import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  FileText,
  Settings,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  History,
  Shield,
  Zap,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// ==================== 类型定义 ====================

interface ScriptParameter {
  name: string;
  type: string;
  default: any;
  required: boolean;
  description: string;
  options?: string[];
}

interface ScriptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  content: string;
  parameters: ScriptParameter[];
  risk_level: string;
  timeout: number;
}

interface ExecutionResult {
  execution_id: string;
  target_host: string;
  status: string;
  exit_code?: number;
  stdout: string;
  stderr: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  error_message?: string;
}

interface ExecutionHistoryItem {
  execution_id: string;
  script_name: string;
  status: string;
  summary: Record<string, number>;
  start_time: string;
  end_time?: string;
  target_count: number;
}

// ==================== API 服务 ====================

const API_BASE = '/api/scripts';

async function fetchTemplates(category?: string): Promise<ScriptTemplate[]> {
  const url = category ? `${API_BASE}/templates?category=${category}` : `${API_BASE}/templates`;
  const res = await fetch(url);
  const data = await res.json();
  return data.templates || [];
}

async function executeScript(request: {
  script_id?: string;
  script_content?: string;
  targets: string[];
  params: Record<string, any>;
  dry_run: boolean;
  max_concurrent: number;
  timeout: number;
}) {
  console.log('🌐 [executeScript] Calling API:', `${API_BASE}/execute`);
  console.log('  - Request body:', request);
  
  try {
    const res = await fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    console.log('📡 [executeScript] Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ [executeScript] API Error:', res.status, errorText);
      throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
    }
    
    const data = await res.json();
    console.log('✅ [executeScript] Parsed response:', data);
    
    // 验证响应数据
    if (!data || !data.execution_id) {
      console.error('❌ [executeScript] Invalid response format:', data);
      throw new Error('服务器返回了无效的响应格式');
    }
    
    return data;
  } catch (error) {
    console.error('💥 [executeScript] Fetch error:', error);
    throw error; // 重新抛出以便上层处理
  }
}

async function fetchHistory(limit = 20): Promise<ExecutionHistoryItem[]> {
  const res = await fetch(`${API_BASE}/history?limit=${limit}`);
  const data = await res.json();
  return data.history || [];
}

// ==================== 子组件 ====================

function ScriptSelector({
  templates,
  selectedScript,
  onSelect,
}: {
  templates: ScriptTemplate[];
  selectedScript: ScriptTemplate | null;
  onSelect: (script: ScriptTemplate) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['system', 'monitoring']));

  // 按分类分组
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) acc[template.category] = [];
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ScriptTemplate[]>);

  const categoryLabels: Record<string, string> = {
    system: '🖥️ 系统维护',
    database: '🗄️ 数据库',
    network: '🌐 网络管理',
    monitoring: '📊 监控诊断',
    custom: '📝 自定义脚本',
  };

  const filteredGroups = Object.entries(groupedTemplates).reduce((acc, [cat, scripts]) => {
    const filtered = scripts.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {} as Record<string, ScriptTemplate[]>);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 搜索脚本模板..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 pl-10 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all text-sm"
        />
        <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
      </div>

      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {Object.keys(filteredGroups).length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">未找到匹配的脚本</p>
          </div>
        ) : (
          Object.entries(filteredGroups).map(([category, scripts]) => (
            <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white hover:from-violet-50 hover:to-white transition-all flex items-center justify-between text-left"
              >
                <span className="text-xs font-semibold text-gray-700">
                  {categoryLabels[category] || category}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                    {scripts.length}
                  </span>
                  {expandedCategories.has(category) ?
                    <ChevronDown size={14} className="text-gray-400" /> :
                    <ChevronRight size={14} className="text-gray-400" />
                  }
                </div>
              </button>

              {expandedCategories.has(category) && (
                <div className="border-t border-gray-100 p-2 space-y-1 bg-white/50">
                  {scripts.map(script => (
                    <button
                      key={script.id}
                      onClick={() => onSelect(script)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                        selectedScript?.id === script.id
                          ? 'bg-violet-50 border-2 border-violet-300 shadow-sm'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className={`font-medium text-sm ${
                          selectedScript?.id === script.id ? 'text-violet-700' : 'text-gray-800'
                        }`}>
                          {script.name}
                        </span>
                        <RiskBadge level={script.risk_level} />
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                        {script.description}
                      </p>
                      {script.parameters.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {script.parameters.slice(0, 3).map(p => (
                            <span
                              key={p.name}
                              className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                            >
                              {p.name}{p.required && '*'}
                            </span>
                          ))}
                          {script.parameters.length > 3 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                              +{script.parameters.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    low: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: '低风险' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', label: '中风险' },
    high: { color: 'text-red-600', bg: 'bg-red-50', label: '高风险' },
  };
  const c = config[level] || config.low;

  return (
    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

function ParameterForm({
  parameters,
  values,
  onChange,
}: {
  parameters: ScriptParameter[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}) {
  const updateValue = (name: string, value: any) => {
    onChange({ ...values, [name]: value });
  };

  if (parameters.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl">
        <Settings size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">此脚本无需配置参数</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parameters.map(param => (
        <div key={param.name}>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {param.name}
            {param.required && <span className="text-red-500 ml-0.5">*</span>}
            {param.description && (
              <span className="text-gray-400 font-normal ml-1">- {param.description}</span>
            )}
          </label>

          {param.type === 'select' && param.options ? (
            <select
              value={values[param.name] || param.default || ''}
              onChange={(e) => updateValue(param.name, e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm"
            >
              <option value="">请选择...</option>
              {param.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : param.type === 'boolean' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values[param.name] || param.default || false}
                onChange={(e) => updateValue(param.name, e.target.checked)}
                className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
              />
              <span className="text-sm text-gray-700">启用</span>
            </label>
          ) : param.type === 'number' ? (
            <input
              type="number"
              value={values[param.name] ?? param.default ?? ''}
              onChange={(e) => updateValue(param.name, Number(e.target.value))}
              placeholder={param.default !== undefined ? String(param.default) : `请输入${param.name}`}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm"
            />
          ) : (
            <input
              type="text"
              value={values[param.name] || param.default || ''}
              onChange={(e) => updateValue(param.name, e.target.value)}
              placeholder={param.default !== undefined ? String(param.default) : `请输入${param.name}`}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function TargetSelector({
  targets,
  onTargetsChange,
}: {
  targets: string[];
  onTargetsChange: (targets: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions] = useState([
    { host: 'localhost', label: '🖥️ 本机（推荐）', type: 'local' },
    { host: '127.0.0.1', label: '🔧 本地回环', type: 'local' },
    { host: '10.0.0.1', label: '🌐 内网测试', type: 'remote' },
    { host: '192.168.1.100', label: '🏠 局域网', type: 'remote' },
    { host: 'web-server-01', label: '🌍 Web服务器01', type: 'remote' },
    { host: 'web-server-02', label: '🌍 Web服务器02', type: 'remote' },
    { host: 'db-master', label: '🗄️ 数据库主库', type: 'remote' },
    { host: 'db-slave-01', label: '🗄️ 数据库从库01', type: 'remote' },
  ]);

  const addTarget = (host: string) => {
    const trimmed = host.trim();
    if (trimmed && !targets.includes(trimmed)) {
      onTargetsChange([...targets, trimmed]);
    }
    setInputValue('');
  };

  const removeTarget = (host: string) => {
    onTargetsChange(targets.filter(t => t !== host));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTarget(inputValue);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Server size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          type="text"
          placeholder="输入主机地址，按回车或逗号添加..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-sm"
        />
      </div>

      {/* 快捷添加 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span>💡 提示：</span>
          <span>选择"本机"可直接测试（无需SSH配置）</span>
        </div>
        
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map(({ host, label, type }) => (
            <button
              key={host}
              onClick={() => addTarget(host)}
              disabled={targets.includes(host)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                targets.includes(host)
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 cursor-default'
                  : type === 'local'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {targets.includes(host) && <CheckCircle2 size={10} className="inline mr-1" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 已选目标 */}
      {targets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              已选择 {targets.length} 台主机
            </span>
            <button
              onClick={() => onTargetsChange([])}
              className="text-[11px] text-red-500 hover:text-red-700"
            >
              清空全部
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {targets.map(host => (
              <span
                key={host}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700"
              >
                <Server size={12} />
                {host}
                <button
                  onClick={() => removeTarget(host)}
                  className="hover:bg-violet-200 rounded p-0.5 transition-colors"
                >
                  <XCircle size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionLogViewer({
  results,
  isExecuting,
}: {
  results: ExecutionResult[];
  isExecuting: boolean;
}) {
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [results, autoScroll]);

  if (results.length === 0 && !isExecuting) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
        <Terminal size={40} className="mb-3 opacity-30" />
        <p className="text-sm">执行结果将在这里显示</p>
        <p className="text-[11px] mt-1">选择脚本并点击执行按钮</p>
      </div>
    );
  }

  const displayResults = selectedHost
    ? results.filter(r => r.target_host === selectedHost)
    : results;

  return (
    <div className="h-full flex flex-col">
      {/* 主机选择标签栏 */}
      {results.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-gray-100">
          <button
            onClick={() => setSelectedHost(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              !selectedHost
                ? 'bg-violet-100 text-violet-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部 ({results.length})
          </button>
          {results.map(r => (
            <button
              key={r.execution_id}
              onClick={() => setSelectedHost(r.target_host)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedHost === r.target_host
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <StatusIcon status={r.status} size={12} />
              {r.target_host}
            </button>
          ))}
        </div>
      )}

      {/* 日志内容区域 */}
      <div
        ref={logRef}
        className="flex-1 overflow-auto bg-gray-900 rounded-xl p-4 font-mono text-xs leading-relaxed custom-scrollbar"
        style={{ maxHeight: 'calc(100vh - 450px)' }}
      >
        {isExecuting && displayResults.length === 0 && (
          <div className="flex items-center gap-2 text-green-400 animate-pulse">
            <Loader2 size={14} className="animate-spin" />
            正在连接目标主机...
          </div>
        )}

        {displayResults.map(result => (
          <div key={result.execution_id} className="mb-4">
            {/* 主机头部 */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <StatusIcon status={result.status} size={14} />
                <span className="text-gray-300 font-semibold">{result.target_host}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                {result.duration != null && (
                  <span>⏱ {Number(result.duration).toFixed(1)}s</span>
                )}
                {result.exit_code != null && (
                  <span>Exit: {result.exit_code}</span>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(result.stdout)}
                  className="hover:text-gray-300"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            {/* 标准输出 */}
            {result.stdout && (
              <pre className="text-green-400 whitespace-pre-wrap break-words mb-2">
                {result.stdout}
              </pre>
            )}

            {/* 错误输出 */}
            {result.stderr && (
              <pre className="text-red-400 whitespace-pre-wrap break-words mb-2">
                {result.stderr}
              </pre>
            )}

            {/* 错误信息 */}
            {result.error_message && (
              <pre className="text-yellow-400 whitespace-pre-wrap break-words">
                ⚠️ {result.error_message}
              </pre>
            )}

            {/* 执行状态 */}
            {result.status === 'running' && (
              <div className="flex items-center gap-2 text-blue-400 mt-2">
                <Loader2 size={12} className="animate-spin" />
                执行中...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-3 h-3 rounded"
          />
          自动滚动
        </label>
        <div className="text-[11px] text-gray-400">
          共 {displayResults.length} 条记录
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 size={size} className="text-emerald-500" />;
    case 'failed':
      return <XCircle size={size} className="text-red-500" />;
    case 'running':
      return <Loader2 size={size} className="text-blue-500 animate-spin" />;
    case 'timeout':
      return <Clock size={size} className="text-amber-500" />;
    default:
      return <Clock size={size} className="text-gray-400" />;
  }
}

function ExecutionHistoryPanel({
  history,
  onSelect,
  isLoading,
}: {
  history: ExecutionHistoryItem[];
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-violet-500" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <History size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无执行历史</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      {history.map(item => (
        <button
          key={item.execution_id}
          onClick={() => onSelect(item.execution_id)}
          className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <span className="font-medium text-sm text-gray-800">{item.script_name}</span>
            </div>
            <span className="text-[10px] text-gray-400">
              {new Date(item.start_time).toLocaleString()}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>🎯 {item.target_count} 台</span>
            <span>✅ {item.summary.success || 0}</span>
            <span>❌ {item.summary.failed || 0}</span>
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-violet-600">
              查看详情 →
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ==================== 主组件 ====================

export default function ScriptExecutor() {
  // 状态管理
  const [activeTab, setActiveTab] = useState<'execute' | 'history'>('execute');
  const [activeSection, setActiveSection] = useState<'script' | 'params' | 'targets' | 'options'>('script');
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptTemplate | null>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [targets, setTargets] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [timeout, setTimeout_val] = useState(300);  // 重命名避免与window.setTimeout冲突
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [executionId, setExecutionId] = useState<string | null>(null);
  
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showCustomScript, setShowCustomScript] = useState(false);
  const [customScriptContent, setCustomScriptContent] = useState('');
  
  // 全屏状态
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // ESC键退出全屏
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);
  
  // 全屏时禁用body滚动
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  // 加载脚本模板
  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(console.error);
  }, []);

  // 加载历史
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // 选择脚本时重置参数
  useEffect(() => {
    if (selectedScript) {
      const defaultParams: Record<string, any> = {};
      selectedScript.parameters.forEach(p => {
        if (p.default !== undefined) defaultParams[p.name] = p.default;
      });
      setParams(defaultParams);
      setShowCustomScript(false);
    }
  }, [selectedScript]);

  // 执行脚本
  const handleExecute = async () => {
    console.log('🚀 [ScriptExecutor] handleExecute called');
    console.log('  - selectedScript:', selectedScript?.name, selectedScript?.id);
    console.log('  - customScriptContent:', customScriptContent ? `${customScriptContent.length} chars` : 'empty');
    console.log('  - targets:', targets);
    console.log('  - params:', params);
    console.log('  - dryRun:', dryRun);
    
    if (!selectedScript && !customScriptContent) {
      console.warn('⚠️ [ScriptExecutor] No script selected!');
      alert('⚠️ 请先选择一个脚本模板或切换到"自定义脚本"模式');
      return;
    }
    if (targets.length === 0) {
      console.warn('⚠️ [ScriptExecutor] No targets selected!');
      alert('⚠️ 请至少选择一台目标主机（推荐点击"本机（推荐）"）');
      return;
    }

    console.log('✅ [ScriptExecutor] Validation passed, starting execution...');
    setIsExecuting(true);
    setExecutionResults([]);
    setExecutionId(null);

    try {
      const request = {
        script_id: showCustomScript ? undefined : selectedScript?.id,
        script_content: showCustomScript ? customScriptContent : undefined,
        targets,
        params,
        dry_run: dryRun,
        max_concurrent: maxConcurrent,
        timeout: timeout,
      };

      console.log('📤 [ScriptExecutor] Sending request:', request);
      
      const result = await executeScript(request);
      
      console.log('📥 [ScriptExecutor] Received response:', result);
      console.log('  - execution_id:', result.execution_id);
      console.log('  - overall_status:', result.overall_status);
      console.log('  - results count:', result.results?.length);
      
      setExecutionId(result.execution_id);
      setExecutionResults(result.results || []);
      
      // 如果成功，刷新历史
      if (activeTab === 'execute') {
        console.log('📜 [ScriptExecutor] Loading history...');
        setTimeout(loadHistory, 1000);
      }
      
      // 显示成功提示
      if (result.overall_status === 'completed' || result.overall_status === 'partial_failed') {
        const successCount = (result.summary?.success || 0);
        const totalCount = (result.summary?.total || 0);
        console.log(`✅ [ScriptExecutor] Execution completed: ${successCount}/${totalCount} success`);
      }
      
    } catch (error) {
      console.error('❌ [ScriptExecutor] Execution failed with error:', error);
      console.error('  - Error name:', error?.name);
      console.error('  - Error message:', error?.message);
      console.error('  - Error stack:', error?.stack);
      
      // 更友好的错误提示
      let errorMsg = '执行失败';
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMsg = '网络错误：无法连接到后端服务器\n请确保后端服务正在运行 (http://localhost:8000)';
      } else if (error instanceof SyntaxError) {
        errorMsg = '数据解析错误：服务器返回了无效的响应';
      } else if (error?.message) {
        errorMsg = `执行失败: ${error.message}`;
      }
      
      alert(`❌ ${errorMsg}\n\n请按 F12 打开开发者工具查看详细错误信息`);
    } finally {
      console.log('🏁 [ScriptExecutor] Execution finished, resetting state...');
      setIsExecuting(false);
    }
  };

  // 统计数据
  const stats = {
    total: executionResults.length,
    success: executionResults.filter(r => r.status === 'success').length,
    failed: executionResults.filter(r => r.status === 'failed').length,
    running: executionResults.filter(r => r.status === 'running').length,
  };

  // 顶部分类栏配置
  const sections = [
    { id: 'script' as const, icon: FileText, label: '脚本选择', count: selectedScript ? 1 : 0 },
    { id: 'params' as const, icon: Settings, label: '参数配置', count: Object.keys(params).length },
    { id: 'targets' as const, icon: Server, label: '目标主机', count: targets.length },
    { id: 'options' as const, icon: Shield, label: '执行选项', count: dryRun ? 1 : 0 },
  ];

  return (
    <div className={`h-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-violet-50 ${
      isFullscreen ? 'fixed inset-0 z-[9999] bg-white/98 backdrop-blur-sm' : ''
    }`}>
      {/* ==================== 顶部标题栏 ==================== */}
      <div className={`px-6 py-4 bg-white border-b border-gray-200 shadow-sm ${
        isFullscreen ? 'shadow-md' : ''
      }`}>
        <div className="flex items-center justify-between">
          {/* 左侧：标题 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <Terminal size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">脚本执行中心</h1>
              <p className="text-xs text-gray-500">自动化运维 · 批量操作 · 实时监控</p>
            </div>
          </div>
          
          {/* 右侧：操作按钮组 */}
          <div className="flex items-center gap-4">
            {/* 状态指示器 */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isExecuting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-xs font-medium text-gray-700">
                  {isExecuting ? '执行中' : '就绪'}
                </span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <span className="text-xs text-gray-600">
                模板: <strong className="text-violet-600">{templates.length}</strong>
              </span>
            </div>

            {/* 全屏按钮 */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group"
              title={isFullscreen ? "退出全屏 (ESC)" : "全屏显示"}
            >
              {isFullscreen ? (
                <Minimize2 size={18} className="text-gray-600 group-hover:text-violet-600" />
              ) : (
                <Maximize2 size={18} className="text-gray-600 group-hover:text-violet-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ==================== 主Tab切换 ==================== */}
      <div className="px-6 pt-4 pb-0 bg-gradient-to-b from-white to-transparent">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('execute')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'execute'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Zap size={15} />
            执行脚本
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <History size={15} />
            执行历史
          </button>
        </div>
      </div>

      {/* ==================== 内容区域 ==================== */}
      <div className="flex-1 overflow-hidden mt-4">
        {activeTab === 'execute' ? (
          /* ========== 执行模式：左右分栏 ========== */
          <div className="h-full grid grid-cols-12 gap-0">
            
            {/* ===== 左侧配置面板（8列）===== */}
            <div className="col-span-5 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
              
              {/* 顶部分类导航栏 */}
              <div className="flex border-b border-gray-200 px-2 pt-2">
                {sections.map(({ id, icon: Icon, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all relative ${
                      activeSection === id
                        ? 'border-violet-600 text-violet-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeSection === id ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 分类内容区 */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                
                {/* ---- 分类1: 脚本选择 ---- */}
                {activeSection === 'script' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* 脚本类型切换 */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                      <button
                        onClick={() => setShowCustomScript(false)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          !showCustomScript
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        📋 预置模板
                      </button>
                      <button
                        onClick={() => setShowCustomScript(true)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          showCustomScript
                            ? 'bg-white text-violet-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        ✏️ 自定义脚本
                      </button>
                    </div>

                    {!showCustomScript ? (
                      <ScriptSelector
                        templates={templates}
                        selectedScript={selectedScript}
                        onSelect={setSelectedScript}
                      />
                    ) : (
                      <div className="space-y-3">
                        <textarea
                          value={customScriptContent}
                          onChange={(e) => setCustomScriptContent(e.target.value)}
                          placeholder="# 在这里输入Shell脚本...&#10;&#10;#!/bin/bash&#10;echo 'Hello World'"
                          rows={10}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-mono text-sm resize-none"
                        />
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>支持 Bash/Python/Ansible</span>
                          <span>{customScriptContent.split('\n').length} 行</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ---- 分类2: 参数配置 ---- */}
                {activeSection === 'params' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {!selectedScript || showCustomScript ? (
                      <div className="text-center py-12 text-gray-400">
                        <Settings size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">请先选择一个预置模板</p>
                        <p className="text-xs mt-1">自定义脚本无需配置参数</p>
                      </div>
                    ) : selectedScript.parameters.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <CheckCircle2 size={48} className="mx-auto mb-3 opacity-30 text-emerald-400" />
                        <p className="text-sm text-emerald-600">该脚本无参数配置</p>
                        <p className="text-xs mt-1">可直接执行</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-700">{selectedScript.name}</span>
                          {selectedScript.parameters.some(p => p.required) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">
                              含必填项
                            </span>
                          )}
                        </div>
                        <ParameterForm
                          parameters={selectedScript.parameters}
                          values={params}
                          onChange={setParams}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* ---- 分类3: 目标主机 ---- */}
                {activeSection === 'targets' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <TargetSelector targets={targets} onTargetsChange={setTargets} />
                  </div>
                )}

                {/* ---- 分类4: 执行选项 ---- */}
                {activeSection === 'options' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    
                    {/* 干运行模式 */}
                    <label className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl cursor-pointer group hover:bg-gray-100 transition-colors">
                      <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        dryRun ? 'bg-amber-500 border-amber-500' : 'border-gray-300 group-hover:border-amber-400'
                      }`}>
                        {dryRun && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800">干运行模式</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            dryRun ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'
                          }`}>
                            {dryRun ? '已启用' : '已禁用'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">仅预览命令，不实际执行（推荐首次使用）</p>
                      </div>
                      <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="sr-only" />
                    </label>

                    {/* 并发控制 */}
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-gray-800 text-sm">最大并发数</label>
                        <span className="text-lg font-bold text-violet-600 bg-violet-100 px-3 py-1 rounded-lg">
                          {maxConcurrent}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={maxConcurrent}
                        onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                        className="w-full accent-violet-600 h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>串行 (1)</span>
                        <span>高并发 (20)</span>
                      </div>
                    </div>

                    {/* 超时设置 */}
                    <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <label className="font-semibold text-gray-800 text-sm">超时时间（秒）</label>
                      <div className="flex gap-2">
                        {[60, 300, 600, 1800].map(t => (
                          <button
                            key={t}
                            onClick={() => setTimeout_val(t)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                              timeout === t
                                ? 'bg-violet-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            {t >= 3600 ? `${t/3600}h` : `${t/60}m`}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={timeout}
                        onChange={(e) => setTimeout_val(Number(e.target.value))}
                        min={30}
                        max={3600}
                        step={30}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 底部固定执行按钮 */}
              <div className="p-5 border-t border-gray-200 bg-white">
                <button
                  onClick={() => {
                    console.log('🖱️ [ScriptExecutor] Button clicked!');
                    handleExecute();
                  }}
                  disabled={isExecuting || (!selectedScript && !customScriptContent) || targets.length === 0}
                  className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                    isExecuting || (!selectedScript && !customScriptContent) || targets.length === 0
                      ? 'bg-gray-200 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 hover:shadow-xl active:scale-[0.99] text-white'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      执行中...
                    </>
                  ) : dryRun ? (
                    <>
                      <Play size={22} />
                      预览执行（干运行）
                    </>
                  ) : (
                    <>
                      <Zap size={22} />
                      立即执行
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ===== 右侧结果面板（7列）===== */}
            <div className="col-span-7 flex flex-col bg-slate-50 overflow-hidden">
              
              {/* 结果头部统计 */}
              {(stats.total > 0 || isExecuting) && (
                <div className="grid grid-cols-4 gap-3 p-4 bg-white border-b border-gray-200">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">总计</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats.success}</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">成功</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                    <p className="text-[11px] text-red-600 mt-0.5">失败</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.running}</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">运行中</p>
                  </div>
                </div>
              )}

              {/* 日志查看器 */}
              <div className="flex-1 overflow-hidden">
                <ExecutionLogViewer
                  results={executionResults}
                  isExecuting={isExecuting}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ========== 历史记录模式 ========== */
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className={`${isFullscreen ? 'max-w-7xl mx-auto' : ''} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <History size={22} className="text-violet-600" />
                  </div>
                  执行历史记录
                </h2>
                <button
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                  className="px-4 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RotateCcw size={15} className={isLoadingHistory ? 'animate-spin' : ''} />
                  刷新
                </button>
              </div>

              <ExecutionHistoryPanel
                history={history}
                onSelect={(id) => console.log('View detail:', id)}
                isLoading={isLoadingHistory}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// useRef hook for functional component
import { useRef } from 'react';
