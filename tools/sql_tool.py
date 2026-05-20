import logging
import re
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from tools.base import BaseOpsTool, SQLQueryInput
from config.settings import DATABASE_URL

logger = logging.getLogger(__name__)

_DANGEROUS_PATTERNS = [
    r"\bDROP\b", r"\bDELETE\b", r"\bUPDATE\b", r"\bINSERT\b",
    r"\bALTER\b", r"\bCREATE\b", r"\bTRUNCATE\b", r"\bGRANT\b",
    r"\bREVOKE\b", r";.*\b", r"--", r"/\*", r"\bEXEC\b",
]


class SQLQueryTool(BaseOpsTool):
    name: str = "sql_query"
    description: str = "查询CMDB或业务数据库，获取配置信息、服务拓扑、资源关系等数据。仅支持SELECT查询。"
    args_schema: type = SQLQueryInput
    engine: Optional[Engine] = None

    def __init__(self, db_url: str = DATABASE_URL, **kwargs):
        super().__init__(**kwargs)
        try:
            self.engine = create_engine(db_url, pool_size=5, max_overflow=10, pool_pre_ping=True)
            logger.info(f"SQLQueryTool initialized, connected to: {db_url.split('@')[-1] if '@' in db_url else db_url}")
        except Exception as e:
            logger.error(f"Failed to create database engine: {e}")
            self.engine = None

    def _validate_sql(self, sql: str) -> bool:
        upper_sql = sql.upper().strip()
        if not upper_sql.startswith("SELECT"):
            return False
        for pattern in _DANGEROUS_PATTERNS:
            if re.search(pattern, upper_sql):
                return False
        return True

    def _run(self, sql: str) -> str:
        if not self.engine:
            return "错误: 数据库连接未初始化，请检查DATABASE_URL配置"

        if not self._validate_sql(sql):
            return "错误: 仅支持SELECT查询，禁止执行修改操作"

        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(sql))
                rows = result.fetchall()
                columns = list(result.keys())

                if not rows:
                    return "查询结果为空"

                if len(rows) > 100:
                    return f"查询返回{len(rows)}行，仅展示前100行:\n" + self._format_results(columns, rows[:100])

                return self._format_results(columns, rows)
        except Exception as e:
            logger.error(f"SQL query failed: {e}")
            return f"SQL查询失败: {str(e)}"

    @staticmethod
    def _format_results(columns: list, rows: list) -> str:
        header = " | ".join(columns)
        separator = "-" * len(header)
        data_rows = []
        for row in rows:
            data_rows.append(" | ".join(str(v) for v in row))
        return f"{header}\n{separator}\n" + "\n".join(data_rows)
