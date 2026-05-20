# AI 运维助手（AIOps Agent）

> 智能运维助手：整合实时监控、告警、RAG 检索与大模型推理，支持交互式排查与自动化响应。

![license](https://img.shields.io/badge/license-MIT-blue) ![python](https://img.shields.io/badge/python-3.10%2B-brightgreen) ![vite](https://img.shields.io/badge/frontend-Vite-orange)

本文档以实践为导向，目标是让开发者能快速在本地或测试环境运行完整栈（后端 + 前端 + 依赖服务），并包含部署与排查要点。

目录（快速跳转）
- 概览
- 功能亮点
- 技术栈
- 快速上手
- 配置与环境变量
- 运行模式与示例命令
- 前端开发与构建
- 架构图（概览）
- 部署（Docker / 生产注意）
- 测试与 CI 建议
- 常见问题与排查
- 目录与文件说明
- 贡献指南与许可

-------------------------

## 功能亮点

- 实时监控展示：通过 Prometheus 数据源绘制趋势并支持面板检索。
- 告警与自动化：接入 Alertmanager，支持基于 LLM 的自动化建议与执行（可选 SSH 执行）。
- RAG 问答：本地知识库 + 向量检索，结合大模型生成可解释性回答与定位建议。
- 可扩展工具链：`tools/` 目录包含 Prometheus、SSH、ES、SQL 等封装，便于扩展自定义工具。

## 技术栈（概要）

- 后端：Python, FastAPI
- Agent / RAG：LangChain 风格的代理实现；向量索引存储于 `rag/vectorstore`（本地实现）
- 模型：支持本地模型推理（QWEN 等）与 Embedding（BGE）；LoRA 微调在 `finetune/` 下
- 前端：React + TypeScript + Vite，图表使用 ECharts，UI 组件来自项目内 `frontend/src/components`
- 数据与搜索：Postgres（元数据）、Elasticsearch（可选）、Prometheus（监控）

## 快速上手（本地开发）

1) 克隆仓库并进入：

```bash
git clone <your-repo-url>
cd AI运维助手
```

2) 后端依赖（推荐 virtualenv）：

```bash
python -m venv .venv
# Windows
.venv\\Scripts\\activate
# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt
```

3) 启动开发环境（示例：不启用真实模型，仅运行 API）：

```bash
# 启动 API
python main.py --mode api
# 检查健康
curl http://127.0.0.1:8000/health
```

4) 启动前端控制台：

```bash
cd frontend
npm install
npm run dev
```

访问：默认前端 dev server 通常在 `http://localhost:5173`（或终端输出的端口）。

## 配置与环境变量（建议写入 `config/.env`）

下面列出常用变量与说明：

| 变量 | 说明 | 示例 |
|---|---:|---|
| QWEN_MODEL_PATH | 推理模型路径或 HF 名称 | models/qwen-1.5b |
| BGE_MODEL_PATH | Embedding 模型路径 | models/bge-large-zh-v1.5 |
| DATABASE_URL | Postgres 连接字符串 | postgresql://user:pass@localhost:5432/cmdb |
| PROMETHEUS_URL | Prometheus HTTP 地址 | http://localhost:9090 |
| ALERTMANAGER_URL | Alertmanager 地址 | http://localhost:9093 |
| ELASTICSEARCH_URL | Elasticsearch 地址 | http://localhost:9200 |
| RAG_VECTORSTORE_DIR | 向量库存放目录 | ./rag/vectorstore |
| RAG_KNOWLEDGE_DIR | 知识文档目录 | ./rag/knowledge |
| API_HOST / API_PORT | 后端绑定地址与端口 | 0.0.0.0 / 8000 |

更多默认与解析规则请参见 `config/settings.py`。

## 运行模式（示例命令）

- `api` — 启动 FastAPI 服务：

```bash
python main.py --mode api
```

- `cli` — 交互式 ReAct Agent（本地调试）：

```bash
python main.py --mode cli
```

- `data-gen` — 生成微调/评测数据：

```bash
python main.py --mode data-gen
```

- `finetune` — LoRA 微调：

```bash
python main.py --mode finetune --config finetune/config.yaml
```

- `merge` — 将 LoRA 权重合并回基模型（供部署使用）
- `eval` — 运行 `aio-eval` 下的评测脚本
- `build-index` — 根据 `rag/knowledge` 生成向量索引（首次或数据变更时）

## 前端开发与关键文件

- 运行（开发）：

```bash
cd frontend
npm install
npm run dev
```

- 构建（生产）：

```bash
cd frontend
npm run build
```

- 关键文件：
	- `frontend/src/components/ModuleVisualizations.tsx` — 监控/可视化组件（已做空数据保护）。
	- `frontend/src/App.tsx` — 应用入口及路由。

## 架构图（概览）

```
								 +-------------------+
								 |   Frontend (Vite) |
								 +---------+---------+
													 |
											 HTTP/WS
													 |
								 +---------v---------+
								 |   FastAPI Backend |
								 +----+----+----+----+
											|    |    |
								 +----v+ +v+   v-----+
								 |Prometheus|Postgres|Elastic|
								 +---------+-------+------+ 
											|        
									 Models (local or remote)
									 Rag Vectorstore (./rag/vectorstore)
```

（请替换为更精美的 PNG/SVG 架构图；我可以按需生成并放入 `docs/`）

## 部署建议

- 本仓库包含 `docker/docker-compose.yaml`，可用于本地或测试环境一键启动依赖（Prometheus / Alertmanager / ES / Postgres / 后端）。

一键启动示例：

```bash
docker compose -f docker/docker-compose.yaml up --build
```

生产环境提示：

- 模型文件与索引不要提交到 Git；使用外部对象存储或 Git LFS。
- 使用专门的模型服务（例如 Triton / Ollama / 自托管推理服务）以改善启动时间与资源隔离。
- 使用 Secret Manager（Kubernetes Secrets / Vault / GitHub Secrets）管理凭据。

## 测试、Lint 与 CI 建议

- 后端测试：

```bash
pytest -q
```

- 前端检查：

```bash
cd frontend
npm run lint
```

- 推荐 GitHub Actions 快速流程（示例描述）：
	1. Checkout
	2. Setup Python, install deps, run `pytest`
	3. Setup Node, install deps, run `npm run lint`, `npm run build`
	4. (可选) Build Docker 镜像并 push

我可以为你生成并提交一个基础的 `.github/workflows/ci.yml` 配置（需要你确认是否提交到仓库）。

## 常见问题与排查要点

- 后端无法启动：检查 `API_PORT`、日志输出与依赖服务（Postgres/ES）。
- Prometheus 无数据：确认 `PROMETHEUS_URL` 与抓取配置正确。
- 模型加载失败：确保 `QWEN_MODEL_PATH` 可读且磁盘空间充足，或使用远程模型服务。

## 目录与文件说明（关键）

- `main.py` — 启动入口。
- `api/` — FastAPI 路由与服务注册。
- `agent/` — 代理逻辑、prompt 组装与反应流（ReAct）。
- `tools/` — 各种运维工具封装（prometheus/prediction/ssh/sql 等）。
- `frontend/` — 前端源码（Vite + React）。
- `rag/` — 知识文档与向量索引、检索逻辑。
- `finetune/` — LoRA 微调脚本与配置。

## 贡献指南

- 请使用分支开发并提交 PR，提交信息建议采用 `conventional commits`。
- PR 前请确保后端测试通过并运行前端 lint。对于大型改动建议先在 Issue 讨论设计。

## 许可

本项目使用 MIT 许可证（详见 `LICENSE`）。

---

接下来我可以：

- 生成并提交一个示例 GitHub Actions CI 配置（`ci`）；
- 在 `frontend/README.md` 添加组件说明并放置截图占位（`screenshots`）；
- 生成英文版 `README.en.md`（`english`）。

请选择下一步：`ci` / `screenshots` / `english` / `none`。

