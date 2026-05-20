import logging
import platform
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class MemoryInfo(BaseModel):
    total_gb: float
    used_gb: float
    available_gb: float
    free_gb: float
    cached_gb: float
    buffer_gb: float
    percent: float
    swap_total_gb: float
    swap_used_gb: float
    swap_free_gb: float
    swap_percent: float
    timestamp: str


class MemProcessInfo(BaseModel):
    pid: int
    name: str
    memory_mb: float
    memory_percent: float
    status: str


class MemorySnapshot(BaseModel):
    info: MemoryInfo
    top_processes: List[MemProcessInfo]


def get_memory_info() -> MemoryInfo:
    if not HAS_PSUTIL:
        return MemoryInfo(
            total_gb=0, used_gb=0, available_gb=0, free_gb=0,
            cached_gb=0, buffer_gb=0, percent=0,
            swap_total_gb=0, swap_used_gb=0, swap_free_gb=0, swap_percent=0,
            timestamp="",
        )

    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    from datetime import datetime

    return MemoryInfo(
        total_gb=round(mem.total / (1024**3), 2),
        used_gb=round(mem.used / (1024**3), 2),
        available_gb=round(mem.available / (1024**3), 2),
        free_gb=round(mem.free / (1024**3), 2),
        cached_gb=round((getattr(mem, 'cached', 0) or 0) / (1024**3), 2),
        buffer_gb=round((getattr(mem, 'buffers', 0) or 0) / (1024**3), 2),
        percent=round(mem.percent, 1),
        swap_total_gb=round(swap.total / (1024**3), 2),
        swap_used_gb=round(swap.used / (1024**3), 2),
        swap_free_gb=round(swap.free / (1024**3), 2),
        swap_percent=round(swap.percent, 1),
        timestamp=datetime.now().isoformat(),
    )


def get_top_mem_processes(n: int = 10) -> List[MemProcessInfo]:
    procs: List[MemProcessInfo] = []
    if not HAS_PSUTIL:
        return procs

    try:
        for p in psutil.process_iter(['pid', 'name', 'memory_percent', 'memory_info', 'status']):
            try:
                info = p.info
                mem_mb = 0
                if info.get('memory_info'):
                    mem_mb = info['memory_info'].rss / (1024**2)
                elif info.get('memory_percent') and info['memory_percent'] > 0.01:
                    mem_mb = info['memory_percent'] / 100 * psutil.virtual_memory().total / (1024**2)

                if mem_mb > 0.1:
                    procs.append(MemProcessInfo(
                        pid=info['pid'],
                        name=(info.get('name') or 'unknown')[:28],
                        memory_mb=round(mem_mb, 1),
                        memory_percent=round(info.get('memory_percent') or 0, 1),
                        status=info.get('status') or 'unknown',
                    ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        procs.sort(key=lambda x: x.memory_mb, reverse=True)
        return procs[:n]
    except Exception as e:
        logger.warning(f"Top mem processes failed: {e}")
        return []


def get_memory_snapshot() -> MemorySnapshot:
    return MemorySnapshot(
        info=get_memory_info(),
        top_processes=get_top_mem_processes(10),
    )


class MemoryTool:
    name: str = "memory_check"
    description: str = "获取本机内存使用率、交换分区、进程内存占用等实时信息"

    def _run(self, query: str = "") -> str:
        try:
            snap = get_memory_snapshot()
            m = snap.info
            lines = [f"=== 内存状态 ({platform.system()}) ==="]
            lines.append(f"检测时间: {m.timestamp}")
            lines.append("")
            lines.append(f"物理内存总量: {m.total_gb} GB")
            lines.append(f"已使用: {m.used_gb} GB ({m.percent}%)")
            lines.append(f"可用: {m.available_gb} GB")
            lines.append(f"空闲: {m.free_gb} GB")
            lines.append(f"缓存: {m.cached_gb} GB | 缓冲: {m.buffer_gb} GB")

            lines.append(f"\n交换分区总量: {m.swap_total_gb} GB")
            if m.swap_total_gb > 0:
                lines.append(f"交换已用: {m.swap_used_gb} GB ({m.swap_percent}%)")

            bar_len = int(m.percent / 2.5)
            bar = "█" * bar_len + "░" * (40 - bar_len)
            lines.append(f"\n  内存占用: [{bar}] {m.percent}%")

            lines.append("\n--- Top 进程 (内存占用) ---")
            for i, proc in enumerate(snap.top_processes[:8], 1):
                lines.append(f"  {i}. [{proc.name:<24}] {proc.memory_mb:>8.1f}MB ({proc.memory_percent:.1f}%)")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Memory check failed: {e}")
            return f"内存检测失败: {str(e)}"