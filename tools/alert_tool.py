import logging
from typing import Optional

import httpx

from tools.base import BaseOpsTool, AlertQueryInput
from config.settings import ALERTMANAGER_URL

logger = logging.getLogger(__name__)


class AlertManagerTool(BaseOpsTool):
    name: str = "alert_query"
    description: str = (
        "查询AlertManager告警信息，获取当前活跃告警、告警历史等。"
        "可按服务名、严重程度等条件过滤。"
        "示例: filter='service=order-service', state='firing'"
    )
    args_schema: type = AlertQueryInput
    alertmanager_url: str = ALERTMANAGER_URL

    def __init__(self, alertmanager_url: str = ALERTMANAGER_URL, **kwargs):
        super().__init__(**kwargs)
        self.alertmanager_url = alertmanager_url.rstrip("/")

    def _run(self, filter: str = "", state: str = "firing") -> str:
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.get(f"{self.alertmanager_url}/api/v2/alerts")
                resp.raise_for_status()
                alerts = resp.json()

            if not alerts:
                return "当前无活跃告警"

            filtered = self._filter_alerts(alerts, filter, state)
            if not filtered:
                return f"未找到匹配告警 (filter={filter}, state={state})"

            return self._format_alerts(filtered)
        except httpx.HTTPError as e:
            return f"AlertManager查询失败: {str(e)}"
        except Exception as e:
            logger.error(f"Alert query failed: {e}")
            return f"告警查询失败: {str(e)}"

    @staticmethod
    def _filter_alerts(alerts: list, filter_str: str, state: str) -> list:
        result = []
        filter_pairs = {}
        if filter_str:
            for pair in filter_str.split(","):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    filter_pairs[k.strip()] = v.strip()

        for alert in alerts:
            if state and alert.get("status", {}).get("state", "") != state:
                if state == "firing" and alert.get("status", {}).get("silencedBy"):
                    continue
                if state != "firing":
                    continue

            labels = alert.get("labels", {})
            match = True
            for k, v in filter_pairs.items():
                if labels.get(k) != v:
                    match = False
                    break

            if match:
                result.append(alert)

        return result[:50]

    @staticmethod
    def _format_alerts(alerts: list) -> str:
        lines = [f"共 {len(alerts)} 条告警:\n"]
        for alert in alerts:
            labels = alert.get("labels", {})
            annotations = alert.get("annotations", {})
            severity = labels.get("severity", "unknown")
            alertname = labels.get("alertname", "unknown")
            service = labels.get("service", labels.get("job", "unknown"))
            instance = labels.get("instance", "")
            summary = annotations.get("summary", annotations.get("description", ""))

            severity_icon = {"critical": "🔴", "warning": "🟡", "info": "🟢"}.get(severity, "⚪")

            lines.append(
                f"{severity_icon} [{severity.upper()}] {alertname}\n"
                f"  服务: {service} | 实例: {instance}\n"
                f"  描述: {summary[:200]}\n"
            )

        return "\n".join(lines)
