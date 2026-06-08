import asyncio
import json
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, AsyncGenerator

import paramiko
from pydantic import BaseModel, Field

from tools.base import BaseOpsTool

logger = logging.getLogger(__name__)


# ==================== 数据模型 ====================

class ScriptParameter(BaseModel):
    """脚本参数定义"""
    name: str = Field(description="参数名称")
    type: str = Field(default="string", description="参数类型: string, number, boolean, select")
    default: Any = Field(default=None, description="默认值")
    required: bool = Field(default=False, description="是否必填")
    description: str = Field(default="", description="参数描述")
    options: Optional[List[str]] = Field(default=None, description="选项列表（type=select时使用）")


class ScriptTemplate(BaseModel):
    """脚本模板"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = Field(description="脚本名称")
    category: str = Field(default="general", description="分类: system, database, network, custom")
    description: str = Field(default="", description="脚本描述")
    content: str = Field(description="脚本内容（支持变量替换）")
    parameters: List[ScriptParameter] = Field(default_factory=list, description="参数列表")
    risk_level: str = Field(default="low", description="风险等级: low, medium, high")
    timeout: int = Field(default=300, description="超时时间（秒）")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    author: str = Field(default="system", description="创建者")


class ExecutionTarget(BaseModel):
    """执行目标"""
    host: str = Field(description="主机IP或别名")
    alias: Optional[str] = Field(default=None, description="主机别名")
    status: str = Field(default="pending", description="状态: pending, running, success, failed, timeout")


class ExecutionRequest(BaseModel):
    """执行请求"""
    script_id: Optional[str] = Field(default=None, description="脚本模板ID（如果使用模板）")
    script_content: Optional[str] = Field(default=None, description="直接提供脚本内容")
    targets: List[str] = Field(description="目标主机列表")
    params: Dict[str, Any] = Field(default_factory=dict, description="脚本参数")
    dry_run: bool = Field(default=False, description="干运行模式（仅预览不执行）")
    max_concurrent: int = Field(default=5, description="最大并发数")
    timeout: int = Field(default=300, description="全局超时时间（秒）")


class ExecutionResult(BaseModel):
    """单个主机的执行结果"""
    execution_id: str
    target_host: str
    status: str  # pending, running, success, failed, timeout, cancelled
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[float] = None  # 秒
    error_message: Optional[str] = None


class BatchExecutionResult(BaseModel):
    """批量执行结果"""
    execution_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    script_name: str = ""
    request: ExecutionRequest
    results: List[ExecutionResult] = []
    status: str = "pending"  # pending, running, completed, partial_failed, failed
    start_time: str = Field(default_factory=lambda: datetime.now().isoformat())
    end_time: Optional[str] = None
    summary: Dict[str, int] = Field(default_factory=lambda: {
        "total": 0,
        "success": 0,
        "failed": 0,
        "running": 0,
        "pending": 0
    })


# ==================== 预置脚本模板 ====================

BUILTIN_SCRIPTS: List[ScriptTemplate] = [
    ScriptTemplate(
        id="builtin-disk-cleanup",
        name="磁盘空间清理",
        category="system",
        description="清理系统临时文件、旧日志文件，释放磁盘空间",
        content="""#!/bin/bash
set -e

KEEP_DAYS={{ keep_days | default(30) }}
LOG_PATH="{{ log_path | default('/var/log') }}"
TEMP_PATH="{{ temp_path | default('/tmp') }}"

echo "🔍 开始扫描可清理文件..."
echo "保留最近 $KEEP_DAYS 天的文件"
echo ""

# 清理旧日志文件
echo "📁 扫描日志目录: $LOG_PATH"
if [ -d "$LOG_PATH" ]; then
    LOG_SIZE=$(find "$LOG_PATH" -name "*.log.*" -mtime +$KEEP_DAYS -type f -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    LOG_COUNT=$(find "$LOG_PATH" -name "*.log.*" -mtime +$KEEP_DAYS -type f 2>/dev/null | wc -l)
    echo "  发现 $LOG_COUNT 个旧日志文件，预计释放: $LOG_SIZE"
    
    if [ "$DRY_RUN" != "1" ]; then
        find "$LOG_PATH" -name "*.log.*" -mtime +$KEEP_DAYS -type f -delete 2>/dev/null && echo "  ✅ 日志清理完成"
    else
        echo "  ⏭️  [干运行] 跳过实际删除"
    fi
else
    echo "  ⚠️  日志目录不存在: $LOG_PATH"
fi

# 清理临时文件
echo ""
echo "📁 扫描临时目录: $TEMP_PATH"
if [ -d "$TEMP_PATH" ]; then
    TEMP_SIZE=$(find "$TEMP_PATH" -mtime +$KEEP_DAYS -type f -exec du -ch {} + 2>/dev/null | tail -1 | cut -f1)
    TEMP_COUNT=$(find "$TEMP_PATH" -mtime +$KEEP_DAYS -type f 2>/dev/null | wc -l)
    echo "  发现 $TEMP_COUNT 个临时文件，预计释放: $TEMP_SIZE"
    
    if [ "$DRY_RUN" != "1" ]; then
        find "$TEMP_PATH" -mtime +$KEEP_DAYS -type f -delete 2>/dev/null && echo "  ✅ 临时文件清理完成"
    else
        echo "  ⏭️  [干运行] 跳过实际删除"
    fi
fi

# 显示磁盘使用情况
echo ""
echo "💾 当前磁盘使用情况:"
df -h | grep -E "^/dev|^Filesystem"

echo ""
echo "✨ 清理任务完成！"
""",
        parameters=[
            ScriptParameter(name="keep_days", type="number", default=30, required=False, description="保留天数"),
            ScriptParameter(name="log_path", type="string", default="/var/log", required=False, description="日志路径"),
            ScriptParameter(name="temp_path", type="string", default="/tmp", required=False, description="临时文件路径"),
        ],
        risk_level="medium",
        timeout=600,
    ),
    ScriptTemplate(
        id="builtin-service-restart",
        name="服务重启",
        category="system",
        description="安全重启指定服务，包含健康检查",
        content="""#!/bin/bash
set -e

SERVICE_NAME="{{ service_name }}"
GRACEFUL_TIMEOUT="{{ graceful_timeout | default(30) }}"
HEALTH_CHECK_URL="{{ health_check_url | default('') }}"
MAX_RETRIES="{{ max_retries | default(3) }}"

echo "🔄 准备重启服务: $SERVICE_NAME"

# 检查服务是否存在
if ! systemctl list-units --all | grep -q "$SERVICE_NAME"; then
    echo "❌ 错误: 服务 $SERVICE_NAME 不存在"
    exit 1
fi

# 获取重启前状态
echo "📊 重启前服务状态:"
systemctl status $SERVICE_NAME --no-pager | head -10

# 优雅停止
echo ""
echo "⏳ 正在优雅停止服务 (超时: ${GRACEFUL_TIMEOUT}s)..."
if [ "$DRY_RUN" != "1" ]; then
    systemctl stop $SERVICE_NAME --timeout=$GRACEFUL_TIMEOUT || {
        echo "⚠️  优雅停止失败，强制终止..."
        systemctl kill $SERVICE_NAME 2>/dev/null || true
    }
    
    # 等待进程完全退出
    sleep 2
    
    # 启动服务
    echo "🚀 正在启动服务..."
    systemctl start $SERVICE_NAME
    
    # 等待服务就绪
    sleep 3
    
    # 健康检查
    if [ -n "$HEALTH_CHECK_URL" ]; then
        echo "🏥 执行健康检查: $HEALTH_CHECK_URL"
        for i in $(seq 1 $MAX_RETRIES); do
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" || echo "000")
            if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
                echo "✅ 健康检查通过 (HTTP $HTTP_CODE)"
                break
            fi
            echo "  ⏳ 等待服务就绪... ($i/$MAX_RETRIES)"
            sleep 2
        done
    fi
    
    # 最终状态检查
    echo ""
    echo "📊 重启后服务状态:"
    systemctl status $SERVICE_NAME --no-pager | head -10
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo ""
        echo "✅ 服务 $SERVICE_NAME 重启成功！"
        exit 0
    else
        echo ""
        echo "❌ 服务 $SERVICE_NAME 启动失败！"
        journalctl -u $SERVICE_NAME --since "5 minutes ago" --no-pager
        exit 1
    fi
else
    echo "⏭️  [干运行] 将执行以下操作:"
    echo "  1. 停止服务: systemctl stop $SERVICE_NAME"
    echo "  2. 启动服务: systemctl start $SERVICE_NAME"
    if [ -n "$HEALTH_CHECK_URL" ]; then
        echo "  3. 健康检查: curl $HEALTH_CHECK_URL"
    fi
fi
""",
        parameters=[
            ScriptParameter(name="service_name", type="string", required=True, description="服务名称（如 nginx, mysql）"),
            ScriptParameter(name="graceful_timeout", type="number", default=30, required=False, description="优雅停止超时时间（秒）"),
            ScriptParameter(name="health_check_url", type="string", default="", required=False, description="健康检查URL"),
            ScriptParameter(name="max_retries", type="number", default=3, required=False, description="健康检查重试次数"),
        ],
        risk_level="high",
        timeout=120,
    ),
    ScriptTemplate(
        id="builtin-log-analysis",
        name="日志分析",
        category="monitoring",
        description="分析指定时间范围内的错误日志和异常",
        content="""#!/bin/bash

LOG_FILE="{{ log_file }}"
TIME_RANGE="{{ time_range | default('1h') }}"
KEYWORD="{{ keyword | default('ERROR|Exception|Failed') }}"
TOP_N="{{ top_n | default(10) }}"

echo "📊 开始分析日志文件: $LOG_FILE"
echo "时间范围: 最近 $TIME_RANGE"
echo "搜索关键词: $KEYWORD"
echo ""

# 检查文件是否存在
if [ ! -f "$LOG_FILE" ]; then
    echo "❌ 错误: 日志文件不存在: $LOG_FILE"
    exit 1
fi

# 计算时间范围（简化处理）
case $TIME_RANGE in
    *h) HOURS=${TIME_RANGE%h}; SINCE="$HOURS hours ago" ;;
    *m) MINUTES=${TIME_RANGE%m}; SINCE="$MINUTES minutes ago" ;;
    *d) DAYS=${TIME_RANGE%d}; SINCE="$DAYS days ago" ;;
    *) SINCE="1 hour ago" ;;
esac

# 统计总行数和时间范围内的行数
TOTAL_LINES=$(wc -l < "$LOG_FILE")
RECENT_LINES=$(awk -v date="$(date -d "$SINCE" '+%Y-%m-%d %H:%M')" '$0 >= date' "$LOG_FILE" 2>/dev/null | wc -l)

echo "📈 日志统计:"
echo "  总行数: $TOTAL_LINES"
echo "  时间范围内行数: $RECENT_LINES"
echo ""

# 搜索关键词匹配
echo "🔍 关键词匹配 ($KEYWORD):"
MATCH_COUNT=$(grep -E "$KEYWORD" "$LOG_FILE" 2>/dev/null | wc -l)
echo "  匹配行数: $MATCH_COUNT"
echo ""

if [ "$MATCH_COUNT" -gt 0 ]; then
    echo "⚠️  Top $TOP_N 错误/异常记录:"
    echo "----------------------------------------"
    grep -E "$KEYWORD" "$LOG_FILE" 2>/dev/null | tail -$TOP_N | while read line; do
        echo "  • $line"
    done
    echo "----------------------------------------"
    
    # 统计错误类型分布
    echo ""
    echo "📊 错误类型分布:"
    grep -oE '"[^"]*Exception[^"]*"|error:[^,]+' "$LOG_FILE" 2>/dev/null | \
        sort | uniq -c | sort -rn | head -10 | while read count pattern; do
        printf "  %-60s %s\n" "$pattern" "($count 次)"
    done
else
    echo "✅ 未发现匹配的关键词，日志正常！"
fi

echo ""
echo "✨ 分析完成！"
""",
        parameters=[
            ScriptParameter(name="log_file", type="string", required=True, description="日志文件路径"),
            ScriptParameter(name="time_range", type="string", default="1h", required=False, description="时间范围（如 1h, 30m, 24h）"),
            ScriptParameter(name="keyword", type="string", default="ERROR|Exception|Failed", required=False, description="搜索关键词（正则表达式）"),
            ScriptParameter(name="top_n", type="number", default=10, required=False, description="显示Top N条记录"),
        ],
        risk_level="low",
        timeout=120,
    ),
    ScriptTemplate(
        id="builtin-system-info",
        name="系统信息采集",
        category="monitoring",
        description="采集主机系统信息、资源使用情况和关键进程",
        content="""#!/bin/bash

echo "=========================================="
echo "  系统信息报告 - $(hostname)"
echo "  生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

echo "[操作系统]"
echo "  系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "  内核: $(uname -r)"
echo "  架构: $(uname -m)"
echo "  运行时间: $(uptime -p)"
echo ""

echo "[CPU 信息]"
echo "  型号: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)"
echo "  核心数: $(nproc)"
echo "  使用率: $(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1)%"
echo ""

echo "[内存信息]"
free -h | awk '/Mem:/{
    printf "  总计: %s\n", $2
    printf "  已用: %s (%.1f%%)\n", $3, $3/$2*100
    printf "  可用: %s\n", $7
}'
echo ""

echo "[磁盘信息]"
df -h | awk '!/^Filesystem/ && /^\/dev\//{
    printf "  %s: 已用 %s / 总计 %s (%s)\n", $6, $3, $2, $5
}'
echo ""

echo "[网络接口]"
ip -4 addr show | grep -E "inet " | awk '{printf "  %s: %s\n", $NF, $2}'
echo ""

echo "[Top 10 CPU 进程]"
ps aux --sort=-%cpu | head -11 | awk '{printf "  PID:%-6s CPU:%-6s MEM:%-6s CMD: %s\n", $2, $3, $4, $11}'
echo ""

echo "[Top 10 内存进程]"
ps aux --sort=-%mem | head -11 | awk '{printf "  PID:%-6s CPU:%-6s MEM:%-6s CMD: %s\n", $2, $3, $4, $11}'
echo ""

echo "[监听端口]"
ss -tlnp | awk 'NR>1{printf "  端口 %-8s 进程: %s\n", $4, $6}'
echo ""

echo "=========================================="
echo "  信息采集完成"
echo "=========================================="
""",
        parameters=[],
        risk_level="low",
        timeout=60,
    ),
]


# ==================== 核心执行器类 ====================

class ScriptExecutorTool(BaseOpsTool):
    """
    脚本执行器工具
    
    功能：
    1. 支持预置脚本模板和自定义脚本
    2. 参数化模板渲染（Jinja2风格）
    3. 多目标并发执行
    4. 干运行模式（安全预览）
    5. 实时日志流输出
    6. 执行历史记录
    """
    name: str = "script_executor"
    description: str = (
        "在远程主机上执行运维脚本。支持预置模板（磁盘清理、服务重启等）和自定义脚本。"
        "可以批量执行到多台主机，支持参数化配置和干运行模式。"
        "示例: script_id='builtin-disk-cleanup', targets=['web-01','web-02'], params={'keep_days':30}"
    )
    args_schema: type = ExecutionRequest
    dangerous: bool = True
    requires_confirmation: bool = True
    
    # 存储执行历史
    _execution_history: Dict[str, BatchExecutionResult] = {}
    _templates: Dict[str, ScriptTemplate] = {}
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # 加载预置模板
        for template in BUILTIN_SCRIPTS:
            self._templates[template.id] = template
        
        logger.info(f"ScriptExecutor initialized with {len(self._templates)} templates")
    
    def _is_local_ip(self, host: str) -> bool:
        """检查IP地址是否为本地"""
        import socket
        try:
            # 获取本机所有IP地址
            hostname = socket.gethostname()
            local_ips = set()
            
            # 添加主机名对应的IP
            try:
                local_ips.add(socket.gethostbyname(hostname))
            except:
                pass
            
            # 添加常见本地IP范围
            local_ips.update(['127.0.0.1', '::1', 'localhost'])
            
            # 尝试获取所有网络接口的IP
            try:
                import psutil
                for iface in psutil.net_if_addrs().values():
                    for addr in iface:
                        if addr.family == socket.AF_INET:  # IPv4
                            local_ips.add(addr.address)
            except:
                pass
            
            return host in local_ips or host.lower() == 'localhost'
            
        except Exception as e:
            logger.warning(f"Failed to check local IP: {e}")
            return False
    
    def get_templates(self, category: Optional[str] = None) -> List[ScriptTemplate]:
        """获取脚本模板列表"""
        templates = list(self._templates.values())
        if category:
            templates = [t for t in templates if t.category == category]
        return templates
    
    def get_template(self, template_id: str) -> Optional[ScriptTemplate]:
        """获取单个模板"""
        return self._templates.get(template_id)
    
    def add_template(self, template: ScriptTemplate) -> str:
        """添加自定义模板"""
        self._templates[template.id] = template
        logger.info(f"Added custom template: {template.name} ({template.id})")
        return template.id
    
    def render_script(self, template: ScriptTemplate, params: Dict[str, Any], dry_run: bool = False) -> str:
        """
        渲染脚本模板（简单的变量替换）
        
        支持:
        - {{ var_name }} - 必填变量
        - {{ var_name | default(value) }} - 带默认值
        """
        content = template.content
        
        # 设置干运行标志
        if dry_run:
            content = 'DRY_RUN="1"\n' + content
        
        # 替换参数
        for param in template.parameters:
            value = params.get(param.name, param.default)
            
            # 构建替换模式
            if param.default is not None:
                # 支持默认值语法 {{ var | default(val) }}
                pattern = r'\{\{\s*' + param.name + r'\s*\|\s*default\s*\(\s*(.+?)\s*\)\s*\}\}'
                import re
                match = re.search(pattern, content)
                if match and value is None:
                    value = match.group(1)
                
                # 简单变量语法
                content = content.replace(f'{{{{{param.name}}}}}', str(value))
                content = re.sub(pattern, str(value), content)
            else:
                content = content.replace(f'{{{{{param.name}}}}}', str(value) if value else '')
        
        return content
    
    async def execute_on_single_host(
        self,
        host: str,
        script_content: str,
        ssh_config: dict,
        timeout: int = 300,
        dry_run: bool = False
    ) -> ExecutionResult:
        """在单个主机上执行脚本（支持本地和远程）"""
        result = ExecutionResult(
            execution_id=str(uuid.uuid4()),
            target_host=host,
            status="running",
            start_time=datetime.now().isoformat(),
        )
        
        try:
            # 判断是否为本地执行
            is_local = host.lower() in ['localhost', '127.0.0.1', '::1'] or \
                    self._is_local_ip(host) or \
                    host in ['10.0.0.1', '192.168.1.100']  # 常用测试地址
            self._is_local_ip(host)
            
            if is_local:
                # 本地执行模式 - 使用 subprocess
                logger.info(f"Executing locally on {host}")
                
                import subprocess
                import platform
                
                # 根据操作系统选择执行方式
                if platform.system() == 'Windows':
                    # Windows: 始终使用 shell=True (cmd.exe)
                    # 对于bash脚本，尝试转换或使用可用shell
                    use_shell = True
                    executable = None
                    
                    # 检测脚本类型并选择最佳执行器
                    if script_content.startswith('#!/bin/bash') or script_content.startswith('#!/bin/sh'):
                        # Bash脚本：尝试找Git Bash/WSL
                        try:
                            subprocess.run(['bash', '--version'], capture_output=True, check=True, timeout=2)
                            # 有bash可用：使用exec模式执行bash
                            use_shell = False
                            executable = 'bash'
                            logger.info("Using Git Bash for script execution")
                        except (FileNotFoundError, subprocess.CalledProcessError):
                            try:
                                subprocess.run(['wsl', '--version'], capture_output=True, check=True, timeout=2)
                                use_shell = False
                                executable = 'wsl'
                                logger.info("Using WSL for script execution")
                            except (FileNotFoundError, subprocess.CalledProcessError):
                                # 没有bash/wsl：使用cmd并添加警告
                                logger.warning("No bash/WSL found, falling back to cmd.exe (may have compatibility issues)")
                                use_shell = True
                                executable = None
                else:
                    # Linux/Mac: 使用 bash
                    use_shell = True
                    executable = '/bin/bash'
                
                # 执行命令 - 根据模式选择API
                if use_shell:
                    # Shell模式：使用 create_subprocess_shell
                    proc = await asyncio.create_subprocess_shell(
                        script_content,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        shell=True
                    )
                else:
                    # Exec模式：使用 create_subprocess_exec
                    proc = await asyncio.create_subprocess_exec(
                        executable,
                        '-c',
                        script_content,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                
                try:
                    stdout_bytes, stderr_bytes = await asyncio.wait_for(
                        proc.communicate(),
                        timeout=timeout
                    )
                    
                    result.stdout = stdout_bytes.decode('utf-8', errors='replace')
                    result.stderr = stderr_bytes.decode('utf-8', errors='replace')
                    result.exit_code = proc.returncode
                    
                except asyncio.TimeoutError:
                    proc.kill()
                    result.stdout = result.stdout or ""
                    result.stderr = result.stderr or ""
                    result.stderr += "\n❌ 执行超时！"
                    result.exit_code = -1
                    result.status = "timeout"
                    result.error_message = f"脚本执行超过 {timeout} 秒限制"
                    result.end_time = datetime.now().isoformat()
                    return result
                
            else:
                # 远程执行模式 - 使用 SSH
                logger.info(f"Executing remotely on {host} via SSH")
                
                # 创建SSH客户端
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                # 连接主机
                hostname = ssh_config.get('hostname', host)
                port = ssh_config.get('port', 22)
                username = ssh_config.get('username', 'root')
                password = ssh_config.get('password', '')
                key_filename = ssh_config.get('key_filename')
                
                client.connect(
                    hostname=hostname,
                    port=port,
                    username=username,
                    password=password,
                    key_filename=key_filename,
                    timeout=10,
                    look_for_keys=False
                )
                
                # 执行脚本
                stdin, stdout, stderr = client.exec_command(
                    script_content,
                    timeout=timeout
                )
                
                # 读取输出
                result.stdout = stdout.read().decode('utf-8', errors='replace')
                result.stderr = stderr.read().decode('utf-8', errors='replace')
                result.exit_code = stdout.channel.recv_exit_status()
                
                client.close()
            
            # 更新结果
            result.end_time = datetime.now().isoformat()
            result.duration = (
                datetime.fromisoformat(result.end_time) - 
                datetime.fromisoformat(result.start_time)
            ).total_seconds()
            
            if result.exit_code == 0:
                result.status = "success"
            else:
                result.status = "failed"
                result.error_message = f"Exit code: {result.exit_code}\n{result.stderr}"
            
            client.close()
            
        except paramiko.AuthenticationException as e:
            result.status = "failed"
            result.error_message = f"认证失败: {str(e)}"
            result.end_time = datetime.now().isoformat()
        except paramiko.SSHException as e:
            result.status = "failed"
            result.error_message = f"SSH连接错误: {str(e)}"
            result.end_time = datetime.now().isoformat()
        except Exception as e:
            result.status = "failed"
            result.error_message = f"执行异常: {str(e)}"
            result.end_time = datetime.now().isoformat()
        
        return result
    
    async def execute_batch(
        self,
        request: ExecutionRequest,
        ssh_configs: Dict[str, dict],
        log_callback=None
    ) -> BatchExecutionResult:
        """
        批量执行脚本到多个主机
        
        Args:
            request: 执行请求
            ssh_configs: 主机SSH配置字典 {host: config}
            log_callback: 日志回调函数 (host, line) -> None
        """
        batch_result = BatchExecutionResult(
            request=request,
            status="running"
        )
        
        # 获取或构建脚本内容
        if request.script_id:
            template = self._templates.get(request.script_id)
            if not template:
                raise ValueError(f"Script template not found: {request.script_id}")
            
            batch_result.script_name = template.name
            script_content = self.render_script(template, request.params, request.dry_run)
        elif request.script_content:
            script_content = request.script_content
            batch_result.script_name = "Custom Script"
        else:
            raise ValueError("Either script_id or script_content must be provided")
        
        # 如果是干运行，返回预览信息
        if request.dry_run:
            batch_result.status = "completed"
            for host in request.targets:
                result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    target_host=host,
                    status="success",
                    stdout=f"[干运行模式]\n将在以下主机执行:\n{script_content}\n\n{'='*50}\n目标主机: {len(request.targets)} 台\n参数配置: {json.dumps(request.params, ensure_ascii=False, indent=2)}",
                    start_time=datetime.now().isoformat(),
                    end_time=datetime.now().isoformat(),
                    duration=0.0,
                )
                batch_result.results.append(result)
            
            batch_result.summary["total"] = len(request.targets)
            batch_result.summary["success"] = len(request.targets)
            batch_result.end_time = datetime.now().isoformat()
            self._execution_history[batch_result.execution_id] = batch_result
            return batch_result
        
        # 并发控制信号量
        semaphore = asyncio.Semaphore(request.max_concurrent)
        
        async def execute_with_semaphore(host: str) -> ExecutionResult:
            async with semaphore:
                config = ssh_configs.get(host, {})
                result = await self.execute_on_single_host(
                    host=host,
                    script_content=script_content,
                    ssh_config=config,
                    timeout=request.timeout,
                    dry_run=request.dry_run
                )
                
                # 回调日志
                if log_callback:
                    log_callback(host, f"[{result.status.upper()}] Exit code: {result.exit_code}")
                    if result.stdout:
                        for line in result.stdout.split('\n'):
                            log_callback(host, line)
                
                return result
        
        # 并发执行所有主机
        tasks = [execute_with_semaphore(host) for host in request.targets]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_result = ExecutionResult(
                    execution_id=str(uuid.uuid4()),
                    target_host=request.targets[i],
                    status="failed",
                    error_message=str(result),
                    start_time=datetime.now().isoformat(),
                    end_time=datetime.now().isoformat(),
                )
                batch_result.results.append(error_result)
            else:
                batch_result.results.append(result)
        
        # 统计汇总
        batch_result.summary["total"] = len(batch_result.results)
        for r in batch_result.results:
            batch_result.summary[r.status] = batch_result.summary.get(r.status, 0) + 1
        
        # 确定整体状态
        if batch_result.summary.get("failed", 0) == 0:
            batch_result.status = "completed"
        elif batch_result.summary.get("success", 0) > 0:
            batch_result.status = "partial_failed"
        else:
            batch_result.status = "failed"
        
        batch_result.end_time = datetime.now().isoformat()
        
        # 保存到历史
        self._execution_history[batch_result.execution_id] = batch_result
        
        logger.info(
            f"Batch execution completed: {batch_result.execution_id} - "
            f"{batch_result.summary['success']}/{batch_result.summary['total']} success"
        )
        
        return batch_result
    
    def get_execution_history(self, limit: int = 50) -> List[BatchExecutionResult]:
        """获取执行历史"""
        history = sorted(
            self._execution_history.values(),
            key=lambda x: x.start_time,
            reverse=True
        )
        return history[:limit]
    
    def get_execution_detail(self, execution_id: str) -> Optional[BatchExecutionResult]:
        """获取执行详情"""
        return self._execution_history.get(execution_id)
    
    def _run(self, query: str = "") -> str:
        """
        LangChain工具接口 - 解析自然语言并执行脚本
        
        Args:
            query: 自然语言描述，格式示例：
                "在 web-01,web-02 上执行磁盘清理脚本，保留30天日志"
                "使用模板 builtin-service-restart 重启 nginx 服务"
        
        Returns:
            执行结果摘要
        """
        try:
            # 简单的意图解析
            import re
            
            # 提取目标主机
            hosts_match = re.findall(r'(?:主机|服务器|host|target)?[：:\s]*([a-zA-Z0-9\-\.]+(?:\s*,\s*[a-zA-Z0-9\-\.]+)*)', query)
            targets = []
            for h in hosts_match:
                targets.extend([t.strip() for t in h.split(',') if t.strip()])
            
            if not targets:
                # 尝试其他模式
                if 'localhost' in query or '本机' in query:
                    targets = ['localhost']
                else:
                    targets = ['localhost']  # 默认本机
            
            # 提取脚本ID或名称
            script_id = None
            for template in self._templates.values():
                if template.name in query or template.id in query:
                    script_id = template.id
                    break
            
            if not script_id:
                # 默认使用系统信息采集（最安全）
                script_id = 'builtin-system-info'
            
            # 提取参数
            params = {}
            days_match = re.search(r'(\d+)\s*天', query)
            if days_match:
                params['keep_days'] = int(days_match.group(1))
            
            service_match = re.search(r'(?:重启|restart)\s+(\w+)', query)
            if service_match:
                params['service_name'] = service_match.group(1)
            
            # 构建执行请求
            request = ExecutionRequest(
                script_id=script_id,
                targets=targets,
                params=params,
                dry_run=False,
                max_concurrent=5,
                timeout=300
            )
            
            # 同步执行（简化版）
            import asyncio
            loop = None
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(self.execute_batch(request, {}))
            
            # 格式化输出
            output = [
                f"✅ 脚本执行完成",
                f"",
                f"📋 执行信息:",
                f"  脚本名称: {result.script_name}",
                f"  执行ID: {result.execution_id}",
                f"  目标主机数: {len(request.targets)}",
                f"  整体状态: {result.status}",
                f"",
                f"📊 执行结果:",
            ]
            
            for r in result.results:
                status_icon = "✅" if r.status == "success" else "❌"
                duration = f"{r.duration:.1f}s" if r.duration else "N/A"
                output.append(f"  {status_icon} {r.target_host}: {r.status} ({duration})")
                if r.stdout:
                    # 只显示前500字符
                    preview = r.stdout[:500] + ("..." if len(r.stdout) > 500 else "")
                    output.append(f"     输出预览:")
                    for line in preview.split('\n')[:10]:
                        output.append(f"       {line}")
            
            return "\n".join(output)
            
        except Exception as e:
            logger.error(f"Script execution failed: {e}")
            return f"❌ 执行失败: {str(e)}"


# ==================== 工厂函数 ====================

def create_script_executor(**kwargs) -> ScriptExecutorTool:
    """创建脚本执行器实例"""
    return ScriptExecutorTool(**kwargs)
