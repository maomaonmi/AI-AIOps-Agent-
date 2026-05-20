import logging
from typing import Optional
from datetime import datetime, timedelta
import json

import httpx

from tools.base import BaseOpsTool, PrometheusQueryInput
from config.settings import PROMETHEUS_URL

logger = logging.getLogger(__name__)

# 常用 PromQL 查询预设
COMMON_QUERIES = {
    "cpu": {
        "query": 'avg by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m])) * 100',
        "label": "CPU使用率",
        "unit": "%",
    },
    "memory": {
        "query": '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100',
        "label": "内存使用率",
        "unit": "%",
    },
    "disk": {
        "query": '(1 - node_filesystem_avail_bytes{fstype!="tmpfs",fstype!="overlay",fstype!~"aufs|squashfs"} / node_filesystem_size_bytes{fstype!="tmpfs",fstype!="overlay",fstype!~"aufs|squashfs"}) * 100',
        "label": "磁盘使用率",
        "unit": "%",
    },
    "network_receive": {
        "query": 'rate(node_network_receive_bytes_total{device!="lo"}[5m])',
        "label": "网络接收速率",
        "unit": "bytes/s",
    },
    "network_transmit": {
        "query": 'rate(node_network_transmit_bytes_total{device!="lo"}[5m])',
        "label": "网络发送速率",
        "unit": "bytes/s",
    },
    "load": {
        "query": 'node_load1',
        "label": "系统负载(1分钟)",
        "unit": "",
    },
    "uptime": {
        "query": 'node_time_seconds - node_boot_time_seconds',
        "label": "运行时间",
        "unit": "秒",
    },
    "filesystem": {
        "query": 'node_filesystem_size_bytes{mountpoint!~"/(run|sys|dev|proc).*"}',
        "label": "文件系统容量",
        "unit": "bytes",
    },
}


class PrometheusTool(BaseOpsTool):
    name: str = "prometheus_query"
    description: str = (
        "查询Prometheus监控指标，支持PromQL表达式。"
        "可查询CPU、内存、磁盘、网络、系统负载等时序数据。"
        "支持自然语言查询，如：'查询CPU使用率'、'查看内存趋势'、'磁盘使用率'。"
        "也可直接传入PromQL表达式进行精确查询。"
        "示例: avg by(instance)(rate(node_cpu_seconds_total{mode!='idle'}[5m])) * 100"
    )
    args_schema: type = PrometheusQueryInput
    prometheus_url: str = PROMETHEUS_URL

    def __init__(self, prometheus_url: str = PROMETHEUS_URL, **kwargs):
        super().__init__(**kwargs)
        self.prometheus_url = prometheus_url.rstrip("/")
        self._available = None

    def _check_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            with httpx.Client(timeout=5) as client:
                resp = client.get(f"{self.prometheus_url}/api/v1/query", params={"query": "up"}, timeout=5)
                self._available = resp.status_code == 200
        except Exception:
            self._available = False
        return self._available

    def _resolve_query(self, query: str) -> tuple:
        """将自然语言查询转换为 PromQL"""
        query_lower = query.lower()

        # 精确匹配预设查询
        for key, config in COMMON_QUERIES.items():
            if key in query_lower:
                return config["query"], config["label"], config["unit"]

        # 模糊匹配
        if any(kw in query_lower for kw in ["cpu", "处理器", "核心"]):
            return COMMON_QUERIES["cpu"]["query"], COMMON_QUERIES["cpu"]["label"], COMMON_QUERIES["cpu"]["unit"]
        if any(kw in query_lower for kw in ["内存", "memory", "ram"]):
            return COMMON_QUERIES["memory"]["query"], COMMON_QUERIES["memory"]["label"], COMMON_QUERIES["memory"]["unit"]
        if any(kw in query_lower for kw in ["磁盘", "disk", "存储", "硬盘"]):
            return COMMON_QUERIES["disk"]["query"], COMMON_QUERIES["disk"]["label"], COMMON_QUERIES["disk"]["unit"]
        if any(kw in query_lower for kw in ["网络", "network", "带宽", "流量"]):
            return COMMON_QUERIES["network_receive"]["query"], COMMON_QUERIES["network_receive"]["label"], COMMON_QUERIES["network_receive"]["unit"]
        if any(kw in query_lower for kw in ["负载", "load"]):
            return COMMON_QUERIES["load"]["query"], COMMON_QUERIES["load"]["label"], COMMON_QUERIES["load"]["unit"]
        if any(kw in query_lower for kw in ["文件", "filesystem", "挂载"]):
            return COMMON_QUERIES["filesystem"]["query"], COMMON_QUERIES["filesystem"]["label"], COMMON_QUERIES["filesystem"]["unit"]

        # 如果包含 PromQL 关键字，直接当作 PromQL 处理
        if any(kw in query for kw in ["rate(", "increase(", "avg(", "sum(", "max(", "min(", "histogram_quantile"]):
            return query, "自定义查询", ""

        return None, None, None

    def _query_range_data(self, promql: str, range_minutes: int = 60) -> list:
        """查询时序数据"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(minutes=range_minutes)
            step = "60s" if range_minutes <= 60 else "300s"

            with httpx.Client(timeout=30) as client:
                resp = client.get(
                    f"{self.prometheus_url}/api/v1/query_range",
                    params={
                        "query": promql,
                        "start": start_time.timestamp(),
                        "end": end_time.timestamp(),
                        "step": step,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            if data.get("status") != "success":
                return []

            results = data.get("data", {}).get("result", [])
            return results
        except Exception as e:
            logger.error(f"Range query failed: {e}")
            return []

    def _query_instant_data(self, promql: str) -> list:
        """查询瞬时数据"""
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.get(
                    f"{self.prometheus_url}/api/v1/query",
                    params={"query": promql},
                )
                resp.raise_for_status()
                data = resp.json()

            if data.get("status") != "success":
                return []

            return data.get("data", {}).get("result", [])
        except Exception as e:
            logger.error(f"Instant query failed: {e}")
            return []

    def _format_time_series(self, results: list, label: str, unit: str) -> str:
        """格式化时序数据"""
        if not results:
            return f"查询结果: {label} - 无数据"

        lines = [f"=== {label} ==="]

        for r in results:
            metric_labels = r.get("metric", {})
            instance = metric_labels.get("instance", metric_labels.get("pod", "unknown"))
            mountpoint = metric_labels.get("mountpoint", "")
            device = metric_labels.get("device", "")

            values = r.get("values", [])
            if not values:
                continue

            # 最新值
            latest_ts, latest_val = values[-1]
            latest_time = datetime.fromtimestamp(float(latest_ts)).strftime("%H:%M:%S")

            # 统计信息
            numeric_values = [float(v[1]) for v in values if v[1] != "NaN"]
            if numeric_values:
                avg_val = sum(numeric_values) / len(numeric_values)
                max_val = max(numeric_values)
                min_val = min(numeric_values)

                identifier = instance
                if mountpoint:
                    identifier = f"{instance} ({mountpoint})"
                if device:
                    identifier = f"{instance} ({device})"

                lines.append(f"实例: {identifier}")
                try:
                    latest_val_float = float(latest_val)
                    lines.append(f"  当前值: {latest_val_float:.2f}{unit} (时间: {latest_time})")
                except (ValueError, TypeError):
                    lines.append(f"  当前值: {latest_val}{unit} (时间: {latest_time})")
                lines.append(f"  平均值: {avg_val:.2f}{unit}")
                lines.append(f"  最大值: {max_val:.2f}{unit}")
                lines.append(f"  最小值: {min_val:.2f}{unit}")
                lines.append(f"  数据点数: {len(values)}")
                lines.append("")

        return "\n".join(lines) if len(lines) > 1 else f"查询结果: {label} - 无有效数据"

    def _format_instant(self, results: list, label: str, unit: str) -> str:
        """格式化瞬时数据"""
        if not results:
            return f"查询结果: {label} - 无数据"

        lines = [f"=== {label} (实时) ==="]

        for r in results:
            metric_labels = r.get("metric", {})
            instance = metric_labels.get("instance", "unknown")
            mountpoint = metric_labels.get("mountpoint", "")
            device = metric_labels.get("device", "")

            value = r.get("value", [None, "N/A"])
            val = value[1] if len(value) > 1 else "N/A"

            try:
                val_float = float(val)
                val_str = f"{val_float:.2f}{unit}"
            except (ValueError, TypeError):
                val_str = f"{val}{unit}"

            identifier = instance
            if mountpoint:
                identifier = f"{instance} ({mountpoint})"
            if device:
                identifier = f"{instance} ({device})"

            lines.append(f"  {identifier}: {val_str}")

        return "\n".join(lines)

    def _run(self, query: str, step: str = "60s") -> str:
        if not self._check_available():
            return f"Prometheus 服务不可用 ({self.prometheus_url})，请检查服务是否启动。"

        # 解析查询
        promql, label, unit = self._resolve_query(query)

        if not promql:
            return f"无法识别查询意图: '{query}'。支持的查询: CPU使用率、内存使用率、磁盘使用率、网络流量、系统负载、文件系统。也可直接传入PromQL表达式。"

        logger.info(f"Resolved query '{query}' -> PromQL: {promql}")

        # 先尝试范围查询
        range_results = self._query_range_data(promql, range_minutes=60)

        if range_results:
            return self._format_time_series(range_results, label, unit)

        # 范围查询无数据，尝试瞬时查询
        instant_results = self._query_instant_data(promql)

        if instant_results:
            return self._format_instant(instant_results, label, unit)

        return f"查询 '{label}' 在 Prometheus 中无数据。请确认 Node Exporter 正在采集指标。"
