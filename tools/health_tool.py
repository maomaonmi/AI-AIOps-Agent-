import logging
import platform
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class HealthCheckItem(BaseModel):
    name: str
    status: str
    value: str
    detail: str = ""
    score: int = 100
    weight: int = 1


class HealthCategory(BaseModel):
    category: str
    icon: str
    items: List[HealthCheckItem]
    category_score: int
    status: str


class HealthReport(BaseModel):
    overall_score: int
    grade: str
    grade_color: str
    categories: List[HealthCategory]
    recommendations: List[str]
    check_time: str
    hostname: str
    os_info: str
    uptime: str


def _get_uptime() -> str:
    try:
        import psutil
        boot_time = psutil.boot_time()
        uptime_seconds = datetime.now().timestamp() - boot_time
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        if days > 0:
            return f"{days}天 {hours}小时 {minutes}分钟"
        elif hours > 0:
            return f"{hours}小时 {minutes}分钟"
        else:
            return f"{minutes}分钟"
    except Exception:
        return "未知"


def _score_to_grade(score: int) -> tuple:
    if score >= 90:
        return "优秀", "emerald"
    elif score >= 80:
        return "良好", "green"
    elif score >= 70:
        return "一般", "amber"
    elif score >= 60:
        return "较差", "orange"
    else:
        return "危险", "red"


def _get_cpu_health() -> HealthCategory:
    items: List[HealthCheckItem] = []
    total_score = 100
    
    try:
        from tools.cpu_tool import get_cpu_info
        cpu_info = get_cpu_info()
        
        util = cpu_info.overall_percent
        if util < 50:
            status, score = "正常", 100
        elif util < 70:
            status, score = "轻度负载", 85
        elif util < 85:
            status, score = "中度负载", 70
        else:
            status, score = "高负载", 50
        items.append(HealthCheckItem(
            name="CPU 使用率",
            status=status,
            value=f"{util:.1f}%",
            detail=f"核心数: {cpu_info.count_logical} 逻辑核心",
            score=score,
            weight=3
        ))
        total_score = score
        
        temp = cpu_info.temperature_celsius or 0
        if temp > 0:
            if temp < 60:
                t_status, t_score = "正常", 100
            elif temp < 75:
                t_status, t_score = "偏高", 80
            elif temp < 85:
                t_status, t_score = "警告", 60
            else:
                t_status, t_score = "过热", 30
            items.append(HealthCheckItem(
                name="CPU 温度",
                status=t_status,
                value=f"{temp}°C",
                score=t_score,
                weight=2
            ))
        
    except Exception as e:
        logger.error(f"CPU health check failed: {e}")
        items.append(HealthCheckItem(name="CPU", status="检测失败", value="N/A", score=0, weight=3))
        total_score = 0
    
    return HealthCategory(
        category="CPU",
        icon="Cpu",
        items=items,
        category_score=total_score,
        status="正常" if total_score >= 70 else "警告" if total_score >= 50 else "异常"
    )


def _get_memory_health() -> HealthCategory:
    items: List[HealthCheckItem] = []
    total_score = 100
    
    try:
        from tools.memory_tool import get_memory_info
        mem_info = get_memory_info()
        
        util = mem_info.percent
        if util < 60:
            status, score = "正常", 100
        elif util < 75:
            status, score = "轻度使用", 85
        elif util < 85:
            status, score = "中度使用", 70
        else:
            status, score = "内存紧张", 50
        items.append(HealthCheckItem(
            name="内存使用率",
            status=status,
            value=f"{util:.1f}%",
            detail=f"已用: {mem_info.used_gb:.1f}GB / {mem_info.total_gb:.1f}GB",
            score=score,
            weight=3
        ))
        total_score = score
        
        swap_util = mem_info.swap_percent
        if swap_util > 50:
            items.append(HealthCheckItem(
                name="交换分区",
                status="使用较高",
                value=f"{swap_util:.1f}%",
                detail=f"可能存在内存压力",
                score=60,
                weight=1
            ))
        
    except Exception as e:
        logger.error(f"Memory health check failed: {e}")
        items.append(HealthCheckItem(name="内存", status="检测失败", value="N/A", score=0, weight=3))
        total_score = 0
    
    return HealthCategory(
        category="内存",
        icon="MemoryStick",
        items=items,
        category_score=total_score,
        status="正常" if total_score >= 70 else "警告" if total_score >= 50 else "异常"
    )


def _get_disk_health() -> HealthCategory:
    items: List[HealthCheckItem] = []
    total_score = 100
    min_score = 100
    
    try:
        from tools.disk_tool import get_local_disk_info
        disk_info = get_local_disk_info()
        
        for drive in disk_info.drives[:5]:
            util = drive.percent
            mount = drive.mountpoint or drive.device
            if util < 70:
                status, score = "正常", 100
            elif util < 85:
                status, score = "空间紧张", 75
            elif util < 95:
                status, score = "空间不足", 50
            else:
                status, score = "严重不足", 20
            
            items.append(HealthCheckItem(
                name=f"磁盘 {mount}",
                status=status,
                value=f"{util:.1f}%",
                detail=f"{drive.used_gb:.1f}GB / {drive.total_gb:.1f}GB",
                score=score,
                weight=1
            ))
            min_score = min(min_score, score)
        
        total_score = min_score
        
    except Exception as e:
        logger.error(f"Disk health check failed: {e}")
        items.append(HealthCheckItem(name="磁盘", status="检测失败", value="N/A", score=0, weight=3))
        total_score = 0
    
    return HealthCategory(
        category="磁盘",
        icon="HardDrive",
        items=items,
        category_score=total_score,
        status="正常" if total_score >= 70 else "警告" if total_score >= 50 else "异常"
    )


def _get_network_health() -> HealthCategory:
    items: List[HealthCheckItem] = []
    total_score = 100
    
    try:
        from tools.network_tool import get_network_info
        net_info = get_network_info()
        
        active_count = sum(1 for i in net_info.interfaces if i.is_up)
        total_count = len(net_info.interfaces)
        
        items.append(HealthCheckItem(
            name="网络接口",
            status="正常" if active_count > 0 else "异常",
            value=f"{active_count}/{total_count} 活跃",
            detail=f"检测到 {total_count} 个网络接口",
            score=100 if active_count > 0 else 0,
            weight=2
        ))
        
        has_ipv4 = any(i.ipv4_addresses for i in net_info.interfaces if i.is_up)
        items.append(HealthCheckItem(
            name="IP 地址",
            status="正常" if has_ipv4 else "无IP",
            value="已分配" if has_ipv4 else "未分配",
            score=100 if has_ipv4 else 30,
            weight=2
        ))
        
        total_score = 100 if has_ipv4 and active_count > 0 else 50
        
    except Exception as e:
        logger.error(f"Network health check failed: {e}")
        items.append(HealthCheckItem(name="网络", status="检测失败", value="N/A", score=0, weight=3))
        total_score = 0
    
    return HealthCategory(
        category="网络",
        icon="Wifi",
        items=items,
        category_score=total_score,
        status="正常" if total_score >= 70 else "警告" if total_score >= 50 else "异常"
    )


def _get_gpu_health() -> HealthCategory:
    items: List[HealthCheckItem] = []
    total_score = 100
    
    try:
        from tools.gpu_tool import get_gpu_info
        gpu_info = get_gpu_info()
        
        if not gpu_info.has_gpu:
            items.append(HealthCheckItem(
                name="GPU",
                status="未检测到",
                value="无独立显卡",
                detail="系统未检测到 NVIDIA GPU",
                score=100,
                weight=1
            ))
            total_score = 100
        else:
            for dev in gpu_info.devices:
                if not dev.is_available:
                    continue
                
                util = dev.utilization.gpu_percent
                if util < 50:
                    u_status, u_score = "正常", 100
                elif util < 80:
                    u_status, u_score = "中度负载", 80
                else:
                    u_status, u_score = "高负载", 60
                items.append(HealthCheckItem(
                    name=f"{dev.name} 使用率",
                    status=u_status,
                    value=f"{util}%",
                    score=u_score,
                    weight=2
                ))
                
                temp = dev.temperature.gpu_celsius
                if temp > 0:
                    if temp < 65:
                        t_status, t_score = "正常", 100
                    elif temp < 80:
                        t_status, t_score = "偏高", 75
                    else:
                        t_status, t_score = "过热", 40
                    items.append(HealthCheckItem(
                        name="GPU 温度",
                        status=t_status,
                        value=f"{temp}°C",
                        score=t_score,
                        weight=2
                    ))
                
                mem_util = dev.memory.percent
                if mem_util > 80:
                    items.append(HealthCheckItem(
                        name="显存使用",
                        status="紧张",
                        value=f"{mem_util:.1f}%",
                        detail=f"{dev.memory.used_gb:.1f}/{dev.memory.total_gb:.1f} GB",
                        score=60,
                        weight=1
                    ))
                
                total_score = min(u_score, t_score if temp > 0 else u_score)
                
    except Exception as e:
        logger.error(f"GPU health check failed: {e}")
        items.append(HealthCheckItem(name="GPU", status="检测失败", value="N/A", score=100, weight=1))
        total_score = 100
    
    return HealthCategory(
        category="GPU",
        icon="Cpu",
        items=items,
        category_score=total_score,
        status="正常" if total_score >= 70 else "警告" if total_score >= 50 else "异常"
    )


def _generate_recommendations(categories: List[HealthCategory]) -> List[str]:
    recommendations = []
    
    for cat in categories:
        if cat.category_score < 70:
            for item in cat.items:
                if item.score < 70:
                    if "CPU 使用率" in item.name and item.score < 70:
                        recommendations.append(f"CPU 使用率较高({item.value})，建议检查是否有高负载进程或考虑升级硬件")
                    elif "内存使用率" in item.name and item.score < 70:
                        recommendations.append(f"内存使用率较高({item.value})，建议关闭不必要的程序或增加内存")
                    elif "磁盘" in item.name and "空间" in item.status:
                        recommendations.append(f"磁盘空间{item.status}({item.value})，建议清理临时文件或扩展存储")
                    elif "温度" in item.name and item.score < 60:
                        recommendations.append(f"{item.name}过高({item.value})，建议检查散热系统或清理灰尘")
                    elif "网络" in cat.category:
                        recommendations.append("网络连接异常，建议检查网络配置和物理连接")
    
    if not recommendations:
        recommendations.append("系统运行状态良好，继续保持当前配置")
        recommendations.append("建议定期清理临时文件和日志，保持系统整洁")
    
    return recommendations[:5]


def get_system_health() -> HealthReport:
    categories = [
        _get_cpu_health(),
        _get_memory_health(),
        _get_disk_health(),
        _get_network_health(),
        _get_gpu_health(),
    ]
    
    total_weight = sum(3 for _ in categories)
    weighted_score = sum(cat.category_score * 3 for cat in categories)
    overall_score = int(weighted_score / total_weight) if total_weight > 0 else 0
    
    grade, grade_color = _score_to_grade(overall_score)
    
    recommendations = _generate_recommendations(categories)
    
    return HealthReport(
        overall_score=overall_score,
        grade=grade,
        grade_color=grade_color,
        categories=categories,
        recommendations=recommendations,
        check_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        hostname=platform.node(),
        os_info=f"{platform.system()} {platform.release()}",
        uptime=_get_uptime(),
    )