import logging
from typing import List, Dict, Any, Optional

from agent.prompts import BASE_SYSTEM_TEMPLATE, REACT_AGENT_PROMPT
from agent.module_prompts import get_module_prompt

logger = logging.getLogger(__name__)

MODULE_TO_TOOLS = {
    "cpu": ["cpu_check"],
    "memory": ["memory_check"],
    "disk": ["disk_check"],
    "network": ["network_check"],
    "gpu": ["gpu_check"],
    "health": ["system_health"],
    "architecture": ["system_architecture"],
    "prediction": ["trend_prediction"],
    "log": ["log_search"],
    "alert": ["alert_query"],
    "diagnosis": ["cpu_check", "memory_check", "disk_check", "network_check", "gpu_check", "log_search", "alert_query"],
}


class PromptAssembler:
    def __init__(self):
        pass

    def assemble(
        self,
        question: str,
        intent_result: Dict[str, Any],
        all_tools_description: str,
    ) -> str:
        modules = intent_result.get("modules", [])
        needs_chart = intent_result.get("needs_chart", False)

        module_prompts = self._collect_module_prompts(modules)

        selected_tools = self._collect_selected_tools(modules)

        if not modules:
            system_instructions = f"""{BASE_SYSTEM_TEMPLATE.replace('{tools_description}', all_tools_description)}

## 当前场景：通用对话
用户提出了非运维场景的问题，请直接使用你的知识回答，不要调用任何工具。

### 规则
- 不要调用工具
- 如果用户是问候或询问你的能力，友好回答并介绍你能做什么
- 如果是概念性问题，用专业知识解释
"""
        else:
            module_names = "、".join(modules)
            module_sections = "\n\n".join(module_prompts)

            filtered_tools_desc = self._filter_tools_description(all_tools_description, selected_tools)

            chart_instruction = ""
            if needs_chart:
                chart_instruction = """
### 图表数据要求
- 回答中需要包含可供前端生成图表的结构化数据
- 在 Final Answer 中用 ```chart 代码块标注图表数据
- 格式: ```chart\n{"type": "line", "labels": [...], "data": [...]}\n```
"""
            else:
                chart_instruction = """
### 图表要求
- 本次不需要生成图表，只提供文字分析即可
"""

            system_instructions = f"""{BASE_SYSTEM_TEMPLATE.replace('{tools_description}', filtered_tools_desc)}

## 当前场景：{module_names} 相关查询

{module_sections}

{chart_instruction}
"""

        full_prompt = REACT_AGENT_PROMPT.replace(
            "{system_instructions}", system_instructions
        ).replace(
            "{tools_description}", all_tools_description
        )

        logger.info(f"Assembled prompt for modules: {modules}, needs_chart: {needs_chart}")
        return full_prompt

    def _collect_module_prompts(self, modules: List[str]) -> List[str]:
        prompts = []
        for module in modules:
            prompt = get_module_prompt(module)
            if prompt:
                prompts.append(prompt)
            else:
                logger.warning(f"No prompt template found for module: {module}")
        return prompts

    def _collect_selected_tools(self, modules: List[str]) -> set:
        tools = set()
        for module in modules:
            module_tools = MODULE_TO_TOOLS.get(module, [])
            tools.update(module_tools)
        return tools

    def _filter_tools_description(self, all_desc: str, selected_tools: set) -> str:
        if not selected_tools:
            return all_desc

        lines = all_desc.strip().split("\n")
        filtered = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("- "):
                tool_name = stripped[2:].split(":")[0].strip()
                if tool_name in selected_tools:
                    filtered.append(line)
        if not filtered:
            return all_desc
        return "\n".join(filtered)


prompt_assembler = PromptAssembler()