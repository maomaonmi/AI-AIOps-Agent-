from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict


class QueryRequest(BaseModel):
    question: str = Field(..., description="用户的运维问题", min_length=1, max_length=2000)
    session_id: Optional[str] = Field(None, description="会话ID，用于多轮对话")
    verbose: bool = Field(default=False, description="是否返回详细推理过程")


class ChatRequest(BaseModel):
    question: str = Field(..., description="用户的运维问题", min_length=1, max_length=2000)
    mode: str = Field(default="normal", description="对话模式: normal/thinking/online")
    conversation_id: Optional[str] = Field(None, description="会话ID")


class CasualChatRequest(BaseModel):
    question: str = Field(..., description="用户的问题", min_length=1, max_length=2000)
    conversation_id: Optional[str] = Field(None, description="会话ID")


class ToolStep(BaseModel):
    tool: str
    tool_input: Any
    observation: str


class MetricDataPoint(BaseModel):
    time: str
    value: float


class MetricInfo(BaseModel):
    name: str
    label: str
    current: float
    unit: str
    status: str
    history: List[MetricDataPoint]


class AlertInfo(BaseModel):
    severity: str
    message: str
    timestamp: str
    source: Optional[str] = None


class ServiceNode(BaseModel):
    name: str
    status: str
    latency: Optional[float] = None
    errorRate: Optional[float] = None


class ServiceEdge(BaseModel):
    from_: str = Field(alias='from')
    to: str
    latency: Optional[float] = None
    requestsPerSecond: Optional[float] = None


class ServiceTopologyData(BaseModel):
    nodes: List[ServiceNode]
    edges: List[ServiceEdge]


class PredictionPoint(BaseModel):
    timestamp: str
    value: float
    isPredicted: bool
    confidence: Optional[float] = None
    upperBound: Optional[float] = None
    lowerBound: Optional[float] = None


class RiskInfo(BaseModel):
    type: str
    severity: str
    probability: float
    impact: str
    recommendation: str
    timeToThreshold: Optional[str] = None


class EvidenceItem(BaseModel):
    type: str
    source: str
    content: str
    relevance: float
    timestamp: Optional[str] = None


class SuggestedAction(BaseModel):
    action: str
    description: str
    confidence: float
    automated: bool
    priority: str


class KnowledgeSource(BaseModel):
    title: str
    content: str
    similarity: float
    type: str
    url: Optional[str] = None


class AutomationLog(BaseModel):
    timestamp: str
    level: str
    message: str


class ModuleData(BaseModel):
    type: str = Field(..., description="模块类型: monitoring/prediction/diagnosis/knowledge/automation")
    data: Dict[str, Any] = Field(..., description="模块数据")


class QueryResponse(BaseModel):
    answer: str = Field(..., description="Agent的最终回答")
    intermediate_steps: List[ToolStep] = Field(default_factory=list, description="中间推理步骤")
    success: bool = Field(default=True, description="是否执行成功")
    error: Optional[str] = Field(None, description="错误信息")
    session_id: Optional[str] = Field(None, description="会话ID")
    module_data: Optional[ModuleData] = Field(None, description="模块数据")


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Agent的最终回答")
    intermediate_steps: List[ToolStep] = Field(default_factory=list, description="中间推理步骤")
    success: bool = Field(default=True, description="是否执行成功")
    error: Optional[str] = Field(None, description="错误信息")
    thinking_content: Optional[str] = Field(None, description="深度思考内容")
    module_data: Optional[ModuleData] = Field(None, description="模块数据")


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    tools_count: int = 0
    knowledge_docs_count: int = 0


class BuildIndexRequest(BaseModel):
    knowledge_dir: Optional[str] = Field(None, description="知识文档目录路径")
    force_rebuild: bool = Field(default=False, description="是否强制重建索引")


class LlmModeRequest(BaseModel):
    mode: str = Field(..., description="LLM 模式: local/cloud")


class LlmModeResponse(BaseModel):
    mode: str
    model: str
    success: bool
