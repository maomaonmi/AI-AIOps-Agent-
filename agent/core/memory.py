"""
P2: 上下文管理与轻量压缩模块

提供 AgentLoop 的短期记忆管理能力：
- 记录每轮 Thought/Action/Observation
- 自动检测 Token 增长趋势
- 轻量压缩：将旧推理步骤总结为关键结论
- 支持流式输出记忆摘要
"""

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


@dataclass
class MemoryConfig:
    max_steps_before_compress: int = 8
    max_raw_steps: int = 6
    compression_prompt: str = (
        "请将以下多步推理过程压缩为一段简洁的摘要，保留以下关键信息：\n"
        "1. 调用了哪些工具及其原因\n"
        "2. 每个工具返回的核心数据/结论\n"
        "3. 推理链条中发现的因果关系\n"
        "4. 已排除的假设\n\n"
        "仅输出压缩后的摘要，不要添加额外的解释或格式标记。"
    )


@dataclass
class StepRecord:
    step_number: int
    thought: str
    action: Optional[str] = None
    action_input: Optional[str] = None
    observation: Optional[str] = None
    elapsed_ms: float = 0
    is_final: bool = False
    final_answer: Optional[str] = None


@dataclass
class CompressedMemory:
    summary: str
    original_step_count: int
    compressed_at: float
    key_findings: List[str] = field(default_factory=list)


class ConversationMemory:
    def __init__(self, config: Optional[MemoryConfig] = None):
        self.config = config or MemoryConfig()
        self.steps: List[StepRecord] = []
        self.compressed: Optional[CompressedMemory] = None
        self.key_conclusions: List[str] = []

    def add_step(self, step: StepRecord) -> None:
        self.steps.append(step)

    def add_conclusion(self, conclusion: str) -> None:
        self.key_conclusions.append(conclusion)

    @property
    def total_steps(self) -> int:
        return len(self.steps)

    @property
    def needs_compression(self) -> bool:
        return self.total_steps >= self.config.max_steps_before_compress

    def build_context_for_llm(self) -> str:
        parts = []

        if self.compressed:
            parts.append(f"[已压缩历史]\n{self.compressed.summary}\n")

        raw_steps = self.steps[-self.config.max_raw_steps:]
        for step in raw_steps:
            parts.append(self._format_step(step))

        return "\n".join(parts) if parts else ""

    def build_scratchpad(self) -> str:
        lines = []
        all_steps = self.steps

        if self.compressed:
            lines.append(f"[历史摘要] {self.compressed.summary}")

        for i, step in enumerate(all_steps):
            if step.is_final:
                continue
            lines.append(f"Thought: {step.thought}")
            if step.action:
                lines.append(f"Action: {step.action}")
                lines.append(f"Action Input: {step.action_input or ''}")
                lines.append(f"Observation: {step.observation or ''}")

        return "\n".join(lines)

    def compress(self, llm=None) -> Optional[str]:
        if self.total_steps < 3:
            return None

        compressible_steps = self.steps[:max(1, self.total_steps - self.config.max_raw_steps)]
        if not compressible_steps:
            return None

        raw_text = "\n---\n".join(
            self._format_full_step(s) for s in compressible_steps
        )

        if llm:
            try:
                prompt = (
                    f"{self.config.compression_prompt}\n\n"
                    f"## 需要压缩的推理步骤\n{raw_text}\n\n"
                    f"## 关键结论\n" + "\n".join(f"- {c}" for c in self.key_conclusions)
                )
                response = llm.invoke(prompt)
                summary = response.content if hasattr(response, "content") else str(response)
            except Exception as e:
                logger.warning(f"Compression via LLM failed: {e}")
                summary = self._simple_compress(compressible_steps)
        else:
            summary = self._simple_compress(compressible_steps)

        findings = self._extract_key_findings(compressible_steps)

        self.compressed = CompressedMemory(
            summary=summary.strip(),
            original_step_count=len(compressible_steps),
            compressed_at=time.time(),
            key_findings=findings,
        )

        self.steps = self.steps[len(compressible_steps):]
        logger.info(f"Memory compressed: {len(compressible_steps)} steps → {len(summary)} chars")

        return summary

    def _simple_compress(self, steps: List[StepRecord]) -> str:
        tools_called = []
        key_data = []
        for s in steps:
            if s.action:
                tools_called.append(s.action)
            if s.observation and len(s.observation) < 200:
                key_data.append(s.observation[:150])
        return f"已调用工具: {', '.join(tools_called[:8])}。关键发现: {'; '.join(key_data[:5])}"

    def _extract_key_findings(self, steps: List[StepRecord]) -> List[str]:
        findings = []
        for s in steps:
            if s.observation and len(s.observation) < 150:
                findings.append(s.observation[:120])
        return findings[:5]

    def _format_step(self, step: StepRecord) -> str:
        parts = [f"Step {step.step_number}:"]
        parts.append(f"  Thought: {step.thought[:200]}")
        if step.action:
            parts.append(f"  → Called {step.action} ({step.elapsed_ms:.0f}ms)")
        if step.observation and len(step.observation) < 300:
            parts.append(f"  Result: {step.observation[:250]}")
        return "\n".join(parts)

    def _format_full_step(self, step: StepRecord) -> str:
        parts = [f"## Step {step.step_number}"]
        parts.append(f"分析: {step.thought}")
        if step.action:
            parts.append(f"调用工具: {step.action}")
            parts.append(f"工具参数: {step.action_input or ''}")
            parts.append(f"工具结果: {step.observation or ''}")
        return "\n".join(parts)

    def clear(self) -> None:
        self.steps.clear()
        self.compressed = None
        self.key_conclusions.clear()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_steps": self.total_steps,
            "steps": [
                {
                    "step": s.step_number,
                    "thought": s.thought[:300],
                    "action": s.action,
                    "observation": s.observation[:300] if s.observation else None,
                    "elapsed_ms": s.elapsed_ms,
                }
                for s in self.steps[-10:]
            ],
            "compressed": {
                "summary": self.compressed.summary,
                "original_count": self.compressed.original_step_count,
            } if self.compressed else None,
        }