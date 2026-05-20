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

_prev_counters: Dict[str, Dict[str, int]] = {}
_prev_timestamp: float = 0.0


class IPAddress(BaseModel):
    address: str
    netmask: Optional[str] = None
    broadcast: Optional[str] = None
    family: str = ""


class NetworkInterface(BaseModel):
    name: str
    display_name: str
    nic_type: str
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    errin: int
    errout: int
    dropin: int
    dropout: int
    upload_speed_bytes: float
    download_speed_bytes: float
    is_up: bool
    speed_mbps: int = 0
    mtu: int = 0
    ipv4_addresses: List[IPAddress] = Field(default_factory=list)
    ipv6_addresses: List[IPAddress] = Field(default_factory=list)
    total_bytes_sent: int = 0
    total_bytes_recv: int = 0


class NetworkInfoResponse(BaseModel):
    interfaces: List[NetworkInterface]
    timestamp: str


def _classify_nic(name: str, display_name: str) -> str:
    combined = (display_name + " " + name).lower()
    if "wi-fi" in combined or "wireless" in combined or "wlan" in combined or "802.11" in combined or "wifi" in combined:
        return "Wi-Fi"
    if "bluetooth" in combined or "bt" in combined:
        return "Bluetooth"
    if "loopback" in combined or name.startswith("lo") or "loopback" in combined:
        return "Loopback"
    if "vpn" in combined or "tunnel" in combined or "teredo" in combined or "isatap" in combined or "sdpclient" in combined:
        return "Tunnel/VPN"
    if "virtual" in combined or "hyper-v" in combined or "vmware" in combined or "vbox" in combined or "veth" in combined or "docker" in combined or "vswitch" in combined or "vmnet" in combined or "vether" in combined or "(wsl" in combined or "wsl (" in combined:
        return "Virtual"
    if "pseudo" in combined or "ppp" in combined or "pppoe" in combined:
        return "PPP"
    if "ethernet" in combined or "以太网" in combined or "eth" in combined or "pcie" in combined or "realtek" in combined or "intel" in combined or "broadcom" in combined or "local area" in combined or "网卡" in combined or "本地连接" in combined:
        return "Ethernet"
    return "Other"


def get_network_info() -> NetworkInfoResponse:
    if not HAS_PSUTIL:
        return NetworkInfoResponse(interfaces=[], timestamp="")

    global _prev_counters, _prev_timestamp

    current_time = time.time()

    io_counters = psutil.net_io_counters(pernic=True)
    if_addrs = psutil.net_if_addrs()
    if_stats = {}
    try:
        if_stats = psutil.net_if_stats()
    except Exception:
        pass

    delta_t = current_time - _prev_timestamp if _prev_timestamp > 0 else 1.0
    if delta_t < 0.1:
        delta_t = 1.0

    interfaces: List[NetworkInterface] = []

    for nic_name, counters in io_counters.items():
        stats = if_stats.get(nic_name)
        display_name = nic_name

        nic_type = _classify_nic(nic_name, display_name)

        is_up = stats.isup if stats else True
        speed_mbps = stats.speed if stats and stats.speed > 0 else 0
        mtu = stats.mtu if stats else 0

        prev = _prev_counters.get(nic_name, {})
        upload_speed = 0.0
        download_speed = 0.0
        if prev and _prev_timestamp > 0:
            sent_delta = counters.bytes_sent - prev.get("bytes_sent", counters.bytes_sent)
            recv_delta = counters.bytes_recv - prev.get("bytes_recv", counters.bytes_recv)
            if sent_delta > 0:
                upload_speed = sent_delta / delta_t
            if recv_delta > 0:
                download_speed = recv_delta / delta_t

        _prev_counters[nic_name] = {
            "bytes_sent": counters.bytes_sent,
            "bytes_recv": counters.bytes_recv,
        }

        ipv4_list: List[IPAddress] = []
        ipv6_list: List[IPAddress] = []

        if nic_name in if_addrs:
            for addr in if_addrs[nic_name]:
                ip_obj = IPAddress(
                    address=addr.address,
                    netmask=addr.netmask if hasattr(addr, 'netmask') else None,
                    broadcast=addr.broadcast if hasattr(addr, 'broadcast') else None,
                    family=str(addr.family),
                )
                if hasattr(addr, 'family'):
                    if addr.family == 2:
                        ipv4_list.append(ip_obj)
                    elif addr.family == 23:
                        ipv6_list.append(ip_obj)
                    else:
                        ipv6_list.append(ip_obj) if ":" in addr.address else ipv4_list.append(ip_obj)
                else:
                    if ":" in addr.address:
                        ipv6_list.append(ip_obj)
                    else:
                        ipv4_list.append(ip_obj)

        interfaces.append(NetworkInterface(
            name=nic_name,
            display_name=display_name,
            nic_type=nic_type,
            bytes_sent=counters.bytes_sent,
            bytes_recv=counters.bytes_recv,
            packets_sent=counters.packets_sent,
            packets_recv=counters.packets_recv,
            errin=counters.errin,
            errout=counters.errout,
            dropin=counters.dropin,
            dropout=counters.dropout,
            upload_speed_bytes=round(upload_speed, 0),
            download_speed_bytes=round(download_speed, 0),
            is_up=is_up,
            speed_mbps=speed_mbps,
            mtu=mtu,
            ipv4_addresses=ipv4_list,
            ipv6_addresses=ipv6_list,
            total_bytes_sent=counters.bytes_sent,
            total_bytes_recv=counters.bytes_recv,
        ))

    interfaces.sort(key=lambda x: (x.download_speed_bytes + x.upload_speed_bytes), reverse=True)

    _prev_timestamp = current_time

    from datetime import datetime
    return NetworkInfoResponse(
        interfaces=interfaces,
        timestamp=datetime.now().isoformat(),
    )


class NetworkTool:
    name: str = "network_check"
    description: str = "获取本机网络接口流量、速率、IP地址等实时信息"

    def _run(self, query: str = "") -> str:
        try:
            info = get_network_info()
            lines = [f"=== 网络状态 ({platform.system()}) ==="]
            lines.append(f"检测时间: {info.timestamp}")
            lines.append("")

            for iface in info.interfaces:
                if not iface.is_up:
                    continue
                lines.append(f"[{iface.nic_type}] {iface.display_name} ({iface.name})")
                lines.append(f"  上传: {_fmt_bytes(iface.upload_speed_bytes)}/s  |  下载: {_fmt_bytes(iface.download_speed_bytes)}/s")
                lines.append(f"  累计上传: {_fmt_bytes(iface.total_bytes_sent)}  |  累计下载: {_fmt_bytes(iface.total_bytes_recv)}")
                if iface.ipv4_addresses:
                    lines.append(f"  IPv4: {', '.join(a.address for a in iface.ipv4_addresses)}")
                if iface.ipv6_addresses:
                    lines.append(f"  IPv6: {', '.join(a.address.split('%')[0] for a in iface.ipv6_addresses)}")
                if iface.speed_mbps > 0:
                    lines.append(f"  链路速率: {iface.speed_mbps} Mbps  |  MTU: {iface.mtu}")
                lines.append("")

            return "\n".join(lines)
        except Exception as e:
            logger.error(f"Network check failed: {e}")
            return f"网络检测失败: {str(e)}"


def _fmt_bytes(b: float) -> str:
    if b >= 1024**3:
        return f"{b / 1024**3:.2f} GB"
    if b >= 1024**2:
        return f"{b / 1024**2:.2f} MB"
    if b >= 1024:
        return f"{b / 1024:.2f} KB"
    return f"{b:.0f} B"