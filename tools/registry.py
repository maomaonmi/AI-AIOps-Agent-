import logging
from typing import List, Optional

from langchain_core.tools import Tool

logger = logging.getLogger(__name__)


def create_all_tools(
    db_url: Optional[str] = None,
    prometheus_url: Optional[str] = None,
    ssh_config_path: Optional[str] = None,
    es_url: Optional[str] = None,
    alertmanager_url: Optional[str] = None,
    retriever=None,
) -> List[Tool]:
    tools = []

    base_tool_configs = [
        {
            "module": "tools.sql_tool",
            "class": "SQLQueryTool",
            "kwargs": {"db_url": db_url} if db_url else {},
            "required": False,
        },
        {
            "module": "tools.prometheus_tool",
            "class": "PrometheusTool",
            "kwargs": {"prometheus_url": prometheus_url} if prometheus_url else {},
            "required": False,
        },
        {
            "module": "tools.ssh_tool",
            "class": "SSHExecTool",
            "kwargs": {"hosts_config_path": ssh_config_path} if ssh_config_path else {},
            "required": False,
        },
        {
            "module": "tools.log_tool",
            "class": "LogSearchTool",
            "kwargs": {},
            "required": False,
        },
        {
            "module": "tools.alert_tool",
            "class": "AlertManagerTool",
            "kwargs": {"alertmanager_url": alertmanager_url} if alertmanager_url else {},
            "required": False,
        },
        {
            "module": "tools.knowledge_tool",
            "class": "KnowledgeSearchTool",
            "kwargs": {"retriever": retriever} if retriever else {},
            "required": False,
        },
    ]

    system_tool_configs = [
        {
            "module": "tools.cpu_tool",
            "class": "CPUTool",
            "kwargs": {},
            "required": True,
        },
        {
            "module": "tools.memory_tool",
            "class": "MemoryTool",
            "kwargs": {},
            "required": True,
        },
        {
            "module": "tools.disk_tool",
            "class": "DiskCheckTool",
            "kwargs": {},
            "required": True,
        },
        {
            "module": "tools.network_tool",
            "class": "NetworkTool",
            "kwargs": {},
            "required": True,
        },
        {
            "module": "tools.gpu_tool",
            "class": "GPUTool",
            "kwargs": {},
            "required": False,
        },
    ]

    wrapper_tool_configs = [
        {
            "module": "tools.system_tools",
            "class": "SystemHealthTool",
            "kwargs": {},
            "required": True,
        },
        {
            "module": "tools.system_tools",
            "class": "SystemArchitectureTool",
            "kwargs": {},
            "required": True,
        },
        {
            "module": "tools.system_tools",
            "class": "TrendPredictionTool",
            "kwargs": {},
            "required": True,
        },
    ]

    all_configs = base_tool_configs + system_tool_configs + wrapper_tool_configs

    for config in all_configs:
        try:
            module = __import__(config["module"], fromlist=[config["class"]])
            tool_cls = getattr(module, config["class"])
            instance = tool_cls(**config["kwargs"])

            name = instance.name if hasattr(instance, "name") else config["class"].lower()
            description = instance.description if hasattr(instance, "description") else ""

            langchain_tool = Tool(
                name=name,
                description=description,
                func=instance._run,
            )
            tools.append(langchain_tool)
            logger.info(f"Registered tool: {name}")
        except Exception as e:
            if config.get("required", False):
                logger.error(f"Failed to register required tool {config['class']}: {e}")
            else:
                logger.warning(f"Failed to register optional tool {config['class']}: {e}")

    return tools


def get_tools_description(tools: List[Tool]) -> str:
    lines = []
    for tool in tools:
        lines.append(f"- {tool.name}: {tool.description}")
    return "\n".join(lines)