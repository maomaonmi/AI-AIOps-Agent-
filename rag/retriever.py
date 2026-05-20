import logging
import os
from typing import List, Optional

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from rag.vectorstore import OpsVectorStore
from config.settings import RAG_KNOWLEDGE_DIR, RAG_VECTORSTORE_DIR, BGE_MODEL_PATH

logger = logging.getLogger(__name__)

CHUNK_SIZE = 512
CHUNK_OVERLAP = 64


class OpsRetriever:
    def __init__(
        self,
        knowledge_dir: str = RAG_KNOWLEDGE_DIR,
        vectorstore_dir: str = RAG_VECTORSTORE_DIR,
        embedding_model_name: str = BGE_MODEL_PATH,
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP,
    ):
        self.knowledge_dir = knowledge_dir
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", "。", "；", "，", " ", ""],
            length_function=len,
        )
        self.vectorstore = OpsVectorStore(
            vectorstore_dir=vectorstore_dir,
            embedding_model_name=embedding_model_name,
        )

    def load_documents_from_dir(self, dir_path: Optional[str] = None) -> List[Document]:
        load_dir = dir_path or self.knowledge_dir
        if not os.path.exists(load_dir):
            logger.warning(f"Knowledge directory not found: {load_dir}")
            return []

        documents = []
        for root, _, files in os.walk(load_dir):
            for filename in files:
                filepath = os.path.join(root, filename)
                if filename.endswith((".md", ".txt", ".rst")):
                    docs = self._load_text_file(filepath)
                    documents.extend(docs)
                elif filename.endswith(".json"):
                    docs = self._load_json_file(filepath)
                    documents.extend(docs)

        logger.info(f"Loaded {len(documents)} documents from {load_dir}")
        return documents

    def _load_text_file(self, filepath: str) -> List[Document]:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            if not content.strip():
                return []

            metadata = {
                "source": filepath,
                "filename": os.path.basename(filepath),
                "type": "text",
            }
            return self.text_splitter.create_documents([content], metadatas=[metadata])
        except Exception as e:
            logger.error(f"Failed to load {filepath}: {e}")
            return []

    def _load_json_file(self, filepath: str) -> List[Document]:
        import json
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)

            documents = []
            items = data if isinstance(data, list) else [data]

            for item in items:
                content = item.get("content", item.get("text", item.get("body", "")))
                if not content:
                    continue

                metadata = {
                    "source": filepath,
                    "filename": os.path.basename(filepath),
                    "type": "json",
                }
                if "title" in item:
                    metadata["title"] = item["title"]
                if "category" in item:
                    metadata["category"] = item["category"]
                if "tags" in item:
                    metadata["tags"] = item["tags"]

                docs = self.text_splitter.create_documents([content], metadatas=[metadata])
                documents.extend(docs)

            return documents
        except Exception as e:
            logger.error(f"Failed to load {filepath}: {e}")
            return []

    def build_index(self, knowledge_dir: Optional[str] = None) -> int:
        documents = self.load_documents_from_dir(knowledge_dir)
        if not documents:
            logger.warning("No documents found to index")
            return 0

        count = self.vectorstore.add_documents(documents)
        logger.info(f"Indexed {count} document chunks")
        return count

    def retrieve(self, query: str, top_k: int = 5) -> List[Document]:
        return self.vectorstore.similarity_search(query, top_k=top_k)

    def retrieve_with_scores(self, query: str, top_k: int = 5) -> List[tuple]:
        return self.vectorstore.similarity_search_with_score(query, top_k=top_k)

    def get_retriever(self, top_k: int = 5):
        return self.vectorstore.as_retriever(search_kwargs={"k": top_k})
