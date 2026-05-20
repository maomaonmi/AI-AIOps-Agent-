import logging
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class PrometheusClient:
    def __init__(self, url: str, timeout: int = 30):
        self.url = url.rstrip('/')
        self.timeout = timeout
        self._available = None

    def check_available(self) -> bool:
        try:
            resp = requests.get(f"{self.url}/-/healthy", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    def query_instant(self, query: str, time: Optional[str] = None) -> Dict[str, Any]:
        params = {"query": query}
        if time:
            params["time"] = time
        try:
            resp = requests.get(
                f"{self.url}/api/v1/query",
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"Prometheus query_instant failed: {e}")
            return {"status": "error", "errorType": "connection_error", "error": str(e)}

    def query_range(
        self,
        query: str,
        start: str,
        end: str,
        step: str = "60s",
    ) -> Dict[str, Any]:
        params = {
            "query": query,
            "start": start,
            "end": end,
            "step": step,
        }
        try:
            resp = requests.get(
                f"{self.url}/api/v1/query_range",
                params=params,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"Prometheus query_range failed: {e}")
            return {"status": "error", "errorType": "connection_error", "error": str(e)}

    def query_metrics(self, metric_name: str, time_range: str = "30m") -> List[Dict[str, Any]]:
        now = datetime.now()
        
        start = now - self._parse_duration(time_range)
        end = now
        step = self._auto_step(time_range)
        
        start_str = str(int(start.timestamp()))
        end_str = str(int(end.timestamp()))
        
        query = f"rate({metric_name}[5m])"
        result = self.query_range(query, start_str, end_str, step)
        
        if result.get("status") != "success":
            return []
        
        metrics = []
        for item in result.get("data", {}).get("result", []):
            metric_labels = item.get("metric", {})
            instance = metric_labels.get("instance", "unknown")
            job = metric_labels.get("job", "")
            
            values = item.get("values", [])
            history = []
            for ts, val in values:
                history.append({
                    "time": datetime.fromtimestamp(ts).strftime("%H:%M"),
                    "value": round(float(val), 2),
                })
            
            current = float(values[-1][1]) * 100 if values and float(values[-1][1]) <= 1 else float(values[-1][1]) if values else 0
            
            metrics.append({
                "name": metric_name,
                "label": instance or job or "unknown",
                "current": round(current, 1),
                "unit": "%" if metric_name and "cpu" in metric_name.lower() else "",
                "status": "critical" if current > 85 else "warning" if current > 70 else "normal",
                "history": history[-20:],
            })
        
        return metrics

    def query_cpu_usage(self, time_range: str = "30m") -> List[Dict[str, Any]]:
        # 使用正确的 PromQL 计算整体 CPU 使用率
        now = datetime.now()
        start = now - self._parse_duration(time_range)
        end = now
        step = self._auto_step(time_range)
        
        start_str = str(int(start.timestamp()))
        end_str = str(int(end.timestamp()))
        
        # 正确的 CPU 使用率计算：1 - idle 比例
        query = '1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))'
        result = self.query_range(query, start_str, end_str, step)
        
        if result.get("status") != "success":
            return []
        
        metrics = []
        for item in result.get("data", {}).get("result", []):
            metric_labels = item.get("metric", {})
            instance = metric_labels.get("instance", "unknown")
            
            values = item.get("values", [])
            history = []
            for ts, val in values:
                history.append({
                    "time": datetime.fromtimestamp(ts).strftime("%H:%M"),
                    "value": round(float(val) * 100, 2),  # 转换为百分比
                })
            
            current = float(values[-1][1]) * 100 if values else 0
            
            metrics.append({
                "name": "cpu_usage",
                "label": instance,
                "current": round(current, 1),
                "unit": "%",
                "status": "critical" if current > 85 else "warning" if current > 70 else "normal",
                "history": history[-20:],
            })
        
        return metrics

    def query_memory_usage(self, time_range: str = "30m") -> List[Dict[str, Any]]:
        now = datetime.now()
        start = now - self._parse_duration(time_range)
        end = now
        step = self._auto_step(time_range)
        
        start_str = str(int(start.timestamp()))
        end_str = str(int(end.timestamp()))
        
        # 内存使用率 = (总内存 - 可用内存) / 总内存 * 100
        query = '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100'
        result = self.query_range(query, start_str, end_str, step)
        
        if result.get("status") != "success":
            return []
        
        metrics = []
        for item in result.get("data", {}).get("result", []):
            metric_labels = item.get("metric", {})
            instance = metric_labels.get("instance", "unknown")
            
            values = item.get("values", [])
            history = []
            for ts, val in values:
                history.append({
                    "time": datetime.fromtimestamp(ts).strftime("%H:%M"),
                    "value": round(float(val), 2),
                })
            
            current = float(values[-1][1]) if values else 0
            
            metrics.append({
                "name": "memory_usage",
                "label": instance,
                "current": round(current, 1),
                "unit": "%",
                "status": "critical" if current > 85 else "warning" if current > 70 else "normal",
                "history": history[-20:],
            })
        
        return metrics

    def query_disk_usage(self, time_range: str = "30m") -> List[Dict[str, Any]]:
        now = datetime.now()
        start = now - self._parse_duration(time_range)
        end = now
        step = self._auto_step(time_range)
        
        start_str = str(int(start.timestamp()))
        end_str = str(int(end.timestamp()))
        
        # 磁盘使用率 = (总容量 - 可用容量) / 总容量 * 100
        query = '(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100'
        result = self.query_range(query, start_str, end_str, step)
        
        if result.get("status") != "success":
            return []
        
        metrics = []
        for item in result.get("data", {}).get("result", []):
            metric_labels = item.get("metric", {})
            instance = metric_labels.get("instance", "unknown")
            mountpoint = metric_labels.get("mountpoint", "/")
            
            values = item.get("values", [])
            history = []
            for ts, val in values:
                history.append({
                    "time": datetime.fromtimestamp(ts).strftime("%H:%M"),
                    "value": round(float(val), 2),
                })
            
            current = float(values[-1][1]) if values else 0
            
            metrics.append({
                "name": "disk_usage",
                "label": f"{instance} ({mountpoint})",
                "current": round(current, 1),
                "unit": "%",
                "status": "critical" if current > 85 else "warning" if current > 70 else "normal",
                "history": history[-20:],
            })
        
        return metrics

    def query_network_traffic(self, time_range: str = "30m") -> List[Dict[str, Any]]:
        now = datetime.now()
        start = now - self._parse_duration(time_range)
        end = now
        step = self._auto_step(time_range)
        
        start_str = str(int(start.timestamp()))
        end_str = str(int(end.timestamp()))
        
        # 网络接收速率
        query = 'rate(node_network_receive_bytes_total{device!="lo"}[5m])'
        result = self.query_range(query, start_str, end_str, step)
        
        if result.get("status") != "success":
            return []
        
        metrics = []
        for item in result.get("data", {}).get("result", []):
            metric_labels = item.get("metric", {})
            instance = metric_labels.get("instance", "unknown")
            device = metric_labels.get("device", "eth0")
            
            values = item.get("values", [])
            history = []
            for ts, val in values:
                # 转换为 KB/s
                history.append({
                    "time": datetime.fromtimestamp(ts).strftime("%H:%M"),
                    "value": round(float(val) / 1024, 2),
                })
            
            current = float(values[-1][1]) / 1024 if values else 0  # KB/s
            
            metrics.append({
                "name": "network_receive",
                "label": f"{instance} ({device})",
                "current": round(current, 1),
                "unit": "KB/s",
                "status": "critical" if current > 100000 else "warning" if current > 50000 else "normal",
                "history": history[-20:],
            })
        
        return metrics

    def query_active_alerts(self) -> List[Dict[str, Any]]:
        try:
            resp = requests.get(
                f"{self.url}/api/v1/alerts",
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            
            if data.get("status") != "success":
                return []
            
            alerts = []
            for alert in data.get("data", {}).get("alerts", []):
                alerts.append({
                    "severity": alert.get("labels", {}).get("severity", "info"),
                    "message": alert.get("annotations", {}).get("summary", alert.get("annotations", {}).get("description", "Unknown alert")),
                    "timestamp": datetime.fromisoformat(alert.get("activeAt", "").replace("Z", "+00:00")).strftime("%H:%M:%S") if alert.get("activeAt") else datetime.now().strftime("%H:%M:%S"),
                    "source": alert.get("labels", {}).get("instance", ""),
                })
            return alerts
        except Exception as e:
            logger.warning(f"Failed to query alerts: {e}")
            return []

    @staticmethod
    def _parse_duration(duration: str) -> timedelta:
        import re
        match = re.match(r"(\d+)([smhd])", duration)
        if not match:
            return timedelta(minutes=30)
        num, unit = int(match.group(1)), match.group(2)
        units = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days"}
        return timedelta(**{units[unit]: num})

    @staticmethod
    def _auto_step(duration: str) -> str:
        import re
        match = re.match(r"(\d+)([smhd])", duration)
        if not match:
            return "60s"
        num, unit = int(match.group(1)), match.group(2)
        if unit == "m":
            return "30s" if num <= 10 else "60s"
        elif unit == "h":
            return "5m" if num <= 1 else "15m"
        elif unit == "d":
            return "1h"
        return "60s"
