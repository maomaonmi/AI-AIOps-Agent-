import logging
from typing import List, Optional

from langchain_core.embeddings import Embeddings
from langchain_community.embeddings import HuggingFaceEmbeddings

from config.settings import BGE_MODEL_PATH

logger = logging.getLogger(__name__)

_embedding_model: Optional[Embeddings] = None


def get_embedding_model(model_name: str = BGE_MODEL_PATH, device: str = None) -> Embeddings:
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model

    import torch
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    logger.info(f"Loading embedding model: {model_name} on {device}")
    _embedding_model = HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs={"device": device},
        encode_kwargs={"normalize_embeddings": True},
    )
    return _embedding_model


def embed_texts(texts: List[str], model_name: str = BGE_MODEL_PATH) -> List[List[float]]:
    model = get_embedding_model(model_name)
    return model.embed_documents(texts)


def embed_query(query: str, model_name: str = BGE_MODEL_PATH) -> List[float]:
    model = get_embedding_model(model_name)
    return model.embed_query(query)
