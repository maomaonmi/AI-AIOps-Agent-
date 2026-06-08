import React, { useState } from 'react';
import { 
  HardDrive, Trash2, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, Server, Shield, ChevronDown, ChevronUp,
  Info, Clock, Zap, TrendingDown, Lightbulb,
  ArrowRight, Loader2, CheckCheck, Circle, AlertCircle, CheckCircle2, Link2
} from 'lucide-react';

interface CleanupItem {
  id: string;
  name: string;
  size: number;
  size_formatted: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
  default_checked: boolean;
}

interface DiskUsage {
  disk: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  usage_percent: number;
}

interface ServiceStatus {
  name: string;
  display_name: string;
  status: string;
  can_stop: boolean;
  exists: boolean;
}

interface VulnerabilitySolution {
  id: string;
  name: string;
  description: string;
  risk: string;
  estimated_time: string;
  confidence: number;
}

interface ExecutionResult {
  status: string;
  operation_type?: string;
  results?: Array<{
    item: string;
    freed: number;
    freed_formatted: string;
    success: boolean;
  }>;
  details?: Array<{
    name: string;
    message: string;
    success: boolean;
    size?: string;
  }>;
  total_freed?: number;
  total_freed_formatted?: string;
  message?: string;
}

interface AIOperationData {
  intent: string;
  operation_id: string;
  title: string;
  description: string;
  requires_confirmation: boolean;
  disk_usage?: DiskUsage;
  cleanup_items?: CleanupItem[];
  total_size_formatted?: string;
  risk_warning?: string;
  action?: string;
  service_name?: string;
  service_status?: ServiceStatus;
  impact_warning?: string;
  solutions?: VulnerabilitySolution[];
  analysis?: AnalysisSuggestion[];
  services?: Array<{
    name: string;
    display_name: string;
    status: string;
    can_restart: boolean;
    start_type?: string;
  }>;
  service_info?: {
    name: string;
    display_name: string;
    description: string;
    purpose: string;
    current_status: string;
    pid?: number | null;
    memory_usage?: number;
    uptime?: string;
  };
  operation_analysis?: {
    requested_action: string;
    can_execute: boolean;
    estimated_duration: string;
    expected_effects: string[];
    user_experience: string;
  };
  risk_assessment?: Array<{
    level: 'danger' | 'warning' | 'info' | 'safe';
    text: string;
  }>;
  ai_suggestions?: Array<{
    type: string;
    icon: string;
    title: string;
    content: string;
  }>;
  dependencies?: string[];
  affected_apps?: string[];
}

interface AnalysisSuggestion {
  type: 'warning' | 'info' | 'tip' | 'recommendation';
  icon: React.ReactNode;
  title: string;
  content: string;
}

interface AIOperationCardProps {
  operation: AIOperationData;
  onConfirm: (operationId: string, operationType: string, confirmedItems: string[]) => Promise<ExecutionResult | void>;
  onCancel: () => void;
  isExecuting?: boolean;
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'low':
    case 'very_low':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'high':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const generateDiskAnalysis = (diskUsage: DiskUsage, cleanupItems: CleanupItem[]): AnalysisSuggestion[] => {
  const suggestions: AnalysisSuggestion[] = [];
  
  if (diskUsage.usage_percent > 90) {
    suggestions.push({
      type: 'warning',
      icon: <AlertTriangle size={16} className="text-red-500" />,
      title: '磁盘空间严重不足',
      content: `当前 ${diskUsage.disk} 盘使用率已达 ${diskUsage.usage_percent}%，仅剩 ${diskUsage.free_gb} GB。建议立即清理以避免系统运行异常。`
    });
  } else if (diskUsage.usage_percent > 75) {
    suggestions.push({
      type: 'warning',
      icon: <AlertTriangle size={16} className="text-yellow-500" />,
      title: '磁盘空间偏高',
      content: `当前 ${diskUsage.disk} 盘使用率为 ${diskUsage.usage_percent}%，剩余 ${diskUsage.free_gb} GB。建议定期清理保持系统流畅。`
    });
  }

  const largeItems = cleanupItems.filter(item => item.size > 1024 * 1024 * 100);
  if (largeItems.length > 0) {
    suggestions.push({
      type: 'recommendation',
      icon: <Lightbulb size={16} className="text-blue-500" />,
      title: '大体积项目推荐清理',
      content: `以下项目占用较多空间：${largeItems.map(i => `${i.name}(${i.size_formatted})`).join('、')}。优先清理这些可快速释放空间。`
    });
  }

  suggestions.push({
    type: 'info',
    icon: <Info size={16} className="text-gray-500" />,
    title: '清理频率建议',
    content: '建议每周进行一次磁盘清理，浏览器缓存和临时文件会持续增长。Windows更新缓存可在系统更新完成后安全清理。'
  });

  suggestions.push({
    type: 'tip',
    icon: <TrendingDown size={16} className="text-green-500" />,
    title: '额外释放空间技巧',
    content: '可考虑：1) 卸载不常用程序 2) 运行"磁盘清理"工具 3) 启用存储感知功能自动清理'
  });

  return suggestions;
};

export const DiskCleanupCard: React.FC<{
  diskUsage: DiskUsage;
  cleanupItems: CleanupItem[];
  totalSizeFormatted: string;
  riskWarning?: string;
  onConfirm: (items: string[]) => Promise<ExecutionResult | void>;
  onCancel: () => void;
}> = ({ diskUsage, cleanupItems, totalSizeFormatted, riskWarning, onConfirm, onCancel }) => {
  const [selectedItems, setSelectedItems] = useState<string[]>(
    cleanupItems.filter(item => item.default_checked).map(item => item.id)
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectedSize = cleanupItems
    .filter(item => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + item.size, 0);

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      const result = await onConfirm(selectedItems);
      setExecutionResult(result as ExecutionResult);
    } catch (error) {
      setExecutionResult({ status: 'error', message: '操作执行失败' });
    } finally {
      setIsExecuting(false);
    }
  };

  const analysisSuggestions = generateDiskAnalysis(diskUsage, cleanupItems);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden my-3">
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Trash2 size={20} />
          <span className="font-semibold">磁盘清理建议</span>
        </div>
      </div>
      
      <div className="p-4">
        {!executionResult ? (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{diskUsage.disk}盘使用情况</span>
                <span className={`text-sm font-bold ${diskUsage.usage_percent > 90 ? 'text-red-600' : diskUsage.usage_percent > 75 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {diskUsage.usage_percent}% 已使用
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    diskUsage.usage_percent > 90 ? 'bg-red-500' : 
                    diskUsage.usage_percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(diskUsage.usage_percent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>已用: {diskUsage.used_gb} GB</span>
                <span>剩余: {diskUsage.free_gb} GB</span>
                <span>总计: {diskUsage.total_gb} GB</span>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">可清理项目</span>
              <span className="text-sm font-bold text-blue-600">
                预计释放: {formatSize(selectedSize)}
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {cleanupItems.map(item => (
                <div 
                  key={item.id}
                  className={`border rounded-lg p-3 transition-all ${
                    selectedItems.includes(item.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-sm text-gray-600 ml-2 shrink-0">{item.size_formatted}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskColor(item.risk)}`}>
                          {item.risk === 'low' ? '低风险' : item.risk === 'medium' ? '中风险' : '高风险'}
                        </span>
                        <span className="text-xs text-gray-500 truncate">{item.description}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showAnalysis && (
              <div className="mb-4 space-y-3">
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Lightbulb size={16} />
                  AI 分析与建议
                  {showAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                
                <div className="space-y-2 pl-6">
                  {analysisSuggestions.map((suggestion, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${
                      suggestion.type === 'warning' ? 'bg-red-50 border-red-200' :
                      suggestion.type === 'recommendation' ? 'bg-blue-50 border-blue-200' :
                      suggestion.type === 'tip' ? 'bg-green-50 border-green-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">{suggestion.icon}</span>
                        <div>
                          <div className={`font-medium text-sm ${
                            suggestion.type === 'warning' ? 'text-red-800' :
                            suggestion.type === 'recommendation' ? 'text-blue-800' :
                            suggestion.type === 'tip' ? 'text-green-800' : 'text-gray-800'
                          }`}>
                            {suggestion.title}
                          </div>
                          <div className={`text-xs mt-0.5 ${
                            suggestion.type === 'warning' ? 'text-red-600' :
                            suggestion.type === 'recommendation' ? 'text-blue-600' :
                            suggestion.type === 'tip' ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {suggestion.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {riskWarning && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 text-sm">
                  <AlertTriangle size={16} />
                  <span>{riskWarning}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={isExecuting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={isExecuting || selectedItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    清理中...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    确认执行
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="py-4">
            {executionResult.status === 'success' ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">清理完成</h3>
                <p className="text-gray-600 mb-4">{executionResult.message}</p>
                
                {executionResult.results && executionResult.results.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">清理详情：</h4>
                    <div className="space-y-1">
                      {executionResult.results.map((result, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600">{result.item}</span>
                          <span className={`${result.success ? 'text-green-600' : 'text-red-600'}`}>
                            {result.success ? `释放 ${result.freed_formatted}` : '失败'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                      <span>共释放</span>
                      <span className="text-green-600">{executionResult.total_freed_formatted}</span>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700"
                >
                  关闭
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">执行失败</h3>
                <p className="text-gray-600 mb-4">{executionResult.message || '未知错误'}</p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => { setExecutionResult(null); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    重试
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700"
                  >
                    关闭
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ServiceManageCard: React.FC<{
  action: string;
  serviceName: string;
  serviceStatus: ServiceStatus;
  impactWarning: string;
  onConfirm: () => Promise<ExecutionResult | void>;
  onCancel: () => void;
}> = ({ action, serviceName, serviceStatus, impactWarning, onConfirm, onCancel }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const actionText = {
    restart: '重启',
    start: '启动',
    stop: '停止',
    status: '查看状态'
  }[action] || action;

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      const result = await onConfirm();
      setExecutionResult(result as ExecutionResult);
    } catch (error) {
      setExecutionResult({ status: 'error', message: '操作执行失败' });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden my-3">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Server size={20} />
          <span className="font-semibold">服务操作确认</span>
        </div>
      </div>
      
      <div className="p-4">
        {!executionResult ? (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{serviceStatus.display_name || serviceName}</div>
                  <div className="text-sm text-gray-500">服务名称: {serviceName}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  serviceStatus.status === 'Running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {serviceStatus.status === 'Running' ? '运行中' : serviceStatus.status}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">操作内容:</div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-purple-500" />
                  <span className="font-medium text-purple-700">{actionText} {serviceName} 服务</span>
                </div>
              </div>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="text-yellow-500 mt-0.5" />
                <div>
                  <div className="font-medium text-yellow-700">操作影响</div>
                  <div className="text-sm text-yellow-600 mt-1">{impactWarning}</div>
                </div>
              </div>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={18} className="text-blue-500 mt-0.5" />
                <div>
                  <div className="font-medium text-blue-700">AI 建议</div>
                  <div className="text-sm text-blue-600 mt-1">
                    建议在业务低峰期执行此操作（如凌晨或周末），并提前通知相关用户。
                    执行前请确保已备份相关配置文件。
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={isExecuting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={isExecuting}
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'stop' ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                {isExecuting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    执行中...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    确认{actionText}
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            {executionResult.status === 'success' ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">操作成功</h3>
                <p className="text-gray-600 mb-4">{executionResult.message}</p>
                <button onClick={onCancel} className="px-4 py-2 text-gray-500 hover:text-gray-700">关闭</button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">操作失败</h3>
                <p className="text-gray-600 mb-4">{executionResult.message}</p>
                <div className="flex justify-center gap-2">
                  <button onClick={() => setExecutionResult(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">重试</button>
                  <button onClick={onCancel} className="px-4 py-2 text-gray-500 hover:text-gray-700">关闭</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const VulnerabilityFixCard: React.FC<{
  solutions: VulnerabilitySolution[];
  onConfirm: (solutionId: string) => Promise<ExecutionResult | void>;
  onCancel: () => void;
}> = ({ solutions, onConfirm, onCancel }) => {
  const [selectedSolution, setSelectedSolution] = useState<string>(solutions[0]?.id || '');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      const result = await onConfirm(selectedSolution);
      setExecutionResult(result as ExecutionResult);
    } catch (error) {
      setExecutionResult({ status: 'error', message: '操作执行失败' });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden my-3">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Shield size={20} />
          <span className="font-semibold">漏洞修复方案</span>
        </div>
      </div>
      
      <div className="p-4">
        {!executionResult ? (
          <>
            <div className="mb-3 text-sm text-gray-600">
              检测到安全风险，请选择修复方案：
            </div>

            <div className="space-y-3 mb-4">
              {solutions.map((solution, index) => (
                <div 
                  key={solution.id}
                  onClick={() => setSelectedSolution(solution.id)}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedSolution === solution.id 
                      ? 'border-orange-300 bg-orange-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="solution"
                      checked={selectedSolution === solution.id}
                      onChange={() => setSelectedSolution(solution.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">
                          {index === 0 && '⭐ '}
                          {solution.name}
                        </span>
                        <span className="text-sm text-orange-600 font-medium">
                          置信度: {(solution.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{solution.description}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-full border ${getRiskColor(solution.risk)}`}>
                          {solution.risk === 'very_low' ? '极低风险' : 
                           solution.risk === 'low' ? '低风险' : 
                           solution.risk === 'medium' ? '中风险' : '高风险'}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock size={12} />
                          {solution.estimated_time}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Lightbulb size={18} className="text-orange-500 mt-0.5" />
                <div>
                  <div className="font-medium text-orange-700">AI 安全建议</div>
                  <div className="text-sm text-orange-600 mt-1">
                    安全补丁应尽快安装，但建议先在测试环境验证。生产环境部署时，
                    请确保有回滚方案，并安排维护窗口时间。
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={isExecuting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={isExecuting || !selectedSolution}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    执行中...
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    执行修复
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            {executionResult.status === 'success' ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">修复成功</h3>
                <p className="text-gray-600 mb-4">{executionResult.message}</p>
                <button onClick={onCancel} className="px-4 py-2 text-gray-500 hover:text-gray-700">关闭</button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle size={32} className="text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">修复失败</h3>
                <p className="text-gray-600 mb-4">{executionResult.message}</p>
                <div className="flex justify-center gap-2">
                  <button onClick={() => setExecutionResult(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">重试</button>
                  <button onClick={onCancel} className="px-4 py-2 text-gray-500 hover:text-gray-700">关闭</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AIOperationCard: React.FC<AIOperationCardProps> = ({
  operation,
  onConfirm,
  onCancel,
}) => {
  if (operation.intent === 'disk_cleanup' && operation.cleanup_items && operation.disk_usage) {
    return (
      <DiskCleanupCard
        diskUsage={operation.disk_usage}
        cleanupItems={operation.cleanup_items}
        totalSizeFormatted={operation.total_size_formatted || ''}
        riskWarning={operation.risk_warning}
        onConfirm={(items) => onConfirm(operation.operation_id, 'disk_cleanup', items)}
        onCancel={onCancel}
      />
    );
  }

  if (operation.intent === 'service_manage' && operation.service_status) {
    return (
      <ServiceManageCard
        action={operation.action || ''}
        serviceName={operation.service_name || ''}
        serviceStatus={operation.service_status}
        impactWarning={operation.impact_warning || ''}
        onConfirm={() => onConfirm(operation.operation_id, 'service_manage', [operation.service_name || ''])}
        onCancel={onCancel}
      />
    );
  }

  if (operation.intent === 'vulnerability_fix' && operation.solutions) {
    return (
      <VulnerabilityFixCard
        solutions={operation.solutions}
        onConfirm={(solutionId) => onConfirm(operation.operation_id, 'vulnerability_fix', [solutionId])}
        onCancel={onCancel}
      />
    );
  }

  if (operation.intent === 'service_manage' && operation.services && !operation.service_status && !operation.ai_suggestions) {
    return (
      <ServiceListCard
        services={operation.services}
        action={operation.action || 'list'}
        description={operation.description}
        operationId={operation.operation_id}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }

  if (operation.intent === 'service_manage' && operation.ai_suggestions) {
    return (
      <ServiceDetailCard
        serviceInfo={operation.service_info!}
        operationAnalysis={operation.operation_analysis!}
        riskAssessment={operation.risk_assessment || []}
        aiSuggestions={operation.ai_suggestions}
        dependencies={operation.dependencies || []}
        affectedApps={operation.affected_apps || []}
        action={operation.action || ''}
        serviceName={operation.service_name || ''}
        requiresConfirmation={operation.requires_confirmation}
        onConfirm={() => onConfirm(operation.operation_id, `service_${operation.action}`, [operation.service_name || ''])}
        onCancel={onCancel}
      />
    );
  }

  return null;
};

export default AIOperationCard;

const ServiceDetailCard: React.FC<{
  serviceInfo: {
    name: string;
    display_name: string;
    description: string;
    purpose: string;
    current_status: string;
    pid?: number | null;
    memory_usage?: number;
    uptime?: string;
  };
  operationAnalysis: {
    requested_action: string;
    can_execute: boolean;
    estimated_duration: string;
    expected_effects: string[];
    user_experience: string;
  };
  riskAssessment: Array<{ level: 'danger' | 'warning' | 'info' | 'safe'; text: string }>;
  aiSuggestions: Array<{ type: string; icon: string; title: string; content: string }>;
  dependencies: string[];
  affectedApps: string[];
  action: string;
  serviceName: string;
  requiresConfirmation: boolean;
  onConfirm: () => Promise<ExecutionResult | void>;
  onCancel: () => void;
}> = ({ 
  serviceInfo, 
  operationAnalysis, 
  riskAssessment, 
  aiSuggestions,
  dependencies,
  affectedApps,
  action,
  requiresConfirmation,
  onConfirm,
  onCancel 
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const handleConfirm = async () => {
    if (!operationAnalysis.can_execute) return;
    setIsExecuting(true);
    try {
      const result = await onConfirm();
      setExecutionResult(result as ExecutionResult);
    } catch (error) {
      setExecutionResult({ status: 'error', message: '操作执行失败' });
    } finally {
      setIsExecuting(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'danger': return 'bg-red-100 border-red-300 text-red-800';
      case 'warning': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'info': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'safe': return 'bg-green-100 border-green-300 text-green-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'danger': return <AlertTriangle size={16} className="text-red-600" />;
      case 'warning': return <AlertCircle size={16} className="text-yellow-600" />;
      case 'info': return <Info size={16} className="text-blue-600" />;
      case 'safe': return <CheckCircle2 size={16} className="text-green-600" />;
      default: return <Info size={16} className="text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><Circle className="w-3 h-3 fill-green-500" /> 运行中</span>;
      case 'stopped':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><Circle className="w-3 h-3 fill-red-500" /> 已停止</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      'restart': '重启',
      'stop': '停止',
      'start': '启动',
      'status': '查看状态'
    };
    return actionMap[action] || action;
  };

  if (executionResult) {
    return (
      <div className="mt-4 rounded-xl border overflow-hidden shadow-lg">
        <div className={`px-5 py-4 ${executionResult.status === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
          <div className="flex items-center gap-3">
            {executionResult.status === 'success' ? <CheckCheck size={22} className="text-white" /> : <XCircle size={22} className="text-white" />}
            <h3 className="font-semibold text-white text-lg">{executionResult.status === 'success' ? '✅ 操作完成' : '❌ 操作失败'}</h3>
          </div>
        </div>
        <div className="p-5 bg-white">
          {executionResult.details && (
            <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
              {executionResult.details.map((detail, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 size={16} className={detail.success ? "text-green-500 flex-shrink-0" : "text-red-500 flex-shrink-0"} />
                  <span className="text-gray-700 font-medium">{detail.name}</span>
                  <span className="text-gray-500">{detail.message}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">{executionResult.message}</p>
          <div className="flex gap-3">
            {executionResult.status !== 'success' && (
              <button onClick={() => setExecutionResult(null)} className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-2 font-medium">
                <RefreshCw size={16} /> 重试
              </button>
            )}
            <button onClick={onCancel} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors font-medium">关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 px-5 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Server size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{serviceInfo.display_name}</h3>
              <p className="text-indigo-200 text-sm mt-0.5">AI 智能分析 · {getActionText(action)}操作</p>
            </div>
          </div>
          <div>{getStatusBadge(serviceInfo.current_status)}</div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</span>
            </div>
            <p className="text-xl font-bold text-gray-800 capitalize">{getActionText(action)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-blue-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">预计耗时</span>
            </div>
            <p className="text-xl font-bold text-gray-800">{operationAnalysis.estimated_duration}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Shield size={15} className="text-orange-500" />
            风险评估
          </h4>
          <div className="space-y-2">
            {riskAssessment.map((risk, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${getRiskColor(risk.level)}`}>
                {getRiskIcon(risk.level)}
                <span className="text-sm">{risk.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
          <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <Lightbulb size={15} />
            AI 智能分析
          </h4>
          <div className="space-y-3">
            {aiSuggestions.map((suggestion, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-lg flex-shrink-0 w-6 text-center">{suggestion.icon}</span>
                <div>
                  <p className="text-sm font-medium text-amber-900">{suggestion.title}</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{suggestion.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {(dependencies.length > 0 || affectedApps.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {dependencies.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Link2 size={12} /> 依赖服务
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {dependencies.slice(0, 4).map((dep, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{dep}</span>
                  ))}
                  {dependencies.length > 4 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs">+{dependencies.length - 4}</span>
                  )}
                </div>
              </div>
            )}
            {affectedApps.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-orange-400" /> 关联应用
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {affectedApps.slice(0, 4).map((app, i) => (
                    <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium">{app}</span>
                  ))}
                  {affectedApps.length > 4 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs">+{affectedApps.length - 4}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">用户体验影响</h4>
          <p className="text-sm text-gray-700">{operationAnalysis.user_experience}</p>
        </div>

        {requiresConfirmation && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={!operationAnalysis.can_execute || isExecuting}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  !operationAnalysis.can_execute
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : isExecuting
                    ? 'bg-indigo-400 text-white cursor-wait'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-md'
                }`}
              >
                {isExecuting ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> 执行中...</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Zap size={18} /> 确认{getActionText(action)}</span>
                )}
              </button>
              <button onClick={onCancel} className="px-8 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ServiceListCard: React.FC<{
  services: Array<{ name: string; display_name: string; status: string; can_restart: boolean; start_type?: string }>;
  action: string;
  description: string;
  onConfirm?: (operationId: string, operationType: string, confirmedItems: string[]) => Promise<ExecutionResult | void>;
  operationId?: string;
  onCancel: () => void;
}> = ({ services, action, description, onConfirm, operationId, onCancel }) => {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [operationAction, setOperationAction] = useState<'restart' | 'stop' | 'start'>('restart');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [serviceAnalyses, setServiceAnalyses] = useState<Record<string, any>>({});
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<string | null>(null);

  const filteredServices = services.filter(s => {
    const matchSearch = !searchTerm || 
      s.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const fetchServiceAnalysis = async (serviceName: string) => {
    if (serviceAnalyses[serviceName]) return;
    
    setIsLoadingAnalysis(serviceName);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `查看 ${serviceName} 服务详情` })
      });
      const data = await response.json();
      if (data.service_info) {
        setServiceAnalyses(prev => ({ ...prev, [serviceName]: data }));
      }
    } catch (error) {
      console.error('Failed to fetch service analysis:', error);
    } finally {
      setIsLoadingAnalysis(null);
    }
  };

  const toggleService = (serviceName: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceName) 
        ? prev.filter(n => n !== serviceName)
        : [...prev, serviceName]
    );
    
    if (!selectedServices.includes(serviceName)) {
      fetchServiceAnalysis(serviceName);
    }
  };

  const selectAllVisible = () => {
    const visibleNames = filteredServices.map(s => s.name);
    setSelectedServices(prev => {
      const newSet = new Set([...prev, ...visibleNames]);
      return Array.from(newSet);
    });
    visibleNames.forEach(name => fetchServiceAnalysis(name));
  };

  const clearSelection = () => setSelectedServices([]);

  const handleConfirm = async () => {
    if (!onConfirm || selectedServices.length === 0) return;
    setIsExecuting(true);
    try {
      const result = await onConfirm(operationId || '', `service_${operationAction}`, selectedServices);
      setExecutionResult(result as ExecutionResult);
    } catch (error) {
      setExecutionResult({ status: 'error', message: '操作执行失败' });
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Circle className="w-3 h-3 fill-green-500 text-green-500" />;
      case 'stopped':
        return <Circle className="w-3 h-3 fill-red-500 text-red-500" />;
      default:
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '运行中';
      case 'stopped': return '已停止';
      default: return status;
    }
  };

  const runningCount = services.filter(s => s.status === 'running').length;
  const stoppedCount = services.filter(s => s.status === 'stopped').length;

  if (executionResult) {
    return (
      <div className="mt-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        <div className={`px-4 py-3 ${executionResult.status === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
          <div className="flex items-center gap-2">
            {executionResult.status === 'success' ? <CheckCheck size={18} className="text-white" /> : <XCircle size={18} className="text-white" />}
            <h3 className="font-semibold text-white">{executionResult.status === 'success' ? '操作完成' : '操作失败'}</h3>
          </div>
        </div>
        <div className="p-4">
          {executionResult.details && (
            <div className="space-y-2 mb-4">
              {executionResult.details.map((detail, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={14} className={detail.success ? "text-green-500" : "text-red-500"} />
                  <span className="text-gray-700">{detail.name}: {detail.message}</span>
                  {detail.size && <span className="text-gray-400">({detail.size})</span>}
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-gray-600 mb-4">{executionResult.message}</p>
          <div className="flex gap-2">
            {executionResult.status !== 'success' && (
              <button onClick={() => { setExecutionResult(null); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-1">
                <RefreshCw size={14} /> 重试
              </button>
            )}
            <button onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">关闭</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-white" />
            <h3 className="font-semibold text-white">服务管理</h3>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full text-white">共 {services.length} 个</span>
        </div>
        <p className="text-sm text-blue-100 mt-1">{description} · 可勾选多个服务进行批量操作</p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setStatusFilter('all')}>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-gray-800">{services.length}</span>
              <Server size={16} className="text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 mt-1">全部服务</p>
            {statusFilter === 'all' && <div className="mt-1 h-0.5 bg-blue-500 rounded" />}
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-green-100 cursor-pointer hover:border-green-300 transition-colors" onClick={() => setStatusFilter('running')}>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-green-600">{runningCount}</span>
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">运行中</p>
            {statusFilter === 'running' && <div className="mt-1 h-0.5 bg-green-500 rounded" />}
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm border border-red-100 cursor-pointer hover:border-red-300 transition-colors" onClick={() => setStatusFilter('stopped')}>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-red-600">{stoppedCount}</span>
              <XCircle size={16} className="text-red-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">已停止</p>
            {statusFilter === 'stopped' && <div className="mt-1 h-0.5 bg-red-500 rounded" />}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="搜索服务名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button onClick={selectAllVisible} className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">全选</button>
          <button onClick={clearSelection} className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">清空</button>
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
          {filteredServices.map((service) => (
            <label key={service.name} className={`flex items-center gap-3 p-2.5 hover:bg-blue-50/50 cursor-pointer transition-colors ${selectedServices.includes(service.name) ? 'bg-blue-50' : ''}`}>
              <input
                type="checkbox"
                checked={selectedServices.includes(service.name)}
                onChange={() => toggleService(service.name)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {getStatusIcon(service.status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-800 truncate">{service.display_name}</p>
                <p className="text-xs text-gray-400 truncate">{service.name}{service.start_type && ` · ${service.start_type}`}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                service.status === 'running' 
                  ? 'bg-green-100 text-green-700' 
                  : service.status === 'stopped'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {getStatusText(service.status)}
              </span>
            </label>
          ))}
          {filteredServices.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">没有找到匹配的服务</div>
          )}
        </div>

        {selectedServices.length > 0 && (
          <>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-blue-700">已选择 <strong>{selectedServices.length}</strong> 个服务</span>
                <select 
                  value={operationAction}
                  onChange={(e) => setOperationAction(e.target.value as any)}
                  className="px-3 py-1.5 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="restart">重启</option>
                  <option value="stop">停止</option>
                  <option value="start">启动</option>
                </select>
              </div>
              <button
                onClick={handleConfirm}
                disabled={isExecuting}
                className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExecuting ? <><Loader2 size={16} className="animate-spin" /> 执行中...</> : <>确认{operationAction === 'restart' ? '重启' : operationAction === 'stop' ? '停止' : '启动'}所选服务</>}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-500" />
                选中服务的 AI 分析
              </h4>
              {selectedServices.map(serviceName => {
                const analysis = serviceAnalyses[serviceName];
                const service = services.find(s => s.name === serviceName);
                const loading = isLoadingAnalysis === serviceName;
                
                return (
                  <div key={serviceName} className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-indigo-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server size={14} className="text-indigo-600" />
                          <span className="font-medium text-sm text-gray-800">{service?.display_name || serviceName}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            service?.status === 'running' ? 'bg-green-100 text-green-700' : 
                            service?.status === 'stopped' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {service?.status === 'running' ? '运行中' : service?.status === 'stopped' ? '已停止' : service?.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      {loading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                          <Loader2 size={14} className="animate-spin" />
                          AI 正在分析此服务...
                        </div>
                      )}
                      
                      {!loading && !analysis && (
                        <p className="text-xs text-gray-400">暂无详细分析信息</p>
                      )}
                      
                      {!loading && analysis?.service_info && (
                        <div className="space-y-2.5">
                          <div className="flex gap-2">
                            <span className="text-sm">🔍</span>
                            <div>
                              <p className="text-xs font-medium text-gray-600">服务用途</p>
                              <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{analysis.service_info.description}</p>
                            </div>
                          </div>
                          
                          {analysis.operation_analysis && (
                            <div className="flex gap-2">
                              <span className="text-sm">⚡</span>
                              <div>
                                <p className="text-xs font-medium text-gray-600">{operationAction === 'restart' ? '重启影响' : operationAction === 'stop' ? '停止影响' : '启动影响'}</p>
                                <p className="text-xs text-gray-700 mt-0.5">{analysis.operation_analysis.user_experience}</p>
                                <p className="text-xs text-indigo-600 mt-0.5">预计耗时: {analysis.operation_analysis.estimated_duration}</p>
                              </div>
                            </div>
                          )}
                          
                          {analysis.risk_assessment && analysis.risk_assessment.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-sm">⚠️</span>
                              <div>
                                <p className="text-xs font-medium text-gray-600">风险评估</p>
                                {analysis.risk_assessment.map((risk: any, i: number) => (
                                  <p key={i} className={`text-xs mt-0.5 px-2 py-0.5 rounded inline-block mr-1 ${
                                    risk.level === 'danger' ? 'bg-red-100 text-red-700' :
                                    risk.level === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                    risk.level === 'safe' ? 'bg-green-100 text-green-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>{risk.text}</p>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {analysis.ai_suggestions && analysis.ai_suggestions.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-sm">💡</span>
                              <div>
                                <p className="text-xs font-medium text-gray-600">AI 建议</p>
                                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                                  {analysis.ai_suggestions.find((s: any) => s.type === 'advice')?.content || 
                                   analysis.ai_suggestions.find((s: any) => s.type === 'detail')?.content ||
                                   analysis.ai_suggestions[0]?.content}
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {analysis.affected_apps && analysis.affected_apps.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-sm">🔗</span>
                              <div>
                                <p className="text-xs font-medium text-gray-600">关联应用</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {analysis.affected_apps.slice(0, 5).map((app: string, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">{app}</span>
                                  ))}
                                  {analysis.affected_apps.length > 5 && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{analysis.affected_apps.length - 5}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex gap-2">
            <Lightbulb size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-yellow-700">
              <p className="font-medium mb-1">💡 AI 建议</p>
              <ul className="space-y-1 ml-2">
                <li>• 勾选需要操作的服务后，可选择<strong>重启/停止/启动</strong>操作</li>
                <li>• ⚠️ 系统关键服务请谨慎操作，建议先了解服务用途</li>
                <li>• 使用搜索框快速定位目标服务</li>
                <li>• 建议在业务低峰期进行服务重启操作</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
