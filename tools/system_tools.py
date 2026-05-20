import json
import logging
from typing import Any, Optional, Type

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class SystemHealthInput(BaseModel):
    query: str = Field(default="", description="查询描述，无需具体参数")


class SystemArchitectureInput(BaseModel):
    query: str = Field(default="", description="查询描述，无需具体参数")


class TrendPredictionInput(BaseModel):
    target: str = Field(default="cpu", description="预测目标指标: cpu, memory, disk")
    hours: int = Field(default=24, description="预测时长（小时），默认24小时")


class SystemHealthTool:
    name: str = "system_health"
    description: str = (
        "获取系统综合健康检查报告，包括CPU、内存、磁盘、网络、GPU各项健康评分、"
        "状态及优化建议。返回: 综合评分(0-100)、各分类评分、具体的问题列表和操作建议。"
    )

    def _run(self, query: str = "") -> str:
        try:
            from tools.health_tool import get_system_health
            report = get_system_health()

            lines = [
                "═══════════════════════════════════",
                f"  系统健康报告 - {report.hostname}",
                "═══════════════════════════════════",
                f"  综合评分: {report.overall_score}/100 ({report.grade})",
                f"  操作系统: {report.os_info}",
                f"  运行时间: {report.uptime}",
                f"  检测时间: {report.check_time}",
                "───────────────────────────────────",
            ]

            for cat in report.categories:
                lines.append(f"  [{cat.category}] {cat.status} (评分: {cat.category_score})")
                for item in cat.items:
                    if item.status == "正常":
                        lines.append(f"    ✓ {item.name}: {item.value} ({item.detail})")
                    else:
                        lines.append(f"    ✗ {item.name}: {item.value} - {item.detail}")

            lines.append("───────────────────────────────────")
            lines.append("  [优化建议]")
            for i, rec in enumerate(report.recommendations, 1):
                lines.append(f"    {i}. {rec}")
            lines.append("═══════════════════════════════════")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"System health check failed: {e}")
            return f"系统健康检查失败: {str(e)}"


class SystemArchitectureTool:
    name: str = "system_architecture"
    description: str = (
        "获取系统完整架构报告，包括操作系统信息、CPU型号和核心数、内存容量、"
        "所有磁盘分区、GPU信息、网络接口详情、运行时环境(Python/Node等版本)。"
        "用于了解系统软硬件配置全景。"
    )

    def _run(self, query: str = "") -> str:
        try:
            from tools.arch_tool import get_architecture_report
            report = get_architecture_report()

            lines = [
                "═══════════════════════════════════",
                f"  系统架构报告 - {report.hostname}",
                "═══════════════════════════════════",
                f"  报告时间: {report.report_time}",
                "",
                "  [操作系统]",
                f"    系统: {report.os.system} {report.os.release}",
                f"    版本: {report.os.version}",
                f"    主机名: {report.os.hostname}",
                f"    架构: {report.os.architecture} ({report.os.machine})",
                f"    内核: {report.os.kernel}" if report.os.kernel else "",
                f"    运行时间: {report.os.uptime}",
                f"    启动时间: {report.os.boot_time}",
                "",
                "  [CPU]",
                f"    处理器: {report.cpu.processor}",
                f"    架构: {report.cpu.architecture}",
                f"    物理核心: {report.cpu.cores_physical}, 逻辑核心: {report.cpu.cores_logical}",
                f"    频率: {report.cpu.frequency_ghz:.1f}GHz",
                f"    当前使用率: {report.cpu.usage_percent:.1f}%",
                f"    温度: {report.cpu.temperature}°C" if report.cpu.temperature > 0 else "",
                "",
                "  [内存]",
                f"    总容量: {report.memory.total_gb:.1f}GB",
                f"    可用: {report.memory.available_gb:.1f}GB",
                f"    已用: {report.memory.used_gb:.1f}GB",
                "",
            ]

            lines.append("  [磁盘]")
            for disk in report.disks:
                lines.append(
                    f"    {disk.device} {disk.mount_point}: "
                    f"{disk.used_gb:.1f}/{disk.total_gb:.1f}GB ({disk.percent:.1f}%) "
                    f"[{disk.fstype}] {'SSD' if disk.is_ssd else 'HDD'}"
                )

            lines.append("")
            lines.append("  [GPU]")
            if report.gpus:
                for gpu in report.gpus:
                    lines.append(f"    {gpu.name} ({gpu.memory_total_gb:.1f}GB)")
                    lines.append(f"    驱动: {gpu.driver_version}, CUDA: {gpu.cuda_version}")
            else:
                lines.append("    未检测到GPU")

            lines.append("")
            lines.append("  [网络]")
            for net in report.networks:
                ips = ", ".join(net.ipv4_addresses) if net.ipv4_addresses else "无IP"
                lines.append(
                    f"    {net.name} [{net.nic_type}] "
                    f"{'UP' if net.is_up else 'DOWN'} "
                    f"{net.speed_mbps}Mbps | IP: {ips}"
                )

            lines.append("")
            lines.append("  [运行时]")
            lines.append(f"    Python: {report.runtime.python_version}")
            if report.runtime.node_version != "N/A":
                lines.append(f"    Node.js: {report.runtime.node_version}")
            if report.runtime.pip_version != "N/A":
                lines.append(f"    pip: {report.runtime.pip_version}")

            lines.append("═══════════════════════════════════")

            return "\n".join(l for l in lines if l)
        except Exception as e:
            logger.error(f"Architecture report failed: {e}")
            return f"架构报告生成失败: {str(e)}"


class TrendPredictionTool:
    name: str = "trend_prediction"
    description: str = (
        "对系统资源使用趋势进行预测分析。"
        "参数: target(预测目标: cpu/memory/disk), hours(预测时长，默认24小时)。"
        "返回: 当前值、趋势方向、预测数据点(含置信区间)、是否超阈值、超阈值时间、异常预警。"
    )

    def _run(self, target: str = "cpu", hours: int = 24) -> str:
        try:
            from tools.prediction_tool import get_trend_prediction, _predict_metric

            if target not in ("cpu", "memory", "disk"):
                target = "cpu"

            report = get_trend_prediction(hours=hours)

            target_pred = None
            for pred in report.predictions:
                if target in pred.metric_name.lower():
                    target_pred = pred
                    break

            lines = [
                "═══════════════════════════════════",
                f"  趋势预测报告 ({hours}小时)",
                "═══════════════════════════════════",
                f"  预测时间: {report.prediction_time}",
                "",
            ]

            for pred in report.predictions:
                trend_icon = {"上升": "↑", "下降": "↓", "稳定": "→"}.get(pred.trend, "?")
                lines.append(
                    f"  [{pred.metric_name}] 当前: {pred.current_value}{pred.unit} "
                    f" 趋势: {trend_icon}{pred.trend} "
                    f"(变化: {'+' if pred.predicted_change > 0 else ''}{pred.predicted_change:.1f}{pred.unit})"
                )
                if pred.will_exceed_threshold:
                    lines.append(f"    ⚠ 预计 {pred.exceed_time} 超过阈值({pred.warning_threshold}{pred.unit})")
                else:
                    lines.append(f"    ✓ 预测期内不会超过阈值")

            lines.append("")
            lines.append("  [综合摘要]")
            lines.append(f"  {report.summary}")

            if report.anomalies:
                lines.append("")
                lines.append("  [异常预警]")
                for anom in report.anomalies:
                    lines.append(f"    ⛔ [{anom.severity}风险] {anom.description} (置信度: {anom.confidence:.0%})")

            lines.append("═══════════════════════════════════")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Trend prediction failed: {e}")
            return f"趋势预测失败: {str(e)}"