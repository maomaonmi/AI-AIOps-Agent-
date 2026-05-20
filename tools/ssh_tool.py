import json
import logging
from pathlib import Path
from typing import Optional

import paramiko

from tools.base import BaseOpsTool, SSHExecInput
from config.settings import SSH_HOSTS_CONFIG

logger = logging.getLogger(__name__)


class SSHExecTool(BaseOpsTool):
    name: str = "ssh_exec"
    description: str = (
        "通过SSH远程执行命令，用于查看主机状态、检查进程、分析日志等。"
        "仅允许执行白名单内的只读命令，禁止危险操作。"
        "示例: host='10.0.0.1', command='free -m'"
    )
    args_schema: type = SSHExecInput
    dangerous: bool = False
    requires_confirmation: bool = False
    hosts_config: dict = {}
    command_whitelist: list = []

    def __init__(self, hosts_config_path: str = SSH_HOSTS_CONFIG, **kwargs):
        super().__init__(**kwargs)
        self.hosts_config, self.command_whitelist = self._load_config(hosts_config_path)

    def _load_config(self, config_path: str) -> tuple:
        try:
            path = Path(config_path)
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    config = json.load(f)
                hosts = {h["alias"]: h for h in config.get("hosts", [])}
                hosts.update({h["hostname"]: h for h in config.get("hosts", [])})
                whitelist = config.get("command_whitelist", [])
                return hosts, whitelist
        except Exception as e:
            logger.error(f"Failed to load SSH config: {e}")
        return {}, []

    def _validate_command(self, command: str) -> bool:
        if not self.command_whitelist:
            return True
        cmd_base = command.strip().split("|")[0].strip().split("&&")[0].strip()
        for allowed in self.command_whitelist:
            if cmd_base.startswith(allowed):
                return True
        return False

    def _get_host_config(self, host: str) -> Optional[dict]:
        if host in self.hosts_config:
            return self.hosts_config[host]
        for alias, cfg in self.hosts_config.items():
            if cfg.get("hostname") == host:
                return cfg
        return None

    def _run(self, host: str, command: str) -> str:
        if not self._validate_command(command):
            return f"错误: 命令 '{command}' 不在白名单内，禁止执行。允许的命令前缀: {self.command_whitelist[:5]}..."

        host_cfg = self._get_host_config(host)
        if not host_cfg:
            available = list(set(h.get("hostname", h.get("alias", "")) for h in self.hosts_config.values()))
            return f"错误: 未找到主机 '{host}' 的配置。可用主机: {available}"

        dangerous_keywords = ["rm ", "shutdown", "reboot", "kill -9", "mkfs", "dd if=", "> /dev/"]
        for kw in dangerous_keywords:
            if kw in command:
                self.requires_confirmation = True
                safety_msg = self._check_safety()
                if safety_msg:
                    return safety_msg

        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            connect_kwargs = {
                "hostname": host_cfg["hostname"],
                "port": host_cfg.get("port", 22),
                "username": host_cfg.get("username", "root"),
                "timeout": 30,
            }

            if "key_path" in host_cfg:
                key_path = Path(host_cfg["key_path"]).expanduser()
                if key_path.exists():
                    connect_kwargs["key_filename"] = str(key_path)
            elif "password" in host_cfg:
                connect_kwargs["password"] = host_cfg["password"]

            client.connect(**connect_kwargs)
            stdin, stdout, stderr = client.exec_command(command, timeout=60)

            output = stdout.read().decode("utf-8", errors="replace")
            error = stderr.read().decode("utf-8", errors="replace")
            exit_code = stdout.channel.recv_exit_status()

            client.close()

            result_parts = []
            if output.strip():
                result_parts.append(output.strip()[:2000])
            if error.strip():
                result_parts.append(f"[stderr]: {error.strip()[:500]}")
            result_parts.append(f"[exit_code: {exit_code}]")

            return "\n".join(result_parts)
        except paramiko.AuthenticationException:
            return f"SSH认证失败: {host_cfg['hostname']}"
        except paramiko.SSHException as e:
            return f"SSH连接错误: {str(e)}"
        except Exception as e:
            return f"SSH执行失败: {str(e)}"
