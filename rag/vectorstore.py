import logging
import os
from typing import List, Optional

from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS

from rag.embedding import get_embedding_model
from config.settings import RAG_VECTORSTORE_DIR, BGE_MODEL_PATH

logger = logging.getLogger(__name__)


class OpsVectorStore:
    def __init__(
        self,
        vectorstore_dir: str = RAG_VECTORSTORE_DIR,
        embedding_model_name: str = BGE_MODEL_PATH,
    ):
        self.vectorstore_dir = vectorstore_dir
        self.embedding_model_name = embedding_model_name
        self.embedding_model = get_embedding_model(embedding_model_name)
        self.vectorstore: Optional[FAISS] = None
        self._load_or_create()

    def _load_or_create(self):
        index_path = os.path.join(self.vectorstore_dir, "index.faiss")
        if os.path.exists(index_path):
            try:
                self.vectorstore = FAISS.load_local(
                    self.vectorstore_dir,
                    self.embedding_model,
                    allow_dangerous_deserialization=True,
                )
                logger.info(f"Loaded existing vectorstore from {self.vectorstore_dir}")
            except Exception as e:
                logger.warning(f"Failed to load vectorstore: {e}, creating new one")
                self.vectorstore = None
        else:
            logger.info("No existing vectorstore found, will create on first add")

    def add_documents(self, documents: List[Document]) -> int:
        if not documents:
            return 0

        if self.vectorstore is None:
            self.vectorstore = FAISS.from_documents(documents, self.embedding_model)
        else:
            self.vectorstore.add_documents(documents)

        self._save()
        logger.info(f"Added {len(documents)} documents to vectorstore")
        return len(documents)

    def add_texts(self, texts: List[str], metadatas: Optional[List[dict]] = None) -> int:
        if not texts:
            return 0

        if self.vectorstore is None:
            self.vectorstore = FAISS.from_texts(texts, self.embedding_model, metadatas=metadatas)
        else:
            self.vectorstore.add_texts(texts, metadatas=metadatas)

        self._save()
        logger.info(f"Added {len(texts)} texts to vectorstore")
        return len(texts)

    def similarity_search(self, query: str, top_k: int = 5) -> List[Document]:
        if self.vectorstore is None:
            logger.warning("Vectorstore is empty, no results")
            return []
        return self.vectorstore.similarity_search(query, k=top_k)

    def similarity_search_with_score(self, query: str, top_k: int = 5) -> List[tuple]:
        if self.vectorstore is None:
            return []
        return self.vectorstore.similarity_search_with_score(query, k=top_k)

    def as_retriever(self, search_kwargs: Optional[dict] = None):
        if self.vectorstore is None:
            raise ValueError("Vectorstore is empty, add documents first")
        kwargs = search_kwargs or {"k": 5}
        return self.vectorstore.as_retriever(search_kwargs=kwargs)

    def _save(self):
        if self.vectorstore is not None:
            os.makedirs(self.vectorstore_dir, exist_ok=True)
            self.vectorstore.save_local(self.vectorstore_dir)
            logger.info(f"Vectorstore saved to {self.vectorstore_dir}")

    def get_document_count(self) -> int:
        if self.vectorstore is None:
            return 0
        try:
            return self.vectorstore.index.ntotal
        except Exception:
            return 0
