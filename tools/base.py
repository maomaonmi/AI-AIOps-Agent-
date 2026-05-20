import logging
from typing import Any, Optional, Type

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class BaseOpsTool(BaseTool):
    dangerous: bool = False
    requires_confirmation: bool = False

    def _check_safety(self, **kwargs) -> Optional[str]:
        if self.requires_confirmation:
            return f"⚠️ 该操作 [{self.name}] 属于危险操作，需要用户确认后方可执行"
        return None


class SQLQueryInput(BaseModel):
    sql: str = Field(description="SQL查询语句，仅支持SELECT查询")


class PrometheusQueryInput(BaseModel):
    query: str = Field(description="PromQL查询表达式")
    step: str = Field(default="60s", description="查询步长，默认60s")


class SSHExecInput(BaseModel):
    host: str = Field(description="目标主机IP地址或别名")
    command: str = Field(description="要执行的Shell命令")


class LogSearchInput(BaseModel):
    host: str = Field(default="", description="目标主机IP，为空则搜索所有主机")
    keyword: str = Field(description="搜索关键词或正则表达式")
    time_range: str = Field(default="1h", description="时间范围，如 1h, 30m, 24h")
    index: str = Field(default="app-logs-*", description="Elasticsearch索引模式")


class AlertQueryInput(BaseModel):
    filter: str = Field(default="", description="告警过滤条件，如 service=order-service")
    state: str = Field(default="firing", description="告警状态: firing, pending, resolved")


class KnowledgeSearchInput(BaseModel):
    query: str = Field(description="自然语言检索问题")
    top_k: int = Field(default=5, description="返回结果数量")
