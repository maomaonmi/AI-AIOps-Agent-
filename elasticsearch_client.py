import logging
import requests
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ElasticsearchClient:
    def __init__(self, url: str, timeout: int = 30):
        self.url = url.rstrip('/')
        self.timeout = timeout
        self._available = None

    def check_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            resp = requests.get(self.url, timeout=5)
            self._available = resp.status_code == 200
        except Exception:
            self._available = False
        return self._available

    def search(self, index: str = "*", query: Optional[Dict] = None, size: int = 20) -> Dict[str, Any]:
        body = {
            "size": size,
            "sort": [{"@timestamp": {"order": "desc"}}],
        }
        if query:
            body["query"] = query
        else:
            body["query"] = {"match_all": {}}

        try:
            resp = requests.post(
                f"{self.url}/{index}/_search",
                json=body,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"ES search failed: {e}")
            return {"error": str(e)}

    def search_by_service(self, service: str, symptom: str = None, hours: int = 1) -> List[Dict[str, Any]]:
        query = {
            "bool": {
                "must": [
                    {"match": {"service": service}},
                    {"range": {"@timestamp": {"gte": f"now-{hours}h"}}},
                ]
            }
        }
        
        if symptom:
            query["bool"]["must"].append({"match": {"message": symptom}})
        
        result = self.search(index="logs-*", query=query, size=50)
        
        if "error" in result:
            return []
        
        logs = []
        for hit in result.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            logs.append({
                "type": "log",
                "source": source.get("service", service),
                "content": source.get("message", ""),
                "relevance": 0.8,
                "timestamp": source.get("@timestamp", datetime.now().isoformat()),
            })
        
        return logs

    def search_errors(self, service: str = None, hours: int = 1) -> List[Dict[str, Any]]:
        query = {
            "bool": {
                "must": [
                    {"match": {"level": "ERROR"}},
                    {"range": {"@timestamp": {"gte": f"now-{hours}h"}}},
                ]
            }
        }
        
        if service:
            query["bool"]["must"].append({"match": {"service": service}})
        
        result = self.search(index="logs-*", query=query, size=30)
        
        if "error" in result:
            return []
        
        errors = []
        for hit in result.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            errors.append({
                "type": "log",
                "source": source.get("service", "unknown"),
                "content": source.get("message", ""),
                "relevance": 0.9,
                "timestamp": source.get("@timestamp", datetime.now().isoformat()),
            })
        
        return errors

    def search_trace_data(self, service: str, symptom: str = None) -> List[Dict[str, Any]]:
        query = {
            "bool": {
                "must": [
                    {"match": {"service": service}},
                    {"range": {"@timestamp": {"gte": "now-1h"}}},
                ]
            }
        }
        
        if symptom:
            query["bool"]["must"].append({"match": {"trace": symptom}})
        
        result = self.search(index="traces-*", query=query, size=20)
        
        if "error" in result:
            return []
        
        traces = []
        for hit in result.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            traces.append({
                "type": "trace",
                "source": source.get("service", service),
                "content": source.get("trace_summary", source.get("message", "")),
                "relevance": 0.85,
                "timestamp": source.get("@timestamp", datetime.now().isoformat()),
            })
        
        return traces

    def get_metrics_summary(self, service: str = None) -> List[Dict[str, Any]]:
        query = {
            "bool": {
                "must": [
                    {"range": {"@timestamp": {"gte": "now-1h"}}},
                ]
            }
        }
        
        if service:
            query["bool"]["must"].append({"match": {"service": service}})
        
        result = self.search(index="metrics-*", query=query, size=50)
        
        if "error" in result:
            return []
        
        metrics = []
        for hit in result.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            metrics.append({
                "type": "metric",
                "source": source.get("source", "prometheus"),
                "content": f"{source.get('metric_name', '')}: {source.get('value', '')}",
                "relevance": 0.7,
                "timestamp": source.get("@timestamp", datetime.now().isoformat()),
            })
        
        return metrics
