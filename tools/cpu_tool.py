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


class CoreInfo(BaseModel):
    core_id: int
    percent: float
    frequency_mhz: float


class ProcessInfo(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float
    status: str


class CPUInfo(BaseModel):
    overall_percent: float
    per_core: List[CoreInfo]
    count_physical: int
    count_logical: int
    freq_current_mhz: float
    freq_min_mhz: float
    freq_max_mhz: float
    load_avg_1m: float
    load_avg_5m: float
    load_avg_15m: float
    ctx_switches: int
    interrupts: int
    temperature_celsius: Optional[float] = None
    top_processes: List[ProcessInfo]
    uptime_seconds: float
    timestamp: str


def get_cpu_temperature() -> Optional[float]:
    if platform.system() == "Windows":
        try:
            import wmi
            c = wmi.WMI()
            temps = []
            for t in c.Win32_TemperatureProbe():
                try:
                    v = float(t.CurrentReading or 0)
                    if 20 < v < 150:
                        temps.append(v)
                except (ValueError, TypeError):
                    pass
            return round(sum(temps) / len(temps), 1) if temps else None
        except Exception as e:
            logger.debug(f"WMI temp failed: {e}")
            return None
    elif HAS_PSUTIL:
        try:
            temps = psutil.sensors_temperatures()
            for name, entries in temps.items():
                for entry in entries:
                    if entry.current and 20 < entry.current < 150:
                        return round(entry.current, 1)
        except Exception:
            pass
    return None


def get_all_processes(limit: int = 50) -> List[ProcessInfo]:
    procs = []
    if not HAS_PSUTIL:
        return procs

    try:
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status', 'create_time']):
            try:
                info = p.info
                cpu_val = info.get('cpu_percent') or 0
                mem_val = info.get('memory_percent') or 0
                if cpu_val >= 0 or mem_val >= 0:
                    procs.append(ProcessInfo(
                        pid=info['pid'],
                        name=(info.get('name') or 'unknown')[:28],
                        cpu_percent=round(cpu_val, 1),
                        memory_percent=round(mem_val, 1),
                        status=info.get('status') or 'unknown',
                    ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
        procs.sort(key=lambda x: x.cpu_percent, reverse=True)
        return procs[:limit]
    except Exception as e:
        logger.warning(f"All processes failed: {e}")
        return []


def get_top_processes(n: int = 6) -> List[ProcessInfo]:
    procs = []
    if not HAS_PSUTIL:
        return procs

    try:
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
            try:
                info = p.info
                cpu_val = info.get('cpu_percent') or 0
                mem_val = info.get('memory_percent') or 0
                if cpu_val > 0.1 or mem_val > 0.1:
                    procs.append(ProcessInfo(
                        pid=info['pid'],
                        name=(info.get('name') or 'unknown')[:24],
                        cpu_percent=round(cpu_val, 1),
                        memory_percent=round(mem_val, 1),
                        status=info.get('status') or 'unknown',
                    ))
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
        procs.sort(key=lambda x: x.cpu_percent, reverse=True)
        return procs[:n]
    except Exception as e:
        logger.warning(f"Top processes failed: {e}")
        return []


def get_cpu_info() -> CPUInfo:
    if not HAS_PSUTIL:
        return CPUInfo(
            overall_percent=0,
            per_core=[],
            count_physical=0,
            count_logical=0,
            freq_current_mhz=0,
            freq_min_mhz=0,
            freq_max_mhz=0,
            load_avg_1m=0,
            load_avg_5m=0,
            load_avg_15m=0,
            ctx_switches=0,
            interrupts=0,
            top_processes=[],
            uptime_seconds=0,
            timestamp="",
        )

    per_cpu = psutil.cpu_percent(percpu=True)
    cores = [
        CoreInfo(
            core_id=i,
            percent=round(v, 1),
            frequency_mhz=round(psutil.cpu_freq(percpu=True)[i].current if i < len(psutil.cpu_freq(percpu=True)) else 0, 0),
        )
        for i, v in enumerate(per_cpu)
    ]

    freq = psutil.cpu_freq()

    load_1, load_5, load_15 = psutil.getloadavg() if hasattr(psutil, 'getloadavg') else (0.0, 0.0, 0.0)

    try:
        cpu_times = psutil.cpu_stats()
        ctx = cpu_times.ctx_switches
        intr = cpu_times.interrupts
    except Exception:
        ctx, intr = 0, 0

    temp = get_cpu_temperature()

    boot_time = psutil.boot_time()
    uptime = time.time() - boot_time

    from datetime import datetime
    return CPUInfo(
        overall_percent=round(psutil.cpu_percent(interval=0.5), 1),
        per_core=cores,
        count_physical=psutil.cpu_count(logical=False) or 0,
        count_logical=psutil.cpu_count(logical=True) or 0,
        freq_current_mhz=round(freq.current, 0) if freq else 0,
        freq_min_mhz=round(freq.min, 0) if freq else 0,
        freq_max_mhz=round(freq.max, 0) if freq else 0,
        load_avg_1m=round(load_1, 2),
        load_avg_5m=round(load_5, 2),
        load_avg_15m=round(load_15, 2),
        ctx_switches=ctx,
        interrupts=intr,
        temperature_celsius=temp,
        top_processes=get_top_processes(8),
        uptime_seconds=round(uptime, 0),
        timestamp=datetime.now().isoformat(),
    )


class CPUTool:
    name: str = "cpu_check"
    description: str = "获取本机CPU使用率、核心负载、频率、温度等实时信息"

    def _run(self, query: str = "") -> str:
        try:
            info = get_cpu_info()
            lines = [f"=== CPU 状态 ({platform.system()}) ==="]
            lines.append(f"检测时间: {info.timestamp}")
            lines.append("")
            lines.append(f"总体使用率: {info.overall_percent}%")
            lines.append(f"物理核心: {info.count_physical} | 逻辑核心: {info.count_logical}")
            lines.append(f"频率: {info.freq_current_mhz} MHz (范围: {info.freq_min_mhz}-{info.freq_max_mhz} MHz)")
            if info.temperature_celsius is not None:
                lines.append(f"温度: {info.temperature_celsius}°C")
            lines.append(f"系统负载: {info.load_avg_1m} / {info.load_avg_5m} / {info.load_avg_15m} (1/5/15min)")
            lines.append(f"上下文切换: {info.ctx_switches:,} | 中断: {info.interrupts:,}")

            hours = int(info.uptime_seconds // 3600)
            mins = int((info.uptime_seconds % 3600) // 60)
            lines.append(f"运行时间: {hours}h {mins}m")

            lines.append("\n--- 各核心使用率 ---")
            for core in info.per_core:
                bar_len = int(core.percent / 2.5)
                bar = "█" * bar_len + "░" * (40 - bar_len)
                lines.append(f"  核心{core.core_id:>2}: {bar} {core.percent:.1f}% ({core.frequency_mhz:.0f}MHz)")

            lines.append("\n--- Top 进程 (CPU占用) ---")
            for i, proc in enumerate(info.top_processes[:6], 1):
                lines.append(f"  {i}. [{proc.name:<22}] CPU:{proc.cpu_percent:>5.1f}% MEM:{proc.memory_percent:>5.1f}% PID:{proc.pid}")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"CPU check failed: {e}")
            return f"CPU检测失败: {str(e)}"