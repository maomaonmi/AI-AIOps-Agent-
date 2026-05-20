import json
import random
import os
import argparse
from pathlib import Path
from typing import List, Dict, Any


class TrainingDataGenerator:
    def __init__(self, templates_dir: str = None):
        if templates_dir is None:
            templates_dir = str(Path(__file__).parent / "templates")
        self.templates_dir = Path(templates_dir)
        self.promql_templates = self._load_json("promql_templates.json")
        self.regex_templates = self._load_json("regex_templates.json")
        self.cot_templates = self._load_json("cot_templates.json")

    def _load_json(self, filename: str) -> dict:
        filepath = self.templates_dir / filename
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def generate_promql_data(self, num_samples: int = 300) -> List[Dict[str, Any]]:
        data = []
        variables = self.promql_templates.get("variables", {})

        for _ in range(num_samples):
            category = random.choice(self.promql_templates["promql_templates"])
            template = random.choice(category["templates"])

            var_values = {}
            for var_name, var_options in variables.items():
                var_values[var_name] = random.choice(var_options)

            try:
                question = template["question"].format(**var_values)
                promql = template["promql"].format(**var_values)
                thought = template["thought"]
            except KeyError:
                continue

            output = f"思考: {thought}\n行动: prometheus_query\n行动输入: {{\"query\": \"{promql}\"}}"

            data.append({
                "instruction": question,
                "input": "",
                "output": output,
                "task_type": "promql_generation",
                "scenario": category["scenario"],
            })

        return data

    def generate_regex_data(self, num_samples: int = 200) -> List[Dict[str, Any]]:
        data = []

        for _ in range(num_samples):
            category = random.choice(self.regex_templates["regex_templates"])
            template = random.choice(category["templates"])

            question = template["question"]
            regex = template["regex"]
            thought = template["thought"]

            output = f"思考: {thought}\n行动: log_search\n行动输入: {{\"keyword\": \"{regex}\"}}"

            data.append({
                "instruction": question,
                "input": "",
                "output": output,
                "task_type": "regex_generation",
                "scenario": category["scenario"],
            })

        return data

    def generate_cot_data(self, num_samples: int = 500) -> List[Dict[str, Any]]:
        data = []
        tool_map = {
            "prometheus_query": "查询Prometheus监控指标",
            "ssh_exec": "SSH远程执行命令",
            "log_search": "搜索日志",
            "sql_query": "查询数据库",
            "alert_query": "查询告警信息",
            "knowledge_search": "检索知识库",
        }

        for _ in range(num_samples):
            template = random.choice(self.cot_templates["cot_templates"])
            scenario = template["scenario"]
            instruction = template["instruction"]
            thought_chain = template["thought_chain"]
            expected_tools = template["expected_tools"]

            steps = []
            for i, (thought, tool_name) in enumerate(zip(thought_chain, expected_tools)):
                tool_desc = tool_map.get(tool_name, tool_name)
                if i == 0:
                    steps.append(f"思考: {thought}")
                else:
                    steps.append(f"观察: [上一步结果]\n思考: {thought}")
                steps.append(f"行动: {tool_name}")
                steps.append(f"行动输入: [根据分析生成的参数]")

            final_thought = "我现在知道最终答案了"
            steps.append(f"思考: {final_thought}")
            steps.append(f"最终答案: [基于以上分析给出结构化的故障诊断结果]")

            output = "\n".join(steps)

            data.append({
                "instruction": instruction,
                "input": "",
                "output": output,
                "task_type": "cot_reasoning",
                "scenario": scenario,
            })

        return data

    def generate_tool_selection_data(self, num_samples: int = 200) -> List[Dict[str, Any]]:
        tool_selection_pairs = [
            ("查询CPU使用率", "prometheus_query", "需要查询监控指标"),
            ("查看主机进程状态", "ssh_exec", "需要远程执行命令"),
            ("搜索错误日志", "log_search", "需要检索日志"),
            ("查询数据库连接数", "sql_query", "需要查询数据库"),
            ("查看当前告警", "alert_query", "需要查询告警"),
            ("查找处理流程", "knowledge_search", "需要检索知识库"),
            ("查询内存使用趋势", "prometheus_query", "需要查询监控指标"),
            ("查看磁盘空间", "ssh_exec", "需要远程执行命令"),
            ("查找OOM日志", "log_search", "需要检索日志"),
            ("查询服务实例列表", "sql_query", "需要查询数据库"),
            ("检查告警抑制规则", "alert_query", "需要查询告警"),
            ("查找故障SOP", "knowledge_search", "需要检索知识库"),
            ("查询网络流量", "prometheus_query", "需要查询监控指标"),
            ("重启服务", "ssh_exec", "需要远程执行命令"),
            ("分析慢查询日志", "log_search", "需要检索日志"),
            ("查询配置信息", "sql_query", "需要查询数据库"),
            ("查询P99延迟", "prometheus_query", "需要查询监控指标"),
            ("查看系统负载", "ssh_exec", "需要远程执行命令"),
            ("查找连接超时日志", "log_search", "需要检索日志"),
            ("查询架构文档", "knowledge_search", "需要检索知识库"),
        ]

        data = []
        for _ in range(num_samples):
            question, tool_name, reason = random.choice(tool_selection_pairs)

            variations = [
                question,
                f"帮我{question}",
                f"请{question}",
                f"需要{question}",
                f"我想{question}",
                f"如何{question}",
            ]
            varied_question = random.choice(variations)

            output = f"思考: {reason}，应使用{tool_name}工具\n行动: {tool_name}"

            data.append({
                "instruction": varied_question,
                "input": "",
                "output": output,
                "task_type": "tool_selection",
                "scenario": "tool_calling",
            })

        return data

    def generate_all(self, output_dir: str = None) -> str:
        if output_dir is None:
            output_dir = str(Path(__file__).parent / "output")
        os.makedirs(output_dir, exist_ok=True)

        all_data = []
        all_data.extend(self.generate_promql_data(300))
        all_data.extend(self.generate_regex_data(200))
        all_data.extend(self.generate_cot_data(500))
        all_data.extend(self.generate_tool_selection_data(200))

        random.shuffle(all_data)

        output_path = os.path.join(output_dir, "train_data.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)

        stats_path = os.path.join(output_dir, "stats.json")
        stats = {}
        for item in all_data:
            task_type = item["task_type"]
            stats[task_type] = stats.get(task_type, 0) + 1

        with open(stats_path, "w", encoding="utf-8") as f:
            json.dump({"total": len(all_data), "by_type": stats}, f, ensure_ascii=False, indent=2)

        print(f"Generated {len(all_data)} training samples")
        print(f"Stats: {json.dumps(stats, ensure_ascii=False, indent=2)}")
        print(f"Output: {output_path}")

        return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate training data for AIOps fine-tuning")
    parser.add_argument("--templates-dir", type=str, default=None, help="Templates directory path")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory path")
    args = parser.parse_args()

    generator = TrainingDataGenerator(templates_dir=args.templates_dir)
    generator.generate_all(output_dir=args.output_dir)
