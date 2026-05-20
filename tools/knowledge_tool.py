import logging
from typing import Optional

from tools.base import BaseOpsTool, KnowledgeSearchInput

logger = logging.getLogger(__name__)


class KnowledgeSearchTool(BaseOpsTool):
    name: str = "knowledge_search"
    description: str = (
        "检索私有运维知识库，获取故障处理SOP、架构文档、配置规范等。"
        "当需要了解内部业务逻辑、标准处理流程时使用此工具。"
        "示例: query='Java OOM 处理流程'"
    )
    args_schema: type = KnowledgeSearchInput
    retriever: Optional[object] = None

    def __init__(self, retriever=None, **kwargs):
        super().__init__(**kwargs)
        self.retriever = retriever

    def _run(self, query: str, top_k: int = 5) -> str:
        if self.retriever is None:
            return "知识库未初始化，请先配置RAG模块。参考: rag/ 目录下的初始化脚本"

        try:
            docs = self.retriever.invoke(query)[:top_k]
            if not docs:
                return f"知识库中未找到与 '{query}' 相关的内容"

            results = []
            for i, doc in enumerate(docs, 1):
                source = doc.metadata.get("source", "未知来源")
                content = doc.page_content[:500]
                results.append(f"[{i}] 来源: {source}\n{content}")

            return "\n\n---\n\n".join(results)
        except Exception as e:
            logger.error(f"Knowledge search failed: {e}")
            return f"知识库检索失败: {str(e)}"
