import re
import json
from typing import List, Dict, Any, Optional


def tool_selection_accuracy(predictions: List[str], references: List[str]) -> float:
    if len(predictions) != len(references):
        raise ValueError("predictions and references must have the same length")
    if not predictions:
        return 0.0
    correct = sum(1 for p, r in zip(predictions, references) if p.strip().lower() == r.strip().lower())
    return correct / len(predictions)


def tool_calling_f1(predictions: List[Dict], references: List[Dict]) -> Dict[str, float]:
    tool_names_pred = [p.get("tool", "") for p in predictions]
    tool_names_ref = [r.get("tool", "") for r in references]

    tp = sum(1 for p, r in zip(tool_names_pred, tool_names_ref) if p == r and p != "")
    fp = sum(1 for p, r in zip(tool_names_pred, tool_names_ref) if p != r and p != "")
    fn = sum(1 for p, r in zip(tool_names_pred, tool_names_ref) if p == "" and r != "")

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {"precision": precision, "recall": recall, "f1": f1}


def promql_syntax_correctness(generated_promqls: List[str]) -> Dict[str, float]:
    total = len(generated_promqls)
    if total == 0:
        return {"syntax_correct_rate": 0.0}

    correct = 0
    for promql in generated_promqls:
        if not promql or not promql.strip():
            continue
        promql = promql.strip()
        has_metric = bool(re.search(r'[a-zA-Z_][a-zA-Z0-9_]*', promql))
        balanced_braces = promql.count('{') == promql.count('}')
        balanced_parens = promql.count('(') == promql.count(')')
        if has_metric and balanced_braces and balanced_parens:
            correct += 1

    return {"syntax_correct_rate": correct / total}


def promql_keyword_coverage(generated_promqls: List[str], expected_keywords: List[List[str]]) -> Dict[str, float]:
    total = len(generated_promqls)
    if total == 0:
        return {"keyword_coverage": 0.0}

    coverages = []
    for promql, keywords in zip(generated_promqls, expected_keywords):
        if not keywords:
            continue
        matched = sum(1 for kw in keywords if kw.lower() in promql.lower())
        coverages.append(matched / len(keywords))

    avg_coverage = sum(coverages) / len(coverages) if coverages else 0.0
    return {"keyword_coverage": avg_coverage}


def regex_match_accuracy(generated_regexes: List[str], test_strings: List[List[str]]) -> Dict[str, float]:
    total = len(generated_regexes)
    if total == 0:
        return {"match_accuracy": 0.0, "valid_regex_rate": 0.0}

    valid_count = 0
    match_count = 0
    total_test_cases = 0

    for regex, strings in zip(generated_regexes, test_strings):
        try:
            compiled = re.compile(regex)
            valid_count += 1
            for s in strings:
                total_test_cases += 1
                if compiled.search(s):
                    match_count += 1
        except re.error:
            continue

    valid_rate = valid_count / total
    match_rate = match_count / total_test_cases if total_test_cases > 0 else 0.0

    return {"valid_regex_rate": valid_rate, "match_accuracy": match_rate}


def compute_all_metrics(
    tool_predictions: Optional[List[str]] = None,
    tool_references: Optional[List[str]] = None,
    tool_calling_preds: Optional[List[Dict]] = None,
    tool_calling_refs: Optional[List[Dict]] = None,
    promql_generated: Optional[List[str]] = None,
    promql_expected_keywords: Optional[List[List[str]]] = None,
) -> Dict[str, Any]:
    metrics = {}

    if tool_predictions and tool_references:
        metrics["tool_selection_accuracy"] = tool_selection_accuracy(tool_predictions, tool_references)

    if tool_calling_preds and tool_calling_refs:
        metrics["tool_calling_f1"] = tool_calling_f1(tool_calling_preds, tool_calling_refs)

    if promql_generated:
        metrics["promql_syntax"] = promql_syntax_correctness(promql_generated)
        if promql_expected_keywords:
            metrics["promql_coverage"] = promql_keyword_coverage(promql_generated, promql_expected_keywords)

    return metrics
