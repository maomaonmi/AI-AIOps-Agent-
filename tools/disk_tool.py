import logging
import os
import platform
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class BlockHealthInfo(BaseModel):
    """磁盘块/扇区健康信息"""
    smart_status: str = "unknown"
    media_type: str = ""
    model: str = ""
    size_gb: float = 0
    reallocated_sectors: int = 0
    pending_sectors: int = 0
    uncorrectable_sectors: int = 0
    temperature: Optional[int] = None
    power_on_hours: Optional[int] = None
    health_score: int = 100
    health_details: List[str] = Field(default_factory=list)


class DiskInfo(BaseModel):
    device: str
    mountpoint: str
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float
    fstype: str
    health_status: str
    health_details: List[str]
    block_health: Optional[BlockHealthInfo] = None


class SystemDiskInfo(BaseModel):
    system: str
    drives: List[DiskInfo]
    timestamp: str


def _run_wmic(query_parts: list) -> tuple:
    """执行 WMIC 命令并解析结果"""
    try:
        import subprocess
        cmd = ["wmic"] + query_parts + ["/format:list"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        lines = [l.strip() for l in result.stdout.strip().split('\n') if '=' in l]
        parsed = {}
        for line in lines:
            if '=' in line:
                k, v = line.split('=', 1)
                parsed[k.strip()] = v.strip()
        return True, parsed
    except Exception as e:
        logger.warning(f"WMIC command failed: {e}")
        return False, {}


def get_block_health() -> Dict[str, BlockHealthInfo]:
    """获取所有物理磁盘的块健康(SMART)信息"""
    result = {}

    if platform.system() != "Windows":
        return result

    success, disks_info = _run_wmic(["diskdrive", "get", "Status,MediaType,Model,Size"])
    if not success or not disks_info:
        return result

    status_val = disks_info.get("Status", "")
    media_type = disks_info.get("MediaType", "Fixed hard disk media")
    model = disks_info.get("Model", "Unknown")
    try:
        size_bytes = int(disks_info.get("Size", 0))
        size_gb = round(size_bytes / (1024**3), 1)
    except (ValueError, TypeError):
        size_gb = 0

    health_score = 100
    details = []

    if status_val == "OK":
        smart_status = "OK"
        details.append("SMART自检: 通过")
    elif status_val == "Degraded":
        smart_status = "Degraded"
        health_score -= 30
        details.append("SMART状态: 降级，存在潜在问题")
    elif status_val == "Error":
        smart_status = "Error"
        health_score -= 60
        details.append("SMART状态: 错误！磁盘可能损坏")
    else:
        smart_status = status_val or "Unknown"
        details.append(f"SMART状态: {smart_status}")

    reallocated = 0
    pending = 0
    uncorrectable = 0
    temp = None
    power_hours = None

    ok2, smart_data = _run_wmic(["diskdrive", "get", "Status", "where", f"Status='{status_val}'"])
    if not ok2:
        pass

    try:
        import wmi
        c = wmi.WMI()
        for disk in c.Win32_DiskDrive():
            dname = disk.Model or ""
            try:
                dsize = round(int(disk.Size or 0) / (1024**3), 1) if disk.Size else 0
            except (ValueError, TypeError):
                dsize = 0

            for partition in disk.associators("Win32_DiskDriveToDiskPartition"):
                for logical in partition.associators("Win32_LogicalDiskToPartition"):
                    drive_letter = logical.DeviceID.replace(":", "")

                    bh = BlockHealthInfo(
                        smart_status=disk.Status or "Unknown",
                        media_type=disk.MediaType or "",
                        model=dname,
                        size_gb=dsize,
                        reallocated_sectors=reallocated,
                        pending_sectors=pending,
                        uncorrectable_sectors=uncorrectable,
                        temperature=temp,
                        power_on_hours=power_hours,
                        health_score=health_score,
                        health_details=list(details),
                    )

                    if reallocated > 0:
                        bh.health_score -= min(reallocated * 5, 40)
                        bh.health_details.append(f"重分配扇区数: {reallocated}（可能有坏块）")
                    if pending > 0:
                        bh.health_score -= min(pending * 10, 30)
                        bh.health_details.append(f"待映射扇区数: {pending}（数据有丢失风险）")
                    if uncorrectable > 0:
                        bh.health_score -= min(uncorrectable * 15, 50)
                        bh.health_details.append(f"无法纠正扇区: {uncorrectable}（严重坏块！）")

                    bh.health_score = max(0, min(100, bh.health_score))
                    result[drive_letter] = bh
            break
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"WMI SMART detail failed: {e}")

    if not result:
        fallback = BlockHealthInfo(
            smart_status=smart_status,
            media_type=media_type,
            model=model,
            size_gb=size_gb,
            reallocated_sectors=reallocated,
            pending_sectors=pending,
            uncorrectable_sectors=uncorrectable,
            temperature=temp,
            power_on_hours=power_hours,
            health_score=health_score,
            health_details=details,
        )
        result["*"] = fallback

    return result


def get_disk_health(drive_letter: str, block_health_map: dict) -> tuple:
    """检测磁盘健康状态（含块健康）"""
    health_status = "healthy"
    details = []

    if platform.system() == "Windows":
        try:
            import subprocess
            result = subprocess.run(
                ["wmic", "diskdrive", "get", "Status"],
                capture_output=True, text=True, timeout=10
            )
            output = result.stdout
            if "OK" not in output and "Status" in output:
                health_status = "warning"
                details.append("SMART状态异常")
            else:
                details.append("SMART状态: OK")
        except Exception as e:
            logger.warning(f"SMART check failed: {e}")
            details.append("无法检测SMART状态")

    bh = block_health_map.get(drive_letter) or block_health_map.get("*")
    if bh:
        if bh.health_score >= 80:
            pass
        elif bh.health_score >= 60:
            if health_status == "healthy":
                health_status = "notice"
            details.insert(0, f"块健康评分: {bh.health_score}/100（略有损耗）")
        elif bh.health_score >= 40:
            health_status = "warning"
            details.insert(0, f"块健康评分: {bh.health_score}/100（扇区异常）")
        else:
            health_status = "critical"
            details.insert(0, f"块健康评分: {bh.health_score}/100（严重损坏风险）")

        for d in bh.health_details:
            if d not in details:
                details.append(d)

    return health_status, details, bh


def get_local_disk_info() -> SystemDiskInfo:
    """获取本机所有磁盘的容量和健康状态（含块健康）"""
    drives = []

    if not HAS_PSUTIL:
        drives.append(DiskInfo(
            device="N/A", mountpoint="N/A", total_gb=0, used_gb=0, free_gb=0,
            percent=0, fstype="N/A", health_status="unknown",
            health_details=["psutil 未安装"],
        ))
        return SystemDiskInfo(system=platform.system(), drives=drives, timestamp="")

    block_health_map = get_block_health()

    partitions = psutil.disk_partitions()
    for part in partitions:
        if part.fstype == "":
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except PermissionError:
            continue

        total_gb = round(usage.total / (1024 ** 3), 2)
        used_gb = round(usage.used / (1024 ** 3), 2)
        free_gb = round(usage.free / (1024 ** 3), 2)
        percent = round(usage.percent, 1)

        dev_name = part.device.rstrip("\\").rstrip(":")
        health_status, health_details, block_health = get_disk_health(dev_name, block_health_map)

        if percent >= 90:
            health_status = "critical"
            health_details.append(f"空间严重不足: 仅剩 {free_gb:.1f}GB ({100-percent:.1f}%)")
        elif percent >= 80:
            if health_status not in ("critical",):
                health_status = "warning"
            health_details.append(f"空间不足: 剩余 {free_gb:.1f}GB ({100-percent:.1f}%)")
        elif percent >= 70:
            if health_status == "healthy":
                health_status = "notice"
            health_details.append(f"空间偏低: 剩余 {free_gb:.1f}GB ({100-percent:.1f}%)")

        drives.append(DiskInfo(
            device=dev_name, mountpoint=part.mountpoint,
            total_gb=total_gb, used_gb=used_gb, free_gb=free_gb,
            percent=percent, fstype=part.fstype,
            health_status=health_status, health_details=health_details,
            block_health=block_health,
        ))

    from datetime import datetime
    return SystemDiskInfo(
        system=platform.system(), drives=drives,
        timestamp=datetime.now().isoformat(),
    )


class DiskCheckTool:
    name: str = "disk_check"
    description: str = (
        "获取本机所有磁盘的容量、使用率和健康状态。"
        "返回各磁盘(C盘、D盘等)的总容量、已用、可用、百分比及块健康状态。"
    )

    def _run(self, query: str = "") -> str:
        try:
            info = get_local_disk_info()
            lines = [f"=== 本机磁盘状态 ({info.system}) ==="]
            lines.append(f"检测时间: {info.timestamp}")
            lines.append("")
            if not info.drives:
                lines.append("未检测到任何磁盘")
                return "\n".join(lines)

            for drive in info.drives:
                icons = {"healthy": "V", "notice": "*", "warning": "!", "critical": "X", "unknown": "?"}
                labels = {"healthy": "健康", "notice": "注意", "warning": "警告", "critical": "危险", "unknown": "未知"}
                icon = icons.get(drive.health_status, "?")
                label = labels.get(drive.health_status, "未知")

                lines.append(f"[{icon}] {drive.device}盘 ({drive.mountpoint})")
                lines.append(f"  文件系统: {drive.fstype}")
                lines.append(f"  总容量:   {drive.total_gb:.2f} GB")
                lines.append(f"  已用:     {drive.used_gb:.2f} GB ({drive.percent:.1f}%)")
                lines.append(f"  可用:     {drive.free_gb:.2f} GB ({100-drive.percent:.1f}%)")
                lines.append(f"  健康状态: {label}")
                if drive.block_health:
                    bh = drive.block_health
                    lines.append(f"  块健康:   {bh.health_score}/100 ({bh.smart_status})")
                    if bh.model:
                        lines.append(f"  型号:     {bh.model}")
                for d in drive.health_details:
                    lines.append(f"    - {d}")
                lines.append("")
            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Disk check failed: {e}")
            return f"磁盘检测失败: {str(e)}"