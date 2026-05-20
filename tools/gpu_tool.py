import logging
import platform
import subprocess
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

try:
    import pynvml
    HAS_PYNVML = True
except ImportError:
    HAS_PYNVML = False

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

_nvm_initialized = False


def _ensure_init():
    global _nvm_initialized
    if HAS_PYNVML and not _nvm_initialized:
        try:
            pynvml.nvmlInit()
            _nvm_initialized = True
        except Exception as e:
            logger.warning(f"NVML init failed: {e}")


class GPUMemoryInfo(BaseModel):
    total_mb: int
    used_mb: int
    free_mb: int
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float

class GPUTemperatureInfo(BaseModel):
    gpu_celsius: int
    max_threshold: int = 0
    slowdown_threshold: int = 0
    shutdown_threshold: int = 0

class GPUClockInfo(BaseModel):
    graphics_mhz: int
    sm_mhz: int
    mem_mhz: int
    video_mhz: int = 0

class GPUPowerInfo(BaseModel):
    current_watts: float
    limit_watts: float = 0.0
    usage_percent: float = 0.0

class GPUUtilization(BaseModel):
    gpu_percent: int
    memory_percent: int
    encoder_percent: int = 0
    decoder_percent: int = 0

class GPUProcessInfo(BaseModel):
    pid: int
    name: str = ""
    used_memory_mb: int = 0
    used_memory_str: str = ""

class GPUDeviceInfo(BaseModel):
    index: int
    name: str
    uuid: str = ""
    pci_bus_id: str = ""
    driver_version: str = ""
    cuda_version: str = ""
    memory: GPUMemoryInfo
    temperature: GPUTemperatureInfo
    clocks: GPUClockInfo
    power: GPUPowerInfo
    utilization: GPUUtilization
    processes: List[GPUProcessInfo] = Field(default_factory=list)
    fan_speed_percent: int = 0
    performance_state: str = "Unknown"
    display_active: bool = False
    persistence_mode: bool = False
    compute_mode: str = "Default"
    ecc_mode: bool = False
    total_ecc_errors: int = 0
    is_available: bool = True

class GPUInfoResponse(BaseModel):
    devices: List[GPUDeviceInfo]
    has_gpu: bool
    timestamp: str


def _safe_nvml(call_fn, default=None):
    try:
        return call_fn()
    except Exception:
        return default


def _get_device_info(handle: Any, idx: int) -> GPUDeviceInfo:
    name = _safe_nvml(lambda: pynvml.nvmlDeviceGetName(handle), "Unknown GPU")
    if isinstance(name, bytes):
        name = name.decode("utf-8", errors="replace")

    uuid = _safe_nvml(lambda: pynvml.nvmlDeviceGetUUID(handle), "")
    if isinstance(uuid, bytes):
        uuid = uuid.decode("utf-8", errors="replace")

    pci_bus_id = _safe_nvml(lambda: pynvml.nvmlDeviceGetPciInfo(handle).busId, "")
    if isinstance(pci_bus_id, bytes):
        pci_bus_id = pci_bus_id.decode("utf-8", errors="replace")

    driver_version = _safe_nvml(lambda: pynvml.nvmlSystemGetDriverVersion(), "")
    if isinstance(driver_version, bytes):
        driver_version = driver_version.decode("utf-8", errors="replace")

    cuda_version_raw = _safe_nvml(lambda: pynvml.nvmlSystemGetCudaDriverVersion(), 0)
    if cuda_version_raw > 0:
        major = cuda_version_raw // 1000
        minor = (cuda_version_raw % 1000) // 10
        cuda_version = f"{major}.{minor}"
    else:
        cuda_version = "N/A"

    mem_info = _safe_nvml(lambda: pynvml.nvmlDeviceGetMemoryInfo(handle))
    if mem_info and getattr(mem_info, 'total', 0):
        total_raw = mem_info.total or 0
        used_raw = mem_info.used or 0
        free_raw = mem_info.free or 0
        memory = GPUMemoryInfo(
            total_mb=total_raw // (1024 * 1024),
            used_mb=used_raw // (1024 * 1024),
            free_mb=free_raw // (1024 * 1024),
            total_gb=round(total_raw / (1024**3), 2),
            used_gb=round(used_raw / (1024**3), 2),
            free_gb=round(free_raw / (1024**3), 2),
            percent=round((used_raw / max(total_raw, 1)) * 100, 1) if total_raw > 0 else 0,
        )
    else:
        memory = GPUMemoryInfo(total_mb=0, used_mb=0, free_mb=0, total_gb=0, used_gb=0, free_gb=0, percent=0)

    temp_gpu = _safe_nvml(
        lambda: pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU), 0
    )
    max_thresh = _safe_nvml(
        lambda: pynvml.nvmlDeviceGetTemperatureThreshold(handle, pynvml.NVML_TEMPERATURE_THRESHOLD_GPU_MAX), 0
    )
    slow_thresh = _safe_nvml(
        lambda: pynvml.nvmlDeviceGetTemperatureThreshold(handle, pynvml.NVML_TEMPERATURE_THRESHOLD_SLOWDOWN), 0
    )
    shutdown_thresh = _safe_nvml(
        lambda: pynvml.nvmlDeviceGetTemperatureThreshold(handle, pynvml.NVML_TEMPERATURE_THRESHOLD_SHUTDOWN), 0
    )
    temperature = GPUTemperatureInfo(gpu_celsius=temp_gpu, max_threshold=max_thresh, slowdown_threshold=slow_thresh, shutdown_threshold=shutdown_thresh)

    graphics_clock = _safe_nvml(lambda: pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_GRAPHICS), 0)
    sm_clock = _safe_nvml(lambda: pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_SM), 0)
    mem_clock = _safe_nvml(lambda: pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_MEM), 0)
    video_clock = _safe_nvml(lambda: pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_VIDEO), 0)
    clocks = GPUClockInfo(graphics_mhz=graphics_clock, sm_mhz=sm_clock, mem_mhz=mem_clock, video_mhz=video_clock)

    power_usage = _safe_nvml(lambda: pynvml.nvmlDeviceGetPowerUsage(handle), 0)
    power_limit = _safe_nvml(lambda: pynvml.nvmlDeviceGetPowerManagementLimit(handle), 0)
    current_watts = round(power_usage / 1000.0, 1) if power_usage > 0 else 0.0
    limit_watts = round(power_limit / 1000.0, 1) if power_limit > 0 else 0.0
    usage_pct = round(current_watts / max(limit_watts, 1) * 100, 1) if limit_watts > 0 else 0.0
    power = GPUPowerInfo(current_watts=current_watts, limit_watts=limit_watts, usage_percent=usage_pct)

    util_rates = _safe_nvml(lambda: pynvml.nvmlDeviceGetUtilizationRates(handle))
    if util_rates:
        utilization = GPUUtilization(
            gpu_percent=util_rates.gpu,
            memory_percent=util_rates.memory,
        )
    else:
        utilization = GPUUtilization(gpu_percent=0, memory_percent=0)

    enc_util = _safe_nvml(lambda: pynvml.nvmlDeviceGetEncoderUtilization(handle))
    dec_util = _safe_nvml(lambda: pynvml.nvmlDeviceGetDecoderUtilization(handle))
    if enc_util and len(enc_util) >= 2:
        utilization.encoder_percent = enc_util[0]
    if dec_util and len(dec_util) >= 2:
        utilization.decoder_percent = dec_util[0]

    processes: List[GPUProcessInfo] = []
    proc_list = _safe_nvml(lambda: pynvml.nvmlDeviceGetComputeRunningProcesses(handle), [])
    if proc_list:
        for proc in proc_list:
            pid = getattr(proc, 'pid', 0)
            pname = ""
            if HAS_PSUTIL:
                try:
                    pname = psutil.Process(pid).name()
                except Exception:
                    pass
            processes.append(GPUProcessInfo(
                pid=pid,
                name=pname,
                used_memory_mb=(getattr(proc, 'usedGpuMemory', 0) or 0) // (1024 * 1024),
                used_memory_str=f"{(getattr(proc, 'usedGpuMemory', 0) or 0) / (1024**2):.2f} GB" if (getattr(proc, 'usedGpuMemory', 0) or 0) > 1024**2 else f"{(getattr(proc, 'usedGpuMemory', 0) or 0) / 1024:.0f} MB",
            ))

    fan_speed = _safe_nvml(lambda: pynvml.nvmlDeviceGetFanSpeed(handle), 0)

    perf_state = _safe_nvml(lambda: pynvml.nvmlDeviceGetPerformanceState(handle), -1)
    if isinstance(perf_state, int) and perf_state >= 0:
        perf_state_str = f"P{perf_state}"
    else:
        perf_state_str = "Unknown"

    display_active_val = _safe_nvml(lambda: pynvml.nvmlDeviceGetDisplayActive(handle), 0)
    display_active = bool(display_active_val == 1)

    persist_mode = _safe_nvml(lambda: pynvml.nvmlDeviceGetPersistenceMode(handle), 0)
    persistence_mode = bool(persist_mode == 1)

    compute_mode_val = _safe_nvml(lambda: pynvml.nvmlDeviceGetComputeMode(handle), 0)
    compute_mode_map = {0: "Default", 1: "Exclusive_Thread", 2: "Exclusive_Process", 3: "Prohibited"}
    compute_mode_str = compute_mode_map.get(compute_mode_val, f"Mode_{compute_mode_val}")

    ecc_mode_val = _safe_nvml(lambda: pynvml.nvmlDeviceGetEccMode(handle), 0)
    ecc_enabled = bool(ecc_mode_val == 1)

    total_ecc = _safe_nvml(lambda: pynvml.nvmlDeviceGetTotalEccErrors(handle, pynvml.NVML_SINGLE_BIT_ECC_ERROR_TYPE), 0)

    return GPUDeviceInfo(
        index=idx,
        name=name,
        uuid=uuid,
        pci_bus_id=pci_bus_id,
        driver_version=driver_version,
        cuda_version=cuda_version,
        memory=memory,
        temperature=temperature,
        clocks=clocks,
        power=power,
        utilization=utilization,
        processes=processes,
        fan_speed_percent=fan_speed,
        performance_state=perf_state_str,
        display_active=display_active,
        persistence_mode=persistence_mode,
        compute_mode=compute_mode_str,
        ecc_mode=ecc_enabled,
        total_ecc_errors=total_ecc,
        is_available=True,
    )


def get_fallback_gpu() -> GPUDeviceInfo:
    info = GPUDeviceInfo(
        index=0,
        name="未检测到 NVIDIA GPU",
        uuid="",
        pci_bus_id="",
        driver_version="N/A",
        cuda_version="N/A",
        memory=GPUMemoryInfo(total_mb=0, used_mb=0, free_mb=0, total_gb=0, used_gb=0, free_gb=0, percent=0),
        temperature=GPUTemperatureInfo(gpu_celsius=0, max_threshold=0, slowdown_threshold=0, shutdown_threshold=0),
        clocks=GPUClockInfo(graphics_mhz=0, sm_mhz=0, mem_mhz=0, video_mhz=0),
        power=GPUPowerInfo(current_watts=0, limit_watts=0, usage_percent=0),
        utilization=GPUUtilization(gpu_percent=0, memory_percent=0, encoder_percent=0, decoder_percent=0),
        processes=[],
        fan_speed_percent=0,
        performance_state="N/A",
        display_active=False,
        persistence_mode=False,
        compute_mode="N/A",
        ecc_mode=False,
        total_ecc_errors=0,
        is_available=False,
    )
    return info


def get_gpu_info() -> GPUInfoResponse:
    from datetime import datetime

    devices: List[GPUDeviceInfo] = []

    if HAS_PYNVML:
        _ensure_init()
        if _nvm_initialized:
            try:
                count = pynvml.nvmlDeviceGetCount()
                for i in range(count):
                    handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                    dev = _get_device_info(handle, i)
                    devices.append(dev)
            except Exception as e:
                logger.error(f"Failed to query NVML device: {e}")
                devices.append(get_fallback_gpu())
        else:
            devices.append(get_fallback_gpu())
    else:
        devices.append(get_fallback_gpu())

    has_gpu = any(d.is_available for d in devices)

    return GPUInfoResponse(
        devices=devices,
        has_gpu=has_gpu,
        timestamp=datetime.now().isoformat(),
    )


class GPUTool:
    name: str = "gpu_check"
    description: str = "获取本机 NVIDIA GPU 实时状态信息，包括型号、显存、温度、功耗、使用率等"

    def _run(self, query: str = "") -> str:
        try:
            info = get_gpu_info()
            lines = ["=== GPU 状态 ==="]
            lines.append(f"检测时间: {info.timestamp}")

            if not info.has_gpu:
                lines.append("\n⚠ 未检测到 NVIDIA GPU 或驱动未安装")
                return "\n".join(lines)

            for dev in info.devices:
                if not dev.is_available:
                    continue
                lines.append(f"\n--- [{dev.index}] {dev.name} ---")
                lines.append(f"  驱动版本: {dev.driver_version} | CUDA: {dev.cuda_version}")
                lines.append(f"  显存: {dev.memory.used_gb}/{dev.memory.total_gb} GB ({dev.memory.percent}%)")
                lines.append(f"  温度: {dev.temperature.gpu_celsius}°C (上限: {dev.temperature.max_threshold}°C)")
                lines.append(f"  功耗: {dev.power.current_watts}W / {dev.power.limit_watts}W ({dev.power.usage_percent}%)")
                lines.append(f"  使用率: GPU {dev.utilization.gpu_percent}% | Memory {dev.utilization.memory_percent}%")
                lines.append(f"  频率: Graphics {dev.clocks.graphics_mhz} MHz | SM {dev.clocks.sm_mhz} MHz | Mem {dev.clocks.mem_mhz} MHz")
                if dev.utilization.encoder_percent > 0 or dev.utilization.decoder_percent > 0:
                    lines.append(f"  编解码: Encoder {dev.utilization.encoder_percent}% | Decoder {dev.utilization.decoder_percent}%")
                if dev.fan_speed_percent > 0:
                    lines.append(f"  风扇: {dev.fan_speed_percent}%")
                lines.append(f"  性能状态: {dev.performance_state} | 显示输出: {'是' if dev.display_active else '否'}")

                if dev.processes:
                    lines.append("  进程占用:")
                    for p in dev.processes[:10]:
                        lines.append(f"    PID={p.pid} {p.name}: {p.used_memory_str}")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"GPU check failed: {e}")
            return f"GPU检测失败: {str(e)}"
