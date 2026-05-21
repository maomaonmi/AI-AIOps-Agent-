<div align="center">

# 🤖 AI 运维助手 (AIOps Agent)

**基于大语言模型的智能运维平台 — 实时监控 · 故障诊断 · 趋势预测 · 自动化响应**

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Python](https://img.shields.io/badge/python-3.10%2B-brightgreen)](https://www.python.org/) [![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)](https://fastapi.tiangolo.com/) [![React](https://img.shields.io/badge/frontend-React_19-61DAFB)](https://react.dev/) [![Vite](https://img.shields.io/badge/build-Vite_8-646CFF)](https://vitejs.dev/)

[功能演示](#-功能模块设计) · [快速开始](#-快速上手指南) · [架构设计](#-整体项目架构) · [部署指南](#-部署流程) · [贡献指南](#-贡献指南)

</div>

<img width="1277" height="625" alt="image" src="https://github.com/user-attachments/assets/e769eb2d-c165-4241-a8f3-64e3d1e1cd62" />

---

## 📑 目录

- [技术栈概览](#-技术栈概览)
- [项目亮点](#-项目亮点)
- [核心竞争力](#-核心竞争力)
- [整体项目架构](#-整体项目架构)
- [系统架构图](#-系统架构图)
- [整体流程图](#-整体流程图)
- [数据流架构](#-数据流架构)
- [前端技术细节](#-前端技术细节)
- [后端技术细节](#-后端技术细节)
- [AI 模块说明](#-ai-模块说明)
- [功能模块设计](#-功能模块设计)
- [Docker 配置说明](#-docker-配置说明)
- [第三方服务集成](#-第三方服务集成)
- [项目说明书](#-项目说明书)
- [快速上手指南](#-快速上手指南)
- [部署流程](#-部署流程)
- [优化策略](#-优化策略)
- [未来计划](#-未来计划)
- [项目统计](#-项目统计)
- [贡献指南](#-贡献指南)
- [许可信息](#-许可信息)

---

## 🛠 技术栈概览

### 后端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| Web 框架 | FastAPI | ≥0.108 | 高性能异步 API 服务 |
| ASGI 服务器 | Uvicorn | ≥0.25 | 生产级 HTTP 服务器 |
| 数据校验 | Pydantic | ≥2.5 | 请求/响应模型校验 |
| LLM 框架 | LangChain | ≥0.1 | Agent 编排与工具调用 |
| LLM 模型 | Qwen (通义千问) | 1.5B / 7B | 本地推理 / 云端 API |
| 向量数据库 | FAISS | ≥1.7.4 | RAG 知识库检索 |
| 嵌入模型 | BGE-large-zh-v1.5 | — | 中文语义向量化 |
| GPU 监控 | nvidia-ml-py | — | NVIDIA GPU 实时数据采集 |
| 系统监控 | psutil | — | CPU/内存/磁盘/网络数据采集 |
| 数据库 | PostgreSQL | 16 | CMDB 配置数据库 |
| 时序数据库 | Prometheus | 2.48 | 监控指标存储与查询 |
| 日志存储 | Elasticsearch | 8.11 | 日志搜索与分析 |
| 告警管理 | AlertManager | 0.26 | 告警路由与静默 |
| 远程执行 | Paramiko | ≥3.4 | SSH 远程命令执行 |
| ML 训练 | PEFT / Transformers | ≥0.7 / ≥4.36 | LoRA 微调与模型加载 |
| 深度学习 | PyTorch | ≥2.1 | 模型推理后端 |

### 前端技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| UI 框架 | React | 19.2 | 函数组件 + Hooks |
| 类型系统 | TypeScript | 6.0 | 全量类型安全 |
| 构建工具 | Vite | 8.0 | 极速 HMR 开发体验 |
| CSS 框架 | Tailwind CSS | 4.2 | 原子化样式系统 |
| 图表库 | ECharts | 6.1 | 实时数据可视化 |
| 图标库 | Lucide React | 1.8 | 轻量 SVG 图标 |
| 状态管理 | Zustand | 5.0 | 极简响应式 Store |
| Markdown 渲染 | react-markdown | 10.1 | AI 回复富文本展示 |
| PDF 导出 | html2pdf.js | 0.14 | 报告导出功能 |

---

## ✨ 项目亮点

### 1. 🧠 ReAct 推理引擎 — 真实数据驱动的智能诊断

采用 ReAct (Reasoning + Acting) 范式，Agent 在每一步推理后调用真实工具获取实时数据，而非猜测或编造。支持多步推理链，最多 5 轮工具调用，确保诊断结论基于真实系统状态。

<img width="980" height="617" alt="image" src="https://github.com/user-attachments/assets/dbcc1804-769b-4e0a-9b13-9900df7513b2" />

### 2. 🎯 分层提示词路由 — 模块专属规则引擎

创新性地设计了「意图分类 → 模块匹配 → 提示词组装 → 工具过滤」四层路由架构。每个运维模块（CPU/内存/磁盘/网络/GPU）拥有独立的详细规则模板，包含触发条件、工具调用流程、分析阈值、输出格式和图表要求，彻底解决"问什么都出图表"的问题。

### 3. 📊 全栈真实数据 — 零 Mock 运行

所有监控数据均通过 psutil、nvidia-ml-py 等底层库直接采集真实硬件数据，GPU 信息通过 NVML API 获取，CPU 温度、频率、每核负载均为实时值。前端图表每 3 秒刷新，数据更新频率 ≥1次/秒。

<img width="1088" height="588" alt="image" src="https://github.com/user-attachments/assets/65ede070-8bad-4b7b-bc0e-81fc1d2eb231" />

### 4. 🔍 RAG 增强检索 — 运维知识库

基于 BGE-large-zh 向量模型 + FAISS 构建私有运维知识库，支持故障处理 SOP、架构文档、配置规范的语义检索。Agent 在诊断时可自动检索相关案例和最佳实践，提供有据可依的处置建议。

<img width="743" height="597" alt="image" src="https://github.com/user-attachments/assets/4ceb2692-d0ae-41ef-802b-9c059264b277" />

### 5. 🐳 一键容器化部署

完整的 Docker Compose 编排方案，包含 AI 推理服务、Prometheus、AlertManager、Elasticsearch、PostgreSQL 五大组件，支持 GPU 直通，一条命令即可启动完整运维平台。

<img width="738" height="245" alt="image" src="https://github.com/user-attachments/assets/ee42a179-3fef-4f19-aa10-30357593d0cd" />

---

## 💎 核心竞争力

### 与传统运维监控平台的差异

| 维度 | 传统监控 (Zabbix/Grafana) | 本项目 |
|------|---------------------------|--------|
| 告警处理 | 人工判断 + 手动排查 | AI 自动诊断 + 根因分析 |
| 交互方式 | Dashboard 查看 + 手动查询 | 自然语言对话 + 智能推荐 |
| 知识沉淀 | 文档/Wiki 分离 | RAG 知识库实时检索 |
| 故障响应 | 人工执行 SOP | Agent 推理 + 自动化操作建议 |
| 数据分析 | 静态阈值告警 | 趋势预测 + 异常预警 |
| 部署成本 | 多系统组合 + 复杂配置 | 一键 Docker 部署 |

### 技术壁垒

1. **ReAct Agent 自适应推理**：Agent 根据问题类型动态选择工具组合，支持跨模块联合诊断（如 CPU+内存+磁盘综合分析），而非固定工作流
2. **模块化提示词工程**：12 个模块专属提示词模板，每个模板包含完整的触发规则、数据采集流程、分析阈值表和输出格式约束，确保 LLM 输出一致且专业
3. **实时数据闭环**：从硬件采集 → API 传输 → 前端渲染全链路真实数据，无任何模拟数据注入

---

## 🏗 整体项目架构

### 设计理念

本项目采用**前后端分离 + Agent 中枢**的三层架构：

- **展示层**（Frontend）：React SPA，负责实时监控可视化、对话交互、模块化面板展示
- **服务层**（Backend）：FastAPI 异步服务，负责 API 路由、意图分类、提示词组装、数据聚合
- **智能层**（Agent）：ReAct 推理引擎，负责工具调用、多步推理、RAG 检索、诊断决策

### 分层结构

```
┌─────────────────────────────────────────────────────────┐
│                    展示层 (Frontend)                      │
│  React 19 + TypeScript + Tailwind CSS + ECharts         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │监控面板│ │对话界面│ │快捷功能│ │报告面板│ │拓扑视图│         │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘         │
└─────┼────────┼────────┼────────┼────────┼───────────────┘
      │        │        │        │        │
      ▼        ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────────┐
│                    服务层 (Backend)                       │
│  FastAPI + Uvicorn + Pydantic                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │API路由│ │意图分类│ │提示词组装│ │数据聚合│ │流式响应│         │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘         │
└─────┼────────┼────────┼────────┼────────┼───────────────┘
      │        │        │        │        │
      ▼        ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────────┐
│                    智能层 (Agent)                         │
│  ReAct Engine + LangChain + RAG                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │推理引擎│ │工具注册│ │知识检索│ │模型推理│ │多步决策│         │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘         │
└─────┼────────┼────────┼────────┼────────┼───────────────┘
      │        │        │        │        │
      ▼        ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────────┐
│                    数据层 (Data Sources)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│  │psutil│ │NVML  │ │Prom  │ │ES    │ │PG    │         │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 系统架构图

```
                            ┌──────────────┐
                            │   用户浏览器   │
                            └──────┬───────┘
                                   │ HTTP/WS
                                   ▼
                    ┌──────────────────────────┐
                    │    Vite Dev Server        │
                    │    (Proxy /api → :8000)   │
                    └──────────┬───────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (:8000)                    │
│                                                                │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ /api/   │  │ Intent       │  │ Prompt             │      │
│  │ chat    │→│ Classifier   │→│ Assembler          │      │
│  └─────────┘  └──────────────┘  └─────────┬──────────┘      │
│                                            │                  │
│  ┌─────────┐  ┌──────────────┐            │                  │
│  │ /api/   │  │ Module Data  │            ▼                  │
│  │ cpu/    │  │ Builder      │  ┌────────────────────┐      │
│  │ memory/ │  └──────────────┘  │ ReAct Agent        │      │
│  │ disk/   │                    │ ┌────────────────┐ │      │
│  │ network/│                    │ │ Thought→Action │ │      │
│  │ gpu/    │                    │ │ →Observation   │ │      │
│  └─────────┘                    │ │ →Final Answer  │ │      │
│                                 └────────┬───────────┘      │
│                                          │                    │
│  ┌───────────────────────────────────────┼──────────────┐   │
│  │           Tool Registry (14 Tools)    │              │   │
│  │  cpu_check │ memory_check │ disk_check│              │   │
│  │  network_check │ gpu_check │ system_health           │   │
│  │  system_architecture │ trend_prediction              │   │
│  │  sql_query │ prometheus_query │ ssh_exec             │   │
│  │  log_search │ alert_query │ knowledge_search         │   │
│  └───────────────────────────────────────┼──────────────┘   │
└──────────────────────────────────────────┼──────────────────┘
                                           │
                    ┌──────────────────────┼─────────────────┐
                    │                      │                  │
                    ▼                      ▼                  ▼
           ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
           │  psutil/NVML  │    │  Prometheus  │    │Elasticsearch │
           │  (本地硬件)    │    │  (:9090)     │    │  (:9200)     │
           └──────────────┘    └──────────────┘    └──────────────┘
                                       │                  │
                                       ▼                  ▼
                               ┌──────────────┐    ┌──────────────┐
                               │ AlertManager │    │  PostgreSQL  │
                               │  (:9093)     │    │  (:5432)     │
                               └──────────────┘    └──────────────┘
```

---

## 🔄 整体流程图

```
用户输入问题
     │
     ▼
┌─────────────┐     闲聊/概念
│ 意图分类器    │──────────────→ 直接回答（不调用工具）
│ IntentClassifier            │
└──────┬──────┘
       │ 运维相关问题
       ▼
┌─────────────┐
│ 提示词组装器  │ ← 模块专属提示词模板
│ PromptAssembler             │ ← 工具描述过滤
└──────┬──────┘ ← 图表指令条件化
       │ 动态系统指令
       ▼
┌─────────────┐
│ ReAct Agent  │
│ ┌───────────┐│
│ │ Thought   ││ ← 分析问题，决定调用哪个工具
│ │    ↓      ││
│ │ Action    ││ ← 调用工具获取真实数据
│ │    ↓      ││
│ │ Observation││ ← 分析工具返回的数据
│ │    ↓      ││
│ │ (循环最多5轮)│
│ │    ↓      ││
│ │ Final     ││ ← 综合总结 + 建议
│ │ Answer    ││
│ └───────────┘│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 模块数据构建  │ ← 根据意图构建前端可视化数据
│ build_module_data           │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ChatResponse │ → answer + module_data + intermediate_steps
└─────────────┘
       │
       ▼
前端渲染：文字回复 + 模块可视化面板
```

---

## 📈 数据流架构

```
┌─────────────────────────── 数据采集层 ───────────────────────────┐

  psutil                    nvidia-ml-py              Prometheus
  CPU使用率/频率/温度         GPU使用率/显存/温度/功耗     PromQL 查询
  内存使用率/Swap            GPU型号/驱动版本             时序指标数据
  磁盘容量/IO/SMART          功耗/风扇转速
  网络接口/流量/速率

┌─────────────────────────── 数据传输层 ───────────────────────────┐

  Tool._run()              →  JSON 序列化  →  FastAPI Endpoint
  cpu_check._run()         →  {"overall_percent": 23.7, ...}
  memory_check._run()      →  {"percent": 65.2, "used_gb": 20.8, ...}
  gpu_check._run()         →  {"has_gpu": true, "devices": [...]}

┌─────────────────────────── 数据处理层 ───────────────────────────┐

  Agent 接收 Observation → 分析阈值判断 → 生成诊断结论
  build_module_data()    → 构建前端可视化数据结构
  _build_monitoring_metrics() → 转换为 MetricInfo[] 格式

┌─────────────────────────── 数据展示层 ───────────────────────────┐

  SSE 流式传输 → 前端逐字渲染
  ModuleData   → MonitoringModule / PredictionModule / DiagnosisModule
  ECharts      → 实时折线图 / 仪表盘 / 热力图
  setInterval  → 每 3 秒轮询 /api/cpu/info 等端点刷新图表
```

---

## 🖥 前端技术细节

### 架构设计

前端采用 React 19 函数组件 + Hooks 架构，无类组件，全面拥抱函数式编程范式。

### 目录结构

```
frontend/src/
├── components/          # 40+ 组件
│   ├── RealtimeMonitorPanel.tsx   # 实时监控主面板
│   ├── MessageBubble.tsx          # 对话消息气泡
│   ├── ChatInput.tsx              # 对话输入框
│   ├── ModuleVisualizations.tsx   # 模块可视化渲染器
│   ├── QuickActionModal.tsx       # 快捷功能弹窗
│   ├── Sidebar.tsx                # 侧边栏导航
│   └── ...                        # 其他功能组件
├── services/
│   └── api.ts                     # API 通信层（支持 SSE 流式）
├── store/
│   └── index.ts                   # Zustand 全局状态管理
├── types/
│   ├── index.ts                   # 核心类型定义
│   └── moduleData.ts              # 模块数据类型（634行）
├── utils/
│   └── moduleAdapters.ts          # 模块数据适配器
├── hooks/
│   └── useIsMobile.ts             # 响应式断点 Hook
├── App.tsx                        # 应用入口
└── main.tsx                       # 渲染入口
```

### 状态管理

使用 Zustand 5.0 管理全局状态，核心 Store 包含：

- `conversations`: 对话列表与消息历史
- `activeConversationId`: 当前活跃对话
- `sidebarOpen`: 侧边栏展开状态
- `quickAction`: 快捷功能弹窗状态

### API 通信

- **普通请求**：`POST /api/chat` — 完整响应模式
- **流式请求**：`POST /api/chat/stream` — SSE 逐字输出
- **监控数据**：`GET /api/{cpu|memory|disk|network|gpu}/info` — 实时数据轮询
- **快捷功能**：`GET /api/health/report`、`/api/architecture/report` 等

### 可视化方案

- **ECharts 6.1**：实时折线图、仪表盘、热力图
- **echarts-for-react**：React 组件封装
- **SVG 内联图表**：MiniChart 轻量趋势线
- 数据刷新间隔：3 秒（监控面板），1 秒（GPU 实时数据）

---

## ⚙️ 后端技术细节

### API 设计

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/chat` | POST | 对话（完整响应） |
| `/api/chat/stream` | POST | 对话（SSE 流式） |
| `/api/cpu/info` | GET | CPU 实时数据 |
| `/api/memory/info` | GET | 内存实时数据 |
| `/api/disk/info` | GET | 磁盘实时数据 |
| `/api/network/info` | GET | 网络实时数据 |
| `/api/gpu/info` | GET | GPU 实时数据 |
| `/api/health/report` | GET | 系统健康报告 |
| `/api/architecture/report` | GET | 系统架构报告 |
| `/api/log/summary` | GET | 日志分析摘要 |
| `/api/prediction` | GET | 趋势预测 |
| `/health` | GET | 服务健康检查 |

### 数据库选型

- **PostgreSQL 16**：CMDB 配置数据、服务拓扑关系
- **Prometheus**：时序监控指标存储
- **Elasticsearch 8.11**：日志全文检索
- **FAISS**：向量知识库索引

### 认证授权

当前版本为单用户本地部署模式，暂不涉及多租户认证。生产环境建议通过反向代理（Nginx）添加 Basic Auth 或 OAuth2。

---

## 🧠 AI 模块说明

### ReAct 推理引擎

Agent 采用 ReAct (Reasoning + Acting) 范式，执行流程：

1. **Thought**：分析用户问题，决定下一步行动
2. **Action**：调用工具获取真实数据
3. **Observation**：分析工具返回结果
4. **循环**：最多 5 轮，直到得出最终答案
5. **Final Answer**：综合总结 + 操作建议

### 意图分类系统

基于关键词加权评分的多标签分类器，支持：

- **模块识别**：CPU / 内存 / 磁盘 / 网络 / GPU / 健康 / 架构 / 预测 / 日志 / 告警 / 诊断
- **意图判断**：监控 / 预测 / 诊断 / 知识 / 自动化 / 闲聊
- **图表需求**：根据问题语义判断是否需要可视化
- **严重程度**：normal / warning / critical

### 分层提示词路由

```
用户问题 → 意图分类 → 模块匹配 → 提示词组装 → 工具过滤 → Agent 执行

模块提示词模板 (12个):
├── CPU: 触发条件 + 工具调用 + 阈值表 + 输出格式 + 图表要求
├── 内存: 触发条件 + 工具调用 + 阈值表 + 输出格式 + 图表要求
├── 磁盘: 触发条件 + 工具调用 + 阈值表 + 输出格式 + 图表要求
├── 网络: 触发条件 + 工具调用 + 阈值表 + 输出格式 + 图表要求
├── GPU: 触发条件 + 工具调用 + 阈值表 + 输出格式 + 图表要求
├── 健康: 综合体检规则 + 评分算法 + 建议生成
├── 架构: 硬件+软件信息采集 + 报告格式
├── 预测: 线性回归 + 移动平均 + 风险评估
├── 日志: 日志级别分析 + 时间热力图 + 高频错误
├── 告警: 告警过滤 + 严重程度排序
├── 诊断: 多模块联合诊断 + 根因分析 + 证据链
└── 闲聊: 直接回答 + 不调用工具
```

### RAG 知识检索

- **嵌入模型**：BAAI/bge-large-zh-v1.5（1024 维向量）
- **向量存储**：FAISS IndexFlatIP（内积相似度）
- **文档切分**：RecursiveCharacterTextSplitter（512 字符，64 重叠）
- **知识来源**：`rag/knowledge/fault_handling/` 目录下的 SOP 文档

### 模型选型

| 模式 | 模型 | 部署方式 | 适用场景 |
|------|------|----------|----------|
| 本地 | Qwen2-1.5B | Transformers + PyTorch | 快速推理，低资源 |
| 本地 | Qwen2-7B | Transformers + GPU | 高质量推理 |
| 云端 | Qwen-Plus | DashScope API | 最佳效果，零部署 |

---

## 🧩 功能模块设计

### 1. 实时监控面板

- **数据源**：psutil + nvidia-ml-py 直采
- **刷新频率**：3 秒轮询
- **展示内容**：CPU/内存/GPU/网络 四大模块实时数据
- **图表类型**：折线图（趋势）、仪表盘（使用率）、柱状图（进程排名）
- **异常预警**：超过阈值自动标红
<img width="1090" height="592" alt="image" src="https://github.com/user-attachments/assets/1949bc33-8ec6-4e75-a021-a652f836b4e3" />

### 2. 智能对话

- **输入方式**：自然语言文本
- **响应模式**：普通模式 / 深度思考模式 / 在线模式
- **流式输出**：SSE 逐字渲染
- **模块可视化**：根据意图自动展示对应监控面板
<img width="1088" height="615" alt="image" src="https://github.com/user-attachments/assets/9967f65b-d66f-4424-b72d-e3a047dfd42b" />

### 3. 系统体检

- **评分算法**：CPU(25%) + 内存(25%) + 磁盘(25%) + 网络(12.5%) + GPU(12.5%)
- **输出**：综合评分(0-100)、各分类评分、问题列表、优化建议

### 4. 趋势预测

- **算法**：线性回归 + 移动平均
- **预测范围**：未来 1-24 小时
- **目标**：CPU / 内存 / 磁盘使用率
- **输出**：预测值 + 置信区间 + 风险预警
<img width="550" height="620" alt="image" src="https://github.com/user-attachments/assets/5a39de84-a776-4add-9f2b-6f55ee6c8c26" />

### 5. 架构报告

- **采集项**：操作系统、CPU型号/核心数、内存容量、磁盘分区、GPU信息、网络接口、运行时环境
- **输出**：结构化系统全景报告
<img width="885" height="544" alt="image" src="https://github.com/user-attachments/assets/084a4eac-7309-4368-b573-57bf5ee2cc6d" />


### 6. 日志可视化

- **数据源**：系统日志文件扫描
- **分析维度**：日志级别分布、时间热力图、高频错误统计
- **乱码处理**：自动过滤非文本文件和乱码行


### 7. 快捷功能面板

- **系统体检**：一键获取综合健康评分
- **趋势预测**：资源使用趋势预测
- **架构报告**：系统全景信息
- **日志可视化**：日志分析摘要

---

## 🐳 Docker 配置说明

### 容器编排

```yaml
services:
  aiops-agent:      # AI 推理服务 (GPU 直通)
  prometheus:        # 监控指标存储
  alertmanager:      # 告警管理
  elasticsearch:     # 日志存储
  postgres:          # CMDB 数据库
```

### 服务依赖

```
aiops-agent → prometheus (监控数据)
aiops-agent → postgres (配置数据)
aiops-agent → elasticsearch (日志数据)
aiops-agent → alertmanager (告警数据)
```

### Dockerfile

基于 `nvidia/cuda:12.1.0-runtime-ubuntu22.04`，包含：
- Python 3.10 运行环境
- SSH 客户端（远程执行）
- 健康检查（30 秒间隔）
- GPU 设备支持

### 数据卷

| 卷名 | 挂载点 | 用途 |
|------|--------|------|
| model-cache | /root/.cache/huggingface | 模型缓存 |
| prometheus-data | /prometheus | 监控数据持久化 |
| es-data | /usr/share/elasticsearch/data | 日志数据持久化 |
| pg-data | /var/lib/postgresql/data | 数据库持久化 |

---

## 🔌 第三方服务集成

| 服务 | 用途 | 配置方式 |
|------|------|----------|
| Prometheus | 时序监控指标 | `PROMETHEUS_URL` 环境变量 |
| AlertManager | 告警路由 | `ALERTMANAGER_URL` 环境变量 |
| Elasticsearch | 日志搜索 | `ELASTICSEARCH_URL` 环境变量 |
| PostgreSQL | CMDB 数据库 | `DATABASE_URL` 环境变量 |
| DashScope | 云端 LLM API | `DASHSCOPE_API_KEY` 环境变量 |
| NVIDIA NVML | GPU 硬件数据 | 自动检测，无需配置 |

---

## 📖 项目说明书

### 项目简介

AI 运维助手是一个基于大语言模型的智能运维平台，将实时监控、故障诊断、趋势预测和自动化响应整合到统一的对话式界面中。用户通过自然语言与系统交互，Agent 自动调用工具获取真实数据，进行多步推理分析，并给出专业的诊断结论和操作建议。

### 核心功能

1. **智能对话**：自然语言交互，支持流式输出
2. **实时监控**：CPU/内存/磁盘/网络/GPU 五大模块实时数据
3. **故障诊断**：多步推理 + 根因分析 + 证据链
4. **趋势预测**：线性回归 + 移动平均算法
5. **系统体检**：综合健康评分 + 优化建议
6. **架构报告**：系统全景信息采集
7. **日志分析**：级别分布 + 时间热力图 + 高频错误
8. **知识检索**：RAG 语义检索运维知识库

### 使用指南

1. 在对话框输入运维问题，如"CPU使用率怎么样"
2. Agent 自动识别意图，调用工具获取真实数据
3. 查看分析结果和可视化面板
4. 点击右侧快捷按钮使用系统体检等功能

---

## 🚀 快速上手指南

### 环境要求

- Python 3.10+
- Node.js 18+
- NVIDIA GPU（可选，用于本地模型推理）
- Docker & Docker Compose（可选，用于容器化部署）

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/your-username/AIOps-Agent.git
cd AIOps-Agent

# 2. 安装后端依赖
pip install -r requirements.txt
pip install nvidia-ml-py psutil

# 3. 配置环境变量
cp config/.env.example config/.env
# 编辑 .env 文件，配置模型路径和 API Key

# 4. 启动后端
python main.py --mode api
# 或
python -m uvicorn api.app:app --host 0.0.0.0 --port 8000

# 5. 启动前端
cd frontend
npm install
npm run dev

# 6. 访问应用
# 前端: http://localhost:5173
# 后端 API: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

### Docker 部署

```bash
# 启动所有服务
cd docker
docker-compose up -d

# 查看日志
docker-compose logs -f aiops-agent

# 停止服务
docker-compose down
```

---

## 📦 部署流程

### 开发环境

| 组件 | 配置 |
|------|------|
| LLM | Qwen2-1.5B 本地模型 |
| 数据库 | SQLite / 本地 PostgreSQL |
| 监控 | 直接 psutil 采集 |
| 前端 | Vite Dev Server (HMR) |

### 测试环境

| 组件 | 配置 |
|------|------|
| LLM | DashScope API (Qwen-Plus) |
| 数据库 | Docker PostgreSQL |
| 监控 | Docker Prometheus |
| 前端 | Vite Preview / Nginx |

### 生产环境

| 组件 | 配置 |
|------|------|
| LLM | Qwen2-7B + GPU 或 DashScope API |
| 数据库 | 托管 PostgreSQL |
| 监控 | Prometheus Cluster |
| 前端 | Nginx 静态托管 |
| 部署 | Docker Compose / K8s |

---

## ⚡ 优化策略

### 性能优化

- **异步 I/O**：FastAPI 原生 async/await，Agent 推理使用 `asyncio.to_thread` 避免阻塞
- **流式响应**：SSE 逐字输出，首字延迟 < 500ms
- **数据缓存**：工具调用结果可缓存，避免重复采集
- **前端懒加载**：ECharts 按需加载，减少首屏体积

### 安全优化

- **SQL 注入防护**：SQLQueryTool 仅允许 SELECT 查询
- **SSH 白名单**：仅允许预定义的只读命令
- **环境变量隔离**：敏感信息通过 .env 管理，不硬编码
- **CORS 配置**：限制跨域来源

### 用户体验优化

- **实时刷新**：监控面板 3 秒自动更新
- **错误边界**：模块可视化组件防御性编程，数据缺失时优雅降级
- **响应式布局**：自适应桌面/平板/手机
- **快捷操作**：一键系统体检、趋势预测等

---

## 🗺 未来计划

### 短期 (1-3 个月)

- [ ] 多用户认证与权限管理
- [ ] WebSocket 双向通信替代 SSE
- [ ] 告警规则自定义引擎
- [ ] 更多 GPU 厂商支持（AMD ROCm）
- [ ] 移动端适配优化

### 中期 (3-6 个月)

- [ ] Kubernetes 集群监控集成
- [ ] 多 Agent 协作诊断
- [ ] 自动化修复操作执行
- [ ] 历史数据回溯分析
- [ ] 国际化 (i18n) 支持

### 长期 (6-12 个月)

- [ ] AIOps 大模型微调（领域适配）
- [ ] 分布式 Agent 集群部署
- [ ] 智能容量规划
- [ ] Chaos Engineering 集成
- [ ] SLA 管理与报告

---

## 📊 项目统计

| 指标 | 数值 |
|------|------|
| Python 文件 | 54 |
| React 组件 | 40 |
| TypeScript 文件 | 7 |
| 总代码行数 | ~29,000 |
| API 端点 | 12+ |
| 注册工具 | 14 |
| 提示词模板 | 12 |
| Docker 服务 | 5 |
| 知识库 SOP | 3 |

---

## 🤝 贡献指南

### 参与贡献

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

### 代码规范

- **Python**：遵循 PEP 8，使用 type hints
- **TypeScript**：ESLint + 严格模式
- **提交信息**：遵循 Conventional Commits
  - `feat:` 新功能
  - `fix:` 修复 Bug
  - `docs:` 文档更新
  - `refactor:` 代码重构
  - `test:` 测试相关

### 开发流程

1. 在 Issue 中描述问题或功能需求
2. 等待维护者确认并分配
3. 开发完成后提交 PR
4. 通过 Code Review 后合并

---

## 📄 许可信息

本项目基于 [MIT License](LICENSE) 开源。

```
MIT License

Copyright (c) 2026 maomaonmi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star！**

Made with ❤️ by [maomaonmi](https://github.com/maomaonmi)

</div>
