## AI 运维助手（AIOps Agent）

> 智能运维助手：集成实时监控、告警、RAG 检索与大模型推理的运维自动化与问答平台。

本仓库包含后端服务、前端控制台、模型与检索索引管理、以及训练/评估工具。该 README 提供快速上手、开发与部署说明，便于直接上传到 GitHub 作为项目主页文档。

**主要特性**
- 实时监控面板与告警展示
- 基于 RAG（检索增强生成）的知识库检索与故障案例引用
- 可交互的 ReAct 风格运维智能代理（CLI 与 API）
- 支持 LoRA 微调、模型合并与评估基准
- Docker 化部署示例，集成 Prometheus、Alertmanager、Elasticsearch、Postgres

**目录概览**
- [main.py](main.py) - 项目入口脚本，支持多种运行模式（api / cli / data-gen / finetune / merge / eval / rag-bench / build-index）
- [requirements.txt](requirements.txt) - Python 依赖列表
- [frontend/](frontend/) - React + Vite 前端源码（控制台 UI）
- [docker/docker-compose.yaml](docker/docker-compose.yaml) - 整体服务编排示例（包含模型容器、prometheus、elasticsearch、postgres 等）
- [docker/Dockerfile](docker/Dockerfile) - 后端镜像构建文件（示例，基于 CUDA 镜像）
- [config/settings.py](config/settings.py) - 配置与环境变量处理（默认路径、端口、模型位置等）
- [models/](models/) - 建议存放本地模型权重（示例：qwen、bge）
- [rag/](rag/) - 知识库与向量存储目录（检索索引）
- [finetune/](finetune/) - LoRA 微调工具与配置
- [api/](api/) - FastAPI 服务初始化与路由
- [tools/](tools/) - 各类运维工具插件（Prometheus、SSH、Elasticsearch 等）

快速开始
----------

以下说明假定你在 Windows、Linux 或 macOS 上本地开发环境中操作；另有 Docker 部署部分供生产或集成环境使用。

1. 克隆仓库

```bash
git clone <your-repo-url>
cd AI运维助手
```

2. 创建 Python 虚拟环境并安装依赖

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

3. 配置环境变量

复制或编辑 `config/.env`（如果不存在，可在 `config/` 下创建），常见变量：

- `QWEN_MODEL_PATH`：Qwen 模型路径或 Hugging Face 名称
- `BGE_MODEL_PATH`：BGE Embedding 模型路径或名称
- `DATABASE_URL`：Postgres 连接字符串
- `PROMETHEUS_URL`, `ALERTMANAGER_URL`, `ELASTICSEARCH_URL`
- `API_HOST`, `API_PORT`

默认值见 [config/settings.py](config/settings.py)。如果使用 Docker Compose，许多变量可在 `docker/docker-compose.yaml` 中通过环境注入。

4. 运行后端 API（开发快速启动）

```bash
# 以 API 模式启动
python main.py --mode api
```

默认监听端口由 `API_PORT` 控制，默认为 `8000`。

5. 运行前端（控制台 UI）

```bash
cd frontend
npm install
npm run dev
```

开发时前端默认使用 Vite 的 dev server（HMR 支持）。构建生产包：`npm run build`。

Docker 化部署（示例）
------------------

仓库提供一个示例 `docker/docker-compose.yaml`，包含后端、Prometheus、Alertmanager、Elasticsearch 与 Postgres。该 compose 文件默认把后端端口映射到 `8000`。

```bash
# 在仓库根目录运行（需 Docker 与 Docker Compose）
docker compose -f docker/docker-compose.yaml up --build
```

注意：默认 `docker/Dockerfile` 基于 `nvidia/cuda` 镜像并尝试安装 Python 与依赖。如果需要在 GPU 上使用模型推理，确保宿主机已安装并配置 NVIDIA Container Toolkit，并在 compose 中启用设备或使用 `--gpus`。

模型与检索
------------

- 模型文件夹：`models/`（可通过 `config/settings.py` 中的环境变量指向其他位置）
- RAG 知识与向量存储：`rag/knowledge`、`rag/vectorstore`
- 在 CLI 模式（`python main.py --mode cli`）或 API 启动时，项目会尝试初始化检索器并在向量库为空时构建索引。

运行模式详解（`main.py`）
--------------------------------
- `api`：启动 FastAPI 服务（推荐用于生产/容器部署）
- `cli`：交互式 ReAct Agent（文本终端）
- `data-gen`：生成微调/评估用训练数据
- `finetune`：执行 LoRA 微调（参考 `finetune/config.yaml`）
- `merge`：合并 LoRA 权重
- `eval`：运行评估基准（参考 `aio-eval/`）
- `rag-bench`：RAG 检索性能 benchmark
- `build-index`：手动构建知识库索引

前端说明
---------

前端位于 `frontend/`，使用 React + TypeScript + Vite。主要启动命令在 [frontend/package.json](frontend/package.json) 中：

- `npm run dev`：本地开发
- `npm run build`：构建生产包

关键文件：
- UI 组件位于 `frontend/src/components/`（例如 `ModuleVisualizations.tsx` 提供监控与面板可视化）

开发与测试
----------------

- 后端单元/集成测试位于 `tests/`，可以使用 `pytest` 运行：

```bash
pytest -q
```

- 前端使用 `eslint` 与 TypeScript 编译辅助质量控制：

```bash
cd frontend
npm run lint
npm run build
```

常见问题与注意事项
--------------------
- 模型体积大：请确保有足够磁盘空间与网络带宽用于下载 Hugging Face 模型权重。
- 若在 Docker 中使用 GPU，请安装并启用 NVIDIA Container Toolkit，并在 `docker-compose` 中为容器分配 GPU 资源。
- 若遇到缺少配置/密钥，请检查 `config/.env` 或环境变量是否正确设置。

贡献指南
-----------

欢迎提交 Issue 与 PR。建议流程：
1. Fork 仓库并新建分支
2. 提交修复/功能分支并包含必要测试
3. 发起 PR 并在 PR 描述中说明变更与测试步骤

许可证
-------

仓库当前未包含明确许可证文件。建议在发布到公共仓库前补充 `LICENSE`（如 MIT、Apache-2.0 等），以明确使用与贡献条款。

联系方式
-----------
如需进一步帮助或希望我把该 README 调整为英文版/更紧凑的版本，请告诉我需要改动的部分。

---
小提示：如果你希望我把上述 README 自动提交为一个 Git commit 并推送到远端仓库，我可以帮你生成对应的命令序列。 
