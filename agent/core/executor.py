"""
P1: 统一工具调用与结果解析层

封装工具调用的通用逻辑：
- 统一工具调用接口（兼容现有 LangChain Tool）
- 自动记录耗时与调用统计
- 工具结果格式化与截断
- 安全校验检查
- 支持联网搜索工具的注入
"""

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from langchain_core.tools import Tool

logger = logging.getLogger(__name__)


@dataclass
class ToolCallResult:
    tool_name: str
    input_args: Any
    raw_result: str
    formatted_result: str
    elapsed_ms: float
    success: bool
    error: Optional[str] = None
    result_size_bytes: int = 0


@dataclass
class ExecutorStats:
    total_calls: int = 0
    success_count: int = 0
    failure_count: int = 0
    total_elapsed_ms: float = 0
    calls_by_tool: Dict[str, int] = field(default_factory=dict)

    def record(self, result: ToolCallResult) -> None:
        self.total_calls += 1
        if result.success:
            self.success_count += 1
        else:
            self.failure_count += 1
        self.total_elapsed_ms += result.elapsed_ms
        self.calls_by_tool[result.tool_name] = (
            self.calls_by_tool.get(result.tool_name, 0) + 1
        )


class ToolExecutor:
    MAX_RESULT_LENGTH = 2000

    def __init__(self, tools: List[Tool], web_search_tool: Optional[Any] = None):
        self.tools_map: Dict[str, Tool] = {t.name: t for t in tools}
        self.web_search = web_search_tool
        self.stats = ExecutorStats()

    def list_tools(self) -> List[Dict[str, str]]:
        return [
            {"name": name, "description": tool.description}
            for name, tool in self.tools_map.items()
        ]

    def has_tool(self, tool_name: str) -> bool:
        return tool_name in self.tools_map

    def execute(self, tool_name: str, tool_input: Any) -> ToolCallResult:
        start = time.time()

        if tool_name not in self.tools_map:
            result = ToolCallResult(
                tool_name=tool_name,
                input_args=tool_input,
                raw_result="",
                formatted_result=json.dumps({
                    "error": f"工具 '{tool_name}' 不存在",
                    "available_tools": list(self.tools_map.keys()),
                }, ensure_ascii=False),
                elapsed_ms=0,
                success=False,
                error=f"Unknown tool: {tool_name}",
            )
            self.stats.record(result)
            return result

        tool = self.tools_map[tool_name]

        try:
            if isinstance(tool_input, str) and tool_input.strip().startswith("{"):
                try:
                    input_dict = json.loads(tool_input)
                    raw_result = tool.func(**input_dict)
                except (json.JSONDecodeError, TypeError):
                    raw_result = tool.func(tool_input)
            else:
                raw_result = tool.func(tool_input)

            raw_str = str(raw_result) if raw_result is not None else ""
            elapsed = (time.time() - start) * 1000

            result = ToolCallResult(
                tool_name=tool_name,
                input_args=tool_input,
                raw_result=raw_str,
                formatted_result=self._format_result(raw_str),
                elapsed_ms=elapsed,
                success=True,
                result_size_bytes=len(raw_str.encode("utf-8")),
            )
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            error_msg = str(e)
            logger.error(f"Tool '{tool_name}' failed: {error_msg}")

            result = ToolCallResult(
                tool_name=tool_name,
                input_args=tool_input,
                raw_result="",
                formatted_result=json.dumps({
                    "error": f"工具执行失败: {error_msg}",
                }, ensure_ascii=False),
                elapsed_ms=elapsed,
                success=False,
                error=error_msg,
            )

        self.stats.record(result)
        return result

    def _format_result(self, raw: str) -> str:
        if len(raw) <= self.MAX_RESULT_LENGTH:
            return raw

        head = raw[:self.MAX_RESULT_LENGTH // 2]
        tail = raw[-self.MAX_RESULT_LENGTH // 4:]
        return f"{head}\n\n... (中间省略 {len(raw) - len(head) - len(tail)} 字符) ...\n\n{tail}"

    def get_tools_description(self) -> str:
        lines = []
        for name, tool in self.tools_map.items():
            lines.append(f"- {name}: {tool.description}")
        return "\n".join(lines)

    async def execute_web_search(
        self, query: str, max_results: int = 5
    ) -> Optional[Dict[str, Any]]:
        if self.web_search is None:
            return None

        try:
            result = await self.web_search.search(query, max_results=max_results)
            return result
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return {"success": False, "error": str(e), "results": []}

    def register_tool(self, tool: Tool) -> None:
        self.tools_map[tool.name] = tool
        logger.info(f"Registered new tool: {tool.name}")

    def get_stats(self) -> ExecutorStats:
        return self.stats