import logging
import re
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


MODULE_KEYWORDS = {
    "cpu": [
        ("cpu", 4), ("处理器", 4), ("核心", 2), ("cpu使用", 5),
        ("cpu占用", 5), ("cpu使用率", 6), ("cpu温度", 5), ("cpu频率", 5),
        ("负载", 2), ("系统负载", 4), ("load", 3),
        ("top进程", 4), ("cpu信息", 5),
        ("卡", 1), ("慢", 1), ("卡顿", 2), ("很卡", 2),
    ],
    "memory": [
        ("内存", 4), ("memory", 4), ("ram", 3), ("内存使用", 5),
        ("内存占用", 5), ("内存使用率", 6), ("内存信息", 5),
        ("swap", 3), ("交换分区", 4), ("虚拟内存", 4),
        ("内存不够", 5), ("oom", 4), ("内存不足", 5), ("内存泄漏", 4),
    ],
    "disk": [
        ("磁盘", 4), ("disk", 4), ("存储", 2), ("硬盘", 4),
        ("磁盘使用", 5), ("磁盘使用率", 6), ("磁盘空间", 5),
        ("磁盘满了", 5), ("空间不足", 4), ("c盘", 4), ("d盘", 4),
        ("分区", 3), ("挂载", 3), ("smart", 3),
    ],
    "network": [
        ("网络", 4), ("network", 4), ("带宽", 4), ("流量", 3),
        ("网卡", 3), ("网络接口", 4), ("网络流量", 5),
        ("上传", 1), ("下载", 1), ("网速", 3),
        ("网络不通", 5), ("网络慢", 4), ("丢包", 3), ("延迟", 2),
        ("ip", 2), ("ip地址", 3),
    ],
    "gpu": [
        ("gpu", 5), ("显卡", 5), ("nvidia", 5), ("显存", 5),
        ("gpu温度", 5), ("gpu功耗", 5), ("gpu频率", 5),
        ("cuda", 4), ("gpu使用", 5), ("gpu利用率", 5),
        ("深度学习", 2), ("渲染", 2),
    ],
    "health": [
        ("体检", 5), ("健康", 4), ("全面检查", 5), ("系统检查", 5),
        ("整体状态", 5), ("整体状况", 5), ("健康报告", 5),
        ("健康评分", 5), ("综合检查", 5), ("全身体检", 5),
        ("健康检查", 5), ("系统体检", 5), ("检查一下系统", 5),
    ],
    "architecture": [
        ("架构", 4), ("配置", 2), ("系统信息", 4), ("硬件信息", 4),
        ("系统配置", 4), ("软硬件", 4), ("系统架构", 5),
        ("什么配置", 4), ("硬件配置", 4), ("操作系统版本", 4),
        ("多少内存", 4), ("什么cpu", 4), ("主机名", 2),
    ],
    "prediction": [
        ("预测", 5), ("趋势", 3), ("未来", 2), ("扩容", 3),
        ("预警", 3), ("预估", 4), ("forecast", 4), ("predict", 4),
        ("什么时候", 2), ("多久", 2), ("何时", 2), ("预计", 3),
        ("会不会", 2), ("是否将", 3), ("将要", 2), ("将会", 2),
        ("趋势分析", 5), ("增长预测", 5), ("容量预测", 5),
        ("达到阈值", 4), ("何时达到", 4), ("多久达到", 4),
        ("未来24小时", 6), ("增长趋势", 5), ("资源规划", 4),
    ],
    "log": [
        ("日志", 5), ("报错", 4), ("错误", 2), ("exception", 4),
        ("error", 4), ("警告", 2), ("warning", 4),
        ("日志分析", 5), ("错误日志", 5), ("系统日志", 5),
        ("查日志", 5), ("看日志", 5), ("异常日志", 4),
    ],
    "alert": [
        ("告警", 5), ("alert", 5), ("报警", 4), ("通知", 1),
        ("活跃告警", 5), ("告警历史", 5), ("监控告警", 5),
        ("firing", 5), ("有什么告警", 5),
    ],
}

DIAGNOSIS_KEYWORDS = [
    ("诊断", 4), ("故障", 4), ("异常", 3), ("排查", 4),
    ("根因", 4), ("原因", 3), ("为什么", 4),
    ("分析原因", 4), ("找出原因", 4), ("定位问题", 4),
    ("为什么慢", 5), ("为什么高", 5), ("为什么低", 5),
    ("怎么回事", 4), ("出问题了", 4), ("坏了", 3),
    ("为什么卡", 4), ("卡顿", 3), ("变慢", 3),
    ("响应慢", 4), ("怎么慢", 4), ("怎么卡", 4),
    ("很卡", 3), ("太卡", 3), ("特别卡", 3),
    ("这么卡", 4), ("这么慢", 4),
]

CHART_KEYWORDS = [
    ("图表", 3), ("图", 1), ("曲线", 2), ("趋势", 1),
    ("可视化", 3), ("折线图", 4), ("柱状图", 4), ("饼图", 4),
    ("仪表盘", 3), ("实时图", 4), ("动态图", 4),
    ("显示", 1), ("画", 1), ("绘制", 2),
]

SEVERITY_KEYWORDS = {
    "critical": [("紧急", 4), ("严重", 3), ("宕机", 5), ("崩溃", 4), ("挂了", 4), ("不可用", 4)],
    "warning": [("警告", 1), ("偏高", 2), ("异常", 2), ("风险", 2), ("注意", 1)],
}

CASUAL_KEYWORDS = [
    ("你好", 3), ("hi", 2), ("hello", 2), ("早上好", 3),
    ("你是谁", 3), ("能做什么", 3), ("介绍一下", 3),
    ("谢谢", 2), ("再见", 2), ("拜拜", 2),
    ("天气", 3), ("聊天", 3), ("讲个笑话", 4),
    ("今天", 1), ("怎么样", 1),
]


class IntentClassifier:
    def classify(self, question: str) -> Dict[str, Any]:
        question_lower = question.lower().strip()

        casual_score = self._calculate_score(question_lower, CASUAL_KEYWORDS)
        if casual_score >= 3 and len(question_lower) < 15:
            return {
                "intent": "casual",
                "confidence": min(1.0, casual_score / 6.0),
                "modules": [],
                "needs_chart": False,
                "needs_realtime": False,
                "action_type": "chat",
                "severity_hint": "normal",
                "extracted_params": {},
            }

        module_matches = self._match_modules(question_lower)

        is_diagnosis = self._calculate_score(question_lower, DIAGNOSIS_KEYWORDS) >= 2

        if is_diagnosis and module_matches:
            module_matches.insert(0, "diagnosis")
            module_matches = list(dict.fromkeys(module_matches))

        if is_diagnosis and not module_matches:
            module_matches = ["diagnosis", "cpu", "memory"]

        needs_chart = (
            self._calculate_score(question_lower, CHART_KEYWORDS) >= 2
            or (len(module_matches) > 0 and not is_diagnosis)
        )

        needs_realtime = any(m in module_matches for m in ["cpu", "memory", "disk", "network", "gpu"])

        severity = self._detect_severity(question_lower)

        if not module_matches:
            return {
                "intent": None,
                "confidence": 0,
                "modules": [],
                "needs_chart": False,
                "needs_realtime": False,
                "action_type": "unknown",
                "severity_hint": "normal",
                "extracted_params": {},
            }

        main_intent = module_matches[0]
        is_diag = "diagnosis" in module_matches

        params = self._extract_params(question_lower, module_matches)

        return {
            "intent": "diagnosis" if is_diag else main_intent,
            "confidence": min(1.0, len(module_matches) * 0.3),
            "modules": module_matches if not is_diag else [m for m in module_matches if m != "diagnosis"],
            "needs_chart": needs_chart,
            "needs_realtime": needs_realtime,
            "action_type": "diagnosis" if is_diag else "monitoring",
            "severity_hint": severity,
            "extracted_params": params,
        }

    def _match_modules(self, question: str) -> List[str]:
        module_scores = {}
        for module, keywords in MODULE_KEYWORDS.items():
            score = self._calculate_score(question, keywords)
            if score > 0:
                module_scores[module] = score

        sorted_modules = sorted(module_scores.items(), key=lambda x: x[1], reverse=True)

        matched = []
        for module, score in sorted_modules:
            if score >= 2:
                matched.append(module)

        return matched[:7]

    def _calculate_score(self, question: str, keywords: List[Tuple[str, int]]) -> float:
        if not question:
            return 0.0

        total_score = 0.0
        matched_count = 0
        matched_keywords = []

        for keyword, weight in keywords:
            if keyword in question:
                total_score += weight
                matched_count += 1
                matched_keywords.append(keyword)

        if matched_count == 0:
            return 0.0

        if matched_count >= 3:
            base = total_score * 0.9
        elif matched_count >= 2:
            base = total_score * 0.8
        else:
            base = total_score * 0.6

        question_len = len(question)
        if question_len > 20:
            base *= 1.1
        elif question_len > 10:
            base *= 1.05

        return base

    def _detect_severity(self, question: str) -> str:
        critical_score = self._calculate_score(question, SEVERITY_KEYWORDS["critical"])
        if critical_score >= 3:
            return "critical"

        warning_score = self._calculate_score(question, SEVERITY_KEYWORDS["warning"])
        if warning_score >= 2:
            return "warning"

        return "normal"

    def _extract_params(self, question: str, modules: List[str]) -> Dict[str, Any]:
        params = {"modules": modules}

        if "prediction" in modules:
            time_match = re.search(r'(\d+)\s*(分钟|小时|天|周|m|h|d|w)', question)
            if time_match:
                num = int(time_match.group(1))
                unit_map = {'分钟': 'm', '小时': 'h', '天': 'd', '周': 'w', 'm': 'm', 'h': 'h', 'd': 'd', 'w': 'w'}
                unit = unit_map.get(time_match.group(2), 'h')
                params['horizon'] = f'{num}{unit}'
            else:
                params['horizon'] = '24h'

            for m in ["cpu", "memory", "disk"]:
                if m in modules:
                    params['target'] = m
                    break
            if 'target' not in params:
                params['target'] = 'cpu'

        if "log" in modules:
            time_match = re.search(r'(\d+)\s*(分钟|小时|天|m|h|d)', question)
            if time_match:
                num = int(time_match.group(1))
                unit_map = {'分钟': 'm', '小时': 'h', '天': 'd', 'm': 'm', 'h': 'h', 'd': 'd'}
                unit = unit_map.get(time_match.group(2), 'h')
                params['time_range'] = f'{num}{unit}'
            else:
                params['time_range'] = '1h'

        if "diagnosis" in modules:
            service_match = re.search(r'(\S+服务|\S+service|\S+server)', question)
            if service_match:
                params['service'] = service_match.group(1)
            params['symptom'] = question

        return params

    def extract_service_name(self, question: str) -> Optional[str]:
        service_patterns = [
            r'(\S+服务)',
            r'(\S+service)',
            r'(\S+server)',
            r'(web-\d+)',
            r'(db-\d+)',
            r'(cache-\d+)',
            r'(api-\S+)',
        ]
        for pattern in service_patterns:
            match = re.search(pattern, question, re.IGNORECASE)
            if match:
                return match.group(1)
        return None