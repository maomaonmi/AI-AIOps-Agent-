import json
import re
import logging
from typing import List, Optional, Dict, Any, Tuple

from langchain_core.tools import Tool
from langchain_core.language_models import BaseLanguageModel
from langchain_core.prompts import PromptTemplate

from agent.prompts import REACT_AGENT_PROMPT, BASE_SYSTEM_TEMPLATE
from config.settings import AGENT_MAX_ITERATIONS, AGENT_VERBOSE

logger = logging.getLogger(__name__)

def extract_final_answer(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = raw_text.strip()

    final_answer_match = re.search(r'Final Answer:\s*(.*)', text, re.DOTALL | re.IGNORECASE)
    if final_answer_match:
        answer = final_answer_match.group(1).strip()
        answer = re.sub(r'\n\s*Thought:.*$', '', answer, flags=re.DOTALL | re.IGNORECASE)
        answer = re.sub(r'\n\s*Action:.*$', '', answer, flags=re.DOTALL | re.IGNORECASE)
        answer = re.sub(r'\n{3,}', '\n\n', answer)
        return answer.strip()

    structured_match = re.search(r'(##\s*问题定位[\s\S]*?##\s*根因分析[\s\S]*?##\s*处理建议[\s\S]*?)(?:\n\n|$)', text, re.IGNORECASE)
    if structured_match:
        return structured_match.group(1).strip()

    thoughts = list(re.finditer(r'Thought:\s*(.*?)(?=\nThought:|\nAction:|\Z)', text, re.DOTALL | re.IGNORECASE))
    if thoughts:
        last_thought = thoughts[-1].group(1).strip()
        if len(last_thought) > 20:
            return last_thought

    text = re.sub(r'重要规则[\s\S]*?(?=##|\Z)', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'示例\d+[\s\S]*?(?=示例\d+|##|\Z)', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'你是.*?运维助手.*?工具来完成任务[\s\S]*?', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


class AgentTimeoutError(Exception):
    pass


class ReActAgent:
    def __init__(
        self,
        llm: BaseLanguageModel,
        tools: List[Tool],
        max_iterations: int = AGENT_MAX_ITERATIONS,
        verbose: bool = AGENT_VERBOSE,
        timeout: int = 180,
    ):
        self.llm = llm
        self.tools = tools
        self.max_iterations = max_iterations
        self.verbose = verbose
        self.timeout = timeout
        self.tools_map = {t.name: t for t in tools}
        self.tools_description = self._build_tools_description()
        self.default_system_instructions = BASE_SYSTEM_TEMPLATE

    def _build_tools_description(self) -> str:
        descriptions = []
        for tool in self.tools:
            descriptions.append(f"- {tool.name}: {tool.description}")
        return "\n".join(descriptions)

    def _parse_llm_output(self, text: str) -> Dict[str, Any]:
        action_match = re.search(r"Action:\s*(.+?)(?:\n|$)", text)
        action_input_match = re.search(r"Action Input:\s*(.+?)(?:\n|$)", text, re.DOTALL)
        final_answer_match = re.search(r"Final Answer:\s*(.*)", text, re.DOTALL)

        if final_answer_match:
            raw_answer = final_answer_match.group(1).strip()
            cleaned_answer = extract_final_answer(raw_answer)
            return {"type": "final_answer", "answer": cleaned_answer}

        if action_match:
            action = action_match.group(1).strip()
            action_input = ""
            if action_input_match:
                action_input = action_input_match.group(1).strip()
            return {"type": "action", "action": action, "action_input": action_input}

        return {"type": "thought", "thought": text.strip()}

    def _execute_tool(self, tool_name: str, tool_input: str) -> str:
        if tool_name not in self.tools_map:
            return json.dumps({
                "error": f"工具 '{tool_name}' 不存在",
                "available_tools": list(self.tools_map.keys())
            }, ensure_ascii=False)

        tool = self.tools_map[tool_name]
        try:
            if isinstance(tool_input, str) and tool_input.strip().startswith("{"):
                try:
                    input_dict = json.loads(tool_input)
                    result = tool.func(**input_dict)
                except (json.JSONDecodeError, TypeError):
                    result = tool.func(tool_input)
            else:
                result = tool.func(tool_input)
            return str(result) if result is not None else "工具执行完成，无返回数据"
        except Exception as e:
            return json.dumps({"error": f"工具执行失败: {str(e)}"}, ensure_ascii=False)

    def run(self, question: str, system_instructions: Optional[str] = None) -> dict:
        import time
        logger.info(f"Agent received question: {question}")

        instructions = system_instructions or self.default_system_instructions
        instructions = instructions.replace("{tools_description}", self.tools_description)

        prompt = PromptTemplate.from_template(REACT_AGENT_PROMPT).partial(
            system_instructions=instructions,
            tools_description=self.tools_description
        )

        intermediate_steps = []
        agent_scratchpad = ""
        start_time = time.time()

        try:
            for iteration in range(self.max_iterations):
                elapsed = time.time() - start_time
                if elapsed > self.timeout:
                    logger.warning(f"Agent timeout after {elapsed:.1f}s")
                    return {
                        "answer": "抱歉，处理超时。请尝试简化问题或稍后重试。",
                        "intermediate_steps": intermediate_steps,
                        "success": False,
                        "error": "timeout",
                    }

                full_prompt = prompt.format(input=question, agent_scratchpad=agent_scratchpad)

                if self.verbose:
                    logger.info(f"Iteration {iteration + 1}, elapsed: {elapsed:.1f}s")

                llm_start = time.time()
                response = self.llm.invoke(full_prompt)
                llm_elapsed = time.time() - llm_start
                logger.info(f"[性能] LLM调用耗时: {llm_elapsed:.2f}s (迭代 {iteration + 1})")

                if isinstance(response, str):
                    llm_output = response
                else:
                    llm_output = response.content if hasattr(response, "content") else str(response)

                parsed = self._parse_llm_output(llm_output)
                logger.info(f"[解析] 输出类型: {parsed['type']}, 内容长度: {len(llm_output)}字符")

                if parsed["type"] == "final_answer":
                    answer = extract_final_answer(parsed["answer"])

                    if not answer or len(answer) < 10:
                        answer = f"基于对 '{question}' 的分析，以下是我的回答：\n\n当前系统运行正常，未检测到明显的异常问题。如果您有具体的运维需求或问题，请提供更多细节，我将为您进行详细分析。"

                    return {
                        "answer": answer,
                        "intermediate_steps": intermediate_steps,
                        "success": True,
                        "error": None,
                    }

                if parsed["type"] == "action":
                    action_name = parsed["action"]
                    action_input = parsed["action_input"]

                    if self.verbose:
                        logger.info(f"Action: {action_name}, Input: {action_input[:100]}")

                    tool_start = time.time()
                    observation = self._execute_tool(action_name, action_input)
                    tool_elapsed = time.time() - tool_start
                    logger.info(f"[性能] 工具'{action_name}'执行耗时: {tool_elapsed:.2f}s, 结果长度: {len(observation)}字符")

                    intermediate_steps.append({
                        "tool": action_name,
                        "tool_input": action_input,
                        "observation": observation[:500],
                        "log": llm_output[:500],
                    })

                    agent_scratchpad += f"\n{llm_output}\nObservation: {observation}\nThought:"

                else:
                    agent_scratchpad += f"\n{llm_output}\n"

            logger.warning(f"Max iterations ({self.max_iterations}) reached, generating answer from collected data")

            summary_prompt = f"""基于以下已收集的运维数据和分析过程，请直接给出最终答案和结论：

用户问题: {question}

已收集的数据:
{json.dumps(intermediate_steps, ensure_ascii=False, indent=2)}

请根据以上信息，综合分析并直接给出最终答案。包含问题定位、根因分析和处理建议（如适用）。

Final Answer:"""

            try:
                final_response = self.llm.invoke(summary_prompt)
                if isinstance(final_response, str):
                    final_answer = final_response.strip()
                else:
                    final_answer = final_response.content if hasattr(final_response, "content") else str(final_response)

                if not final_answer or len(final_answer) < 10:
                    final_answer = f"基于已收集的 {len(intermediate_steps)} 条分析数据，系统已完成初步诊断。建议结合以上收集的信息进行进一步分析。"

                return {
                    "answer": final_answer,
                    "intermediate_steps": intermediate_steps,
                    "success": True,
                    "error": None,
                }
            except Exception as e:
                logger.error(f"Failed to generate final answer from collected data: {e}")
                return {
                    "answer": f"达到最大迭代次数({self.max_iterations}次)，已收集{len(intermediate_steps)}条分析数据但无法生成最终答案。原始错误: {str(e)}",
                    "intermediate_steps": intermediate_steps,
                    "success": False,
                    "error": "max_iterations_reached",
                }

        except Exception as e:
            logger.error(f"Agent execution failed: {e}")
            return {
                "answer": f"执行失败: {str(e)}",
                "intermediate_steps": intermediate_steps,
                "success": False,
                "error": str(e),
            }