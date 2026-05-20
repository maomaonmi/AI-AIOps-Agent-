from pathlib import Path
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / "config" / ".env"

# Load environment variables from config/.env
load_dotenv(dotenv_path=ENV_PATH)

def _resolve_path(path_str: str) -> str:
    """Resolve relative path to absolute path based on BASE_DIR."""
    if path_str.startswith("./") or path_str.startswith("../"):
        return str(BASE_DIR / path_str.lstrip("./"))
    return path_str

QWEN_MODEL_PATH = _resolve_path(os.getenv("QWEN_MODEL_PATH", str(BASE_DIR / "models" / "qwen-1.5b")))
LORA_OUTPUT_DIR = _resolve_path(os.getenv("LORA_OUTPUT_DIR", str(BASE_DIR / "finetune" / "output")))
LORA_MERGED_DIR = _resolve_path(os.getenv("LORA_MERGED_DIR", str(BASE_DIR / "finetune" / "merged")))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/cmdb")
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
ALERTMANAGER_URL = os.getenv("ALERTMANAGER_URL", "http://localhost:9093")
ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")

SSH_HOSTS_CONFIG = _resolve_path(os.getenv("SSH_HOSTS_CONFIG", str(BASE_DIR / "config" / "ssh_hosts.json")))

RAG_VECTORSTORE_DIR = _resolve_path(os.getenv("RAG_VECTORSTORE_DIR", str(BASE_DIR / "rag" / "vectorstore")))
RAG_KNOWLEDGE_DIR = _resolve_path(os.getenv("RAG_KNOWLEDGE_DIR", str(BASE_DIR / "rag" / "knowledge")))
BGE_MODEL_PATH = _resolve_path(os.getenv("BGE_MODEL_PATH", str(BASE_DIR / "models" / "bge-large-zh-v1.5")))

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

AGENT_MAX_ITERATIONS = int(os.getenv("AGENT_MAX_ITERATIONS", "5"))
AGENT_VERBOSE = os.getenv("AGENT_VERBOSE", "true").lower() == "true"
AGENT_TIMEOUT = int(os.getenv("AGENT_TIMEOUT", "180"))

# LLM 配置
LLM_MODE = os.getenv("LLM_MODE", "local")  # 'local' 或 'cloud'
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_MODEL = os.getenv("DASHSCOPE_MODEL", "qwen-plus")
