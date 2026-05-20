import json
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch


class TestSQLQueryTool(unittest.TestCase):
    def test_validate_sql_select_allowed(self):
        from tools.sql_tool import SQLQueryTool
        tool = SQLQueryTool.__new__(SQLQueryTool)
        self.assertTrue(tool._validate_sql("SELECT * FROM users"))
        self.assertTrue(tool._validate_sql("select id, name from services where env='prod'"))

    def test_validate_sql_dangerous_blocked(self):
        from tools.sql_tool import SQLQueryTool
        tool = SQLQueryTool.__new__(SQLQueryTool)
        self.assertFalse(tool._validate_sql("DROP TABLE users"))
        self.assertFalse(tool._validate_sql("DELETE FROM users WHERE 1=1"))
        self.assertFalse(tool._validate_sql("UPDATE users SET role='admin'"))
        self.assertFalse(tool._validate_sql("INSERT INTO users VALUES(1,'hack')"))

    def test_format_results(self):
        from tools.sql_tool import SQLQueryTool
        columns = ["id", "name", "status"]
        rows = [(1, "web-server", "running"), (2, "db-server", "stopped")]
        result = SQLQueryTool._format_results(columns, rows)
        self.assertIn("id", result)
        self.assertIn("web-server", result)
        self.assertIn("stopped", result)


class TestPrometheusTool(unittest.TestCase):
    def test_format_instant_results(self):
        from tools.prometheus_tool import PrometheusTool
        results = [
            {"metric": {"instance": "10.0.0.1:9100", "job": "node"}, "value": [1700000000, "95.2"]},
            {"metric": {"instance": "10.0.0.2:9100", "job": "node"}, "value": [1700000000, "45.3"]},
        ]
        output = PrometheusTool._format_instant_results(results)
        self.assertIn("10.0.0.1:9100", output)
        self.assertIn("95.2", output)
        self.assertIn("45.3", output)


class TestAlertManagerTool(unittest.TestCase):
    def test_filter_alerts(self):
        from tools.alert_tool import AlertManagerTool
        alerts = [
            {"status": {"state": "firing"}, "labels": {"service": "order-service", "severity": "critical"}},
            {"status": {"state": "resolved"}, "labels": {"service": "user-service", "severity": "warning"}},
            {"status": {"state": "firing"}, "labels": {"service": "order-service", "severity": "warning"}},
        ]
        result = AlertManagerTool._filter_alerts(alerts, "service=order-service", "firing")
        self.assertEqual(len(result), 2)

    def test_format_alerts(self):
        from tools.alert_tool import AlertManagerTool
        alerts = [
            {
                "labels": {"severity": "critical", "alertname": "HighCPU", "service": "web", "instance": "10.0.0.1"},
                "annotations": {"summary": "CPU usage over 90%"},
                "status": {"state": "firing"},
            }
        ]
        output = AlertManagerTool._format_alerts(alerts)
        self.assertIn("CRITICAL", output)
        self.assertIn("HighCPU", output)
        self.assertIn("CPU usage over 90%", output)


class TestLogSearchTool(unittest.TestCase):
    def test_parse_time_range(self):
        from tools.log_tool import LogSearchTool
        result = LogSearchTool._parse_time_range("1h")
        self.assertIn("T", result)
        result = LogSearchTool._parse_time_range("30m")
        self.assertIn("T", result)
        result = LogSearchTool._parse_time_range("1d")
        self.assertIn("T", result)


class TestTrainingDataGenerator(unittest.TestCase):
    def test_generate_promql_data(self):
        from data_gen.generate import TrainingDataGenerator
        gen = TrainingDataGenerator()
        data = gen.generate_promql_data(10)
        self.assertEqual(len(data), 10)
        for item in data:
            self.assertIn("instruction", item)
            self.assertIn("output", item)
            self.assertEqual(item["task_type"], "promql_generation")

    def test_generate_regex_data(self):
        from data_gen.generate import TrainingDataGenerator
        gen = TrainingDataGenerator()
        data = gen.generate_regex_data(10)
        self.assertEqual(len(data), 10)
        for item in data:
            self.assertEqual(item["task_type"], "regex_generation")

    def test_generate_tool_selection_data(self):
        from data_gen.generate import TrainingDataGenerator
        gen = TrainingDataGenerator()
        data = gen.generate_tool_selection_data(10)
        self.assertEqual(len(data), 10)
        for item in data:
            self.assertEqual(item["task_type"], "tool_selection")

    def test_generate_all(self):
        from data_gen.generate import TrainingDataGenerator
        gen = TrainingDataGenerator()
        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = gen.generate_all(output_dir=tmpdir)
            self.assertTrue(os.path.exists(output_path))
            with open(output_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertGreater(len(data), 1000)


class TestMetrics(unittest.TestCase):
    def test_tool_selection_accuracy(self):
        from aio_eval.metrics import tool_selection_accuracy
        preds = ["prometheus_query", "ssh_exec", "log_search"]
        refs = ["prometheus_query", "ssh_exec", "sql_query"]
        acc = tool_selection_accuracy(preds, refs)
        self.assertAlmostEqual(acc, 2 / 3)

    def test_tool_calling_f1(self):
        from aio_eval.metrics import tool_calling_f1
        preds = [{"tool": "prometheus_query"}, {"tool": "ssh_exec"}, {"tool": "log_search"}]
        refs = [{"tool": "prometheus_query"}, {"tool": "ssh_exec"}, {"tool": "sql_query"}]
        result = tool_calling_f1(preds, refs)
        self.assertIn("f1", result)
        self.assertGreater(result["f1"], 0)

    def test_promql_syntax_correctness(self):
        from aio_eval.metrics import promql_syntax_correctness
        promqls = [
            "rate(node_cpu_seconds_total{mode='idle'}[5m])",
            "avg by(instance)(rate(http_requests_total[5m]))",
            "invalid{",
        ]
        result = promql_syntax_correctness(promqls)
        self.assertIn("syntax_correct_rate", result)
        self.assertGreater(result["syntax_correct_rate"], 0.5)


class TestReActAgent(unittest.TestCase):
    def test_format_intermediate_steps(self):
        from agent.react_agent import ReActAgent
        mock_action = MagicMock()
        mock_action.tool = "prometheus_query"
        mock_action.tool_input = {"query": "up"}
        mock_action.log = "Thought: need to check\nAction: prometheus_query"

        steps = [(mock_action, "result data")]
        formatted = ReActAgent._format_intermediate_steps(steps)
        self.assertEqual(len(formatted), 1)
        self.assertEqual(formatted[0]["tool"], "prometheus_query")


if __name__ == "__main__":
    unittest.main()
