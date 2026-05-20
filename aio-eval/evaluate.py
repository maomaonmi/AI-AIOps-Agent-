import json
import os
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

from aio_eval.metrics import compute_all_metrics

logger = logging.getLogger(__name__)

EVAL_DATASETS = {
    "tool_calling": "dataset/tool_calling.json",
    "promql_syntax": "dataset/promql_syntax.json",
    "regex_match": "dataset/regex_match.json",
}


def load_eval_dataset(dataset_name: str, dataset_dir: str) -> List[Dict]:
    filepath = os.path.join(dataset_dir, EVAL_DATASETS[dataset_name])
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def generate_model_response(model, tokenizer, prompt: str, max_new_tokens: int = 512) -> str:
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1024)
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=0.1,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
        )

    input_len = inputs["input_ids"].shape[1]
    generated = outputs[0][input_len:]
    return tokenizer.decode(generated, skip_special_tokens=True)


def extract_tool_name(response: str) -> str:
    import re
    action_match = re.search(r"行动:\s*(\w+)", response)
    if action_match:
        return action_match.group(1)
    action_match = re.search(r"Action:\s*(\w+)", response)
    if action_match:
        return action_match.group(1)
    return ""


def extract_promql(response: str) -> str:
    import re
    promql_match = re.search(r"query[\":]\s*[\"\'](.*?)[\"\']", response, re.DOTALL)
    if promql_match:
        return promql_match.group(1)
    promql_match = re.search(r"prometheus_query.*?query[\":]\s*[\"\'](.*?)[\"\']", response, re.DOTALL)
    if promql_match:
        return promql_match.group(1)
    return response


def eval_tool_calling(model, tokenizer, dataset: List[Dict]) -> Dict[str, Any]:
    predictions = []
    references = []

    for item in dataset:
        prompt = f"### Instruction:\n{item['question']}\n\n### Response:\n"
        response = generate_model_response(model, tokenizer, prompt)
        predicted_tool = extract_tool_name(response)
        predictions.append(predicted_tool)
        references.append(item["expected_tool"])

    tool_preds = [{"tool": p} for p in predictions]
    tool_refs = [{"tool": r} for r in references]

    metrics = compute_all_metrics(
        tool_predictions=predictions,
        tool_references=references,
        tool_calling_preds=tool_preds,
        tool_calling_refs=tool_refs,
    )
    return metrics


def eval_promql_syntax(model, tokenizer, dataset: List[Dict]) -> Dict[str, Any]:
    generated_promqls = []
    expected_keywords_list = []

    for item in dataset:
        prompt = f"### Instruction:\n{item['question']}\n\n### Response:\n"
        response = generate_model_response(model, tokenizer, prompt)
        promql = extract_promql(response)
        generated_promqls.append(promql)
        expected_keywords_list.append(item.get("expected_promql_contains", []))

    metrics = compute_all_metrics(
        promql_generated=generated_promqls,
        promql_expected_keywords=expected_keywords_list,
    )
    return metrics


def eval_regex_match(model, tokenizer, dataset: List[Dict]) -> Dict[str, Any]:
    from aio_eval.metrics import regex_match_accuracy

    generated_regexes = []
    test_strings_list = []

    for item in dataset:
        prompt = f"### Instruction:\n{item['question']}\n\n### Response:\n"
        response = generate_model_response(model, tokenizer, prompt)
        generated_regexes.append(response.strip())
        test_strings_list.append(item.get("test_strings", []))

    metrics = regex_match_accuracy(generated_regexes, test_strings_list)
    return metrics


def run_evaluation(model_path: str, dataset_dir: str, output_dir: str):
    logger.info(f"Loading model from: {model_path}")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        trust_remote_code=True,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )
    model.eval()

    all_metrics = {}

    logger.info("Evaluating tool calling...")
    tool_dataset = load_eval_dataset("tool_calling", dataset_dir)
    all_metrics["tool_calling"] = eval_tool_calling(model, tokenizer, tool_dataset)

    logger.info("Evaluating PromQL syntax...")
    promql_dataset = load_eval_dataset("promql_syntax", dataset_dir)
    all_metrics["promql_syntax"] = eval_promql_syntax(model, tokenizer, promql_dataset)

    logger.info("Evaluating regex matching...")
    regex_dataset = load_eval_dataset("regex_match", dataset_dir)
    all_metrics["regex_match"] = eval_regex_match(model, tokenizer, regex_dataset)

    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "eval_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_metrics, f, ensure_ascii=False, indent=2)

    logger.info(f"Evaluation results saved to: {output_path}")
    logger.info(f"Results:\n{json.dumps(all_metrics, ensure_ascii=False, indent=2)}")

    return all_metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AIOps Agent evaluation benchmark")
    parser.add_argument("--model-path", type=str, required=True, help="Path to the model to evaluate")
    parser.add_argument("--dataset-dir", type=str, default="./aio-eval", help="Dataset directory")
    parser.add_argument("--output-dir", type=str, default="./aio-eval/results", help="Output directory")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    run_evaluation(args.model_path, args.dataset_dir, args.output_dir)
