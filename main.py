import argparse
import logging
import sys

from config.settings import LOG_LEVEL

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def run_api():
    logger.info("Starting AIOps Agent API server...")
    from api.app import start_server
    start_server()


def run_cli():
    logger.info("Starting AIOps Agent CLI mode...")
    from agent.react_agent import ReActAgent
    from tools.registry import create_all_tools
    from config.settings import (
        QWEN_MODEL_PATH, DATABASE_URL, PROMETHEUS_URL, SSH_HOSTS_CONFIG,
        ELASTICSEARCH_URL, ALERTMANAGER_URL, RAG_KNOWLEDGE_DIR, RAG_VECTORSTORE_DIR,
        BGE_MODEL_PATH,
    )

    logger.info("Initializing RAG retriever...")
    try:
        from rag.retriever import OpsRetriever
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
        logger.warning(f"RAG init failed: {e}")
        langchain_retriever = None

    logger.info("Loading LLM...")
    from langchain_community.llms import HuggingFacePipeline
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    import torch

    tokenizer = AutoTokenizer.from_pretrained(QWEN_MODEL_PATH, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        QWEN_MODEL_PATH,
        trust_remote_code=True,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        max_new_tokens=1024,
        do_sample=True,
        temperature=0.1,
        top_p=0.9,
        repetition_penalty=1.1,
    )
    llm = HuggingFacePipeline(pipeline=pipe)

    logger.info("Creating tools...")
    tools = create_all_tools(
        db_url=DATABASE_URL,
        prometheus_url=PROMETHEUS_URL,
        ssh_config_path=SSH_HOSTS_CONFIG,
        es_url=ELASTICSEARCH_URL,
        alertmanager_url=ALERTMANAGER_URL,
        retriever=langchain_retriever,
    )

    logger.info("Initializing Agent...")
    agent = ReActAgent(llm=llm, tools=tools, verbose=True)

    print("\n" + "=" * 60)
    print("  AIOps Agent - 智能运维助手")
    print("  输入运维问题，按 Ctrl+C 退出")
    print("=" * 60 + "\n")

    while True:
        try:
            question = input("[User] ").strip()
            if not question:
                continue
            if question.lower() in ("exit", "quit", "q"):
                break

            print("\n[Agent] 思考中...\n")
            result = agent.run(question)

            if result["success"]:
                print(f"[Agent] {result['answer']}\n")
                if result["intermediate_steps"]:
                    print("推理步骤:")
                    for i, step in enumerate(result["intermediate_steps"], 1):
                        print(f"  {i}. 工具: {step['tool']} | 输入: {str(step['tool_input'])[:100]}")
                    print()
            else:
                print(f"[Error] 执行失败: {result['error']}\n")
        except KeyboardInterrupt:
            print("\n\n再见！")
            break
        except Exception as e:
            print(f"[Error] {e}\n")


def run_data_gen():
    logger.info("Generating training data...")
    from data_gen.generate import TrainingDataGenerator
    generator = TrainingDataGenerator()
    generator.generate_all()


def run_finetune(config_path: str = "./finetune/config.yaml"):
    logger.info("Starting LoRA fine-tuning...")
    from finetune.train_lora import train
    train(config_path)


def run_merge(config_path: str = "./finetune/config.yaml"):
    logger.info("Merging LoRA weights...")
    from finetune.merge_lora import merge_lora
    merge_lora(config_path)


def run_eval(model_path: str, dataset_dir: str = "./aio-eval"):
    logger.info("Running evaluation benchmark...")
    from aio_eval.evaluate import run_evaluation
    run_evaluation(model_path, dataset_dir, os.path.join(dataset_dir, "results"))


def run_rag_benchmark():
    logger.info("Running RAG benchmark...")
    from rag.benchmark import run_rag_benchmark
    run_rag_benchmark()


def run_build_index():
    logger.info("Building knowledge index...")
    from rag.retriever import OpsRetriever
    from config.settings import RAG_KNOWLEDGE_DIR, RAG_VECTORSTORE_DIR, BGE_MODEL_PATH
    retriever = OpsRetriever(
        knowledge_dir=RAG_KNOWLEDGE_DIR,
        vectorstore_dir=RAG_VECTORSTORE_DIR,
        embedding_model_name=BGE_MODEL_PATH,
    )
    count = retriever.build_index()
    logger.info(f"Indexed {count} document chunks")


if __name__ == "__main__":
    import os

    parser = argparse.ArgumentParser(description="AIOps Agent - 智能运维助手")
    parser.add_argument(
        "--mode",
        type=str,
        default="api",
        choices=["api", "cli", "data-gen", "finetune", "merge", "eval", "rag-bench", "build-index"],
        help="运行模式",
    )
    parser.add_argument("--config", type=str, default="./finetune/config.yaml", help="微调配置文件路径")
    parser.add_argument("--model-path", type=str, default=None, help="评测模型路径")
    parser.add_argument("--dataset-dir", type=str, default="./aio-eval", help="评测数据集目录")

    args = parser.parse_args()

    mode_map = {
        "api": run_api,
        "cli": run_cli,
        "data-gen": run_data_gen,
        "finetune": lambda: run_finetune(args.config),
        "merge": lambda: run_merge(args.config),
        "eval": lambda: run_eval(args.model_path, args.dataset_dir),
        "rag-bench": run_rag_benchmark,
        "build-index": run_build_index,
    }

    handler = mode_map.get(args.mode)
    if handler:
        handler()
    else:
        parser.print_help()
