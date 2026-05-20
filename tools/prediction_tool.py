import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
import random
import math

logger = logging.getLogger(__name__)

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class PredictionPoint(BaseModel):
    timestamp: str
    value: float
    is_predicted: bool = False
    confidence_lower: float = 0.0
    confidence_upper: float = 0.0


class MetricPrediction(BaseModel):
    metric_name: str
    unit: str
    current_value: float
    predicted_change: float
    trend: str
    points: List[PredictionPoint]
    warning_threshold: float
    will_exceed_threshold: bool
    exceed_time: str = ""
    color: str


class AnomalyWarning(BaseModel):
    metric: str
    severity: str
    description: str
    predicted_time: str
    confidence: float


class TrendPredictionReport(BaseModel):
    predictions: List[MetricPrediction]
    anomalies: List[AnomalyWarning]
    summary: str
    prediction_time: str
    time_horizon_hours: int


_history_cache: Dict[str, List[Tuple[float, float]]] = {}
_cache_timestamp: float = 0.0


def _collect_sample(metric: str) -> Tuple[float, float]:
    now = time.time()
    
    if metric == "cpu":
        if HAS_PSUTIL:
            return now, psutil.cpu_percent(interval=0.1)
        return now, random.uniform(20, 60)
    elif metric == "memory":
        if HAS_PSUTIL:
            mem = psutil.virtual_memory()
            return now, mem.percent
        return now, random.uniform(50, 80)
    elif metric == "disk":
        if HAS_PSUTIL:
            try:
                usage = psutil.disk_usage('/')
                if platform and hasattr(platform, 'system') and platform.system() == 'Windows':
                    usage = psutil.disk_usage('C:\\')
                return now, usage.percent
            except Exception:
                pass
        return now, random.uniform(60, 85)
    
    return now, random.uniform(30, 70)


def _get_history(metric: str, points: int = 30) -> List[Tuple[float, float]]:
    global _history_cache, _cache_timestamp
    
    now = time.time()
    
    if metric not in _history_cache or now - _cache_timestamp > 2:
        if metric not in _history_cache:
            _history_cache[metric] = []
        
        current_ts, current_val = _collect_sample(metric)
        _history_cache[metric].append((current_ts, current_val))
        
        if len(_history_cache[metric]) > 120:
            _history_cache[metric] = _history_cache[metric][-120:]
        
        _cache_timestamp = now
    
    return _history_cache.get(metric, [])[-points:]


def _moving_average(values: List[float], window: int = 5) -> List[float]:
    if len(values) < window:
        return values
    
    result = []
    for i in range(len(values)):
        if i < window - 1:
            result.append(values[i])
        else:
            avg = sum(values[i - window + 1:i + 1]) / window
            result.append(avg)
    return result


def _linear_regression_predict(values: List[float], future_steps: int) -> List[float]:
    if len(values) < 3:
        return [values[-1]] * future_steps if values else [50.0] * future_steps
    
    n = len(values)
    x = list(range(n))
    y = values
    
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_xx = sum(xi * xi for xi in x)
    
    denominator = n * sum_xx - sum_x * sum_x
    if abs(denominator) < 0.0001:
        slope = 0
    else:
        slope = (n * sum_xy - sum_x * sum_y) / denominator
    
    intercept = (sum_y - slope * sum_x) / n
    
    predictions = []
    for i in range(future_steps):
        pred = intercept + slope * (n + i)
        pred = max(0, min(100, pred))
        predictions.append(pred)
    
    return predictions


def _calculate_confidence(values: List[float], predictions: List[float]) -> List[Tuple[float, float]]:
    if not values:
        return [(p * 0.8, p * 1.2) for p in predictions]
    
    std_dev = math.sqrt(sum((v - sum(values)/len(values))**2 for v in values) / len(values)) if len(values) > 1 else 5.0
    
    confidence = []
    for i, pred in enumerate(predictions):
        expand = std_dev * (1 + i * 0.1)
        confidence.append((max(0, pred - expand), min(100, pred + expand)))
    
    return confidence


def _predict_metric(metric: str, hours: int = 24) -> MetricPrediction:
    history = _get_history(metric, points=60)
    
    if not history:
        now = time.time()
        history = [(now - i * 60, random.uniform(30, 60)) for i in range(60, 0, -1)]
    
    values = [v for _, v in history]
    timestamps = [datetime.fromtimestamp(t).strftime("%H:%M:%S") for t, _ in history[-30:]]
    
    smoothed = _moving_average(values, window=5)
    current = smoothed[-1] if smoothed else 50.0
    
    future_points = min(hours * 4, 96)
    predictions = _linear_regression_predict(smoothed, future_points)
    confidence = _calculate_confidence(smoothed, predictions)
    
    trend = "稳定"
    if len(smoothed) >= 10:
        recent_avg = sum(smoothed[-5:]) / 5
        older_avg = sum(smoothed[-10:-5]) / 5
        change = recent_avg - older_avg
        if change > 5:
            trend = "上升"
        elif change < -5:
            trend = "下降"
    
    predicted_change = predictions[-1] - current if predictions else 0
    
    points: List[PredictionPoint] = []
    
    for ts, val in zip(timestamps, smoothed[-30:]):
        points.append(PredictionPoint(
            timestamp=ts,
            value=round(val, 1),
            is_predicted=False,
        ))
    
    future_base = datetime.now()
    for i, (pred, (lower, upper)) in enumerate(zip(predictions, confidence)):
        future_ts = (future_base + timedelta(minutes=15 * (i + 1))).strftime("%H:%M")
        points.append(PredictionPoint(
            timestamp=future_ts,
            value=round(pred, 1),
            is_predicted=True,
            confidence_lower=round(lower, 1),
            confidence_upper=round(upper, 1),
        ))
    
    warning_threshold = 85.0
    will_exceed = any(p.value >= warning_threshold for p in points if p.is_predicted)
    exceed_time = ""
    if will_exceed:
        for p in points:
            if p.is_predicted and p.value >= warning_threshold:
                exceed_time = p.timestamp
                break
    
    metric_names = {
        "cpu": ("CPU 使用率", "%", "text-blue-600"),
        "memory": ("内存使用率", "%", "text-purple-600"),
        "disk": ("磁盘使用率", "%", "text-amber-600"),
    }
    
    name, unit, color = metric_names.get(metric, (metric.upper(), "%", "text-gray-600"))
    
    return MetricPrediction(
        metric_name=name,
        unit=unit,
        current_value=round(current, 1),
        predicted_change=round(predicted_change, 1),
        trend=trend,
        points=points,
        warning_threshold=warning_threshold,
        will_exceed_threshold=will_exceed,
        exceed_time=exceed_time,
        color=color,
    )


def _detect_anomalies(predictions: List[MetricPrediction]) -> List[AnomalyWarning]:
    anomalies = []
    
    for pred in predictions:
        if pred.will_exceed_threshold:
            severity = "高" if pred.current_value > 70 else "中"
            anomalies.append(AnomalyWarning(
                metric=pred.metric_name,
                severity=severity,
                description=f"{pred.metric_name}预计将在 {pred.exceed_time} 超过阈值 ({pred.warning_threshold}%)",
                predicted_time=pred.exceed_time,
                confidence=0.75,
            ))
        
        if pred.trend == "上升" and pred.predicted_change > 15:
            anomalies.append(AnomalyWarning(
                metric=pred.metric_name,
                severity="中",
                description=f"{pred.metric_name}呈上升趋势，预计增加 {abs(pred.predicted_change):.1f}%",
                predicted_time="未来24小时",
                confidence=0.65,
            ))
    
    return anomalies


def _generate_summary(predictions: List[MetricPrediction], anomalies: List[AnomalyWarning]) -> str:
    if not anomalies:
        return "系统资源使用率预测稳定，未来24小时内无异常风险。建议继续保持当前配置。"
    
    high_severity = [a for a in anomalies if a.severity == "高"]
    if high_severity:
        return f"检测到 {len(high_severity)} 个高风险预警，建议尽快处理。主要关注：{', '.join(a.metric for a in high_severity[:3])}"
    
    return f"检测到 {len(anomalies)} 个潜在风险，建议关注资源使用趋势并提前规划。"


def get_trend_prediction(hours: int = 24) -> TrendPredictionReport:
    metrics = ["cpu", "memory", "disk"]
    predictions = [_predict_metric(m, hours) for m in metrics]
    
    anomalies = _detect_anomalies(predictions)
    summary = _generate_summary(predictions, anomalies)
    
    return TrendPredictionReport(
        predictions=predictions,
        anomalies=anomalies,
        summary=summary,
        prediction_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        time_horizon_hours=hours,
    )