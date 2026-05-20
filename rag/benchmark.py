import json
import logging
import os
from typing import List, Dict, Any

from rag.retriever import OpsRetriever

logger = logging.getLogger(__name__)

BENCHMARK_QUESTIONS = [
    {
        "id": "rag_001",
        "question": "Java OOM的标准处理流程是什么",
        "expected_keywords": ["OOM", "内存", "重启", "JVM", "heap"],
        "category": "故障处理",
    },
    {
        "id": "rag_002",
        "question": "数据库连接池耗尽如何处理",
        "expected_keywords": ["连接池", "max_connections", "慢查询", "超时"],
        "category": "故障处理",
    },
    {
        "id": "rag_003",
        "question": "CPU使用率高的排查步骤",
        "expected_keywords": ["top", "进程", "CPU", "GC", "线程"],
        "category": "故障处理",
    },
    {
        "id": "rag_004",
        "question": "磁盘空间不足的清理方法",
        "expected_keywords": ["磁盘", "清理", "日志", "临时文件"],
        "category": "故障处理",
    },
    {
        "id": "rag_005",
        "question": "服务发布流程规范",
        "expected_keywords": ["发布", "审批", "灰度", "回滚"],
        "category": "操作规范",
    },
    {
        "id": "rag_006",
        "question": "告警升级机制是什么",
        "expected_keywords": ["告警", "升级", "P1", "P2", "通知"],
        "category": "告警管理",
    },
    {
        "id": "rag_007",
        "question": "Redis集群故障恢复步骤",
        "expected_keywords": ["Redis", "集群", "故障转移", "主从"],
        "category": "故障处理",
    },
    {
        "id": "rag_008",
        "question": "Kubernetes Pod重启排查方法",
        "expected_keywords": ["Pod", "CrashLoopBackOff", "日志", "资源限制"],
        "category": "故障处理",
    },
    {
        "id": "rag_009",
        "question": "网络延迟排查方法",
        "expected_keywords": ["网络", "延迟", "ping", "traceroute", "DNS"],
        "category": "故障处理",
    },
    {
        "id": "rag_010",
        "question": "SSL证书更新流程",
        "expected_keywords": ["SSL", "证书", "更新", "过期"],
        "category": "操作规范",
    },
]


def evaluate_rag(retriever: OpsRetriever, questions: List[Dict] = None) -> Dict[str, Any]:
    if questions is None:
        questions = BENCHMARK_QUESTIONS

    results = []
    total_keyword_recall = 0.0
    total_relevance = 0

    for q in questions:
        retrieved_docs = retriever.retrieve(q["question"], top_k=5)
        retrieved_content = " ".join([doc.page_content for doc in retrieved_docs])

        matched_keywords = 0
        for kw in q["expected_keywords"]:
            if kw.lower() in retrieved_content.lower():
                matched_keywords += 1

        keyword_recall = matched_keywords / len(q["expected_keywords"]) if q["expected_keywords"] else 0
        total_keyword_recall += keyword_recall

        has_relevant = keyword_recall > 0.3
        if has_relevant:
            total_relevance += 1

        results.append({
            "id": q["id"],
            "question": q["question"],
            "category": q["category"],
            "keyword_recall": round(keyword_recall, 3),
            "matched_keywords": matched_keywords,
            "total_keywords": len(q["expected_keywords"]),
            "num_retrieved": len(retrieved_docs),
            "relevant": has_relevant,
        })

    n = len(questions)
    avg_keyword_recall = total_keyword_recall / n if n > 0 else 0
    relevance_rate = total_relevance / n if n > 0 else 0

    summary = {
        "total_questions": n,
        "avg_keyword_recall": round(avg_keyword_recall, 3),
        "relevance_rate": round(relevance_rate, 3),
        "by_category": {},
    }

    categories = set(q["category"] for q in questions)
    for cat in categories:
        cat_results = [r for r in results if r["category"] == cat]
        cat_recall = sum(r["keyword_recall"] for r in cat_results) / len(cat_results)
        cat_relevance = sum(1 for r in cat_results if r["relevant"]) / len(cat_results)
        summary["by_category"][cat] = {
            "count": len(cat_results),
            "avg_keyword_recall": round(cat_recall, 3),
            "relevance_rate": round(cat_relevance, 3),
        }

    return {"summary": summary, "details": results}


def run_rag_benchmark(
    knowledge_dir: str = None,
    output_dir: str = "./rag/benchmark_results",
):
    from config.settings import RAG_KNOWLEDGE_DIR, RAG_VECTORSTORE_DIR, BGE_MODEL_PATH

    retriever = OpsRetriever(
        knowledge_dir=knowledge_dir or RAG_KNOWLEDGE_DIR,
        vectorstore_dir=RAG_VECTORSTORE_DIR,
        embedding_model_name=BGE_MODEL_PATH,
    )

    doc_count = retriever.vectorstore.get_document_count()
    if doc_count == 0:
        logger.info("Vectorstore is empty, building index from knowledge directory...")
        retriever.build_index()

    logger.info("Running RAG benchmark...")
    results = evaluate_rag(retriever)

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "rag_benchmark_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    logger.info(f"RAG benchmark results saved to: {output_path}")
    logger.info(f"Summary: {json.dumps(results['summary'], ensure_ascii=False, indent=2)}")

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAG knowledge base benchmark")
    parser.add_argument("--knowledge-dir", type=str, default=None)
    parser.add_argument("--output-dir", type=str, default="./rag/benchmark_results")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    run_rag_benchmark(args.knowledge_dir, args.output_dir)
