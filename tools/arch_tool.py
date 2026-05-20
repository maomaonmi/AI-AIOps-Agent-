import logging
import platform
import socket
import sys
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class CPUArchInfo(BaseModel):
    processor: str
    architecture: str
    cores_physical: int
    cores_logical: int
    frequency_mhz: float
    frequency_ghz: float
    usage_percent: float
    temperature: int = 0


class MemoryArchInfo(BaseModel):
    total_gb: float
    available_gb: float
    used_gb: float
    type: str = "DDR"
    speed_mhz: int = 0


class DiskArchInfo(BaseModel):
    device: str
    mount_point: str
    fstype: str
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float
    is_ssd: bool = False


class GPUArchInfo(BaseModel):
    name: str
    memory_total_gb: float
    driver_version: str
    cuda_version: str
    is_available: bool


class NetworkArchInfo(BaseModel):
    name: str
    nic_type: str
    is_up: bool
    speed_mbps: int
    ipv4_addresses: List[str]
    ipv6_addresses: List[str]
    mtu: int


class OSInfo(BaseModel):
    system: str
    release: str
    version: str
    hostname: str
    architecture: str
    machine: str
    kernel: str = ""
    uptime: str
    boot_time: str


class RuntimeInfo(BaseModel):
    python_version: str
    python_path: str
    node_version: str = "N/A"
    pip_version: str = "N/A"


class ArchitectureReport(BaseModel):
    os: OSInfo
    cpu: CPUArchInfo
    memory: MemoryArchInfo
    disks: List[DiskArchInfo]
    gpus: List[GPUArchInfo]
    networks: List[NetworkArchInfo]
    runtime: RuntimeInfo
    hostname: str
    report_time: str


def _get_os_info() -> OSInfo:
    uptime_str = "未知"
    boot_time_str = "未知"
    
    if HAS_PSUTIL:
        try:
            boot_ts = psutil.boot_time()
            boot_time_str = datetime.fromtimestamp(boot_ts).strftime("%Y-%m-%d %H:%M:%S")
            uptime_sec = datetime.now().timestamp() - boot_ts
            days = int(uptime_sec // 86400)
            hours = int((uptime_sec % 86400) // 3600)
            mins = int((uptime_sec % 3600) // 60)
            if days > 0:
                uptime_str = f"{days}天 {hours}小时 {mins}分钟"
            elif hours > 0:
                uptime_str = f"{hours}小时 {mins}分钟"
            else:
                uptime_str = f"{mins}分钟"
        except Exception:
            pass
    
    kernel = ""
    if platform.system() == "Linux":
        try:
            kernel = platform.release()
        except Exception:
            pass
    elif platform.system() == "Windows":
        kernel = f"Build {platform.version()}"
    
    return OSInfo(
        system=platform.system(),
        release=platform.release(),
        version=platform.version(),
        hostname=platform.node(),
        architecture=platform.architecture()[0],
        machine=platform.machine(),
        kernel=kernel,
        uptime=uptime_str,
        boot_time=boot_time_str,
    )


def _get_cpu_arch() -> CPUArchInfo:
    processor = platform.processor() or "未知处理器"
    arch = platform.architecture()[0]
    
    cores_physical = 0
    cores_logical = 0
    freq_mhz = 0.0
    usage = 0.0
    temp = 0
    
    if HAS_PSUTIL:
        try:
            cores_physical = psutil.cpu_count(logical=False) or 0
            cores_logical = psutil.cpu_count(logical=True) or 0
            usage = psutil.cpu_percent(interval=0.5)
            
            freq = psutil.cpu_freq()
            if freq:
                freq_mhz = freq.current
        except Exception:
            pass
    
    try:
        from tools.cpu_tool import get_cpu_info
        cpu_info = get_cpu_info()
        if cpu_info.temperature > 0:
            temp = cpu_info.temperature
    except Exception:
        pass
    
    return CPUArchInfo(
        processor=processor,
        architecture=arch,
        cores_physical=cores_physical,
        cores_logical=cores_logical,
        frequency_mhz=round(freq_mhz, 1),
        frequency_ghz=round(freq_mhz / 1000, 2) if freq_mhz > 0 else 0,
        usage_percent=round(usage, 1),
        temperature=temp,
    )


def _get_memory_arch() -> MemoryArchInfo:
    total_gb = 0.0
    available_gb = 0.0
    used_gb = 0.0
    
    if HAS_PSUTIL:
        try:
            mem = psutil.virtual_memory()
            total_gb = round(mem.total / (1024**3), 2)
            available_gb = round(mem.available / (1024**3), 2)
            used_gb = round(mem.used / (1024**3), 2)
        except Exception:
            pass
    
    return MemoryArchInfo(
        total_gb=total_gb,
        available_gb=available_gb,
        used_gb=used_gb,
    )


def _get_disk_arch() -> List[DiskArchInfo]:
    disks = []
    
    if HAS_PSUTIL:
        try:
            for part in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    is_ssd = False
                    if platform.system() == "Windows":
                        is_ssd = "SSD" in part.opts.upper() if part.opts else False
                    
                    disks.append(DiskArchInfo(
                        device=part.device,
                        mount_point=part.mountpoint,
                        fstype=part.fstype,
                        total_gb=round(usage.total / (1024**3), 2),
                        used_gb=round(usage.used / (1024**3), 2),
                        free_gb=round(usage.free / (1024**3), 2),
                        percent=round(usage.percent, 1),
                        is_ssd=is_ssd,
                    ))
                except Exception:
                    continue
        except Exception:
            pass
    
    return disks


def _get_gpu_arch() -> List[GPUArchInfo]:
    gpus = []
    
    try:
        from tools.gpu_tool import get_gpu_info
        gpu_info = get_gpu_info()
        
        for dev in gpu_info.devices:
            gpus.append(GPUArchInfo(
                name=dev.name,
                memory_total_gb=dev.memory.total_gb,
                driver_version=dev.driver_version,
                cuda_version=dev.cuda_version,
                is_available=dev.is_available,
            ))
    except Exception:
        pass
    
    if not gpus:
        gpus.append(GPUArchInfo(
            name="未检测到 NVIDIA GPU",
            memory_total_gb=0,
            driver_version="N/A",
            cuda_version="N/A",
            is_available=False,
        ))
    
    return gpus


def _get_network_arch() -> List[NetworkArchInfo]:
    networks = []
    
    try:
        from tools.network_tool import get_network_info
        net_info = get_network_info()
        
        for iface in net_info.interfaces:
            if not iface.is_up:
                continue
            
            networks.append(NetworkArchInfo(
                name=iface.display_name,
                nic_type=iface.nic_type,
                is_up=iface.is_up,
                speed_mbps=iface.speed_mbps,
                ipv4_addresses=[a.address for a in iface.ipv4_addresses],
                ipv6_addresses=[a.address.split('%')[0] for a in iface.ipv6_addresses],
                mtu=iface.mtu,
            ))
    except Exception:
        pass
    
    return networks


def _get_runtime_info() -> RuntimeInfo:
    python_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    python_path = sys.executable
    
    pip_ver = "N/A"
    try:
        import pip
        pip_ver = pip.__version__
    except Exception:
        pass
    
    node_ver = "N/A"
    try:
        import subprocess
        result = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            node_ver = result.stdout.strip()
    except Exception:
        pass
    
    return RuntimeInfo(
        python_version=python_ver,
        python_path=python_path,
        node_version=node_ver,
        pip_version=pip_ver,
    )


def get_architecture_report() -> ArchitectureReport:
    return ArchitectureReport(
        os=_get_os_info(),
        cpu=_get_cpu_arch(),
        memory=_get_memory_arch(),
        disks=_get_disk_arch(),
        gpus=_get_gpu_arch(),
        networks=_get_network_arch(),
        runtime=_get_runtime_info(),
        hostname=platform.node(),
        report_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )