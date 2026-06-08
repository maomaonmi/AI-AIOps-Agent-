"""
P0: Agent 核心循环引擎

真正的 Agent Loop — 动态决策循环，而非固定阶段流水线：

    while loop_active:
        thought = llm.think(question, history, tools)
        if thought is Final Answer → break
        action = thought.next_tool
        observation = executor.execute(action)
        memory.record(thought, action, observation)

与现有 ReActAgent 完全兼容，复用其 LLM 输出解析逻辑。
"""

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

from langchain_core.language_models import BaseLanguageModel
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import Tool

from agent.core.executor import ToolCallResult, ToolExecutor
from agent.core.memory import ConversationMemory, MemoryConfig, StepRecord
from agent.prompts import REACT_AGENT_PROMPT, BASE_SYSTEM_TEMPLATE
from config.settings import AGENT_MAX_ITERATIONS

logger = logging.getLogger(__name__)


class StepType(str, Enum):
    THOUGHT = "thought"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    FINAL_ANSWER = "final_answer"
    ERROR = "error"


@dataclass
class AgentEvent:
    type: StepType
    step_number: int
    content: str
    data: Optional[Dict[str, Any]] = None
    elapsed_ms: float = 0


@dataclass
class AgentLoopConfig:
    max_steps: int = AGENT_MAX_ITERATIONS
    timeout_seconds: int = 180
    verbose: bool = True
    enable_memory_compression: bool = True
    default_system_instructions: str = BASE_SYSTEM_TEMPLATE
    max_observation_length: int = 800


class AgentLoop:
    def __init__(
        self,
        llm: BaseLanguageModel,
        tools: List[Tool],
        config: Optional[AgentLoopConfig] = None,
        web_search_tool: Optional[Any] = None,
    ):
        self.llm = llm
        self.config = config or AgentLoopConfig()
        self.executor = ToolExecutor(tools, web_search_tool=web_search_tool)
        self.memory = ConversationMemory(
            MemoryConfig(max_steps_before_compress=self.config.max_steps + 4)
        )
        self.tools_description = self.executor.get_tools_description()

    def _parse_llm_output(self, text: str) -> Dict[str, Any]:
        action_match = re.search(r"Action:\s*(.+?)(?:\n|$)", text)
        action_input_match = re.search(r"Action Input:\s*(.+?)(?:\n|$)", text, re.DOTALL)
        final_answer_match = re.search(r"Final Answer:\s*(.*)", text, re.DOTALL)

        if final_answer_match:
            raw_answer = final_answer_match.group(1).strip()
            cleaned = self._clean_final_answer(raw_answer)
            return {"type": "final_answer", "answer": cleaned}

        if action_match:
            action = action_match.group(1).strip()
            action_input = ""
            if action_input_match:
                action_input = action_input_match.group(1).strip()
            return {"type": "action", "action": action, "action_input": action_input}

        thought_match = re.search(r"Thought:\s*(.+)", text, re.DOTALL | re.IGNORECASE)
        if thought_match:
            return {"type": "thought", "thought": thought_match.group(1).strip()}

        return {"type": "thought", "thought": text.strip()[:300]}

    def _clean_final_answer(self, text: str) -> str:
        if not text:
            return ""

        text = text.strip()
        text = re.sub(r'\n\s*Thought:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n\s*Action:.*$', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def _build_prompt(
        self,
        question: str,
        system_instructions: Optional[str] = None,
        web_context: Optional[str] = None,
    ) -> str:
        instructions = system_instructions or self.config.default_system_instructions
        instructions = instructions.replace("{tools_description}", self.tools_description)

        if web_context:
            instructions += f"\n\n## 联网搜索参考信息\n以下来自网络搜索的结果，可作为推理参考：\n{web_context[:2000]}\n"

        prompt = PromptTemplate.from_template(REACT_AGENT_PROMPT).partial(
            system_instructions=instructions,
            tools_description=self.tools_description,
        )

        scratchpad = self.memory.build_scratchpad()
        return prompt.format(input=question, agent_scratchpad=scratchpad)

    def _invoke_llm(self, prompt: str) -> str:
        response = self.llm.invoke(prompt)
        if isinstance(response, str):
            return response
        return response.content if hasattr(response, "content") else str(response)

    async def run_stream(
        self,
        question: str,
        system_instructions: Optional[str] = None,
        web_context: Optional[str] = None,
    ) -> AsyncGenerator[AgentEvent, None]:
        step_number = 0
        start_time = time.time()
        final_answer = ""

        while step_number < self.config.max_steps:
            elapsed_total = time.time() - start_time
            if elapsed_total > self.config.timeout_seconds:
                yield AgentEvent(
                    type=StepType.ERROR,
                    step_number=step_number,
                    content=f"推理超时（{self.config.timeout_seconds}秒），已收集 {step_number} 步分析数据",
                    elapsed_ms=elapsed_total * 1000,
                )
                if self.memory.total_steps > 0:
                    final_answer = await self._generate_summary_answer(question)
                else:
                    final_answer = "抱歉，处理超时。请尝试简化问题或稍后重试。"
                break

            if self.config.verbose:
                logger.info(f"[AgentLoop] Step {step_number + 1}, elapsed: {elapsed_total:.1f}s")

            # ---- Step A: THOUGHT ----
            prompt = self._build_prompt(question, system_instructions, web_context)
            llm_start = time.time()
            llm_output = self._invoke_llm(prompt)
            llm_elapsed = (time.time() - llm_start) * 1000

            parsed = self._parse_llm_output(llm_output)

            if parsed["type"] == "final_answer":
                final_answer = parsed["answer"]
                step_number += 1
                thought_text = self._extract_thought(llm_output)
                if not thought_text or len(thought_text) < 5:
                    thought_text = "这是一个知识性问题，基于已有知识直接回答，无需调用工具采集数据。"

                self.memory.add_step(StepRecord(
                    step_number=step_number,
                    thought=thought_text,
                    is_final=True,
                    final_answer=final_answer,
                    elapsed_ms=llm_elapsed,
                ))

                yield AgentEvent(
                    type=StepType.THOUGHT,
                    step_number=step_number,
                    content=thought_text,
                    data={
                        "llm_elapsed_ms": round(llm_elapsed, 1),
                        "is_final_thought": True,
                    },
                    elapsed_ms=elapsed_total * 1000,
                )

                yield AgentEvent(
                    type=StepType.FINAL_ANSWER,
                    step_number=step_number,
                    content="推理完成，正在生成最终回答...",
                    data={"step_count": self.memory.total_steps},
                    elapsed_ms=elapsed_total * 1000,
                )
                break

            if parsed["type"] == "action":
                action_name = parsed["action"]
                action_input = parsed["action_input"]
                thought_text = self._extract_thought(llm_output)
                step_number += 1

                # yield thought event
                yield AgentEvent(
                    type=StepType.THOUGHT,
                    step_number=step_number,
                    content=thought_text,
                    data={
                        "next_action": action_name,
                        "action_input": action_input,
                        "llm_elapsed_ms": round(llm_elapsed, 1),
                    },
                    elapsed_ms=elapsed_total * 1000,
                )

                # ---- Step B: TOOL CALL ----
                yield AgentEvent(
                    type=StepType.TOOL_CALL,
                    step_number=step_number,
                    content=f"调用工具: {action_name}",
                    data={
                        "tool": action_name,
                        "input": action_input[:200],
                    },
                    elapsed_ms=elapsed_total * 1000,
                )

                # ---- Step C: OBSERVATION ----
                tool_start = time.time()
                result = self.executor.execute(action_name, action_input)
                tool_elapsed = (time.time() - tool_start) * 1000

                raw_result = result.formatted_result
                observation_text = raw_result[:self.config.max_observation_length]

                interpretation = await self._interpret_observation(
                    action_name,observation_text
                )

                yield AgentEvent(
                    type=StepType.TOOL_RESULT,
                    step_number=step_number,
                    content=interpretation,
                    data={
                        "tool": action_name,
                        "success": result.success,
                        "elapsed_ms": round(tool_elapsed, 1),
                        "result_size_bytes": result.result_size_bytes,
                        "full_result_available": True,
                        "has_interpretation": True,
                        "_raw_result": observation_text[:800],
                    },
                    elapsed_ms=elapsed_total * 1000,
                )

                # record step
                self.memory.add_step(StepRecord(
                    step_number=step_number,
                    thought=thought_text,
                    action=action_name,
                    action_input=action_input,
                    observation=observation_text,
                    elapsed_ms=tool_elapsed,
                ))

                # compress memory if needed
                if self.config.enable_memory_compression and self.memory.needs_compression:
                    self.memory.compress(llm=self.llm)

            else:
                # pure thought, no action
                thought_text = parsed.get("thought", llm_output[:300])
                step_number += 1

                yield AgentEvent(
                    type=StepType.THOUGHT,
                    step_number=step_number,
                    content=thought_text,
                    elapsed_ms=elapsed_total * 1000,
                )

                self.memory.add_step(StepRecord(
                    step_number=step_number,
                    thought=thought_text,
                    elapsed_ms=llm_elapsed,
                ))

        # Loop ended without final answer — generate summary
        if not final_answer and self.memory.total_steps > 0:
            final_answer = await self._generate_summary_answer(question)

        if not final_answer:
            final_answer = (
                "抱歉，我无法完成对您问题的分析。\n\n"
                "可能原因：\n"
                "1. 问题描述不够具体，无法确定分析方向\n"
                "2. 所需数据暂时不可用\n\n"
                "建议：尝试用更具体的方式描述问题，或切换模式重试。"
            )

        yield AgentEvent(
            type=StepType.FINAL_ANSWER,
            step_number=step_number,
            content=final_answer,
            data={
                "total_steps": self.memory.total_steps,
                "tool_stats": {
                    "total_calls": self.executor.stats.total_calls,
                    "success_count": self.executor.stats.success_count,
                    "failure_count": self.executor.stats.failure_count,
                },
            },
            elapsed_ms=(time.time() - start_time) * 1000,
        )

    async def _generate_summary_answer(self, question: str) -> str:
        steps_summary = self.memory.build_context_for_llm()

        summary_prompt = f"""基于以下已收集的运维数据和分析过程，请直接给出最终答案和结论。不要调用工具，直接回答。

用户问题: {question}

已收集的数据和分析:
{steps_summary}

请根据以上信息，综合分析并直接给出最终答案。包含问题定位、根因分析和处理建议（如适用）。

Final Answer:"""

        try:
            response = self._invoke_llm(summary_prompt)
            cleaned = self._clean_final_answer(response)
            return cleaned if len(cleaned) >= 10 else f"基于 {self.memory.total_steps} 步分析，系统已完成初步诊断。建议查看推理过程了解详情。"
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return f"分析过程已完成（共 {self.memory.total_steps} 步），但生成总结时出错。请查看推理步骤了解详情。"

    def _extract_thought(self, llm_output: str) -> str:
        match = re.search(r"Thought:\s*(.+?)(?=\n(?:Action:|Final Answer:)|$)", llm_output, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return llm_output[:300].strip()
    
    async def _interpret_observation(self,tool_name: str,raw_output: str) -> str:
        interpretation_prompt = f"""
        你是一个运维助手。请用 1-2 句简洁的中文概括以下工具返回的关键信息。
        不要重复原始数据，而是说明"这意味着什么"或"发现了什么"。用自然语言表达。
        工具名称: {tool_name}
        返回数据(前500字):
        {raw_output[:500]}
        解读（1-2句话）:"""
        try:
            response = self._invoke_llm(interpretation_prompt)
            cleaned = response.strip()
            if len(cleaned) < 5:
                return f"{tool_name} 已返回数据"
            return cleaned[:200]
        except Exception as e:
            logger.error(f"[AgentLoop] Observation interpretation failed: {e}")
            first_line = raw_output.strip().split('\n')[0][:100]
            return f"{tool_name} 返回结果: {first_line}"

    def get_memory_summary(self) -> Dict[str, Any]:
        return self.memory.to_dict()

    def get_executor_stats(self) -> Dict[str, Any]:
        stats = self.executor.stats
        return {
            "total_calls": stats.total_calls,
            "success_count": stats.success_count,
            "failure_count": stats.failure_count,
            "total_elapsed_ms": stats.total_elapsed_ms,
            "calls_by_tool": stats.calls_by_tool,
        }