from asyncio import subprocess
import logging
import platform as _platform

import asyncio
import json
import sys
import os
import time
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Path, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from numpy import mod
from pydantic import Field
from typing import List, Optional, Dict, Any  # 添加必要的类型导入

from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"✅ 已加载 .env 配置文件: {env_path}")
else:
    logging.warning(f"⚠️ 未找到 .env 文件: {env_path}")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.schemas import (

    QueryRequest, QueryResponse, HealthResponse, BuildIndexRequest,

    ChatRequest, ChatResponse, CasualChatRequest, ThinkRequest, ModuleData, BaseModel,

    LlmModeRequest, LlmModeResponse,

)

from agent.react_agent import ReActAgent
from agent.core.agent_loop import AgentLoop, AgentLoopConfig
from tools.registry import create_all_tools
from tools.web_search import web_search_tool as _web_search_tool
from rag.retriever import OpsRetriever
from agent.prompt_assembler import prompt_assembler
from config.settings import (
    QWEN_MODEL_PATH, DATABASE_URL, PROMETHEUS_URL, SSH_HOSTS_CONFIG,
    ELASTICSEARCH_URL, ALERTMANAGER_URL, RAG_KNOWLEDGE_DIR, RAG_VECTORSTORE_DIR,
    BGE_MODEL_PATH, API_HOST, API_PORT, AGENT_TIMEOUT, AGENT_MAX_ITERATIONS,
    LLM_MODE, DASHSCOPE_API_KEY, DASHSCOPE_MODEL,
)

from data_collector import DataCollector
from intent_classifier import IntentClassifier

logger = logging.getLogger(__name__)
agent: Optional[ReActAgent] = None
agent_loop: Optional[AgentLoop] = None
retriever: Optional[OpsRetriever] = None
data_collector: Optional[DataCollector] = None
intent_classifier: Optional[IntentClassifier] = None


def get_llm():
    import config.settings as _settings
    _mode = _settings.LLM_MODE
    _api_key = _settings.DASHSCOPE_API_KEY
    _model = _settings.DASHSCOPE_MODEL

    if _mode == "cloud" and _api_key:
        logger.info(f"Loading cloud LLM: {_model}")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=_model,
            api_key=_api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            temperature=0.1,
            max_tokens=4096,
            timeout=120,
        )

    else:
        import config.settings as _settings
        _qwen_path = _settings.QWEN_MODEL_PATH
        logger.info(f"Loading local LLM: {_qwen_path}")
        try:
            from langchain_community.llms import HuggingFacePipeline
            from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
            import torch
            import warnings
            warnings.filterwarnings("ignore")

            # Qwen2 is natively supported in transformers, no need for trust_remote_code
            tokenizer = AutoTokenizer.from_pretrained(_qwen_path)
            model = AutoModelForCausalLM.from_pretrained(
                _qwen_path,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto" if torch.cuda.is_available() else None,
            )

            pipe = pipeline(
                "text-generation",
                model=model,
                tokenizer=tokenizer,
                max_new_tokens=2048,
                max_length=4096,
                temperature=0.1,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )

            return HuggingFacePipeline(pipeline=pipe)
        except Exception as e:
            import traceback
            logger.error(f"Failed to load local LLM: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise


def generate_fallback_answer(question: str, intent_result: dict) -> str:
    intent = intent_result.get('intent') if intent_result else None
    params = intent_result.get('extracted_params', {}) if intent_result else {}
    fallback_templates = {

        'prediction': """## 基于历史数据的扩容建议
根据系统历史数据分析，以下是智能扩容建议：
### 扩容时间点预测- **建议扩容时间**: {time_point}
- **依据**: 基于历史趋势分析，资源使用率将在该时间点接近容量上限


### 扩容方案
1. **临时扩容**: 可先增加 {temp_scale}% 资源缓解压力
2. **永久扩容**: 建议最终扩容至当前资源的{perm_scale} 倍
### 监控指标
- CPU 使用率趋势: {cpu_trend}
- 内存使用率趋势: {mem_trend}
- 磁盘使用率趋势: {disk_trend}



> 倍 以上为基于历史数据的智能预测，具体实施请结合业务实际情况
""",
    'monitoring': """## 实时监控分析
### 当前系统状倍- **整体状倍*: 运行正常
- **监控时间范围**: {time_range}

### 关键指标
- CPU 平均使用倍 {cpu_usage}%
- 内存平均使用倍 {mem_usage}%
- 磁盘平均使用倍 {disk_usage}%

### 建议
持续监控系统指标，如有异常波动请及时处理
""",
        'diagnosis': """## 故障诊断分析

### 问题定位
正在分析 {service} 的运行状倍..

### 可能原因
1. 资源瓶颈(CPU/内存/磁盘)
2. 网络连接异常
3. 服务配置问题
4. 依赖服务故障

### 处理建议
1. 查看详细监控指标定位具体问题
2. 检查服务日志寻找错误信倍3. 验证服务配置是否正确

4. 检查依赖服务状倍""",
        'knowledge': """## 知识库查询结倍

### 查询主题: {query_topic}
根据运维知识库检索，以下是相关建议：
1. **最佳实倍*: 遵循标准运维流程
2. **常见问题**: 检查系统配置和依赖关系
3. **解决方案**: 参考标准操作程倍SOP)

> 详细文档请查阅运维知识库系统
""",
        'automation': """## 自动化运维操倍

### 操作类型: {operation}
### 目标: {target}

**执行前确倍*:
- 确认操作目标正确
- 确认当前系统状态允许执倍- 确认有回滚方倍
**风险提示**: 自动化操作可能影响系统运行，请谨慎执倍"""
    }



    if intent in fallback_templates:

        template = fallback_templates[intent]

        answer = template.format(
            time_point=params.get('time_point', '未来 7-14 天内'),
            temp_scale=params.get('temp_scale', '20-30'),
            perm_scale=params.get('perm_scale', '1.5-2.0'),
            cpu_trend=params.get('cpu_trend', '平稳/上升'),
            mem_trend=params.get('mem_trend', '平稳/上升'),
            disk_trend=params.get('disk_trend', '平稳/上升'),
            time_range=params.get('time_range', '最倍24 小时'),
            cpu_usage=params.get('cpu_usage', '35-45'),
            mem_usage=params.get('mem_usage', '60-70'),
            disk_usage=params.get('disk_usage', '45-55'),
            service=params.get('service', '目标服务'),
            query_topic=params.get('query', '运维相关问题'),
            operation=params.get('operation', '自动化操作'),
            target=params.get('target', '目标系统'),
        )
        return answer
    else:
        return f"""## 分析结果



### 问题分析
{question}

### 建议
1. 系统运行正常，未检测到明显异常
2. 建议持续监控关键指标
3. 如有具体问题请提供更多细倍
> 倍 由于分析超时，以上为基于历史数据的通用建议，仅供参倍"""

def build_module_data(intent_result: dict) -> Optional[ModuleData]:
    if not intent_result['intent'] and not intent_result.get('modules'):
        return None

    module_type = intent_result['intent']
    params = intent_result.get('extracted_params', {})
    modules = intent_result.get('modules', [])

    try:
        if module_type in ('cpu', 'memory', 'disk', 'network', 'gpu'):
            all_modules = modules if len(modules) > 1 else [module_type]
            metrics = []
            for m in all_modules:
                metrics.extend(_build_monitoring_metrics(m))
            data = {
                'metrics': metrics,
                'alerts': [],
                'timeRange': '实时',
            }
            return ModuleData(type='monitoring', data=data)

        elif module_type in ('health', 'architecture'):
            metrics = []
            for m in modules if modules else ['cpu', 'memory', 'disk', 'network', 'gpu']:
                metrics.extend(_build_monitoring_metrics(m))
            data = {
                'metrics': metrics,
                'alerts': [],
                'timeRange': '实时',
            }
            return ModuleData(type='monitoring', data=data)

        elif module_type == 'prediction':
            target = params.get('target', 'cpu')
            horizon = params.get('horizon', '24h')
            data = data_collector._collect_prediction_data(target, horizon)
            return ModuleData(type='prediction', data=data)

        elif module_type == 'diagnosis':
            service = params.get('service', 'order-service')
            symptom = params.get('symptom', '')
            data = data_collector._collect_diagnosis_data(service, symptom)
            return ModuleData(type='diagnosis', data=data)

        elif module_type == 'log':
            metrics = _build_monitoring_metrics('disk')
            data = {
                'metrics': metrics,
                'alerts': [],
                'timeRange': '实时',
            }
            return ModuleData(type='monitoring', data=data)

        elif module_type == 'alert':
            metrics = []
            for m in modules if modules else ['cpu', 'memory']:
                metrics.extend(_build_monitoring_metrics(m))
            data = {
                'metrics': metrics,
                'alerts': [],
                'timeRange': '实时',
            }
            return ModuleData(type='monitoring', data=data)

        elif module_type == 'monitoring':
            metric = params.get('metric', 'cpu')
            time_range = params.get('time_range', '30m')
            data = data_collector._collect_monitoring_data(metric, time_range)
            return ModuleData(type='monitoring', data=data)

        elif module_type == 'knowledge':
            query = params.get('query', '')
            data = data_collector._collect_knowledge_data(query)
            return ModuleData(type='knowledge', data=data)

        elif module_type == 'automation':
            operation = params.get('operation', 'restart')
            target = params.get('target', 'order-service')
            data = data_collector._collect_automation_data(operation, target)
            return ModuleData(type='automation', data=data)

        elif module_type == 'report':
            operation = params.get('operation', 'generate_daily')
            content = params.get('content')
            data = data_collector._collect_report_data(operation, content)
            return ModuleData(type='report', data=data)

    except Exception as e:
        logger.warning(f"Failed to build module data for {module_type}: {e}")
        return None

    return None


def _to_dict(obj):
    if obj is None:
        return None
    if hasattr(obj, 'model_dump'):
        return obj.model_dump()
    if hasattr(obj, 'dict'):
        return obj.dict()
    if isinstance(obj, dict):
        return obj
    try:
        return vars(obj)
    except Exception:
        return obj


def _build_monitoring_metrics(module_name: str) -> list:
    metrics = []
    try:
        if module_name == 'cpu':
            from tools.cpu_tool import get_cpu_info
            info = get_cpu_info()
            d = _to_dict(info)
            if d:
                pct = d.get('overall_percent', 0) or 0
                metrics.append({
                    'name': 'CPU使用率',
                    'label': 'cpu_usage',
                    'current': round(float(pct), 1),
                    'unit': '%',
                    'status': 'critical' if pct > 90 else 'warning' if pct > 75 else 'normal',
                    'history': [],
                })
                freq = d.get('freq_current_mhz', 0) or 0
                metrics.append({
                    'name': 'CPU频率',
                    'label': 'cpu_freq',
                    'current': round(float(freq), 0),
                    'unit': 'MHz',
                    'status': 'normal',
                    'history': [],
                })
        elif module_name == 'memory':
            from tools.memory_tool import get_memory_snapshot
            snap = get_memory_snapshot()
            if snap and hasattr(snap, 'info') and snap.info:
                m = _to_dict(snap.info)
                if m:
                    pct = m.get('percent', 0) or 0
                    metrics.append({
                        'name': '内存使用率',
                        'label': 'memory_usage',
                        'current': round(float(pct), 1),
                        'unit': '%',
                        'status': 'critical' if pct > 90 else 'warning' if pct > 80 else 'normal',
                        'history': [],
                    })
                    used_gb = m.get('used_gb', 0) or 0
                    metrics.append({
                        'name': '已用内存',
                        'label': 'memory_used',
                        'current': round(float(used_gb), 1),
                        'unit': 'GB',
                        'status': 'normal',
                        'history': [],
                    })
        elif module_name == 'disk':
            from tools.disk_tool import get_local_disk_info
            info = get_local_disk_info()
            d = _to_dict(info)
            if d:
                drives_raw = d.get('drives', [])
                drives = [_to_dict(dr) for dr in drives_raw] if drives_raw else []
                for drive in drives[:2]:
                    drive = drive or {}
                    pct = drive.get('percent', 0) or 0
                    dev = drive.get('device', '磁盘')
                    metrics.append({
                        'name': f'{dev} 使用率',
                        'label': f'disk_{dev}',
                        'current': round(float(pct), 1),
                        'unit': '%',
                        'status': 'critical' if pct > 95 else 'warning' if pct > 85 else 'normal',
                        'history': [],
                    })
        elif module_name == 'network':
            from tools.network_tool import get_network_info
            info = get_network_info()
            d = _to_dict(info)
            if d:
                interfaces_raw = d.get('interfaces', [])
                interfaces = [_to_dict(i) for i in interfaces_raw] if interfaces_raw else []
                for iface in interfaces[:3]:
                    iface = _to_dict(iface) or {}
                    name = iface.get('name', 'unknown')
                    speed = iface.get('speed_mbps', 0) or 0
                    metrics.append({
                        'name': f'{name} 速率',
                        'label': f'net_{name}',
                        'current': round(float(speed), 0),
                        'unit': 'Mbps',
                        'status': 'normal',
                        'history': [],
                    })
        elif module_name == 'gpu':
            from tools.gpu_tool import get_gpu_info
            info = get_gpu_info()
            d = _to_dict(info)
            if d and d.get('has_gpu'):
                devices_raw = d.get('devices', [])
                devices = [_to_dict(dev) for dev in devices_raw] if devices_raw else []
                for dev in devices[:2]:
                    dev = dev or {}
                    idx = dev.get('index', 0)
                    util_data = dev.get('utilization')
                    util_d = _to_dict(util_data) if util_data else {}
                    util = util_d.get('gpu_percent', 0) or 0
                    metrics.append({
                        'name': f'GPU{idx} 使用率',
                        'label': f'gpu{idx}_usage',
                        'current': round(float(util), 1),
                        'unit': '%',
                        'status': 'critical' if util > 95 else 'warning' if util > 80 else 'normal',
                        'history': [],
                    })
                    temp = dev.get('temperature_celsius', 0) or 0
                    metrics.append({
                        'name': f'GPU{idx} 温度',
                        'label': f'gpu{idx}_temp',
                        'current': round(float(temp), 0),
                        'unit': '°C',
                        'status': 'critical' if temp > 90 else 'warning' if temp > 80 else 'normal',
                        'history': [],
                    })
    except Exception as e:
        logger.warning(f"Failed to build metrics for {module_name}: {e}")
    return metrics





@asynccontextmanager

async def lifespan(app: FastAPI):

    global agent, agent_loop, retriever, data_collector, intent_classifier

    logger.info("Initializing AIOps Agent...")



    data_collector = DataCollector(

        prometheus_url=PROMETHEUS_URL,

        es_url=ELASTICSEARCH_URL,

    )

    intent_classifier = IntentClassifier()

    logger.info("Data collector and intent classifier initialized")



    try:

        retriever = OpsRetriever(

            knowledge_dir=RAG_KNOWLEDGE_DIR,

            vectorstore_dir=RAG_VECTORSTORE_DIR,

            embedding_model_name=BGE_MODEL_PATH,

        )



        doc_count = retriever.vectorstore.get_document_count()

        if doc_count == 0:

            logger.info("Building knowledge index...")

            retriever.build_index()



        langchain_retriever = retriever.get_retriever()

    except Exception as e:

        logger.warning(f"RAG initialization failed: {e}, continuing without knowledge base")

        langchain_retriever = None



    try:

        llm = get_llm()

        tools = create_all_tools(

            db_url=DATABASE_URL,

            prometheus_url=PROMETHEUS_URL,

            ssh_config_path=SSH_HOSTS_CONFIG,

            es_url=ELASTICSEARCH_URL,

            alertmanager_url=ALERTMANAGER_URL,

            retriever=langchain_retriever,

        )

        agent = ReActAgent(llm=llm, tools=tools, timeout=AGENT_TIMEOUT)
        logger.info("AIOps Agent initialized successfully")

        agent_loop = AgentLoop(
            llm=llm,
            tools=tools,
            config=AgentLoopConfig(
                max_steps=AGENT_MAX_ITERATIONS,
                timeout_seconds=AGENT_TIMEOUT,
            ),
            web_search_tool=_web_search_tool,
        )
        logger.info("AgentLoop (Deep Thinking) initialized successfully")

    except Exception as e:

        logger.error(f"Agent initialization failed: {e}")

        agent = None



    yield



    logger.info("Shutting down AIOps Agent...")





app = FastAPI(

    title="AIOps Agent API",

    description="基于大模型的智能运维助手 API",

    version="1.0.0",

    lifespan=lifespan,

)



app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)



api_router = APIRouter(prefix="/api")







@app.exception_handler(asyncio.TimeoutError)

async def timeout_exception_handler(request: Request, exc: asyncio.TimeoutError):

    return JSONResponse(

        status_code=504,

        content={"detail": "Request timeout - model is taking too long to respond"},

    )


@api_router.get("/monitoring/realtime")
async def get_realtime_metrics():
    """获取实时监控指标"""
    from prometheus_client import PrometheusClient
    from config.settings import PROMETHEUS_URL
    client = PrometheusClient(PROMETHEUS_URL)
    
    if not client.check_available():
        return {"status": "error", "message": "Prometheus 不可用", "data": []}
    
    try:
        cpu_data = client.query_cpu_usage("30m")
        memory_data = client.query_memory_usage("30m")
        disk_data = client.query_disk_usage("30m")
        network_data = client.query_network_traffic("30m")
        
        return {
            "status": "success",
            "data": {
                "cpu": cpu_data,
                "memory": memory_data,
                "disk": disk_data,
                "network": network_data,
            },
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to get realtime metrics: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.get("/monitoring/history")
async def get_history_metrics(metric: str = "cpu", range_hours: int = 1):
    """获取历史监控数据"""
    from prometheus_client import PrometheusClient
    from config.settings import PROMETHEUS_URL
    client = PrometheusClient(PROMETHEUS_URL)
    
    if not client.check_available():
        return {"status": "error", "message": "Prometheus 不可用", "data": []}
    
    try:
        range_str = f"{range_hours}h"
        if metric == "cpu":
            data = client.query_cpu_usage(range_str)
        elif metric == "memory":
            data = client.query_memory_usage(range_str)
        elif metric == "disk":
            data = client.query_disk_usage(range_str)
        elif metric == "network":
            data = client.query_network_traffic(range_str)
        else:
            return {"status": "error", "message": f"不支持的指标: {metric}", "data": []}
        
        return {
            "status": "success",
            "metric": metric,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to get history metrics: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.get("/health", response_model=HealthResponse)

async def health_check():

    tools_count = len(agent.tools) if agent else 0

    docs_count = retriever.vectorstore.get_document_count() if retriever else 0

    return HealthResponse(

        status="ok" if agent else "degraded",

        tools_count=tools_count,

        knowledge_docs_count=docs_count,

    )





async def generate_stream(question: str, mode: str = "normal"):
    start_time = time.time()
    yield f"data: {json.dumps({'type': 'status', 'message': '正在分析您的意图...', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
    intent_result = None

    if intent_classifier:
        intent_result = intent_classifier.classify(question)
        if intent_result['intent']:
            logger.info(f"Intent: {intent_result['intent']} (confidence: {intent_result['confidence']:.2f})")
            intent_msg = f"检测到意图: {intent_result['intent']}"
            yield f"data: {json.dumps({'type': 'status', 'message': intent_msg, 'elapsed': round(time.time() - start_time, 1)})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'status', 'message': '正在思考回倍..', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
    else:
        yield f"data: {json.dumps({'type': 'status', 'message': '正在调用 Agent...', 'elapsed': round(time.time() - start_time, 1)})}\n\n"

    answer = ""
    module_data = None
    error = None
    success = True
    use_fallback = False

    try:
        if agent is None:
            raise HTTPException(status_code=503, detail="Agent not initialized")
        system_instructions = None
        tools_desc = getattr(agent, 'tools_description', '')
        if intent_result and intent_result.get('modules'):
            system_instructions = prompt_assembler.assemble(
                question=question,
                intent_result=intent_result,
                all_tools_description=tools_desc,
            )

        result = await asyncio.wait_for(
            asyncio.to_thread(agent.run, question, system_instructions),
            timeout=AGENT_TIMEOUT
        )
        answer = result.get("answer", "")
        success = result.get("success", True)
        error = result.get("error")

        if not success or error == "timeout":
            use_fallback = True

        yield f"data: {json.dumps({'type': 'status', 'message': '正在生成分析数据...', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
        
        if intent_result and intent_result.get('intent') and data_collector:
            module_data = build_module_data(intent_result)



    except asyncio.TimeoutError:
        use_fallback = True
        error = "timeout"
        yield f"data: {json.dumps({'type': 'status', 'message': '分析超时，正在生成智能建倍..', 'elapsed': round(time.time() - start_time, 1)})}\n\n"

        if intent_result and intent_result.get('intent'):
            module_data = build_module_data(intent_result)
            answer = generate_fallback_answer(question, intent_result)
            success = True

        else:
            answer = "抱歉，请求超时，请稍后重试。"
            success = False



    except Exception as e:
        answer = f"抱歉，处理失败: {str(e)}"
        success = False
        error = str(e)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e), 'elapsed': round(time.time() - start_time, 1)})}\n\n"



    if use_fallback and intent_result and intent_result.get('intent') and not module_data:
        if data_collector:
            module_data = build_module_data(intent_result)

        if not answer:
            answer = generate_fallback_answer(question, intent_result)

    content_parts = answer.split('\n')

    for i, part in enumerate(content_parts):

        if part.strip():
            yield f"data: {json.dumps({'type': 'content', 'content': part + '\n', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
            await asyncio.sleep(0.02)

    if module_data:
        yield f"data: {json.dumps({'type': 'module_data', 'data': module_data.model_dump(), 'elapsed': round(time.time() - start_time, 1)})}\n\n"

    yield f"data: {json.dumps({'type': 'done', 'answer': answer, 'success': success, 'error': error, 'elapsed': round(time.time() - start_time, 1)})}\n\n"


@api_router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    return StreamingResponse(
        generate_stream(request.question, request.mode),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },

    )


async def generate_think_stream(request: ThinkRequest):
    if agent_loop is None:
        yield f"data: {json.dumps({'type': 'error', 'message': 'AgentLoop not initialized'})}\n\n"
        return

    start_time = time.time()

    capabilities = request.capabilities
    use_search = capabilities.get("web_search", False)
    use_thinking = capabilities.get("thinking", True)

    if not use_thinking:
        yield f"data: {json.dumps({'type': 'error', 'message': 'Thinking must be enabled for this endpoint'})}\n\n"
        return

    web_context = None
    if use_search and _web_search_tool:
        yield f"data: {json.dumps({'type': 'status', 'message': '🔍 正在联网搜索...', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
        try:
            search_count = capabilities.get("search_count", 10)
            search_result = await _web_search_tool.search(request.question, max_results=search_count)
            if search_result.get("success") and search_result.get("results"):
                results = search_result["results"]
                web_context = "\n\n".join([
                    f"【{r.get('title', '')}】\n{r.get('snippet', '')[:400]}\n来源: {r.get('source', 'Unknown')}"
                    for r in results[:3]
                ])
                yield f"data: {json.dumps({'type': 'status', 'message': f'✅ 找到 {len(results)} 条相关信息', 'elapsed': round(time.time() - start_time, 1), 'data': {'search_results': results, 'engine': search_result.get('engine', 'Unknown')}})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'status', 'message': '未找到相关信息，使用本地知识推理', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
        except Exception as e:
            logger.error(f"Web search failed in think stream: {e}")
            yield f"data: {json.dumps({'type': 'status', 'message': '联网搜索失败，使用本地知识推理', 'elapsed': round(time.time() - start_time, 1)})}\n\n"

    intent_result = None
    system_instructions = request.system_instructions
    if not system_instructions and intent_classifier:
        intent_result = intent_classifier.classify(request.question)
        if intent_result and intent_result.get("modules"):
            tools_desc = getattr(agent_loop.executor, "get_tools_description", lambda: "")()
            system_instructions = prompt_assembler.assemble(
                question=request.question,
                intent_result=intent_result,
                all_tools_description=tools_desc,
            )

    final_answer = ""

    try:
        async for event in agent_loop.run_stream(
            question=request.question,
            system_instructions=system_instructions,
            web_context=web_context,
        ):
            elapsed = round(time.time() - start_time, 1)

            if event.type.value == "thought":
                yield f"data: {json.dumps({'type': 'thinking', 'subtype': 'thought', 'content': event.content, 'step': event.step_number, 'data': event.data or {}, 'elapsed': elapsed})}\n\n"
                await asyncio.sleep(0.01)

            elif event.type.value == "tool_call":
                yield f"data: {json.dumps({'type': 'thinking', 'subtype': 'tool_call', 'content': event.content, 'step': event.step_number, 'data': event.data or {}, 'elapsed': elapsed})}\n\n"
                await asyncio.sleep(0.01)

            elif event.type.value == "tool_result":
                event_data = event.data or {}
                yield f"data: {json.dumps({'type': 'thinking', 'subtype': 'tool_result', 'content': event.content, 'step': event.step_number, 'data': {
                    **event_data,
                    'raw_result': event_data.get('_raw_result', ''),
                    'has_interpretation': event_data.get('has_interpretation', False),
                }, 'elapsed': elapsed})}\n\n"
                await asyncio.sleep(0.01)

            elif event.type.value == "final_answer":
                final_answer = event.content
                final_data = event.data or {}

    except Exception as e:
        logger.error(f"AgentLoop execution failed: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': str(e), 'elapsed': round(time.time() - start_time, 1)})}\n\n"
        return

    if final_answer:
        content_parts = final_answer.split("\n")
        for part in content_parts:
            if part.strip():
                yield f"data: {json.dumps({'type': 'content', 'content': part + '\n', 'elapsed': round(time.time() - start_time, 1)})}\n\n"
                await asyncio.sleep(0.02)

    memory_summary = agent_loop.get_memory_summary()
    executor_stats = agent_loop.get_executor_stats()

    yield f"data: {json.dumps({'type': 'done', 'answer': final_answer, 'success': True, 'error': None, 'elapsed': round(time.time() - start_time, 1), 'data': {'memory': memory_summary, 'executor_stats': executor_stats}})}\n\n"


@api_router.post("/chat/think/stream")
async def chat_think_stream(request: ThinkRequest):
    return StreamingResponse(
        generate_think_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@api_router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        intent_result_agent = intent_classifier.classify(request.question) if intent_classifier else None
        system_instructions = None
        if intent_result_agent and intent_result_agent.get('modules'):
            tools_desc = getattr(agent, 'tools_description', '')
            system_instructions = prompt_assembler.assemble(
                question=request.question,
                intent_result=intent_result_agent,
                all_tools_description=tools_desc,
            )

        result = await asyncio.wait_for(
            asyncio.to_thread(agent.run, request.question, system_instructions),
            timeout=AGENT_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timeout")

    module_data = None
    if intent_classifier:
        intent_result = intent_classifier.classify(request.question)
        if intent_result['intent']:
            module_data = build_module_data(intent_result)

    return QueryResponse(
        answer=result["answer"],
        intermediate_steps=result["intermediate_steps"],
        success=result["success"],
        error=result["error"],
        session_id=request.session_id,
        module_data=module_data,
    )

@api_router.post("/chat", response_model=ChatResponse)

async def chat(request: ChatRequest):
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        intent_result_agent = intent_classifier.classify(request.question) if intent_classifier else None
        system_instructions = None
        if intent_result_agent and intent_result_agent.get('modules'):
            tools_desc = getattr(agent, 'tools_description', '')
            system_instructions = prompt_assembler.assemble(
                question=request.question,
                intent_result=intent_result_agent,
                all_tools_description=tools_desc,
            )

        result = await asyncio.wait_for(
            asyncio.to_thread(agent.run, request.question, system_instructions),
            timeout=AGENT_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timeout - model is taking too long to respond")

    thinking_content = None

    if request.mode == "thinking":
        thinking_content = "正在使用深度思考模式进行推理分倍.."

    module_data = None
    if intent_classifier:
        intent_result = intent_classifier.classify(request.question)
        logger.info(f"Intent classification: {intent_result['intent']} (confidence: {intent_result['confidence']:.2f})")
        if intent_result['intent']:
            module_data = build_module_data(intent_result)

    return ChatResponse(
        answer=result["answer"],
        intermediate_steps=result["intermediate_steps"],
        success=result["success"],
        error=result["error"],
        thinking_content=thinking_content,
        module_data=mod
    )

@api_router.post("/chat/casual", response_model=ChatResponse)
async def casual_chat(request: CasualChatRequest):
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    system_prompt = """你是一个友好的AI运维助手，名叫AIOps Agent。你可以和用户进行日常聊天，也可以回答运维相关的问题倍
你的能力包括倍- 智能监控：实时监控服务器CPU、内存、磁盘、网络等指标，发现异常及时告倍- 故障诊断：自动分析故障根因，提供详细的排查报告和处理建议
- 知识库查询：快速检索运维SOP文档、最佳实践和常见问题解决方案
- 自动修复：执行安全的自动化运维操作，如服务重启、磁盘清理、连接池扩容倍
回答要求倍- 语气友好、热情、自然，像一个专业的运维专家在和朋友聊天
- 回答要详细、丰富，不要过于简倍- 主动介绍自己能做什么，引导用户提问
- 如果是运维相关问题，给出实用、详细的建议
- 不要调用工具，直接回答即倍"""

    prompt = f"{system_prompt}\n\n用户: {request.question}\n\n助手:"

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(agent.llm.invoke, prompt),
            timeout=AGENT_TIMEOUT
        )

        answer = response.content if hasattr(response, 'content') else str(response)
        answer = answer.strip()

        lines = answer.split('\n')
        filtered_lines = []
        skip = False

        for line in lines:
            stripped = line.strip()
            if '你是一个友好的AI运维助手' in stripped or '回答要求' in stripped or '不要重复系统提示倍' in stripped:
                skip = True
                continue

            if skip:
                if stripped == '' or '语气友好' in stripped or '回答简倍' in stripped or '运维相关' in stripped or '不要调用工具' in stripped or '主动介绍' in stripped or '不要过于简倍' in stripped:
                    continue
                if stripped and '用户:' not in stripped and '助手:' not in stripped and '你的能力包括' not in stripped and '智能监控' not in stripped and '故障诊断' not in stripped and '知识倍' not in stripped and '自动修复' not in stripped:
                    skip = False

            if not skip:
                if '用户:' in stripped:
                    continue
                if '助手:' in stripped:
                    content = stripped.split('助手:', 1)[1].strip()
                    if content:
                        filtered_lines.append(content)
                else:
                    if stripped:
                        filtered_lines.append(stripped)

        answer = '\n'.join(filtered_lines).strip()

        if not answer or len(answer) < 10:
            answer = "您好！我是AIOps智能运维助手，很高兴为您服务！\n\n我可以帮您做很多事情，比如：\n\n🔍 **智能监控** - 实时监控服务器的CPU、内存、磁盘、网络等各项指标，发现异常第一时间告诉您\n\n🔧 **故障诊断** - 当系统出现问题时，我可以自动分析根因，给您详细的排查报告和处理建议\n\n📚 **知识查询** - 快速查找运维SOP文档、最佳实践，帮您解决各种技术问题\n\n倍**自动修复** - 执行一些安全的自动化操作，比如重启异常服务、清理磁盘空间等\n\n请问有什么我可以帮您的吗？无论是日常聊天还是专业的运维问题，我都很乐意为您解答！"

    except asyncio.TimeoutError:
        answer = "抱歉，响应超时，请稍后重试倍"

    except Exception as e:
        answer = f"抱歉，处理您的请求时出错: {str(e)}"

    module_data = None

    if intent_classifier:
        intent_result = intent_classifier.classify(request.question)
        if intent_result['intent']:
            module_data = build_module_data(intent_result)

    return ChatResponse(
        answer=answer,
        intermediate_steps=[],
        success=True,
        error=None,
        thinking_content=None,
        module_data=module_data,
    )

@api_router.post("/build-index")

async def build_index(request: BuildIndexRequest):
    global retriever
    if retriever is None:
        raise HTTPException(status_code=503, detail="RAG module not initialized")

    try:
        count = retriever.build_index(
            knowledge_dir=request.knowledge_dir,
        )

        return {"status": "ok", "documents_indexed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/tools")

async def list_tools():
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    return {
        "tools": [
            {"name": t.name, "description": t.description}
            for t in agent.tools
        ]
    }

@api_router.post("/llm-mode", response_model=LlmModeResponse)
async def set_llm_mode(request: LlmModeRequest):
    global agent
    if request.mode not in ("local", "cloud"):
        raise HTTPException(status_code=400, detail="mode must be 'local' or 'cloud'")

    import config.settings as settings
    settings.LLM_MODE = request.mode

    try:
        llm = get_llm()
        if agent:
            agent.llm = llm

        model_name = settings.DASHSCOPE_MODEL if request.mode == "cloud" else settings.QWEN_MODEL_PATH
        return LlmModeResponse(mode=request.mode, model=model_name, success=True)

    except Exception as e:
        import traceback
        logger.error(f"Failed to switch LLM mode: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/llm-mode")
async def get_llm_mode():
    import config.settings as settings
    return {
        "mode": settings.LLM_MODE,
        "model": settings.DASHSCOPE_MODEL if settings.LLM_MODE == "cloud" else settings.QWEN_MODEL_PATH,
    }

@api_router.get("/disk/info")
async def get_disk_info():
    """获取本机磁盘容量和健康状态"""
    from tools.disk_tool import get_local_disk_info
    try:
        info = get_local_disk_info()
        return {
            "status": "success",
            "system": info.system,
            "drives": [d.model_dump() for d in info.drives],
            "timestamp": info.timestamp,
        }
    except Exception as e:
        logger.error(f"Failed to get disk info: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/system/health")
async def get_system_health():
    """获取系统整体健康状态报告"""
    from tools.health_tool import get_system_health
    try:
        report = get_system_health()
        return {
            "status": "success",
            **report.model_dump(),
        }
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/system/architecture")
async def get_system_architecture():
    """获取系统架构信息报告"""
    from tools.arch_tool import get_architecture_report
    try:
        report = get_architecture_report()
        return {
            "status": "success",
            **report.model_dump(),
        }
    except Exception as e:
        logger.error(f"Failed to get architecture report: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/logs/summary")
async def get_logs_summary(hours: int = 24):
    """获取日志统计分析"""
    from tools.log_tool import get_log_summary
    try:
        summary = get_log_summary(hours)
        return {
            "status": "success",
            **summary.model_dump(),
        }
    except Exception as e:
        logger.error(f"Failed to get log summary: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/prediction/trend")
async def get_trend_prediction(hours: int = 24):
    """获取资源使用趋势预测"""
    from tools.prediction_tool import get_trend_prediction
    try:
        prediction = get_trend_prediction(hours)
        return {
            "status": "success",
            **prediction.model_dump(),
        }
    except Exception as e:
        logger.error(f"Failed to get trend prediction: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/gpu/info")
async def get_gpu_info():
    """获取本机 NVIDIA GPU 实时状态信息"""
    from tools.gpu_tool import get_gpu_info
    try:
        info = get_gpu_info()
        return {
            "status": "success",
            "has_gpu": info.has_gpu,
            "devices": [d.model_dump() for d in info.devices],
            "timestamp": info.timestamp,
        }
    except Exception as e:
        logger.error(f"Failed to get GPU info: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/prediction/realtime")
async def get_prediction_realtime():
    """轻量级实时采样，供预测面板动态曲线使用"""
    import psutil as _ps
    result = {"status": "success", "metrics": {}, "timestamp": datetime.now().isoformat()}
    try:
        result["metrics"]["cpu"] = round(_ps.cpu_percent(interval=0.1), 1)
    except Exception:
        result["metrics"]["cpu"] = 0.0
    try:
        mem = _ps.virtual_memory()
        result["metrics"]["memory"] = round(mem.percent, 1)
    except Exception:
        result["metrics"]["memory"] = 0.0
    try:
        if _platform.system() == 'Windows':
            du = _ps.disk_usage('C:\\')
        else:
            du = _ps.disk_usage('/')
        result["metrics"]["disk"] = round(du.percent, 1)
    except Exception:
        result["metrics"]["disk"] = 0.0
    try:
        from tools.gpu_tool import get_gpu_info as _gpu_info
        gi = _gpu_info()
        if gi.has_gpu and gi.devices:
            u = gi.devices[0].utilization
            result["metrics"]["gpu"] = round(u.gpu_percent, 1) if u else 0.0
        else:
            result["metrics"]["gpu"] = None
    except Exception:
        result["metrics"]["gpu"] = None
    try:
        net = _ps.net_io_counters()
        result["metrics"]["network"] = round(min(100, (net.bytes_sent + net.bytes_recv) / (1024 * 1024) % 100), 1)
    except Exception:
        result["metrics"]["network"] = 0.0
    return result


@api_router.get("/cpu/info")
async def get_cpu_info():
    """获取本机CPU使用率、核心负载、频率、温度等实时信息"""
    from tools.cpu_tool import get_cpu_info
    try:
        info = get_cpu_info()
        return {
            "status": "success",
            "overall_percent": info.overall_percent,
            "per_core": [c.model_dump() for c in info.per_core],
            "count_physical": info.count_physical,
            "count_logical": info.count_logical,
            "freq_current_mhz": info.freq_current_mhz,
            "freq_min_mhz": info.freq_min_mhz,
            "freq_max_mhz": info.freq_max_mhz,
            "load_avg_1m": info.load_avg_1m,
            "load_avg_5m": info.load_avg_5m,
            "load_avg_15m": info.load_avg_15m,
            "ctx_switches": info.ctx_switches,
            "interrupts": info.interrupts,
            "temperature_celsius": info.temperature_celsius,
            "top_processes": [p.model_dump() for p in info.top_processes],
            "uptime_seconds": info.uptime_seconds,
            "timestamp": info.timestamp,
        }
    except Exception as e:
        logger.error(f"Failed to get CPU info: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/cpu/processes")
async def get_all_processes(limit: int = 50):
    """获取所有CPU进程列表（按CPU占用排序）"""
    from tools.cpu_tool import get_all_processes
    try:
        procs = get_all_processes(limit)
        return {
            "status": "success",
            "total": len(procs),
            "processes": [p.model_dump() for p in procs],
        }
    except Exception as e:
        logger.error(f"Failed to get processes: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/memory/info")
async def get_memory_info():
    """获取本机内存实时使用信息"""
    from tools.memory_tool import get_memory_snapshot
    try:
        snap = get_memory_snapshot()
        return {
            "status": "success",
            "info": snap.info.model_dump(),
            "top_processes": [p.model_dump() for p in snap.top_processes],
        }
    except Exception as e:
        logger.error(f"Failed to get memory info: {e}")
        return {"status": "error", "message": str(e)}


@api_router.get("/network/info")
async def get_network_info():
    """获取本机网络接口流量、速率、IP地址等实时信息"""
    from tools.network_tool import get_network_info
    try:
        info = get_network_info()
        return {
            "status": "success",
            "interfaces": [i.model_dump() for i in info.interfaces],
            "timestamp": info.timestamp,
        }
    except Exception as e:
        logger.error(f"Failed to get network info: {e}")
        return {"status": "error", "message": str(e)}


# ==================== Script Executor API ====================

# 全局脚本执行器实例
script_executor = None


def get_script_executor():
    """获取或创建脚本执行器实例"""
    global script_executor
    if script_executor is None:
        from tools.script_executor import create_script_executor
        script_executor = create_script_executor()
    return script_executor


@api_router.get("/scripts/templates")
async def list_script_templates(category: Optional[str] = None):
    """
    获取脚本模板列表
    
    Args:
        category: 可选，按分类过滤 (system, database, network, monitoring, custom)
    
    Returns:
        模板列表
    """
    try:
        executor = get_script_executor()
        templates = executor.get_templates(category=category)
        return {
            "status": "success",
            "total": len(templates),
            "templates": [t.model_dump() for t in templates]
        }
    except Exception as e:
        logger.error(f"Failed to list scripts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/scripts/templates/{template_id}")
async def get_script_template(template_id: str):
    """获取单个脚本模板详情"""
    try:
        executor = get_script_executor()
        template = executor.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")
        
        return {
            "status": "success",
            "template": template.model_dump()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get template {template_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ScriptExecutionRequest(BaseModel):
    """脚本执行请求"""
    script_id: Optional[str] = Field(default=None, description="脚本模板ID")
    script_content: Optional[str] = Field(default=None, description="自定义脚本内容")
    targets: List[str] = Field(..., description="目标主机列表")
    params: Dict[str, Any] = Field(default_factory=dict, description="脚本参数")
    dry_run: bool = Field(default=False, description="干运行模式")
    max_concurrent: int = Field(default=5, description="最大并发数")
    timeout: int = Field(default=300, description="超时时间（秒）")


@api_router.post("/scripts/execute")
async def execute_script(request: ScriptExecutionRequest):
    """
    执行脚本（支持批量）
    
    支持两种模式：
    1. 使用预置模板：提供 script_id + params
    2. 自定义脚本：提供 script_content
    
    安全特性：
    - 干运行模式：仅预览不实际执行
    - 并发控制：限制同时执行的主机数量
    - 超时保护：防止单个主机长时间阻塞
    """
    try:
        logger.info(f"🚀 [API] 收到脚本执行请求:")
        logger.info(f"   - script_id: {request.script_id}")
        logger.info(f"   - targets: {request.targets}")
        logger.info(f"   - dry_run: {request.dry_run}")
        logger.info(f"   - params: {request.params}")
        
        executor = get_script_executor()
        logger.info(f"✅ [API] 获取到执行器实例")
        
        # 加载SSH配置
        from config.settings import SSH_HOSTS_CONFIG
        ssh_configs = {}
        try:
            import json as _json
            from pathlib import Path as _Path
            config_path = Path(SSH_HOSTS_CONFIG)
            if config_path.exists():
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = _json.load(f)
                    for host in config.get('hosts', []):
                        ssh_configs[host.get('hostname', '')] = host
                        if 'alias' in host:
                            ssh_configs[host['alias']] = host
            logger.info(f"✅ [API] SSH配置加载完成，共{len(ssh_configs)}个主机配置")
        except Exception as config_err:
            logger.warning(f"⚠️ [API] Failed to load SSH config: {config_err}")
        
        # 构建执行请求
        exec_request = ExecutionRequest(
            script_id=request.script_id,
            script_content=request.script_content,
            targets=request.targets,
            params=request.params,
            dry_run=request.dry_run,
            max_concurrent=request.max_concurrent,
            timeout=request.timeout
        )
        
        logger.info(f"📤 [API] 开始执行脚本...")
        
        # 异步执行
        result = await executor.execute_batch(
            request=exec_request,
            ssh_configs=ssh_configs
        )
        
        logger.info(f"📥 [API] 脚本执行完成:")
        logger.info(f"   - execution_id: {result.execution_id}")
        logger.info(f"   - status: {result.status}")
        logger.info(f"   - results count: {len(result.results)}")
        
        return {
            "status": "success",
            "execution_id": result.execution_id,
            "script_name": result.script_name,
            "overall_status": result.status,
            "summary": result.summary,
            "results": [r.model_dump() for r in result.results],
            "start_time": result.start_time,
            "end_time": result.end_time,
        }
        
    except ValueError as ve:
        logger.error(f"❌ [API] Script execution validation error: {ve}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"参数验证错误: {str(ve)}")
    except Exception as e:
        logger.error(f"❌ [API] Script execution failed with exception:")
        logger.error(f"   - Error type: {type(e).__name__}")
        logger.error(f"   - Error message: {str(e)}")
        import traceback
        logger.error(f"   - Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"执行失败: {type(e).__name__}: {str(e)}")


@api_router.get("/scripts/history")
async def get_execution_history(limit: int = 20):
    """获取脚本执行历史"""
    try:
        executor = get_script_executor()
        history = executor.get_execution_history(limit=limit)
        return {
            "status": "success",
            "total": len(history),
            "history": [
                {
                    "execution_id": h.execution_id,
                    "script_name": h.script_name,
                    "status": h.status,
                    "summary": h.summary,
                    "start_time": h.start_time,
                    "end_time": h.end_time,
                    "target_count": len(h.request.targets),
                }
                for h in history
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get execution history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/scripts/history/{execution_id}")
async def get_execution_detail(execution_id: str):
    """获取单次执行的详细信息"""
    try:
        executor = get_script_executor()
        detail = executor.get_execution_detail(execution_id)
        if not detail:
            raise HTTPException(status_code=404, detail=f"Execution not found: {execution_id}")
        
        return {
            "status": "success",
            **detail.model_dump(),
            "results": [r.model_dump() for r in detail.results]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get execution detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Import ExecutionRequest at module level
from tools.script_executor import ExecutionRequest

class ReportRequest(BaseModel):
    operation: str = "generate_daily"
    content: Optional[str] = None

@api_router.post("/report")
async def report_api(request: ReportRequest):
    if data_collector is None:
        raise HTTPException(status_code=503, detail="Data collector not initialized")
    try:
        data = await data_collector.collect_report_data(operation=request.operation, content=request.content)
        return {"status": "ok", "data": data}
    except Exception as e:
        logger.error(f"Report API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 批量操作引擎 API ====================

class ServiceInfo(BaseModel):
    """服务信息"""
    name: str
    display_name: str
    status: str  # running, stopped, pending
    pid: Optional[int] = None
    start_type: str = ""  # auto, manual, disabled
    description: str = ""

class BatchOperationRequest(BaseModel):
    """批量操作请求"""
    operation_type: str = Field(..., description="操作类型: restart_service, deploy_app, update_config")
    targets: List[str] = Field(..., description="目标服务/应用列表")
    params: Dict[str, Any] = Field(default_factory=dict, description="操作参数")
    options: Dict[str, Any] = Field(default_factory=dict, description="执行选项")
    
    # 安全确认
    confirmed: bool = Field(False, description="用户是否已确认")
    confirmation_code: Optional[str] = Field(None, description="确认码（可选）")

class BatchOperationResult(BaseModel):
    """单个操作结果"""
    target: str
    status: str  # pending, running, success, failed, skipped
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[float] = None
    output: str = ""
    error: Optional[str] = None

class BatchOperationResponse(BaseModel):
    """批量操作响应"""
    operation_id: str
    operation_type: str
    total_targets: int
    results: List[BatchOperationResult]
    summary: Dict[str, int]
    status: str  # completed, partial_failed, failed, cancelled
    start_time: str
    end_time: Optional[str] = None


@api_router.get("/system/services")
async def get_local_services(
    status_filter: Optional[str] = None,
    search: Optional[str] = None
):
    """
    获取本机真实服务列表
    
    支持平台：
    - Windows: 使用 PowerShell Get-Service
    - Linux: 使用 systemctl list-units
    
    Args:
        status_filter: 过滤状态 (running, stopped, all)
        search: 搜索关键词（匹配服务名或显示名）
    """
    import subprocess
    import platform
    import json as _json
    
    services = []
    
    try:
        system = platform.system()
        
        if system == 'Windows':
            # Windows: 使用 PowerShell 获取服务列表
            # 将PowerShell命令写入临时文件避免引号问题
            import tempfile
            import os
            
            # 使用 WMI 获取服务详细信息（包含PID和描述）
            # 设置UTF-8输出编码避免中文乱码
            ps_script = '''
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$services = Get-WmiObject Win32_Service | ForEach-Object {
    $svc = Get-Service -Name $_.Name -ErrorAction SilentlyContinue
    $status = if ($svc) { $svc.Status.ToString() } else { "Unknown" }
    $startType = if ($svc) { $svc.StartType.ToString() } else { "Unknown" }
    
    # 判断服务是否可重启（检查是否接受Stop命令）
    $canRestart = $false
    try {
        $canRestart = $svc.CanStop -and ($svc.Status -eq 'Running')
    } catch {
        $canRestart = $false
    }
    
    # 判断是否为系统关键服务
    $isSystemCritical = $_.Name -in @('lsass', 'csrss', 'smss', 'services', 'wininit', 'winlogon', 'svchost')
    
    [PSCustomObject]@{
        Name = $_.Name
        DisplayName = $_.DisplayName
        Status = $status
        StartType = $startType
        PID = $_.ProcessId
        Description = $_.Description
        ServiceType = $_.ServiceType
        StartMode = $_.StartMode
        CanRestart = $canRestart
        IsSystemCritical = $isSystemCritical
    }
}

$services | ConvertTo-Json -Compress
'''
            
            # 创建临时脚本文件（使用UTF-8 BOM确保中文正确）
            import codecs
            with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False, encoding='utf-8-sig') as f:
                f.write(ps_script)
                temp_script = f.name
            
            try:
                # 执行临时脚本，设置代码页为UTF-8
                proc = await asyncio.create_subprocess_exec(
                    'powershell',
                    '-ExecutionPolicy', 'Bypass',
                    '-NoProfile',
                    '-Command',
                    f'[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & "{temp_script}"',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
                
                # 尝试多种编码解码
                for encoding in ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'cp936']:
                    try:
                        output = stdout.decode(encoding, errors='strict')
                        if output.strip():
                            break
                    except:
                        continue
                else:
                    output = stdout.decode('utf-8', errors='replace')
                
                error_output = stderr.decode('utf-8', errors='replace')
                
                if error_output:
                    logger.warning(f"⚠️ [API] PowerShell stderr: {error_output[:200]}")
                
                if output.strip():
                    try:
                        service_list = _json.loads(output)
                        
                        # 确保是列表
                        if isinstance(service_list, dict):
                            service_list = [service_list]
                        
                        for svc in service_list:
                            svc_status = svc.get('Status', '').lower()
                            
                            # 应用过滤条件
                            if status_filter and status_filter != 'all':
                                if status_filter == 'running' and svc_status != 'running':
                                    continue
                                if status_filter == 'stopped' and svc_status not in ['stopped', 'stop']:
                                    continue
                            
                            # 应用搜索过滤
                            svc_name = f"{svc.get('Name', '')} {svc.get('DisplayName', '')}".lower()
                            if search and search.lower() not in svc_name:
                                continue
                            
                            # 获取PID（WMI返回0表示未运行）
                            pid = svc.get('PID', 0)
                            if pid == 0:
                                pid = None
                            
                            # 获取描述（清理乱码）
                            description = svc.get('Description', '') or ''
                            # 如果描述为空或乱码，使用DisplayName
                            if not description or '?' in description:
                                description = svc.get('DisplayName', '')
                            
                            services.append(ServiceInfo(
                                name=svc.get('Name', ''),
                                display_name=svc.get('DisplayName', ''),
                                status='running' if svc_status == 'running' else 'stopped',
                                start_type=svc.get('StartType', ''),
                                pid=pid,
                                description=description,
                                group=svc.get('ServiceType', ''),
                                can_stop=svc.get('CanRestart', False) and not svc.get('IsSystemCritical', False)
                            ))
                    except _json.JSONDecodeError as je:
                        logger.error(f"❌ [API] JSON解析失败: {je}")
                        logger.error(f"   输出内容前500字: {output[:500]}")
                
            finally:
                # 清理临时文件
                try:
                    os.unlink(temp_script)
                except:
                    pass
        
        elif system == 'Linux':
            # Linux: 使用 systemctl
            cmd = ['systemctl', 'list-units', '--type=service', '--all', '--no-pager']
            if status_filter == 'running':
                cmd.extend(['--state=running'])
            elif status_filter == 'stopped':
                cmd.extend(['--state=stopped'])
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
            lines = stdout.decode('utf-8').strip().split('\n')
            
            for line in lines[1:]:  # 跳过标题行
                parts = line.split()
                if len(parts) >= 4 and parts[0].endswith('.service'):
                    svc_name = parts[0].replace('.service', '')
                    svc_status = parts[3] if len(parts) > 3 else 'unknown'
                    
                    if search and search.lower() not in svc_name.lower():
                        continue
                    
                    services.append(ServiceInfo(
                        name=svc_name,
                        display_name=svc_name,
                        status='running' if svc_status == 'running' else 'stopped',
                        start_type='auto',
                        description=''
                    ))
        
        logger.info(f"📋 [API] 获取到 {len(services)} 个本地服务 (平台: {system})")
        
        return {
            "status": "success",
            "platform": system,
            "total": len(services),
            "services": [s.model_dump() for s in services],
            "filters_applied": {
                "status": status_filter or "all",
                "search": search or None
            }
        }
        
    except Exception as e:
        logger.error(f"❌ [API] 获取服务列表失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"获取服务列表失败: {str(e)}")


@api_router.post("/batch/operations")
async def execute_batch_operation(request: BatchOperationRequest):
    """
    执行批量操作（重启服务、部署应用、配置更新）
    
    安全特性：
    1. 用户必须明确确认（confirmed=True）
    2. 高风险操作需要二次验证
    3. 支持灰度发布（先执行部分目标）
    4. 实时进度反馈
    5. 失败自动重试机制
    """
    import uuid
    from datetime import datetime
    
    # ========== 安全检查 ==========
    if not request.confirmed:
        raise HTTPException(
            status_code=400, 
            detail={
                "error": "CONFIRMATION_REQUIRED",
                "message": "⚠️ 请先确认此操作！这是一个高风险批量操作。",
                "action": "需要用户在界面上点击'确认执行'按钮"
            }
        )
    
    # 验证操作类型
    valid_operations = ['restart_service', 'deploy_app', 'update_config']
    if request.operation_type not in valid_operations:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的操作类型: {request.operation_type}。支持的操作: {valid_operations}"
        )
    
    # 验证目标列表
    if not request.targets or len(request.targets) == 0:
        raise HTTPException(status_code=400, detail="至少需要选择一个目标服务/应用")
    
    operation_id = str(uuid.uuid4())[:8].upper()
    logger.info(f"🚀 [批量操作] 开始执行 #{operation_id}:")
    logger.info(f"   - 操作类型: {request.operation_type}")
    logger.info(f"   - 目标数量: {len(request.targets)}")
    logger.info(f"   - 目标列表: {request.targets[:5]}{'...' if len(request.targets) > 5 else ''}")
    
    # 获取执行选项
    max_concurrent = request.options.get('max_concurrent', 5)
    retry_count = request.options.get('retry_count', 2)
    timeout = request.options.get('timeout', 30)
    canary_percent = request.options.get('canary_percent', 20)  # 灰度比例
    
    results = []
    summary = {"total": len(request.targets), "success": 0, "failed": 0, "running": 0, "skipped": 0}
    start_time = datetime.now().isoformat()
    
    try:
        import platform
        
        # 根据操作系统生成实际命令
        system = platform.system()
        
        for idx, target in enumerate(request.targets):
            result = BatchOperationResult(target=target, status="pending", start_time=datetime.now().isoformat())
            
            try:
                # 灰度发布逻辑：如果还没达到灰度比例，跳过
                canary_threshold = len(request.targets) * canary_percent / 100
                if idx > 0 and idx < canary_threshold and request.options.get('canary_mode'):
                    # 检查前面的任务是否有失败的
                    has_failure = any(r.status == 'failed' for r in results[:int(canary_threshold)])
                    if has_failure:
                        result.status = 'skipped'
                        result.output = "⏸️ 灰度阶段检测到失败，已暂停后续执行"
                        summary['skipped'] += 1
                        results.append(result)
                        continue
                
                # 生成实际命令
                if request.operation_type == 'restart_service':
                    if system == 'Windows':
                        # Windows: 使用 net 命令重启服务（权限要求较低）
                        # 先停止再启动，使用 timeout 等待服务完全停止
                        cmd = f"net stop {target} && timeout /t 2 /nobreak > nul && net start {target}"
                    else:
                        cmd = f"sudo systemctl restart {target}"
                
                elif request.operation_type == 'deploy_app':
                    # 部署应用：支持多种部署方式
                    deploy_type = request.params.get('deploy_type', 'script')
                    deploy_folder = request.params.get('deploy_folder', '')
                    
                    if deploy_type == 'script':
                        # 自定义脚本部署
                        deploy_script = request.params.get('deploy_script', '')
                        if deploy_folder:
                            # 使用 PowerShell 的 Set-Location 来切换目录，更可靠
                            cmd = f'powershell -Command "Set-Location -Path \'{deploy_folder}\' ; {deploy_script}"' if system == 'Windows' else f'cd {deploy_folder} && {deploy_script}'
                        else:
                            cmd = deploy_script or f"echo 'Deploying {target}'"
                    
                    elif deploy_type == 'docker':
                        # Docker部署
                        image = request.params.get('image', target)
                        port = request.params.get('port', '8080')
                        if deploy_folder and system == 'Windows':
                            cmd = f'cd /d "{deploy_folder}" && docker pull {image} && docker stop {target} 2>nul && docker rm {target} 2>nul && docker run -d --name {target} -p {port}:{port} {image}'
                        else:
                            cmd = f"docker pull {image} && docker stop {target} 2>nul && docker rm {target} 2>nul && docker run -d --name {target} -p {port}:{port} {image}"
                    
                    elif deploy_type == 'git':
                        # Git拉取部署 - 智能判断使用 clone 还是 pull
                        repo_url = request.params.get('repo_url', '')
                        branch = request.params.get('branch', 'main')
                        deploy_path = request.params.get('deploy_path', f'./{target}')
                        
                        if deploy_folder:
                            full_path = f'{deploy_folder}/{deploy_path}'.replace('\\', '/')
                            # 使用 PowerShell 检查目录是否存在且是Git仓库
                            check_cmd = f'powershell -Command "if (Test-Path \'{full_path}/.git\') {{ exit 0 }} else {{ exit 1 }}"'
                            try:
                                check_result = subprocess.run(check_cmd, shell=True, capture_output=True, timeout=5)
                                is_git_repo = check_result.returncode == 0
                            except Exception as e:
                                logger.warning(f"检查Git仓库状态失败: {e}")
                                is_git_repo = False
                            
                            if is_git_repo:
                                # 是Git仓库，执行pull
                                cmd = f'cd /d "{full_path}" && git pull origin {branch}'
                            else:
                                # 不是Git仓库，执行clone - 使用 cmd 直接执行，避免 PowerShell 解析问题
                                # 如果指定分支克隆失败，尝试默认分支
                                cmd = f'cd /d "{deploy_folder}" && (git clone -b {branch} "{repo_url}" "{deploy_path}" 2>nul || git clone "{repo_url}" "{deploy_path}")'
                        else:
                            cmd = f'git clone -b {branch} "{repo_url}" "{deploy_path}" 2>nul || git clone "{repo_url}" "{deploy_path}"'
                    
                    elif deploy_type == 'file':
                        # 文件复制部署
                        source_path = request.params.get('source_path', '')
                        target_path = request.params.get('target_path', f'./{target}')
                        if deploy_folder:
                            target_path = f'{deploy_folder}\\{target_path}' if system == 'Windows' else f'{deploy_folder}/{target_path}'
                        cmd = f"xcopy /Y /E \"{source_path}\" \"{target_path}\"" if system == 'Windows' else f"cp -r {source_path} {target_path}"
                    
                    else:
                        cmd = f"echo 'Unknown deploy type: {deploy_type}'"
                
                elif request.operation_type == 'update_config':
                    config_path = request.params.get('config_path', '')
                    new_content = request.params.get('new_content', '')
                    cmd = f"echo '{new_content}' > {config_path}" if config_path else f"echo 'Config update for {target}'"
                
                else:
                    cmd = f"echo 'Unknown operation: {request.operation_type}'"
                
                # 执行命令
                result.status = 'running'
                
                if system == 'Windows':
                    # Windows: 使用 cmd /c 执行，捕获权限错误
                    proc = await asyncio.create_subprocess_shell(
                        cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        shell=True
                    )
                else:
                    proc = await asyncio.create_subprocess_shell(
                        cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        shell=True,
                        executable='/bin/bash'
                    )
                
                try:
                    stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=timeout)
                    
                    result.output = stdout_bytes.decode('utf-8', errors='replace')
                    error_output = stderr_bytes.decode('utf-8', errors='replace')
                    
                    if proc.returncode == 0:
                        result.status = 'success'
                        summary['success'] += 1
                    else:
                        # 检查是否是权限错误
                        is_permission_error = any(keyword in error_output.lower() for keyword in [
                            'access is denied', 'system error 5', '权限', 'denied'
                        ])
                        
                        if is_permission_error and system == 'Windows':
                            # 尝试使用管理员权限重新执行
                            logger.warning(f"⚠️ 权限不足，尝试使用管理员权限执行: {target}")
                            
                            # 创建临时PowerShell脚本并使用Start-Process -Verb RunAs
                            admin_script = f'''
Start-Process powershell -Verb RunAs -ArgumentList "-Command Restart-Service -Name '{target}' -Force" -Wait
'''
                            import tempfile
                            with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False, encoding='utf-8') as f:
                                f.write(admin_script)
                                admin_script_path = f.name
                            
                            try:
                                admin_proc = await asyncio.create_subprocess_exec(
                                    'powershell',
                                    '-ExecutionPolicy', 'Bypass',
                                    '-File', admin_script_path,
                                    stdout=asyncio.subprocess.PIPE,
                                    stderr=asyncio.subprocess.PIPE
                                )
                                
                                admin_stdout, admin_stderr = await asyncio.wait_for(admin_proc.communicate(), timeout=timeout)
                                admin_output = admin_stdout.decode('utf-8', errors='replace')
                                admin_error = admin_stderr.decode('utf-8', errors='replace')
                                
                                if admin_proc.returncode == 0:
                                    result.output = admin_output or f"✅ 服务 {target} 已使用管理员权限重启"
                                    result.status = 'success'
                                    summary['success'] += 1
                                else:
                                    result.status = 'failed'
                                    result.error = f"❌ 权限不足，无法重启系统服务。\n\n错误详情:\n{error_output}\n\n建议:\n1. 以管理员身份运行后端服务器 (python -m api.app)\n2. 或选择非系统服务进行操作"
                                    summary['failed'] += 1
                            finally:
                                try:
                                    os.unlink(admin_script_path)
                                except:
                                    pass
                        else:
                            # 尝试重试
                            for attempt in range(retry_count):
                                logger.warning(f"⚠️ 重试 {attempt+1}/{retry_count}: {target}")
                                
                                if system == 'Windows':
                                    proc_retry = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, shell=True)
                                else:
                                    proc_retry = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, shell=True, executable='/bin/bash')
                                
                                stdout_retry, stderr_retry = await asyncio.wait_for(proc_retry.communicate(), timeout=timeout)
                                
                                if proc_retry.returncode == 0:
                                    result.output = stdout_retry.decode('utf-8')
                                    result.status = 'success'
                                    summary['success'] += 1
                                    break
                            else:
                                result.status = 'failed'
                                result.error = f"Exit code: {proc.returncode}\n{error_output}"
                                summary['failed'] += 1
                    
                except asyncio.TimeoutError:
                    proc.kill()
                    result.status = 'failed'
                    result.error = f"执行超时 ({timeout}秒)"
                    summary['failed'] += 1
                
                result.end_time = datetime.now().isoformat()
                if result.start_time:
                    start_dt = datetime.fromisoformat(result.start_time)
                    end_dt = datetime.fromisoformat(result.end_time)
                    result.duration = (end_dt - start_dt).total_seconds()
                
            except Exception as e:
                result.status = 'failed'
                result.error = str(e)
                summary['failed'] += 1
                logger.error(f"❌ 操作失败 [{target}]: {e}")
            
            results.append(result)
            
            # 添加小延迟，避免并发过高
            await asyncio.sleep(0.1)
        
        end_time = datetime.now().isoformat()
        
        # 判断整体状态
        if summary['failed'] == 0:
            overall_status = 'completed'
        elif summary['success'] > 0:
            overall_status = 'partial_failed'
        else:
            overall_status = 'failed'
        
        logger.info(f"✅ [批量操作] #{operation_id} 完成:")
        logger.info(f"   - 总体状态: {overall_status}")
        logger.info(f"   - 成功: {summary['success']}, 失败: {summary['failed']}, 跳过: {summary['skipped']}")
        
        return BatchOperationResponse(
            operation_id=operation_id,
            operation_type=request.operation_type,
            total_targets=len(request.targets),
            results=results,
            summary=summary,
            status=overall_status,
            start_time=start_time,
            end_time=end_time
        ).model_dump()
        
    except Exception as e:
        logger.error(f"❌ [批量操作] 执行异常: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"批量操作执行失败: {str(e)}")



# ==================== 磁盘清理模块 ====================

class DiskScanRequest(BaseModel):
    scan_paths: List[str] = Field(default_factory=lambda: ['C:\\'], description="要扫描的路径列表")
    days_threshold: int = Field(default=30, description="文件天数阈值")

class DiskCleanupRequest(BaseModel):
    cleanup_items: List[Dict[str, Any]] = Field(..., description="要清理的项目列表")
    dry_run: bool = Field(default=True, description="是否仅预览")

class CleanupCategory(BaseModel):
    type: str
    size: str
    size_bytes: int
    files: int
    risk: str
    paths: List[str]

class DiskScanResponse(BaseModel):
    total_releasable: str
    total_bytes: int
    categories: List[CleanupCategory]
    recommendations: List[str]
    disk_usage: Dict[str, Any]

def _filter_by_disk(category: Dict[str, Any], scan_paths: List[str]) -> Dict[str, Any]:
    """根据扫描路径过滤文件，只保留指定磁盘的文件"""
    if not category.get('file_details'):
        return category
    
    # 获取要扫描的磁盘盘符
    target_disks = [p[0].upper() for p in scan_paths if len(p) > 0]
    
    # 过滤文件详情
    filtered_details = [
        f for f in category['file_details']
        if len(f['path']) > 0 and f['path'][0].upper() in target_disks
    ]
    
    if not filtered_details:
        return {**category, 'files': 0, 'size_bytes': 0, 'size': '0 B', 'paths': [], 'file_details': []}
    
    # 重新计算统计信息
    total_size = sum(f['size'] for f in filtered_details)
    
    return {
        **category,
        'files': len(filtered_details),
        'size_bytes': total_size,
        'size': _format_size(total_size),
        'paths': [f['path'] for f in filtered_details],
        'file_details': filtered_details
    }

@api_router.post("/disk/scan", response_model=DiskScanResponse)
async def scan_disk_cleanup(request: DiskScanRequest):
    """
    阶段1：智能扫描磁盘可清理内容
    """
    logger.info(f"🔍 [磁盘扫描] 开始扫描: {request.scan_paths}")
    
    try:
        categories = []
        total_bytes = 0
        
        # 1. 扫描临时文件
        temp_files = await _scan_temp_files(request.days_threshold)
        temp_files = _filter_by_disk(temp_files, request.scan_paths)
        if temp_files['files'] > 0:
            categories.append(temp_files)
            total_bytes += temp_files['size_bytes']
        
        # 2. 扫描日志文件
        log_files = await _scan_log_files(request.days_threshold)
        log_files = _filter_by_disk(log_files, request.scan_paths)
        if log_files['files'] > 0:
            categories.append(log_files)
            total_bytes += log_files['size_bytes']
        
        # 3. 扫描缓存文件
        cache_files = await _scan_cache_files()
        cache_files = _filter_by_disk(cache_files, request.scan_paths)
        if cache_files['files'] > 0:
            categories.append(cache_files)
            total_bytes += cache_files['size_bytes']
        
        # 4. 扫描回收站
        recycle_bin = await _scan_recycle_bin()
        recycle_bin = _filter_by_disk(recycle_bin, request.scan_paths)
        if recycle_bin['files'] > 0:
            categories.append(recycle_bin)
            total_bytes += recycle_bin['size_bytes']
        
        # 5. 扫描浏览器缓存
        browser_cache = await _scan_browser_cache()
        browser_cache = _filter_by_disk(browser_cache, request.scan_paths)
        if browser_cache['files'] > 0:
            categories.append(browser_cache)
            total_bytes += browser_cache['size_bytes']
        
        # 6. 扫描下载文件夹
        downloads = await _scan_downloads_folder(request.days_threshold)
        downloads = _filter_by_disk(downloads, request.scan_paths)
        if downloads['files'] > 0:
            categories.append(downloads)
            total_bytes += downloads['size_bytes']
        
        # 7. 扫描大文件 (>100MB)
        large_files = await _scan_large_files(request.scan_paths)
        if large_files['files'] > 0:
            categories.append(large_files)
            total_bytes += large_files['size_bytes']
        
        # 8. 扫描旧安装包
        old_installers = await _scan_old_installers(request.days_threshold)
        old_installers = _filter_by_disk(old_installers, request.scan_paths)
        if old_installers['files'] > 0:
            categories.append(old_installers)
            total_bytes += old_installers['size_bytes']
        
        # 9. 扫描系统更新缓存
        windows_update_cache = await _scan_windows_update_cache()
        windows_update_cache = _filter_by_disk(windows_update_cache, request.scan_paths)
        if windows_update_cache['files'] > 0:
            categories.append(windows_update_cache)
            total_bytes += windows_update_cache['size_bytes']
        
        # 10. 扫描缩略图缓存
        thumbnail_cache = await _scan_thumbnail_cache()
        thumbnail_cache = _filter_by_disk(thumbnail_cache, request.scan_paths)
        if thumbnail_cache['files'] > 0:
            categories.append(thumbnail_cache)
            total_bytes += thumbnail_cache['size_bytes']
        
        # 生成建议
        recommendations = _generate_recommendations(categories)
        
        # 获取指定磁盘的使用情况
        disk_usage = _get_disk_usage(request.scan_paths[0] if request.scan_paths else 'C:\\')
        
        return DiskScanResponse(
            total_releasable=_format_size(total_bytes),
            total_bytes=total_bytes,
            categories=categories,
            recommendations=recommendations,
            disk_usage=disk_usage
        )
        
    except Exception as e:
        logger.error(f"❌ [磁盘扫描] 失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"磁盘扫描失败: {str(e)}")

async def _scan_temp_files(days_threshold: int) -> Dict[str, Any]:
    """扫描临时文件 - 返回目录路径"""
    temp_paths = [
        os.environ.get('TEMP', ''),
        os.environ.get('TMP', ''),
        'C:\\Windows\\Temp',
    ]
    
    files = 0
    size_bytes = 0
    file_details = []
    
    for temp_path in temp_paths:
        if not temp_path or not os.path.exists(temp_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(temp_path):
                for filename in filenames:
                    try:
                        filepath = os.path.join(root, filename)
                        if os.path.exists(filepath):
                            stat = os.stat(filepath)
                            file_age_days = (time.time() - stat.st_mtime) / 86400
                            if file_age_days > days_threshold:
                                files += 1
                                size_bytes += stat.st_size
                                from datetime import datetime
                                file_details.append({
                                    'path': filepath,
                                    'size': stat.st_size,
                                    'size_formatted': _format_size(stat.st_size),
                                    'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                                    'name': filename
                                })
                    except:
                        pass
        except:
            pass
    
    # 按文件大小排序
    file_details.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        'type': '临时文件',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'low',
        'paths': [f['path'] for f in file_details],
        'file_details': file_details,
        'is_directory': False  # 改为文件级清理，让用户选择具体文件
    }

async def _scan_log_files(days_threshold: int) -> Dict[str, Any]:
    """扫描日志文件 - 返回具体文件列表"""
    log_paths = [
        'C:\\Windows\\Logs',
        'C:\\Windows\\System32\\LogFiles',
        os.path.expandvars('%LOCALAPPDATA%\\Temp'),
    ]
    
    files = 0
    size_bytes = 0
    file_details = []
    
    for log_path in log_paths:
        if not log_path or not os.path.exists(log_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(log_path):
                for filename in filenames:
                    if filename.endswith(('.log', '.txt', '.etl')):
                        try:
                            filepath = os.path.join(root, filename)
                            if os.path.exists(filepath):
                                stat = os.stat(filepath)
                                file_age_days = (time.time() - stat.st_mtime) / 86400
                                if file_age_days > days_threshold:
                                    files += 1
                                    size_bytes += stat.st_size
                                    from datetime import datetime
                                    file_details.append({
                                        'path': filepath,
                                        'size': stat.st_size,
                                        'size_formatted': _format_size(stat.st_size),
                                        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                                        'name': filename
                                    })
                        except:
                            pass
        except:
            pass
    
    # 按文件大小排序
    file_details.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        'type': '日志文件',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'low',
        'paths': [f['path'] for f in file_details],
        'file_details': file_details,
        'is_directory': False  # 文件级清理
    }

async def _scan_cache_files() -> Dict[str, Any]:
    """扫描缓存文件 - 返回具体文件列表"""
    cache_paths = [
        os.path.expandvars('%LOCALAPPDATA%\\Microsoft\\Windows\\INetCache'),
        os.path.expandvars('%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer'),
        os.path.expandvars('%APPDATA%\\Microsoft\\Windows\\Recent'),
    ]
    
    files = 0
    size_bytes = 0
    file_details = []
    
    for cache_path in cache_paths:
        if not cache_path or not os.path.exists(cache_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(cache_path):
                for filename in filenames:
                    try:
                        filepath = os.path.join(root, filename)
                        if os.path.exists(filepath):
                            stat = os.stat(filepath)
                            files += 1
                            size_bytes += stat.st_size
                            from datetime import datetime
                            file_details.append({
                                'path': filepath,
                                'size': stat.st_size,
                                'size_formatted': _format_size(stat.st_size),
                                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                                'name': filename
                            })
                    except:
                        pass
        except:
            pass
    
    # 按文件大小排序
    file_details.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        'type': '缓存文件',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'medium',
        'paths': [f['path'] for f in file_details],
        'file_details': file_details,
        'is_directory': False  # 文件级清理
    }

async def _scan_recycle_bin() -> Dict[str, Any]:
    """扫描回收站"""
    files = 0
    size_bytes = 0
    file_details = []
    
    try:
        import subprocess
        result = subprocess.run(
            ['powershell', '-Command', 
             '(New-Object -ComObject Shell.Application).NameSpace(0x0a).Items() | '
             'ForEach-Object { $_.Size; $_.Path }'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        lines = result.stdout.strip().split('\n')
        for i in range(0, len(lines), 2):
            if i < len(lines):
                try:
                    size = int(lines[i].strip())
                    path = lines[i + 1].strip() if i + 1 < len(lines) else ''
                    size_bytes += size
                    files += 1
                    from datetime import datetime
                    file_details.append({
                        'path': path,
                        'size': size,
                        'size_formatted': _format_size(size),
                        'modified': '-',
                        'name': path.split('\\')[-1] if path else '未知文件'
                    })
                except:
                    pass
    except Exception as e:
        logger.warning(f"扫描回收站失败: {e}")
    
    # 按文件大小排序
    file_details.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        'type': '回收站',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'low',
        'paths': [f['path'] for f in file_details],
        'file_details': file_details,
        'is_directory': False
    }

async def _scan_browser_cache() -> Dict[str, Any]:
    """扫描浏览器缓存 - 返回具体文件列表"""
    browser_paths = [
        os.path.expandvars('%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache'),
        os.path.expandvars('%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache'),
        os.path.expandvars('%LOCALAPPDATA%\\Mozilla\\Firefox\\Profiles'),
    ]
    
    files = 0
    size_bytes = 0
    file_details = []
    
    for browser_path in browser_paths:
        if not browser_path or not os.path.exists(browser_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(browser_path):
                for filename in filenames:
                    try:
                        filepath = os.path.join(root, filename)
                        if os.path.exists(filepath):
                            stat = os.stat(filepath)
                            files += 1
                            size_bytes += stat.st_size
                            from datetime import datetime
                            file_details.append({
                                'path': filepath,
                                'size': stat.st_size,
                                'size_formatted': _format_size(stat.st_size),
                                'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                                'name': filename
                            })
                    except:
                        pass
        except:
            pass
    
    # 按文件大小排序
    file_details.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        'type': '浏览器缓存',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'low',
        'paths': [f['path'] for f in file_details],
        'file_details': file_details,
        'is_directory': False  # 文件级清理
    }

async def _scan_downloads_folder(days_threshold: int) -> Dict[str, Any]:
    """扫描下载文件夹"""
    downloads_paths = [
        os.path.expandvars('%USERPROFILE%\\Downloads'),
        os.path.expandvars('%USERPROFILE%\\下载'),
    ]
    
    files = 0
    size_bytes = 0
    
    for downloads_path in downloads_paths:
        if not downloads_path or not os.path.exists(downloads_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(downloads_path):
                for filename in filenames:
                    try:
                        filepath = os.path.join(root, filename)
                        if os.path.exists(filepath):
                            stat = os.stat(filepath)
                            file_age_days = (time.time() - stat.st_mtime) / 86400
                            if file_age_days > days_threshold:
                                files += 1
                                size_bytes += stat.st_size
                    except:
                        pass
        except:
            pass
    
    return {
        'type': '下载文件夹(旧文件)',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'high',  # 高风险，因为可能包含重要文件
        'paths': [p for p in downloads_paths if p and os.path.exists(p)],
        'is_directory': True
    }

async def _scan_large_files(scan_paths: List[str] = None) -> Dict[str, Any]:
    """扫描大文件 (>100MB)，返回具体文件列表"""
    if scan_paths:
        # 根据扫描路径确定搜索范围
        target_disks = [p[0].upper() for p in scan_paths if len(p) > 0]
        search_paths = []
        for disk in target_disks:
            if disk == 'C':
                search_paths.extend(['C:\\Users', 'C:\\ProgramData'])
            else:
                search_paths.append(f'{disk}:\\')
    else:
        search_paths = [
            'C:\\Users',
            'C:\\ProgramData',
            'D:\\',
        ]
    
    files = 0
    size_bytes = 0
    file_details = []  # 存储文件详情
    
    for search_path in search_paths:
        if not os.path.exists(search_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(search_path):
                # 跳过某些系统目录
                if any(skip in root.lower() for skip in ['windows', 'program files', 'appdata\\local\\microsoft']):
                    continue
                    
                for filename in filenames:
                    try:
                        filepath = os.path.join(root, filename)
                        if os.path.exists(filepath):
                            size = os.path.getsize(filepath)
                            if size > 100 * 1024 * 1024:  # > 100MB
                                files += 1
                                size_bytes += size
                                # 获取文件修改时间
                                mtime = os.path.getmtime(filepath)
                                from datetime import datetime
                                file_details.append({
                                    'path': filepath,
                                    'size': size,
                                    'size_formatted': _format_size(size),
                                    'modified': datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M'),
                                    'name': filename
                                })
                    except:
                        pass
        except:
            pass
    
    # 按文件大小排序，最大的在前
    file_details.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        'type': '大文件(>100MB)',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'high',
        'paths': [f['path'] for f in file_details],  # 所有文件路径
        'file_details': file_details,  # 详细的文件信息
        'is_directory': False  # 文件级清理
    }

async def _scan_old_installers(days_threshold: int) -> Dict[str, Any]:
    """扫描旧安装包"""
    search_paths = [
        os.path.expandvars('%USERPROFILE%\\Downloads'),
        'C:\\Software',
        'D:\\',
    ]
    
    installer_extensions = ['.exe', '.msi', '.zip', '.rar', '.7z', '.dmg', '.pkg']
    files = 0
    size_bytes = 0
    
    for search_path in search_paths:
        if not os.path.exists(search_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(search_path):
                for filename in filenames:
                    if any(filename.lower().endswith(ext) for ext in installer_extensions):
                        try:
                            filepath = os.path.join(root, filename)
                            if os.path.exists(filepath):
                                stat = os.stat(filepath)
                                file_age_days = (time.time() - stat.st_mtime) / 86400
                                if file_age_days > days_threshold:
                                    files += 1
                                    size_bytes += stat.st_size
                        except:
                            pass
        except:
            pass
    
    return {
        'type': '旧安装包',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'medium',
        'paths': search_paths,
        'is_directory': False
    }

async def _scan_windows_update_cache() -> Dict[str, Any]:
    """扫描Windows更新缓存"""
    update_paths = [
        'C:\\Windows\\SoftwareDistribution\\Download',
        'C:\\Windows\\Temp',
    ]
    
    files = 0
    size_bytes = 0
    
    for update_path in update_paths:
        if not os.path.exists(update_path):
            continue
        
        try:
            for root, dirs, filenames in os.walk(update_path):
                for filename in filenames:
                    try:
                        filepath = os.path.join(root, filename)
                        if os.path.exists(filepath):
                            stat = os.stat(filepath)
                            files += 1
                            size_bytes += stat.st_size
                    except:
                        pass
        except:
            pass
    
    return {
        'type': 'Windows更新缓存',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'low',
        'paths': [p for p in update_paths if os.path.exists(p)],
        'is_directory': True
    }

async def _scan_thumbnail_cache() -> Dict[str, Any]:
    """扫描缩略图缓存"""
    thumbnail_path = os.path.expandvars('%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer')
    
    files = 0
    size_bytes = 0
    
    if os.path.exists(thumbnail_path):
        try:
            for root, dirs, filenames in os.walk(thumbnail_path):
                for filename in filenames:
                    if 'thumb' in filename.lower() or filename.endswith('.db'):
                        try:
                            filepath = os.path.join(root, filename)
                            if os.path.exists(filepath):
                                stat = os.stat(filepath)
                                files += 1
                                size_bytes += stat.st_size
                        except:
                            pass
        except:
            pass
    
    return {
        'type': '缩略图缓存',
        'size': _format_size(size_bytes),
        'size_bytes': size_bytes,
        'files': files,
        'risk': 'low',
        'paths': [thumbnail_path] if os.path.exists(thumbnail_path) else [],
        'is_directory': True
    }

def _generate_recommendations(categories: List[Dict]) -> List[str]:
    """生成清理建议"""
    recommendations = []
    
    for cat in categories:
        if cat['files'] == 0:
            continue
            
        if cat['type'] == '临时文件':
            recommendations.append(f"✅ 建议清理临时文件，可释放 {cat['size']}，风险较低")
        elif cat['type'] == '日志文件':
            recommendations.append(f"✅ 建议清理旧日志文件，可释放 {cat['size']}")
        elif cat['type'] == '缓存文件':
            recommendations.append(f"⚠️ 缓存文件可清理 {cat['size']}，但可能影响应用启动速度")
        elif cat['type'] == '回收站':
            recommendations.append(f"✅ 清空回收站可释放 {cat['size']}")
        elif cat['type'] == '浏览器缓存':
            recommendations.append(f"✅ 清理浏览器缓存可释放 {cat['size']}，不影响书签和密码")
        elif cat['type'] == '下载文件夹(旧文件)':
            recommendations.append(f"⚠️ 下载文件夹有 {cat['size']} 的旧文件，请确认后再清理")
        elif cat['type'] == '大文件(>100MB)':
            recommendations.append(f"🔍 发现 {cat['files']} 个大文件，共 {cat['size']}，请手动确认")
        elif cat['type'] == '旧安装包':
            recommendations.append(f"✅ 发现 {cat['size']} 的旧安装包，通常可以安全删除")
        elif cat['type'] == 'Windows更新缓存':
            recommendations.append(f"✅ Windows更新缓存可释放 {cat['size']}，清理后可重新下载更新")
        elif cat['type'] == '缩略图缓存':
            recommendations.append(f"✅ 缩略图缓存可释放 {cat['size']}，系统会自动重建")
    
    if not recommendations:
        recommendations.append("🎉 磁盘状态良好，暂无需要清理的内容")
    
    return recommendations

def _get_disk_usage(path: str = 'C:\\') -> Dict[str, Any]:
    """获取磁盘使用情况"""
    try:
        import shutil
        total, used, free = shutil.disk_usage(path)
        return {
            'total': _format_size(total),
            'used': _format_size(used),
            'free': _format_size(free),
            'percent': round(used / total * 100, 1)
        }
    except:
        return {
            'total': 'Unknown',
            'used': 'Unknown',
            'free': 'Unknown',
            'percent': 0
        }

def _format_size(size_bytes: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"

@api_router.post("/disk/cleanup")
async def execute_disk_cleanup(request: DiskCleanupRequest):
    """
    阶段3：执行磁盘清理
    """
    logger.info(f"🧹 [磁盘清理] 开始执行, dry_run={request.dry_run}")
    
    try:
        results = []
        total_freed = 0
        
        for item in request.cleanup_items:
            result = await _cleanup_item(item, request.dry_run)
            results.append(result)
            if result.get('freed_bytes'):
                total_freed += result['freed_bytes']
        
        return {
            'status': 'success' if not request.dry_run else 'preview',
            'dry_run': request.dry_run,
            'total_freed': _format_size(total_freed),
            'total_freed_bytes': total_freed,
            'results': results,
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ [磁盘清理] 执行失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"磁盘清理失败: {str(e)}")

async def _cleanup_item(item: Dict[str, Any], dry_run: bool) -> Dict[str, Any]:
    """清理单个项目 - 支持目录级和文件级清理"""
    cleanup_type = item.get('type', '')
    paths = item.get('paths', [])
    is_directory = item.get('is_directory', False)
    freed_bytes = 0
    commands = []
    
    # 特殊处理：回收站
    if cleanup_type == '回收站':
        if dry_run:
            commands.append("清空回收站")
        else:
            try:
                import subprocess
                result = subprocess.run(
                    ['powershell', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'],
                    capture_output=True,
                    timeout=30,
                    text=True
                )
                if result.returncode != 0:
                    logger.warning(f"清空回收站警告: {result.stderr}")
                logger.info("✅ 已清空回收站")
            except Exception as e:
                logger.error(f"❌ 清空回收站失败: {e}")
        return {
            'type': cleanup_type,
            'status': 'success',
            'freed': _format_size(freed_bytes),
            'freed_bytes': freed_bytes,
            'commands': commands if dry_run else []
        }
    
    if is_directory:
        # 目录级清理：删除目录下所有内容（保留目录本身）
        for dir_path in paths:
            if dry_run:
                commands.append(f"清理目录: {dir_path} (及其子目录)")
            else:
                try:
                    if os.path.exists(dir_path):
                        freed = _cleanup_directory(dir_path)
                        freed_bytes += freed
                        logger.info(f"✅ 清理目录 {dir_path}: 释放 {_format_size(freed)}")
                except Exception as e:
                    logger.error(f"❌ 清理目录失败 {dir_path}: {e}")
    else:
        # 文件级清理：逐个删除文件
        for path in paths:
            if dry_run:
                commands.append(f"删除: {path}")
            else:
                try:
                    if os.path.exists(path):
                        size = os.path.getsize(path)
                        os.remove(path)
                        freed_bytes += size
                except Exception as e:
                    logger.warning(f"删除文件失败 {path}: {e}")
    
    return {
        'type': cleanup_type,
        'status': 'success',
        'freed': _format_size(freed_bytes),
        'freed_bytes': freed_bytes,
        'commands': commands if dry_run else [],
        'cleaned_count': len(commands) if dry_run else 0
    }

def _cleanup_directory(dir_path: str) -> int:
    """递归清理目录下所有文件，返回释放的字节数"""
    total_freed = 0
    
    # 检查是否是浏览器缓存目录（需要特殊处理）
    is_browser_cache = any(keyword in dir_path.lower() for keyword in [
        'chrome', 'edge', 'firefox', 'cache'
    ])
    
    if is_browser_cache:
        # 浏览器缓存：使用 PowerShell 强制删除（处理文件锁定）
        try:
            import subprocess
            
            # 先尝试结束浏览器进程
            logger.info("🔄 尝试结束浏览器进程...")
            subprocess.run(
                ['powershell', '-Command',
                 'Get-Process chrome, msedge, firefox -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue'],
                capture_output=True,
                timeout=10
            )
            
            # 等待进程结束
            import time
            time.sleep(1)
            
            # 计算清理前的大小
            result = subprocess.run(
                ['powershell', '-Command',
                 f'$items = Get-ChildItem -Path "{dir_path}" -Recurse -Force -ErrorAction SilentlyContinue; '
                 f'if ($items) {{ ($items | Measure-Object -Property Length -Sum).Sum }} else {{ 0 }}'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            try:
                size_before = float(result.stdout.strip()) if result.stdout.strip() else 0
            except:
                size_before = 0
            
            # 使用 PowerShell 的 Remove-Item -Recurse -Force 强制删除
            result = subprocess.run(
                ['powershell', '-Command',
                 f'Remove-Item -Path "{dir_path}\\*" -Recurse -Force -ErrorAction SilentlyContinue; '
                 f'if (-not (Test-Path "{dir_path}")) {{ New-Item -ItemType Directory -Path "{dir_path}" -Force | Out-Null }}'],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # 计算清理后的大小
            result = subprocess.run(
                ['powershell', '-Command',
                 f'$items = Get-ChildItem -Path "{dir_path}" -Recurse -Force -ErrorAction SilentlyContinue; '
                 f'if ($items) {{ ($items | Measure-Object -Property Length -Sum).Sum }} else {{ 0 }}'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            try:
                size_after = float(result.stdout.strip()) if result.stdout.strip() else 0
            except:
                size_after = 0
            
            freed = int(size_before - size_after)
            logger.info(f"✅ 使用 PowerShell 清理浏览器缓存: {dir_path}, 释放 {freed} bytes")
            return freed if freed > 0 else 0
            
        except Exception as e:
            logger.warning(f"PowerShell 清理浏览器缓存失败，尝试普通方式: {e}")
    
    # 普通目录清理
    for root, dirs, filenames in os.walk(dir_path, topdown=False):
        # 先删除文件
        for filename in filenames:
            filepath = os.path.join(root, filename)
            try:
                if os.path.exists(filepath):
                    size = os.path.getsize(filepath)
                    os.remove(filepath)
                    total_freed += size
            except Exception as e:
                logger.debug(f"无法删除文件 {filepath}: {e}")
        
        # 再删除空目录
        for dirname in dirs:
            dirpath = os.path.join(root, dirname)
            try:
                if os.path.isdir(dirpath):
                    os.rmdir(dirpath)  # 只能删除空目录
            except Exception as e:
                logger.debug(f"无法删除目录 {dirpath}: {e}")
    
    return total_freed


# ==================== 定时任务管理 ====================

import sqlite3
import threading
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor

# 定时任务数据库
SCHEDULER_DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'scheduler.db')
os.makedirs(os.path.dirname(SCHEDULER_DB), exist_ok=True)

# 任务执行历史数据库
TASK_HISTORY_DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'task_history.db')

# 初始化调度器
scheduler = None

def init_scheduler():
    """初始化定时任务调度器"""
    global scheduler
    if scheduler is not None:
        return scheduler
    
    jobstores = {
        'default': SQLAlchemyJobStore(url=f'sqlite:///{SCHEDULER_DB}')
    }
    executors = {
        'default': ThreadPoolExecutor(20)
    }
    
    scheduler = BackgroundScheduler(jobstores=jobstores, executors=executors, timezone='Asia/Shanghai')
    scheduler.start()
    logger.info("✅ 定时任务调度器已启动")
    return scheduler

def init_task_history_db():
    """初始化任务执行历史数据库"""
    conn = sqlite3.connect(TASK_HISTORY_DB)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS task_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            task_name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            duration REAL,
            status TEXT NOT NULL,
            result TEXT,
            error_message TEXT
        )
    ''')
    conn.commit()
    conn.close()

# 数据模型
class ScheduledTask(BaseModel):
    id: Optional[str] = None
    name: str
    task_type: str  # 'cleanup', 'backup', 'script', 'custom'
    cron_expression: str
    enabled: bool = True
    config: Dict[str, Any] = {}  # 任务配置
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TaskExecutionLog(BaseModel):
    id: Optional[int] = None
    task_id: str
    task_name: str
    task_type: str
    start_time: str
    end_time: Optional[str] = None
    duration: Optional[float] = None
    status: str  # 'running', 'success', 'failed'
    result: Optional[str] = None
    error_message: Optional[str] = None

class TaskStats(BaseModel):
    total_tasks: int
    enabled_tasks: int
    total_executions: int
    success_rate: float
    avg_duration: float
    recent_executions: List[Dict[str, Any]]
    top_tasks: List[Dict[str, Any]]

# 任务执行函数
def execute_cleanup_task(task_id: str, task_name: str, config: Dict[str, Any]):
    """执行清理任务"""
    start_time = datetime.now()
    log_id = None
    
    try:
        # 记录开始
        log_id = _log_task_start(task_id, task_name, 'cleanup')
        
        # 执行清理
        cleanup_types = config.get('cleanup_types', ['Windows更新缓存', '浏览器缓存'])
        disk = config.get('disk', 'C')
        
        results = []
        total_freed = 0
        
        for cleanup_type in cleanup_types:
            if cleanup_type == 'Windows更新缓存':
                freed = _cleanup_windows_update_cache(disk)
            elif cleanup_type == '浏览器缓存':
                freed = _cleanup_browser_cache_auto(disk)
            elif cleanup_type == '临时文件':
                freed = _cleanup_temp_files_auto(disk)
            elif cleanup_type == '缩略图缓存':
                freed = _cleanup_thumbnail_cache_auto(disk)
            else:
                freed = 0
            
            total_freed += freed
            results.append({'type': cleanup_type, 'freed': freed})
        
        # 记录成功
        duration = (datetime.now() - start_time).total_seconds()
        _log_task_end(log_id, 'success', f'释放 {_format_size(total_freed)}', duration)
        
        logger.info(f"✅ 清理任务完成: {task_name}, 释放 {_format_size(total_freed)}")
        return {'success': True, 'freed': total_freed}
        
    except Exception as e:
        # 记录失败
        duration = (datetime.now() - start_time).total_seconds()
        if log_id:
            _log_task_end(log_id, 'failed', None, duration, str(e))
        logger.error(f"❌ 清理任务失败: {task_name}, {e}")
        return {'success': False, 'error': str(e)}

def execute_backup_task(task_id: str, task_name: str, config: Dict[str, Any]):
    """执行备份任务"""
    start_time = datetime.now()
    log_id = None
    
    try:
        # 记录开始
        log_id = _log_task_start(task_id, task_name, 'backup')
        
        backup_path = config.get('backup_path', 'C:\\Backups')
        backup_type = config.get('backup_type', 'database')  # 'database', 'files', 'full'
        
        # 创建备份目录
        os.makedirs(backup_path, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if backup_type == 'database':
            # 备份数据库文件
            db_files = [
                SCHEDULER_DB,
                TASK_HISTORY_DB,
            ]
            
            backup_files = []
            for db_file in db_files:
                if os.path.exists(db_file):
                    backup_name = f"{os.path.basename(db_file)}.{timestamp}.bak"
                    backup_file = os.path.join(backup_path, backup_name)
                    import shutil
                    shutil.copy2(db_file, backup_file)
                    backup_files.append(backup_file)
            
            result = f'备份了 {len(backup_files)} 个数据库文件'
        
        elif backup_type == 'files':
            # 备份指定文件夹
            source_paths = config.get('source_paths', [])
            backup_files = []
            
            for source_path in source_paths:
                if os.path.exists(source_path):
                    backup_name = f"{os.path.basename(source_path)}.{timestamp}"
                    backup_file = os.path.join(backup_path, backup_name)
                    import shutil
                    if os.path.isdir(source_path):
                        shutil.copytree(source_path, backup_file)
                    else:
                        shutil.copy2(source_path, backup_file)
                    backup_files.append(backup_file)
            
            result = f'备份了 {len(backup_files)} 个文件/文件夹'
        
        else:
            result = '未指定备份类型'
        
        # 记录成功
        duration = (datetime.now() - start_time).total_seconds()
        _log_task_end(log_id, 'success', result, duration)
        
        logger.info(f"✅ 备份任务完成: {task_name}, {result}")
        return {'success': True, 'result': result}
        
    except Exception as e:
        # 记录失败
        duration = (datetime.now() - start_time).total_seconds()
        if log_id:
            _log_task_end(log_id, 'failed', None, duration, str(e))
        logger.error(f"❌ 备份任务失败: {task_name}, {e}")
        return {'success': False, 'error': str(e)}

def execute_script_task(task_id: str, task_name: str, config: Dict[str, Any]):
    """执行脚本任务"""
    start_time = datetime.now()
    log_id = None
    
    try:
        # 记录开始
        log_id = _log_task_start(task_id, task_name, 'script')
        
        script_path = config.get('script_path', '')
        script_content = config.get('script_content', '')
        
        if script_path and os.path.exists(script_path):
            # 执行脚本文件
            import subprocess
            result = subprocess.run(
                ['powershell', '-ExecutionPolicy', 'Bypass', '-File', script_path],
                capture_output=True,
                text=True,
                timeout=300
            )
            output = result.stdout if result.returncode == 0 else result.stderr
            success = result.returncode == 0
        elif script_content:
            # 执行脚本内容
            import subprocess
            result = subprocess.run(
                ['powershell', '-ExecutionPolicy', 'Bypass', '-Command', script_content],
                capture_output=True,
                text=True,
                timeout=300
            )
            output = result.stdout if result.returncode == 0 else result.stderr
            success = result.returncode == 0
        else:
            raise ValueError("未指定脚本路径或内容")
        
        # 记录结果
        duration = (datetime.now() - start_time).total_seconds()
        status = 'success' if success else 'failed'
        _log_task_end(log_id, status, output[:500], duration)
        
        logger.info(f"✅ 脚本任务完成: {task_name}")
        return {'success': success, 'output': output}
        
    except Exception as e:
        # 记录失败
        duration = (datetime.now() - start_time).total_seconds()
        if log_id:
            _log_task_end(log_id, 'failed', None, duration, str(e))
        logger.error(f"❌ 脚本任务失败: {task_name}, {e}")
        return {'success': False, 'error': str(e)}

# 辅助函数
def _cleanup_windows_update_cache(disk: str) -> int:
    """清理Windows更新缓存"""
    update_paths = [
        f'{disk}:\\Windows\\SoftwareDistribution\\Download',
        f'{disk}:\\Windows\\Temp',
    ]
    
    total_freed = 0
    for path in update_paths:
        if os.path.exists(path):
            for root, dirs, files in os.walk(path):
                for file in files:
                    try:
                        filepath = os.path.join(root, file)
                        size = os.path.getsize(filepath)
                        os.remove(filepath)
                        total_freed += size
                    except:
                        pass
    return total_freed

def _cleanup_browser_cache_auto(disk: str) -> int:
    """自动清理浏览器缓存"""
    browser_paths = [
        os.path.expandvars('%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache'),
        os.path.expandvars('%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache'),
    ]
    
    total_freed = 0
    for path in browser_paths:
        if os.path.exists(path):
            try:
                import subprocess
                subprocess.run(
                    ['powershell', '-Command',
                     f'Remove-Item -Path "{path}\\*" -Recurse -Force -ErrorAction SilentlyContinue'],
                    capture_output=True,
                    timeout=60
                )
            except:
                pass
    return total_freed

def _cleanup_temp_files_auto(disk: str) -> int:
    """清理临时文件"""
    temp_paths = [
        os.environ.get('TEMP', ''),
        f'{disk}:\\Windows\\Temp',
    ]
    
    total_freed = 0
    for path in temp_paths:
        if path and os.path.exists(path):
            for root, dirs, files in os.walk(path):
                for file in files:
                    try:
                        filepath = os.path.join(root, file)
                        if os.path.exists(filepath):
                            size = os.path.getsize(filepath)
                            os.remove(filepath)
                            total_freed += size
                    except:
                        pass
    return total_freed

def _cleanup_thumbnail_cache_auto(disk: str) -> int:
    """清理缩略图缓存"""
    thumbnail_path = os.path.expandvars('%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer')
    
    total_freed = 0
    if os.path.exists(thumbnail_path):
        for file in os.listdir(thumbnail_path):
            if 'thumb' in file.lower() or file.endswith('.db'):
                try:
                    filepath = os.path.join(thumbnail_path, file)
                    size = os.path.getsize(filepath)
                    os.remove(filepath)
                    total_freed += size
                except:
                    pass
    return total_freed

def _log_task_start(task_id: str, task_name: str, task_type: str) -> int:
    """记录任务开始"""
    conn = sqlite3.connect(TASK_HISTORY_DB)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO task_history (task_id, task_name, task_type, start_time, status)
        VALUES (?, ?, ?, ?, ?)
    ''', (task_id, task_name, task_type, datetime.now().isoformat(), 'running'))
    log_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return log_id

def _log_task_end(log_id: int, status: str, result: Optional[str], duration: float, error: Optional[str] = None):
    """记录任务结束"""
    conn = sqlite3.connect(TASK_HISTORY_DB)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE task_history 
        SET end_time = ?, duration = ?, status = ?, result = ?, error_message = ?
        WHERE id = ?
    ''', (datetime.now().isoformat(), duration, status, result, error, log_id))
    conn.commit()
    conn.close()

# API端点
@api_router.get("/scheduler/tasks")
async def get_scheduled_tasks():
    """获取所有定时任务"""
    try:
        init_scheduler()
        
        jobs = scheduler.get_jobs()
        tasks = []
        
        for job in jobs:
            tasks.append({
                'id': job.id,
                'name': job.name or job.id,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger),
                'enabled': job.next_run_time is not None
            })
        
        return {'tasks': tasks, 'total': len(tasks)}
    except Exception as e:
        logger.error(f"获取定时任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/scheduler/tasks")
async def create_scheduled_task(task: ScheduledTask):
    """创建定时任务"""
    try:
        init_scheduler()
        
        task_id = task.id or f"task_{int(time.time())}"
        
        # 根据任务类型选择执行函数
        if task.task_type == 'cleanup':
            func = execute_cleanup_task
            args = [task_id, task.name, task.config]
        elif task.task_type == 'backup':
            func = execute_backup_task
            args = [task_id, task.name, task.config]
        elif task.task_type == 'script':
            func = execute_script_task
            args = [task_id, task.name, task.config]
        else:
            raise HTTPException(status_code=400, detail="不支持的任务类型")
        
        # 解析cron表达式
        parts = task.cron_expression.split()
        if len(parts) != 5:
            raise HTTPException(status_code=400, detail="无效的cron表达式")
        
        trigger = CronTrigger(
            minute=parts[0],
            hour=parts[1],
            day=parts[2],
            month=parts[3],
            day_of_week=parts[4]
        )
        
        # 添加任务
        if task.enabled:
            scheduler.add_job(
                func,
                trigger=trigger,
                id=task_id,
                name=task.name,
                args=args,
                replace_existing=True
            )
        else:
            # 暂停的任务也要添加，但暂停
            scheduler.add_job(
                func,
                trigger=trigger,
                id=task_id,
                name=task.name,
                args=args,
                replace_existing=True
            )
            scheduler.pause_job(task_id)
        
        return {
            'id': task_id,
            'name': task.name,
            'cron': task.cron_expression,
            'enabled': task.enabled,
            'message': '任务创建成功'
        }
    except Exception as e:
        logger.error(f"创建定时任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/scheduler/tasks/{task_id}")
async def update_scheduled_task(task_id: str, task: ScheduledTask):
    """更新定时任务"""
    try:
        init_scheduler()
        
        # 删除旧任务
        scheduler.remove_job(task_id)
        
        # 创建新任务
        task.id = task_id
        return await create_scheduled_task(task)
    except Exception as e:
        logger.error(f"更新定时任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/scheduler/tasks/{task_id}")
async def delete_scheduled_task(task_id: str):
    """删除定时任务"""
    try:
        init_scheduler()
        scheduler.remove_job(task_id)
        return {'message': '任务已删除', 'task_id': task_id}
    except Exception as e:
        logger.error(f"删除定时任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/scheduler/tasks/{task_id}/execute")
async def execute_task_now(task_id: str):
    """立即执行任务"""
    try:
        init_scheduler()
        
        job = scheduler.get_job(task_id)
        if not job:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 立即执行
        func = job.func
        args = job.args
        
        # 在后台线程执行
        import threading
        thread = threading.Thread(target=func, args=args)
        thread.start()
        
        return {'message': '任务已开始执行', 'task_id': task_id}
    except Exception as e:
        logger.error(f"执行任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/scheduler/tasks/{task_id}/toggle")
async def toggle_task(task_id: str):
    """启用/暂停任务"""
    try:
        init_scheduler()
        
        job = scheduler.get_job(task_id)
        if not job:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        if job.next_run_time:
            scheduler.pause_job(task_id)
            return {'message': '任务已暂停', 'task_id': task_id, 'enabled': False}
        else:
            scheduler.resume_job(task_id)
            return {'message': '任务已启用', 'task_id': task_id, 'enabled': True}
    except Exception as e:
        logger.error(f"切换任务状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/scheduler/stats")
async def get_scheduler_stats():
    """获取调度器统计信息"""
    try:
        init_task_history_db()
        
        conn = sqlite3.connect(TASK_HISTORY_DB)
        cursor = conn.cursor()
        
        # 总执行次数
        cursor.execute('SELECT COUNT(*) FROM task_history')
        total_executions = cursor.fetchone()[0]
        
        # 成功次数
        cursor.execute('SELECT COUNT(*) FROM task_history WHERE status = ?', ('success',))
        success_count = cursor.fetchone()[0]
        
        # 成功率
        success_rate = (success_count / total_executions * 100) if total_executions > 0 else 0
        
        # 平均耗时
        cursor.execute('SELECT AVG(duration) FROM task_history WHERE duration IS NOT NULL')
        avg_duration = cursor.fetchone()[0] or 0
        
        # 最近执行记录
        cursor.execute('''
            SELECT task_id, task_name, task_type, start_time, end_time, duration, status, result
            FROM task_history
            ORDER BY start_time DESC
            LIMIT 10
        ''')
        recent_executions = [
            {
                'task_id': row[0],
                'task_name': row[1],
                'task_type': row[2],
                'start_time': row[3],
                'end_time': row[4],
                'duration': row[5],
                'status': row[6],
                'result': row[7]
            }
            for row in cursor.fetchall()
        ]
        
        # Top 5 高频任务
        cursor.execute('''
            SELECT task_name, COUNT(*) as count
            FROM task_history
            GROUP BY task_name
            ORDER BY count DESC
            LIMIT 5
        ''')
        top_tasks = [
            {'name': row[0], 'count': row[1]}
            for row in cursor.fetchall()
        ]
        
        # 今日统计
        today = datetime.now().strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*), 
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END),
                   AVG(duration)
            FROM task_history
            WHERE DATE(start_time) = ?
        ''', (today,))
        today_stats = cursor.fetchone()
        
        # 本月统计
        month_start = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        cursor.execute('''
            SELECT COUNT(*), 
                   SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END),
                   AVG(duration)
            FROM task_history
            WHERE DATE(start_time) >= ?
        ''', (month_start,))
        month_stats = cursor.fetchone()
        
        # 最近7天趋势
        cursor.execute('''
            SELECT DATE(start_time) as date, COUNT(*) as count
            FROM task_history
            WHERE DATE(start_time) >= DATE('now', '-7 days')
            GROUP BY DATE(start_time)
            ORDER BY date
        ''')
        trend_7days = [
            {'date': row[0], 'count': row[1]}
            for row in cursor.fetchall()
        ]
        
        # 任务类型分布
        cursor.execute('''
            SELECT task_type, COUNT(*) as count
            FROM task_history
            GROUP BY task_type
        ''')
        task_type_distribution = [
            {'type': row[0], 'count': row[1]}
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return {
            'total_executions': total_executions,
            'success_rate': round(success_rate, 2),
            'avg_duration': round(avg_duration, 2),
            'recent_executions': recent_executions,
            'top_tasks': top_tasks,
            'today_stats': {
                'total': today_stats[0] or 0,
                'success': today_stats[1] or 0,
                'avg_duration': round(today_stats[2] or 0, 2)
            },
            'month_stats': {
                'total': month_stats[0] or 0,
                'success': month_stats[1] or 0,
                'avg_duration': round(month_stats[2] or 0, 2)
            },
            'trend_7days': trend_7days,
            'task_type_distribution': task_type_distribution
        }
    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/scheduler/history")
async def get_task_history(limit: int = 50, offset: int = 0):
    """获取任务执行历史"""
    try:
        init_task_history_db()
        
        conn = sqlite3.connect(TASK_HISTORY_DB)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, task_id, task_name, task_type, start_time, end_time, duration, status, result, error_message
            FROM task_history
            ORDER BY start_time DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        history = [
            {
                'id': row[0],
                'task_id': row[1],
                'task_name': row[2],
                'task_type': row[3],
                'start_time': row[4],
                'end_time': row[5],
                'duration': row[6],
                'status': row[7],
                'result': row[8],
                'error_message': row[9]
            }
            for row in cursor.fetchall()
        ]
        
        cursor.execute('SELECT COUNT(*) FROM task_history')
        total = cursor.fetchone()[0]
        
        conn.close()
        
        return {'history': history, 'total': total}
    except Exception as e:
        logger.error(f"获取执行历史失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AI 智能运维操作 API ====================

INTENT_PATTERNS = {
    "disk_cleanup": ["清理", "垃圾", "缓存", "磁盘空间", "释放空间", "临时文件", "磁盘清理", "清理磁盘", "清理垃圾", "清理缓存", "空间不足", "磁盘满了"],
    "service_manage": ["重启", "启动", "停止", "服务", "进程", "nginx", "mysql", "redis", "apache", "iis", "tomcat", "docker"],
    "vulnerability_fix": ["漏洞", "安全", "CVE", "补丁", "修复漏洞", "安全风险", "漏洞检测", "安全检测"]
}

CLEANUP_ITEMS_RISK = {
    "Windows更新缓存": {"risk": "low", "description": "Windows Update 下载缓存，清理后不影响系统"},
    "浏览器缓存": {"risk": "low", "description": "Chrome/Edge 浏览器缓存，清理后需重新加载网页资源"},
    "临时文件": {"risk": "low", "description": "系统临时文件，清理后不影响系统运行"},
    "缩略图缓存": {"risk": "low", "description": "图片缩略图缓存，清理后会重新生成"},
    "回收站": {"risk": "medium", "description": "已删除文件暂存区，清理后无法恢复"},
    "Windows日志": {"risk": "high", "description": "系统日志文件，清理后无法查看历史日志"},
    "下载文件夹": {"risk": "high", "description": "用户下载的文件，清理前请确认"}
}

class AIOperationRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None
    force_search: bool = False

class AIOperationConfirm(BaseModel):
    operation_id: str
    operation_type: str
    confirmed_items: List[str]
    user_confirmation: bool

def detect_intent(query: str) -> Optional[str]:
    """检测用户意图"""
    query_lower = query.lower()
    scores = {}
    
    for intent, keywords in INTENT_PATTERNS.items():
        score = sum(1 for kw in keywords if kw in query_lower)
        if score > 0:
            scores[intent] = score
    
    if scores:
        return max(scores, key=scores.get)
    return None

def get_disk_usage_real(disk: str = "C") -> Dict[str, Any]:
    """获取真实磁盘使用情况"""
    try:
        import shutil
        total, used, free = shutil.disk_usage(f"{disk}:\\")
        return {
            "disk": disk,
            "total": total,
            "used": used,
            "free": free,
            "total_gb": round(total / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "usage_percent": round(used / total * 100, 1)
        }
    except Exception as e:
        logger.error(f"获取磁盘使用情况失败: {e}")
        return {"error": str(e)}

def scan_cleanup_items_real(disk: str = "C") -> List[Dict[str, Any]]:
    """扫描真实可清理项目"""
    items = []
    
    def get_dir_size(path: str) -> int:
        if not os.path.exists(path):
            return 0
        total = 0
        try:
            for entry in os.scandir(path):
                if entry.is_file():
                    total += entry.stat().st_size
                elif entry.is_dir():
                    total += get_dir_size(entry.path)
        except:
            pass
        return total
    
    windows_update_paths = [
        f"{disk}:\\Windows\\SoftwareDistribution\\Download",
        os.path.expandvars("%WINDIR%\\SoftwareDistribution\\Download")
    ]
    update_size = sum(get_dir_size(p) for p in windows_update_paths if os.path.exists(p))
    items.append({
        "id": "windows_update_cache",
        "name": "Windows更新缓存",
        "size": update_size,
        "size_formatted": _format_size(update_size),
        "risk": "low",
        "description": "Windows Update 下载缓存",
        "default_checked": True,
        "paths": windows_update_paths
    })
    
    browser_paths = [
        os.path.expandvars("%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache"),
        os.path.expandvars("%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache"),
        os.path.expandvars("%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Code Cache"),
        os.path.expandvars("%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Code Cache"),
    ]
    browser_size = sum(get_dir_size(p) for p in browser_paths if os.path.exists(p))
    items.append({
        "id": "browser_cache",
        "name": "浏览器缓存",
        "size": browser_size,
        "size_formatted": _format_size(browser_size),
        "risk": "low",
        "description": "Chrome/Edge 浏览器缓存",
        "default_checked": True,
        "paths": browser_paths
    })
    
    temp_paths = [
        os.environ.get('TEMP', ''),
        f"{disk}:\\Windows\\Temp",
        os.path.expandvars("%LOCALAPPDATA%\\Temp")
    ]
    temp_size = sum(get_dir_size(p) for p in temp_paths if p and os.path.exists(p))
    items.append({
        "id": "temp_files",
        "name": "临时文件",
        "size": temp_size,
        "size_formatted": _format_size(temp_size),
        "risk": "low",
        "description": "系统临时文件",
        "default_checked": True,
        "paths": temp_paths
    })
    
    thumbnail_path = os.path.expandvars("%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer")
    thumb_size = get_dir_size(thumbnail_path) if os.path.exists(thumbnail_path) else 0
    items.append({
        "id": "thumbnail_cache",
        "name": "缩略图缓存",
        "size": thumb_size,
        "size_formatted": _format_size(thumb_size),
        "risk": "low",
        "description": "图片缩略图缓存",
        "default_checked": True,
        "paths": [thumbnail_path]
    })
    
    recycle_bin_path = f"{disk}:\\$Recycle.Bin"
    recycle_size = get_dir_size(recycle_bin_path) if os.path.exists(recycle_bin_path) else 0
    items.append({
        "id": "recycle_bin",
        "name": "回收站",
        "size": recycle_size,
        "size_formatted": _format_size(recycle_size),
        "risk": "medium",
        "description": "已删除文件暂存区",
        "default_checked": False,
        "paths": [recycle_bin_path]
    })
    
    return items

def get_services_real() -> List[Dict[str, Any]]:
    """获取真实服务列表（包含描述信息）"""
    services = []
    try:
        import subprocess
        result = subprocess.run(
            ['powershell', '-Command', 
             'Get-CimInstance Win32_Service | Select-Object Name, DisplayName, State, StartMode, Description, ProcessId | ConvertTo-Json -Depth 2'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            if isinstance(data, dict):
                data = [data]
            
            for svc in data:
                status = svc.get('State', '')
                desc = svc.get('Description', '') or ''
                
                services.append({
                    "name": svc.get('Name', ''),
                    "display_name": svc.get('DisplayName', '') or svc.get('Name', ''),
                    "status": 'running' if str(status) == 'Running' else ('stopped' if str(status) == 'Stopped' else str(status)),
                    "start_type": svc.get('StartMode', ''),
                    "description": desc[:200] if desc else '',
                    "pid": svc.get('ProcessId'),
                    "can_restart": True,
                    "can_stop": str(status) == 'Running'
                })
    except Exception as e:
        logger.error(f"获取服务列表失败: {e}")
    
    return sorted(services, key=lambda x: (x['status'] != 'running', x['display_name']))

def get_service_status_real(service_name: str) -> Dict[str, Any]:
    """获取单个服务状态"""
    try:
        import subprocess
        result = subprocess.run(
            ['powershell', '-Command', 
             f'Get-Service -Name "{service_name}" | Select-Object Name, DisplayName, Status, CanStop | ConvertTo-Json'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            import json
            data = json.loads(result.stdout)
            return {
                "name": data.get('Name', service_name),
                "display_name": data.get('DisplayName', ''),
                "status": data.get('Status', 'Unknown'),
                "can_stop": data.get('CanStop', False),
                "exists": True
            }
    except Exception as e:
        logger.error(f"获取服务状态失败: {e}")
    
    return {"name": service_name, "exists": False, "error": "服务不存在或无法访问"}

from tools.web_search import web_search_tool, need_web_search

@api_router.post("/ai/web-search")
async def ai_web_search(request: AIOperationRequest):
    """AI联网搜索 - 专业版（Tavily + Bing 双引擎）"""
    try:
        force_search = getattr(request, 'force_search', False)
        
        if not force_search and not need_web_search(request.query):
            logger.info(f"⏭️ 跳过搜索（智能判断）: {request.query}")
            return {
                "intent": "web_search",
                "success": False,
                "skip_reason": "该问题不需要联网搜索，使用本地知识库即可回答",
                "query": request.query,
                "results": [],
                "suggestion": "建议切换到'日常聊天'或'专业分析'模式"
            }
        
        if force_search:
            logger.info(f"🔍 强制执行联网搜索: {request.query}")
        else:
            logger.info(f"🔍 开始联网搜索: {request.query}")
            
        search_result = await web_search_tool.search(request.query, max_results=5)
        
        if not search_result.get('success') or not search_result.get('results'):
            return {
                "intent": "web_search",
                "success": False,
                "message": "未找到相关搜索结果",
                "query": request.query,
                "engine_used": search_result.get('engine', 'Unknown'),
                "results": []
            }
        
        results = search_result['results']
        context_text = "\n\n".join([
            f"【{r['title']}】\n{r['snippet']}\n来源: {r.get('source', 'Unknown')}"
            for r in results[:3]
        ])
        
        tavily_answer = search_result.get('answer', '')
        
        return {
            "intent": "web_search",
            "success": True,
            "query": request.query,
            "engine_used": search_result.get('engine', ''),
            "results": results,
            "context": context_text,
            "tavily_answer": tavily_answer,
            "summary": f"🌐 通过 {search_result.get('engine', '')} 找到 {len(results)} 条相关信息",
            "should_summarize": True
        }
    except Exception as e:
        logger.error(f"AI联网搜索失败: {e}")
        return {"intent": "web_search", "success": False, "error": str(e)}

@api_router.post("/ai/analyze")
async def ai_analyze_operation(request: AIOperationRequest):
    """分析用户意图并返回操作建议"""
    try:
        intent = detect_intent(request.query)
        
        if intent == "disk_cleanup":
            disk = "C"
            for d in ["C", "D", "E", "F"]:
                if f"{d}盘" in request.query or f"{d}:" in request.query:
                    disk = d
                    break
            
            disk_usage = get_disk_usage_real(disk)
            cleanup_items = scan_cleanup_items_real(disk)
            total_size = sum(item["size"] for item in cleanup_items)
            
            return {
                "intent": "disk_cleanup",
                "operation_id": f"cleanup_{int(time.time())}",
                "title": "磁盘清理建议",
                "description": f"检测到您想要清理磁盘，以下是 {disk} 盘的使用情况和可清理项目",
                "disk_usage": disk_usage,
                "cleanup_items": cleanup_items,
                "total_size": total_size,
                "total_size_formatted": _format_size(total_size),
                "requires_confirmation": True,
                "risk_warning": "建议只勾选低风险项目，中高风险项目请谨慎操作"
            }
        
        elif intent == "service_manage":
            query_lower = request.query.lower()
            action = None
            service_name = None
            
            if "重启" in request.query:
                action = "restart"
            elif "启动" in request.query or "开启" in request.query:
                action = "start"
            elif "停止" in request.query or "关闭" in request.query:
                action = "stop"
            elif "状态" in request.query or "查看" in request.query:
                action = "status"
            
            service_keywords_all = ["office", "clicktorun", "click to run", "wuauserv", "windows update", "spooler", "print spooler", 
                                   "dnscache", "dns client", "eventlog", "event log", "windows event",
                                   "nginx", "mysql", "redis", "apache", "iis", "tomcat", "docker", 
                                   "mongodb", "postgresql", "sql server", "oracle",
                                   "defender", "antivirus", "firewall", "hyper-v", "hyperv",
                                   "audio", "bluetooth", "wifi", "network", "lanman", "smb",
                                   "search", "indexing", "task scheduler", "remote desktop",
                                   "bitlocker", "encryption", "vpn"]
            
            query_patterns = [
                r'(.+?)\s*(?:服务|service)\s*(?:是)?(?:什么|干嘛|干吗|做什么|用来|有啥|有何)',
                r'(?:什么是|啥是|介绍一下|解释一下|说明|分析|查看)(.+?)(?:服务|service)',
                r'(.+?)\s*(?:服务的?(?:作用|用途|功能|目的)|干什么用的)'
            ]
            
            import re
            extracted_service = None
            
            for pattern in query_patterns:
                match = re.search(pattern, request.query, re.IGNORECASE)
                if match:
                    extracted_service = match.group(1).strip()
                    break
            
            for kw in service_keywords_all:
                if kw in query_lower:
                    service_name = kw.replace(' ', '')
                    break
            
            if not service_name and extracted_service:
                service_name = extracted_service.lower().replace(' ', '').replace('的', '')
            
            if service_name and action and action != "status":
                service_status = get_service_status_real(service_name)
                ai_analysis = analyze_service(service_name, action, service_status)
                
                return {
                    "intent": "service_manage",
                    "operation_id": f"service_{int(time.time())}",
                    "title": f"{ai_analysis['service_info']['display_name']} - {action.capitalize()} 分析",
                    "description": f"AI 已为您分析「{ai_analysis['service_info']['display_name']}」服务的{action}操作，请查看详细分析和建议后确认：",
                    "action": action,
                    "service_name": service_name,
                    "service_status": service_status,
                    "impact_warning": _get_service_impact_warning(service_name, action),
                    "requires_confirmation": True,
                    **ai_analysis
                }
            elif service_name and (action == "status" or not action):
                service_status = get_service_status_real(service_name)
                ai_analysis = analyze_service(service_name, "status", service_status)
                
                return {
                    "intent": "service_manage",
                    "operation_id": f"service_{int(time.time())}",
                    "title": f"{ai_analysis['service_info']['display_name']} - 服务详情",
                    "description": f"以下是「{ai_analysis['service_info']['display_name']}」服务的详细信息和 AI 分析：",
                    "action": "status",
                    "service_name": service_name,
                    "service_status": service_status,
                    "requires_confirmation": False,
                    **ai_analysis
                }
            else:
                services = get_services_real()
                
                return {
                    "intent": "service_manage",
                    "operation_id": f"services_{int(time.time())}",
                    "title": "服务管理",
                    "description": f"当前系统共有 {len(services)} 个服务 · 输入如「重启 office」「查看 nginx 状态」可获取 AI 智能分析",
                    "action": "list",
                    "services": services,
                    "requires_confirmation": False
                }
        
        elif intent == "vulnerability_fix":
            return {
                "intent": "vulnerability_fix",
                "operation_id": f"vuln_{int(time.time())}",
                "title": "漏洞检测",
                "description": "检测到您想要进行安全漏洞检测",
                "solutions": [
                    {
                        "id": "windows_update",
                        "name": "检查Windows更新",
                        "description": "检查并安装最新的Windows安全补丁",
                        "risk": "low",
                        "estimated_time": "10-30分钟",
                        "confidence": 0.95
                    },
                    {
                        "id": "check_firewall",
                        "name": "检查防火墙状态",
                        "description": "确保Windows防火墙已启用",
                        "risk": "very_low",
                        "estimated_time": "1分钟",
                        "confidence": 0.90
                    }
                ],
                "requires_confirmation": True
            }
        
        return {
            "intent": None,
            "message": "未识别到明确的运维操作意图，请描述您想要执行的具体操作"
        }
    
    except Exception as e:
        logger.error(f"分析操作意图失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

SERVICE_KNOWLEDGE_BASE = {
    "office": {
        "display_name": "Microsoft Office",
        "description": "Microsoft Office 套件的核心服务，负责处理 Word、Excel、PowerPoint 等应用程序的后台任务、自动更新和云同步功能。",
        "purpose": "提供 Office 应用程序的协作编辑、自动保存、模板下载等后台支持",
        "dependencies": ["Windows Update", "RPCSS", "DCOM Server Process Launcher"],
        "affected_apps": ["Microsoft Word", "Microsoft Excel", "Microsoft PowerPoint", "Outlook", "OneDrive"],
        "risk_level": "low",
        "can_restart": True,
        "restart_impact": {
            "duration": "5-15秒",
            "effects": [
                "正在编辑的文档可能需要重新保存",
                "Office 自动保存功能暂时中断",
                "正在进行的云端同步会暂停"
            ],
            "user_experience": "轻微影响，Office应用可能会短暂无响应后恢复"
        },
        "recommendations": {
            "restart": "可以安全重启，建议先保存所有Office文档",
            "stop": "不建议停止，会导致Office核心功能不可用",
            "start": "如Office功能异常可尝试启动"
        },
        "ai_analysis": "Office 服务是 Windows 系统中较为重要的用户级服务。该服务主要管理 Office 应用的后台任务，包括自动更新检查、云文档同步、许可证验证等。重启此服务通常不会造成严重问题，但建议在关闭所有 Office 文档后进行。如果遇到 Office 应用卡顿或无法启动的问题，重启此服务是一个有效的排查手段。"
    },
    "clicktorunsvc": {
        "display_name": "Microsoft Office 即点即用服务",
        "description": "Office 365 和 Office 2016+ 的 Click-to-Run 安装技术使用的后台服务，管理 Office 组件的按需安装和更新。",
        "purpose": "实现 Office 的虚拟化运行，支持组件的动态加载和即时安装",
        "dependencies": ["Windows Installer", "RPCSS"],
        "affected_apps": ["所有 Microsoft Office 应用"],
        "risk_level": "low",
        "can_restart": True,
        "restart_impact": {
            "duration": "3-10秒",
            "effects": [
                "首次打开新 Office 功能时可能需要重新加载",
                "Office 更新检查暂时中断"
            ],
            "user_experience": "几乎无感知"
        },
        "recommendations": {
            "restart": "安全，可在任何时间重启",
            "stop": "不推荐，可能导致 Office 功能异常",
            "start": "如 Office 安装/更新问题可尝试"
        },
        "ai_analysis": "Click-to-Run 是微软现代 Office 的核心技术。它采用 App-V 虚拟化技术，允许 Office 在'沙箱'环境中运行，与系统其他部分隔离。这意味着即使此服务出现问题，也不会影响系统稳定性。但如果此服务停止，Office 的在线功能和某些高级特性将无法使用。"
    },
    "wuauserv": {
        "display_name": "Windows Update",
        "description": "Windows 操作系统的自动更新服务，负责检测、下载和安装系统及应用程序的安全补丁。",
        "purpose": "保持系统安全和最新状态，自动获取微软发布的安全更新",
        "dependencies": ["RPCSS", "Cryptographic Services", "DCOM Server Process Launcher"],
        "affected_apps": ["Windows 设置", "Microsoft Store", "Windows Defender"],
        "risk_level": "medium",
        "can_restart": True,
        "restart_impact": {
            "duration": "10-30秒",
            "effects": [
                "正在进行的更新会被中断",
                "自动更新检查暂停",
                "系统可能提示重启以完成更新"
            ],
            "user_experience": "中等影响，可能需要稍后手动检查更新"
        },
        "recommendations": {
            "restart": "可以重启，但如果有正在进行的重要更新请等待完成",
            "stop": "可用于临时禁用自动更新（不推荐长期）",
            "start": "如更新功能异常可重启恢复"
        },
        "ai_analysis": "Windows Update 是系统安全的重要组成部分。虽然有时更新过程可能令人烦恼（比如在工作时强制重启），但它对于防范新型漏洞攻击至关重要。如果您想临时停止此服务来避免更新干扰，建议使用'暂停更新'功能而不是直接停止服务，这样更安全可控。"
    },
    "spooler": {
        "display_name": "Print Spooler (打印后台处理程序)",
        "description": "管理所有打印作业的队列和处理，是 Windows 打印子系统的核心组件。",
        "purpose": "接收打印任务、管理打印队列、与打印机驱动程序通信",
        "dependencies": ["RPCSS", "DCOM Server Process Launcher"],
        "affected_apps": ["所有打印相关应用", "PDF 虚拟打印机", "传真服务"],
        "risk_level": "medium",
        "can_restart": True,
        "restart_impact": {
            "duration": "5-15秒",
            "effects": [
                "当前打印队列中的作业会被清除",
                "正在打印的文档会中断",
                "打印机连接可能短暂断开"
            ],
            "user_experience": "如有打印任务则影响较大"
        },
        "recommendations": {
            "restart": "打印问题时常用解决方案，但会清空打印队列",
            "stop": "如不需要打印功能可停止以节省资源",
            "start": "打印功能异常时首选操作"
        },
        "ai_analysis": "Print Spooler 是一个历史悠久的 Windows 服务，也是常见的故障源。当您遇到'无法连接到打印机'或打印任务卡住时，重启此服务通常能解决问题。值得注意的是，近年来 Print Spooler 漏洞频发（如 PrintNightmare），如果不使用打印功能，建议将此服务设置为手动启动以提高安全性。"
    },
    "dnscache": {
        "display_name": "DNS Client (DNS 客户端)",
        "description": "缓存 DNS 查询结果的服务，加速域名解析速度并减少 DNS 服务器负载。",
        "purpose": "本地缓存 DNS 记录，加快网站访问速度",
        "dependencies": ["TCP/IP Protocol Driver"],
        "affected_apps": ["浏览器", "所有网络应用", "邮件客户端"],
        "risk_level": "low",
        "can_restart": True,
        "restart_impact": {
            "duration": "1-3秒",
            "effects": [
                "DNS 缓存被清空",
                "访问过的网站需要重新解析域名",
                "首次访问网站时可能有轻微延迟"
            ],
            "user_experience": "几乎无感知，仅首次访问略慢"
        },
        "recommendations": {
            "restart": "非常安全，常用于解决 DNS 解析问题",
            "stop": "不推荐，会影响网络体验",
            "start": "DNS 问题时的标准操作"
        },
        "ai_analysis": "DNS Client 服务对日常上网体验有重要影响。当您修改了 hosts 文件或更换 DNS 后，如果发现网站仍指向旧地址，重启此服务即可立即生效。清空 DNS 缓存也是解决'无法访问特定网站'问题的有效方法。此服务的资源占用很低，建议始终保持运行。"
    },
    "eventlog": {
        "display_name": "Windows Event Log (事件日志)",
        "description": "记录系统和应用程序事件的核心服务，用于系统诊断和安全审计。",
        "purpose": "收集、存储和管理系统日志信息",
        "dependencies": ["Remote Procedure Call (RPC)"],
        "affected_apps": ["事件查看器", "性能监视器", "任务计划程序"],
        "risk_level": "high",
        "can_restart": False,
        "restart_impact": {
            "duration": "N/A",
            "effects": [
                "系统事件记录中断",
                "安全日志丢失",
                "故障诊断能力下降"
            ],
            "user_experience": "可能导致系统不稳定"
        },
        "recommendations": {
            "restart": "不推荐，除非用于诊断目的",
            "stop": "强烈不推荐",
            "start": "必须保持运行"
        },
        "ai_analysis": "Event Log 是 Windows 系统的'黑匣子'，记录着系统发生的几乎所有重要事件。停止此服务不仅会影响故障排查能力，还可能导致依赖事件日志的其他服务和应用程序异常。除非您清楚自己在做什么，否则不要触碰这个服务。"
    },
    "mysql": {
        "display_name": "MySQL Database Server",
        "description": "开源关系型数据库管理系统，广泛用于 Web 应用程序的数据存储。",
        "purpose": "提供数据存储、查询和管理服务",
        "dependencies": ["Network Connections", "Security Accounts Manager"],
        "affected_apps": ["WordPress", "phpMyAdmin", "所有使用 MySQL 的应用"],
        "risk_level": "high",
        "can_restart": True,
        "restart_impact": {
            "duration": "10-60秒",
            "effects": [
                "所有数据库连接断开",
                "未提交的事务回滚",
                "正在执行的查询失败",
                "Web 站点可能出现数据库错误"
            ],
            "user_experience": "严重影响，所有依赖 MySQL 的应用都会受影响"
        },
        "recommendations": {
            "restart": "仅在维护窗口期进行，需提前通知用户",
            "stop": "紧急情况下的最后手段",
            "start": "数据库不可用时的必要操作"
        },
        "ai_analysis": "MySQL 是许多 Web 应用的数据心脏。在生产环境中重启 MySQL 需要格外谨慎：1) 确保没有长时间运行的查询；2) 提前通知用户维护时间；3) 备份重要数据；4) 准备好回滚方案。如果是开发环境，重启相对安全，但仍建议先执行 'FLUSH TABLES' 关闭所有表。"
    },
    "nginx": {
        "display_name": "Nginx Web Server",
        "description": "高性能的 HTTP 和反向代理服务器，也可作为 IMAP/POP3/SMTP 代理服务器。",
        "purpose": "处理 Web 请求、负载均衡、反向代理、静态文件服务",
        "dependencies": ["Network Connections"],
        "affected_apps": ["所有通过 Nginx 访问的网站/API"],
        "risk_level": "high",
        "can_restart": True,
        "restart_impact": {
            "duration": "2-10秒",
            "effects": [
                "当前 HTTP 连接断开",
                "服务中断期间新请求无法处理",
                "负载均衡配置重载"
            ],
            "user_experience": "网站短暂不可访问"
        },
        "recommendations": {
            "restart": "使用 reload 而非 restart 可实现无缝重载",
            "stop": "会导致所有托管站点下线",
            "start": "Web 服务不可用时的首要操作"
        },
        "ai_analysis": "Nginx 以其高性能和低内存占用著称。好消息是，Nginx 支持 '优雅重载'（nginx -s reload），可以在不断开现有连接的情况下加载新配置。因此，如果只是修改了配置文件，强烈推荐使用 reload 而非 restart。另外，Nginx 通常配合进程管理器（如 systemd）使用，确保意外崩溃后能自动重启。"
    },
    "redis": {
        "display_name": "Redis Cache Server",
        "description": "开源的高性能键值对存储数据库，常用作数据库缓存、消息队列和会话存储。",
        "purpose": "提供高速数据缓存、消息队列、实时数据分析等服务",
        "dependencies": ["Network Connections"],
        "affected_apps": ["使用 Redis 缓存的 Web 应用", "会话依赖 Redis 的系统"],
        "risk_level": "high",
        "can_restart": True,
        "restart_impact": {
            "duration": "1-5秒（如有持久化则更长）",
            "effects": [
                "缓存数据丢失（未持久化的数据）",
                "会话状态丢失（用户可能需要重新登录）",
                "应用性能明显下降（缓存未命中）"
            ],
            "user_experience": "用户体验下降，可能需要重新登录"
        },
        "recommendations": {
            "restart": "确保已启用持久化（RDB/AOF），低峰期操作",
            "stop": "紧急情况下可用，但要求数据可重建",
            "start": "缓存失效、性能问题时的常规操作"
        },
        "ai_analysis": "Redis 的内存特性使其重启风险较高。关键问题是：您的数据是否配置了持久化？如果没有开启 RDB 或 AOF，重启 = 数据全部丢失！即使开启了持久化，也会有少量最近的数据丢失。建议在重启前执行 BGSAVE 手动触发一次持久化，并在低流量时段操作。另外，Redis Cluster 模式下重启单个节点的影响较小。"
    },
    "docker": {
        "display_name": "Docker Engine",
        "description": "容器化平台的核心引擎，负责容器的创建、运行和管理。",
        "purpose": "提供容器运行时环境、镜像管理、网络和存储管理",
        "dependencies": ["Network Connections", "Hyper-V (Windows)"],
        "affected_apps": ["所有 Docker 容器及其中的应用"],
        "risk_level": "critical",
        "can_restart": True,
        "restart_impact": {
            "duration": "30秒-2分钟",
            "effects": [
                "所有容器停止运行",
                "容器间网络中断",
                "未持久化的容器数据丢失",
                "正在处理的任务中断"
            ],
            "user_experience": "所有基于 Docker 的服务完全不可用"
        },
        "recommendations": {
            "restart": "重大操作，需评估所有容器影响，提前规划",
            "stop": "极端情况才考虑",
            "start": "Docker 引擎故障时的必要操作"
        },
        "ai_analysis": "Docker Engine 是容器生态的基础设施层。重启 Docker 影响范围极广——所有容器都会停止！这不仅仅是'服务中断'那么简单：1) 如果容器配置了 restart: always 策略，它们会在 Docker 重启后自动恢复；2) 但如果使用了 docker-compose down 或手动停止的容器不会自动恢复；3) 未挂载 volume 的容器数据会丢失。建议在重启前执行 `docker ps` 列出所有运行中的容器，评估影响范围。"
    }
}

def analyze_service(service_name: str, action: str, service_status: Dict[str, Any] = None) -> Dict[str, Any]:
    """AI智能分析服务（使用系统真实信息）"""
    name_lower = service_name.lower()
    
    real_description = None
    real_display_name = service_name
    
    try:
        import subprocess
        result = subprocess.run(
            ['powershell', '-Command', 
             f'Get-CimInstance Win32_Service -Filter "Name=\'{service_name}\'" | Select-Object Name, DisplayName, Description, State, ProcessId, StartMode, PathName | ConvertTo-Json'],
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode == 0 and result.stdout.strip():
            import json
            svc_data = json.loads(result.stdout)
            if isinstance(svc_data, list):
                svc_data = svc_data[0] if svc_data else {}
            
            if svc_data.get('Name'):
                real_display_name = svc_data.get('DisplayName', '') or service_name
                real_description = svc_data.get('Description', '') or ''
                
                if not service_status:
                    state = svc_data.get('State', 'Unknown')
                    service_status = {
                        "status": 'running' if str(state) == 'Running' else ('stopped' if str(state) == 'Stopped' else str(state)),
                        "pid": svc_data.get('ProcessId'),
                        "start_type": svc_data.get('StartMode', ''),
                        "path": svc_data.get('PathName', '')
                    }
    except Exception as e:
        logger.debug(f"获取服务真实信息失败: {e}")
    
    knowledge = None
    for key in SERVICE_KNOWLEDGE_BASE:
        if key in name_lower or name_lower in key:
            knowledge = SERVICE_KNOWLEDGE_BASE[key]
            break
    
    if not knowledge:
        display_name = real_display_name
        
        purpose_guess = _guess_service_purpose(service_name, real_description)
        
        risk_level, can_restart, restart_impact = _assess_service_risk(service_name, real_description)
        
        knowledge = {
            "display_name": display_name,
            "description": real_description or f"{service_name} - Windows 系统服务",
            "purpose": purpose_guess,
            "dependencies": [],
            "affected_apps": _guess_affected_apps(service_name),
            "risk_level": risk_level,
            "can_restart": can_restart,
            "restart_impact": restart_impact,
            "recommendations": {
                "restart": "建议在业务低峰期操作",
                "stop": "请确认不影响其他服务",
                "start": "可尝试启动"
            },
            "ai_analysis": _generate_ai_analysis(service_name, real_description, display_name)
        }
    
    current_status = "unknown"
    pid = None
    memory_usage = 0
    uptime = "未知"
    
    if service_status:
        current_status = service_status.get('status', 'unknown')
        pid = service_status.get('pid')
        memory_usage = service_status.get('memory_usage', 0)
        uptime = service_status.get('uptime', '未知')
    
    action_recommendation = knowledge["recommendations"].get(action, "请谨慎操作")
    
    risk_assessment = []
    if knowledge["risk_level"] == "critical":
        risk_assessment.append({"level": "danger", "text": "高风险操作，可能影响多个系统组件"})
    elif knowledge["risk_level"] == "high":
        risk_assessment.append({ "level": "warning", "text": "较高风险，可能影响依赖此服务的应用" })
    elif knowledge["risk_level"] == "medium":
        risk_assessment.append({ "level": "info", "text": "中等风险，建议了解影响范围后再操作" })
    else:
        risk_assessment.append({ "level": "safe", "text": "低风险操作，一般可以安全执行" })
    
    if not knowledge["can_restart"]:
        risk_assessment.append({ "level": "danger", "text": "⚠️ 此服务不支持或不建议重启" })
    
    if current_status == "running" and action == "restart":
        risk_assessment.append({ "level": "info", "text": f"服务当前运行中 (PID: {pid or 'N/A'})" })
    elif current_status == "stopped" and action in ["restart", "stop"]:
        risk_assessment.append({ "level": "warning", "text": "⚠️ 服务当前已停止，无法执行此操作" })
    
    ai_suggestions = [
        { "type": "analysis", "icon": "🔍", "title": "服务用途", "content": knowledge["description"] },
        { "type": "impact", "icon": "⚡", "title": "操作影响", "content": f"{action.capitalize()} 将导致: {', '.join(knowledge['restart_impact']['effects'][:2])}" },
        { "type": "duration", "icon": "⏱️", "title": "预计耗时", "content": knowledge['restart_impact']['duration'] },
        { "type": "advice", "icon": "💡", "title": "AI 建议", "content": action_recommendation },
        { "type": "detail", "icon": "📋", "title": "详细分析", "content": knowledge["ai_analysis"] }
    ]
    
    affected_count = len(knowledge["affected_apps"])
    if affected_count > 0:
        ai_suggestions.insert(2, {
            "type": "warning", 
            "icon": "🔗", 
            "title": "关联应用", 
            "content": f"以下 {affected_count} 个应用/服务可能受影响: {', '.join(knowledge['affected_apps'][:3])}{'...' if affected_count > 3 else ''}"
        })
    
    return {
        "service_info": {
            "name": service_name,
            "display_name": knowledge["display_name"],
            "description": knowledge["description"],
            "purpose": knowledge["purpose"],
            "current_status": current_status,
            "pid": pid,
            "memory_usage": memory_usage,
            "uptime": uptime
        },
        "operation_analysis": {
            "requested_action": action,
            "can_execute": knowledge["can_restart"] and not (current_status == "stopped" and action in ["restart", "stop"]),
            "estimated_duration": knowledge["restart_impact"]["duration"],
            "expected_effects": knowledge["restart_impact"]["effects"],
            "user_experience": knowledge["restart_impact"]["user_experience"]
        },
        "risk_assessment": risk_assessment,
        "ai_suggestions": ai_suggestions,
        "dependencies": knowledge["dependencies"],
        "affected_apps": knowledge["affected_apps"],
        "knowledge_base_used": knowledge is not None
    }

def _guess_service_purpose(service_name: str, description: str = None) -> str:
    """基于服务名称和描述智能推测用途"""
    name_lower = service_name.lower()
    
    if description and len(description) > 10:
        return description[:150] + ('...' if len(description) > 150 else '')
    
    purpose_patterns = {
        'update': ['更新', 'update', 'upgrade', '补丁'],
        'audio': ['音频', '声音', 'audio', 'sound'],
        'bluetooth': ['蓝牙', 'bluetooth'],
        'print': ['打印', 'printer', 'spooler'],
        'network': ['网络', 'network', 'lan', 'wan', 'tcp', 'dhcp', 'dns'],
        'firewall': ['防火墙', 'firewall', 'security'],
        'search': ['搜索', '索引', 'search', 'index'],
        'remote': ['远程', 'remote', 'rdp', 'desktop'],
        'defender': ['安全', '防病毒', 'defender', 'antivirus'],
        'crypt': ['加密', 'bitlocker', 'encrypt', 'crypto'],
        'hyper': ['虚拟化', 'hyper-v', 'vm', 'virtual'],
        'task': ['任务计划', 'scheduler', 'task'],
        'event': ['事件日志', 'event log'],
        'plug': ['即插即用', 'pnp', 'plug'],
        'power': ['电源', 'power'],
        'user': ['用户管理', 'user manager', 'profile'],
        'time': ['时间同步', 'time', 'ntp', 'w32time'],
        'windows': ['windows 更新', 'wuauserv', 'windows update']
    }
    
    for key, keywords in purpose_patterns.items():
        for kw in keywords:
            if kw in name_lower or (description and kw in description.lower()):
                purposes = {
                    'update': '管理系统更新和补丁',
                    'audio': '管理音频设备和声音输出',
                    'bluetooth': '管理蓝牙连接和设备',
                    'print': '处理打印任务队列',
                    'network': '提供网络连接和服务',
                    'firewall': '网络安全防护',
                    'search': '文件搜索和索引服务',
                    'remote': '远程桌面连接',
                    'defender': '实时病毒防护和安全监控',
                    'crypt': '数据加密保护',
                    'hyper': '虚拟化管理',
                    'task': '计划任务执行',
                    'event': '系统事件日志记录',
                    'plug': '硬件设备检测和管理',
                    'power': '电源管理和休眠控制',
                    'user': '用户配置文件管理',
                    'time': '系统时间同步'
                }
                return purposes.get(key, f'与 {key} 相关的系统服务')
    
    if any(x in name_lower for x in ['svc', 'service', 'host']):
        return '后台系统服务，支持特定应用程序功能'
    
    return f'Windows 系统服务 - {service_name}'

def _assess_service_risk(service_name: str, description: str = None) -> tuple:
    """评估服务操作风险"""
    name_lower = service_name.lower()
    
    critical_services = [
        'winmgmt', 'rpcss', 'eventlog', 'lsass', 'csrss', 'services', 
        'smss', 'svchost', 'system', 'dcomlaunch', 'plugplay'
    ]
    
    high_risk_services = [
        'dns', 'dhcp', 'netlogon', 'browser', 'server', 'workstation',
        'lanman', 'smb', 'mssql', 'mysql', 'oracle', 'postgres'
    ]
    
    for svc in critical_services:
        if svc in name_lower:
            return ('critical', False, {
                "duration": "不推荐",
                "effects": ["可能导致系统不稳定", "影响核心功能"],
                "user_experience": "⚠️ 系统关键服务，不建议手动操作"
            })
    
    for svc in high_risk_services:
        if svc in name_lower:
            return ('high', True, {
                "duration": "10-30秒",
                "effects": ["相关服务可能中断"],
                "user_experience": "较高风险，建议在维护窗口期操作"
            })
    
    safe_keywords = ['audio', 'bluetooth', 'print', 'search', 'theme', 'display', 'input']
    for kw in safe_keywords:
        if kw in name_lower:
            return ('low', True, {
                "duration": "3-10秒",
                "effects": ["该功能暂时不可用"],
                "user_experience": "几乎无感知"
            })
    
    return ('medium', True, {
        "duration": "5-15秒",
        "effects": ["服务短暂中断"],
        "user_experience": "轻微影响"
    })

def _guess_affected_apps(service_name: str) -> list:
    """推测受影响的应用"""
    name_lower = service_name.lower()
    
    app_mapping = {
        'office': ['Microsoft Office', 'Word', 'Excel', 'PowerPoint', 'Outlook'],
        'clicktorun': ['Office 365', 'Microsoft 365 应用'],
        'wuauserv': ['Windows Update', 'Microsoft Store'],
        'spooler': ['打印应用', 'Adobe Acrobat', '记事本(打印)'],
        'dnscache': ['浏览器', '所有网络应用'],
        'eventlog': ['事件查看器', '监控系统'],
        'defender': ['Windows 安全中心', '实时防护'],
        'audio': ['媒体播放器', 'Zoom/Teams 会议', '游戏'],
        'bluetooth': ['蓝牙设备', '无线耳机/音箱'],
        'search': ['Windows 搜索', '文件资源管理器'],
        'print': ['打印机', 'PDF 虚拟打印机'],
        'remote': ['远程桌面客户端', 'RDP 连接'],
        'hyper': ['Hyper-V 虚拟机', 'Docker Desktop (WSL2)'],
        'bitlocker': ['BitLocker 加密驱动器'],
        'task': ['计划任务', '自动备份脚本'],
        'time': ['系统时间', 'Kerberos 认证'],
        'firewall': ['防火墙规则', '入站/出站连接'],
        'network': ['网络共享', '文件传输', 'VPN']
    }
    
    for key, apps in app_mapping.items():
        if key in name_lower:
            return apps
    
    return []

def _generate_ai_analysis(service_name: str, description: str = None, display_name: str = None) -> str:
    """生成AI分析文本"""
    name = display_name or service_name
    
    if description and len(description) > 20:
        analysis = f"**{name}**\n\n"
        analysis += f"{description}\n\n"
        
        risk_level, _, impact = _assess_service_risk(service_name, description)
        
        if risk_level == 'critical':
            analysis += "⚠️ **重要提示**: 这是 Windows 核心服务，不建议手动停止或重启。"
        elif risk_level == 'high':
            analysis += "💡 **注意**: 此服务较为重要，重启可能影响其他依赖它的应用。"
        elif risk_level == 'low':
            analysis += "✅ **安全**: 这是普通用户级服务，可以安全重启。"
        else:
            analysis += "ℹ️ **一般服务**: 可根据需要操作，建议先了解其用途。"
            
        affected = _guess_affected_apps(service_name)
        if affected:
            analysis += f"\n\n🔗 **关联应用**: {', '.join(affected[:4])}"
        
        return analysis
    
    return f"**{name}** 是一个 Windows 系统服务。如需了解更多信息，请查看服务的详细描述或参考微软官方文档。"

def _get_service_impact_warning(service_name: str, action: str) -> str:
    """获取服务操作影响警告"""
    warnings = {
        "nginx": {
            "restart": "重启 Nginx 会导致当前连接断开，服务中断约 2-5 秒",
            "stop": "停止 Nginx 会导致网站无法访问"
        },
        "mysql": {
            "restart": "重启 MySQL 会导致数据库连接中断，正在进行的查询将失败",
            "stop": "停止 MySQL 会导致所有数据库应用无法工作"
        },
        "redis": {
            "restart": "重启 Redis 会导致缓存丢失，服务中断约 1-3 秒",
            "stop": "停止 Redis 会导致依赖缓存的应用性能下降"
        },
        "docker": {
            "restart": "重启 Docker 会影响所有运行中的容器",
            "stop": "停止 Docker 会停止所有容器"
        }
    }
    return warnings.get(service_name, {}).get(action, f"{action} 服务可能会影响相关应用")

@api_router.post("/ai/execute")
async def ai_execute_operation(confirm: AIOperationConfirm):
    """执行用户确认的操作"""
    if not confirm.user_confirmation:
        return {"status": "cancelled", "message": "用户取消操作"}
    
    try:
        if confirm.operation_type == "disk_cleanup":
            results = []
            total_freed = 0
            
            for item_id in confirm.confirmed_items:
                freed = _execute_cleanup_item(item_id)
                results.append({
                    "item": item_id,
                    "freed": freed,
                    "freed_formatted": _format_size(freed),
                    "success": freed >= 0
                })
                total_freed += freed
            
            return {
                "status": "success",
                "operation_type": "disk_cleanup",
                "results": results,
                "total_freed": total_freed,
                "total_freed_formatted": _format_size(total_freed),
                "message": f"清理完成，共释放 {_format_size(total_freed)}"
            }
        
        elif confirm.operation_type == "service_manage":
            return {
                "status": "error",
                "message": "服务操作需要更详细的信息，请重新发起请求"
            }
        
        return {"status": "error", "message": "未知的操作类型"}
    
    except Exception as e:
        logger.error(f"执行操作失败: {e}")
        return {"status": "error", "message": str(e)}

def _execute_cleanup_item(item_id: str) -> int:
    """执行单个清理项目"""
    total_freed = 0
    
    if item_id == "windows_update_cache":
        paths = [
            os.path.expandvars("%WINDIR%\\SoftwareDistribution\\Download"),
            "C:\\Windows\\SoftwareDistribution\\Download"
        ]
        for path in paths:
            if os.path.exists(path):
                total_freed += _delete_directory_contents(path)
    
    elif item_id == "browser_cache":
        paths = [
            os.path.expandvars("%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache"),
            os.path.expandvars("%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache"),
            os.path.expandvars("%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Code Cache"),
            os.path.expandvars("%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Code Cache"),
        ]
        for path in paths:
            if os.path.exists(path):
                total_freed += _delete_directory_contents(path)
    
    elif item_id == "temp_files":
        paths = [
            os.environ.get('TEMP', ''),
            "C:\\Windows\\Temp",
            os.path.expandvars("%LOCALAPPDATA%\\Temp")
        ]
        for path in paths:
            if path and os.path.exists(path):
                total_freed += _delete_directory_contents(path)
    
    elif item_id == "thumbnail_cache":
        path = os.path.expandvars("%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer")
        if os.path.exists(path):
            for file in os.listdir(path):
                if 'thumb' in file.lower() or file.endswith('.db'):
                    try:
                        filepath = os.path.join(path, file)
                        size = os.path.getsize(filepath)
                        os.remove(filepath)
                        total_freed += size
                    except:
                        pass
    
    elif item_id == "recycle_bin":
        try:
            import subprocess
            subprocess.run(
                ['powershell', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'],
                capture_output=True,
                timeout=60
            )
        except:
            pass
    
    return total_freed

def _delete_directory_contents(path: str) -> int:
    """删除目录内容并返回释放的空间"""
    total_freed = 0
    try:
        for entry in os.scandir(path):
            try:
                if entry.is_file():
                    size = entry.stat().st_size
                    os.remove(entry.path)
                    total_freed += size
                elif entry.is_dir():
                    size = _get_dir_size(entry.path)
                    import shutil
                    shutil.rmtree(entry.path, ignore_errors=True)
                    total_freed += size
            except:
                pass
    except:
        pass
    return total_freed

def _get_dir_size(path: str) -> int:
    """获取目录大小"""
    total = 0
    try:
        for entry in os.scandir(path):
            if entry.is_file():
                total += entry.stat().st_size
            elif entry.is_dir():
                total += _get_dir_size(entry.path)
    except:
        pass
    return total

# 服务启动时初始化
@app.on_event("startup")
async def startup_event():
    """服务启动时初始化"""
    global agent, retriever
    
    # 初始化定时任务调度器
    init_scheduler()
    init_task_history_db()
    
    # 添加默认的自动清理任务
    try:
        scheduler.add_job(
            execute_cleanup_task,
            trigger=CronTrigger(hour=3, minute=0),  # 每天凌晨3点
            id='auto_cleanup',
            name='自动清理任务',
            args=['auto_cleanup', '自动清理任务', {
                'cleanup_types': ['Windows更新缓存', '浏览器缓存', '临时文件', '缩略图缓存'],
                'disk': 'C'
            }],
            replace_existing=True
        )
        logger.info("✅ 已添加自动清理任务（每天凌晨3点）")
    except Exception as e:
        logger.warning(f"添加自动清理任务失败: {e}")
    
    # 原有的初始化代码
    try:
        retriever = OpsRetriever(
            knowledge_dir=RAG_KNOWLEDGE_DIR,
            vectorstore_dir=RAG_VECTORSTORE_DIR,
            bge_model_path=BGE_MODEL_PATH,
        )
        logger.info("✅ RAG Retriever 初始化成功")
    except Exception as e:
        logger.warning(f"⚠️ RAG Retriever 初始化失败: {e}")

app.include_router(api_router)

def start_server():
    import uvicorn
    uvicorn.run(
        "api.app:app",
        host=API_HOST,
        port=API_PORT,
        log_level="info",
        timeout_keep_alive=300,
    )

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    start_server()

