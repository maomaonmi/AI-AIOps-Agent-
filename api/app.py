import logging

import asyncio

import json

import sys

import os

import time

from datetime import datetime

from contextlib import asynccontextmanager

from typing import Optional



from fastapi import FastAPI, HTTPException, Request, APIRouter

from fastapi.middleware.cors import CORSMiddleware

from fastapi.responses import JSONResponse, StreamingResponse



sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))



from api.schemas import (

    QueryRequest, QueryResponse, HealthResponse, BuildIndexRequest,

    ChatRequest, ChatResponse, CasualChatRequest, ModuleData, BaseModel,

    LlmModeRequest, LlmModeResponse,

)

from agent.react_agent import ReActAgent
from tools.registry import create_all_tools
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

            max_tokens=1024,

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
                max_new_tokens=512,
                max_length=512,
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

            data = {

                'module_type': module_type,

                'params': params,

                'modules': modules,

            }

            return ModuleData(type='monitoring', data=data)



        elif module_type in ('health', 'architecture'):

            data = {

                'module_type': module_type,

                'params': params,

                'modules': modules,

            }

            return ModuleData(type='report', data=data)



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

            data = {

                'module_type': 'log',

                'params': params,

                'modules': modules,

            }

            return ModuleData(type='monitoring', data=data)



        elif module_type == 'alert':

            data = {

                'module_type': 'alert',

                'params': params,

                'modules': modules,

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





@asynccontextmanager

async def lifespan(app: FastAPI):

    global agent, retriever, data_collector, intent_classifier

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

        module_data=module_data,

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

