import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, 
  Upload, 
  Settings, 
  Play, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Loader2,
  Copy,
  RotateCcw,
  Target,
  ArrowLeft,
  Maximize2
} from 'lucide-react';

interface ServiceInfo {
  name: string;
  display_name: string;
  status: 'running' | 'stopped' | 'pending';
  pid?: number;
  start_type: string;
  description: string;
  group?: string;  // 服务组
  can_stop?: boolean;  // 是否可以停止
  can_restart?: boolean;  // 是否可以重启
}

interface OperationResult {
  target: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  start_time?: string;
  end_time?: string;
  duration?: number;
  output: string;
  error?: string;
}

interface OperationResponse {
  operation_id: string;
  operation_type: string;
  total_targets: number;
  results: OperationResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    running: number;
    skipped: number;
  };
  status: string;
  start_time: string;
  end_time?: string;
}

type OperationType = 'restart_service' | 'deploy_app' | 'update_config';
type StatusFilter = 'all' | 'running' | 'stopped';

const API_BASE = 'http://localhost:8000/api';

const BatchOperationEngine: React.FC<{ isFullscreen?: boolean; onToggleFullscreen?: () => void }> = ({ 
  isFullscreen = false, 
  onToggleFullscreen 
}) => {
  // ========== 状态管理 ==========
  const [activeTab, setActiveTab] = useState<'select' | 'options' | 'confirm' | 'progress'>('select');
  const [operationType, setOperationType] = useState<OperationType>('restart_service');
  
  // 服务列表
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // 执行选项
  const [maxConcurrent, setMaxConcurrent] = useState(5);
  const [retryCount, setRetryCount] = useState(2);
  const [timeout, setTimeout_val] = useState(30);
  const [canaryPercent, setCanaryPercent] = useState(20);
  const [canaryMode, setCanaryMode] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  
  // 部署选项
  const [deployType, setDeployType] = useState<'script' | 'docker' | 'git' | 'file'>('script');
  const [deployFolder, setDeployFolder] = useState('');
  const [deployScript, setDeployScript] = useState('');
  const [dockerImage, setDockerImage] = useState('');
  const [dockerPort, setDockerPort] = useState('8080');
  const [gitRepo, setGitRepo] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitPath, setGitPath] = useState('');
  const [fileSource, setFileSource] = useState('');
  const [fileTarget, setFileTarget] = useState('');
  
  // 确认状态
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // 执行状态
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<OperationResponse | null>(null);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ========== 操作类型配置 ==========
  const operationTypes = [
    {
      id: 'restart_service' as OperationType,
      icon: RefreshCw,
      label: '重启服务',
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      riskLevel: 'high' as const,
      description: '重启选中的系统服务'
    },
    {
      id: 'deploy_app' as OperationType,
      icon: Upload,
      label: '部署应用',
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      riskLevel: 'high' as const,
      description: '部署或更新应用程序'
    },
    {
      id: 'update_config' as OperationType,
      icon: Settings,
      label: '配置更新',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      borderColor: 'border-green-200',
      riskLevel: 'medium' as const,
      description: '更新系统或应用配置'
    }
  ];

  const currentOpConfig = operationTypes.find(op => op.id === operationType)!;

  // ========== 加载服务列表 ==========
  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status_filter', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      console.log(`📡 [BatchEngine] 加载服务列表...`);
      
      const response = await fetch(`${API_BASE}/system/services?${params.toString()}`);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      console.log(`✅ [BatchEngine] 获取到 ${data.total} 个服务 (平台: ${data.platform})`);
      
      setServices(data.services || []);
    } catch (err) {
      console.error('❌ [BatchEngine] 加载服务失败:', err);
      setError(`加载服务失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoadingServices(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // ========== 过滤后的服务列表 ==========
  const filteredServices = useMemo(() => {
    return services.filter(svc => {
      if (statusFilter !== 'all' && svc.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return svc.name.toLowerCase().includes(query) || 
               svc.display_name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [services, statusFilter, searchQuery]);

  // ========== 选择/取消选择 ==========
  const toggleTarget = (targetName: string) => {
    setSelectedTargets(prev => 
      prev.includes(targetName) 
        ? prev.filter(t => t !== targetName)
        : [...prev, targetName]
    );
  };

  const selectAll = () => setSelectedTargets(filteredServices.map(s => s.name));
  const clearAll = () => setSelectedTargets([]);
  const selectRunning = () => setSelectedTargets(filteredServices.filter(s => s.status === 'running').map(s => s.name));
  const selectStopped = () => setSelectedTargets(filteredServices.filter(s => s.status === 'stopped').map(s => s.name));

  // ========== 执行操作 ==========
  const executeOperation = async () => {
    if (!isConfirmed || selectedTargets.length === 0) return;
    
    setIsExecuting(true);
    setCurrentProgress(0);
    setExecutionResult(null);
    setError(null);
    
    try {
      console.log(`🚀 [BatchEngine] 开始执行 ${operationType}...`);
      console.log(`   - 目标数量: ${selectedTargets.length}`);
      console.log(`   - 目标列表:`, selectedTargets.slice(0, 5));
      
      const response = await fetch(`${API_BASE}/batch/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_type: operationType,
          targets: selectedTargets,
          params: operationType === 'deploy_app' ? {
            deploy_type: deployType,
            deploy_folder: deployFolder,
            deploy_script: deployScript,
            image: dockerImage,
            port: dockerPort,
            repo_url: gitRepo,
            branch: gitBranch,
            deploy_path: gitPath,
            source_path: fileSource,
            target_path: fileTarget
          } : {},
          options: {
            max_concurrent: maxConcurrent,
            retry_count: retryCount,
            timeout: timeout,
            canary_percent: canaryPercent,
            canary_mode: canaryMode && selectedTargets.length > 1,
            dry_run: dryRun
          },
          confirmed: true,
          confirmation_code: confirmationCode || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.detail?.error === 'CONFIRMATION_REQUIRED') {
          setShowConfirmDialog(true);
          return;
        }
        throw new Error(data.detail || `执行失败 (${response.status})`);
      }
      
      console.log(`✅ [BatchEngine] 操作完成 #${data.operation_id}:`);
      console.log(`   - 总体状态: ${data.status}`);
      console.log(`   - 成功: ${data.summary.success}, 失败: ${data.summary.failed}`);
      
      setExecutionResult(data);
      setActiveTab('progress');
      
    } catch (err) {
      console.error('❌ [BatchEngine] 执行失败:', err);
      setError(err instanceof Error ? err.message : '执行失败');
    } finally {
      setIsExecuting(false);
      setIsConfirmed(false);
      setConfirmationCode('');
    }
  };

  // ========== 进度计算 ==========
  useEffect(() => {
    if (executionResult && isExecuting) {
      const completed = executionResult.results.filter(r => 
        r.status === 'success' || r.status === 'failed' || r.status === 'skipped'
      ).length;
      const progress = Math.round((completed / executionResult.total_targets) * 100);
      setCurrentProgress(progress);
    }
  }, [executionResult, isExecuting]);

  // ========== 渲染：操作类型选择 ==========
  const renderOperationSelector = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Zap size={16} />
          操作类型
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {operationTypes.map(op => (
            <button
              key={op.id}
              onClick={() => {
                setOperationType(op.id);
                setSelectedTargets([]);
              }}
              className={`p-4 rounded-xl border-2 transition-all ${
                operationType === op.id
                  ? `${op.borderColor} ${op.bgColor} shadow-md scale-[1.02]`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <op.icon size={24} className={`mx-auto mb-2 ${operationType === op.id ? op.textColor : 'text-gray-400'}`} />
              <div className={`font-bold text-sm ${operationType === op.id ? op.textColor : 'text-gray-600'}`}>
                {op.label}
              </div>
              <div className={`text-xs mt-1 ${operationType === op.id ? op.textColor + '/70' : 'text-gray-400'}`}>
                {op.description}
              </div>
              {op.riskLevel === 'high' && (
                <div className={`flex items-center justify-center gap-1 mt-2 text-xs font-medium ${operationType === op.id ? 'text-red-600' : 'text-red-400'}`}>
                  <AlertTriangle size={12} />
                  高风险
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 风险提示 */}
      {currentOpConfig.riskLevel === 'high' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>⚠️ 高风险操作警告</strong>
              <p className="mt-1 text-red-600/80">
                {operationType === 'restart_service' && '重启服务可能导致短暂的服务中断，请确保已通知相关用户！'}
                {operationType === 'deploy_app' && '部署应用会替换现有版本，请确保备份已完成且测试通过！'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ========== 渲染：目标选择 ==========
  const renderTargetSelection = () => (
    <div className="space-y-4">
      {/* 部署应用：自定义目标输入 */}
      {operationType === 'deploy_app' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Target size={16} />
              部署目标
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  应用名称 / 项目标识
                </label>
                <input
                  type="text"
                  value={selectedTargets[0] || ''}
                  onChange={(e) => setSelectedTargets(e.target.value ? [e.target.value] : [])}
                  placeholder="例如: my-web-app, api-service, frontend-project"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  输入应用名称或项目标识，用于标识此次部署
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  部署文件夹路径
                </label>
                <input
                  type="text"
                  value={deployFolder}
                  onChange={(e) => setDeployFolder(e.target.value)}
                  placeholder="例如: D:\\projects\\my-app 或 /var/www/my-app"
                  className={`w-full px-3 py-2 rounded-lg border focus:ring-2 outline-none font-mono text-sm ${
                    deployFolder && !deployFolder.match(/^[a-zA-Z]:\\|^\//)
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50'
                      : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
                  }`}
                />
                {deployFolder && !deployFolder.match(/^[a-zA-Z]:\\|^\//) && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    路径格式不正确。Windows路径示例: D:\\folder\\project，Linux路径示例: /var/www/project
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  选择要部署的项目文件夹路径，所有部署操作将在此目录下执行
                </p>
              </div>
            </div>
          </div>
          
          {/* 已选择统计 */}
          <div className={`${currentOpConfig.bgColor} ${currentOpConfig.textColor} px-4 py-2 rounded-lg flex items-center justify-between`}>
            <span className="font-medium">
              📦 部署目标: <strong>{selectedTargets.length > 0 ? selectedTargets[0] : '未设置'}</strong>
            </span>
            {selectedTargets.length > 0 && (
              <button onClick={clearAll} className="text-sm underline opacity-70 hover:opacity-100">
                清空
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* 重启服务/配置更新：从服务列表选择 */}
      {operationType !== 'deploy_app' && (
        <>
          {/* 搜索和过滤 */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索服务名称..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 outline-none bg-white"
            >
              <option value="all">全部状态</option>
              <option value="running">运行中</option>
              <option value="stopped">已停止</option>
            </select>
            
            <button
              onClick={loadServices}
              disabled={loadingServices}
              className="px-4 py-2.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loadingServices ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* 快捷操作 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">快捷选择:</span>
            <button onClick={selectAll} className="px-3 py-1 bg-violet-50 text-violet-600 rounded-md hover:bg-violet-100 transition-colors">
              全部 ({filteredServices.length})
            </button>
            <button onClick={selectRunning} className="px-3 py-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors">
              运行中 ({filteredServices.filter(s => s.status === 'running').length})
            </button>
            <button onClick={selectStopped} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">
              已停止 ({filteredServices.filter(s => s.status === 'stopped').length})
            </button>
            <button onClick={clearAll} className="px-3 py-1 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
              清空
            </button>
          </div>

          {/* 已选择统计 */}
          <div className={`${currentOpConfig.bgColor} ${currentOpConfig.textColor} px-4 py-2 rounded-lg flex items-center justify-between`}>
            <span className="font-medium">
              📦 已选择 <strong>{selectedTargets.length}</strong> 个目标
            </span>
            {selectedTargets.length > 0 && (
              <button onClick={clearAll} className="text-sm underline opacity-70 hover:opacity-100">
                清空选择
              </button>
            )}
          </div>

          {/* 服务列表 - 任务管理器样式 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[450px] overflow-y-auto">
            {loadingServices ? (
              <div className="p-8 text-center text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                正在加载本机服务列表...
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Server size={32} className="mx-auto mb-2 opacity-50" />
                暂无匹配的服务
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-8"></th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 min-w-[200px]">名称</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-20">PID</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-24">状态</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">启动类型</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700">描述</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">组</th>
                  </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredServices.map(service => {
                const isSelected = selectedTargets.includes(service.name);
                return (
                  <tr
                    key={service.name}
                    onClick={() => toggleTarget(service.name)}
                    className={`cursor-pointer transition-colors ${
                      isSelected 
                        ? `${currentOpConfig.bgColor}` 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          service.status === 'running' ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-xs flex items-center gap-1">
                            {service.display_name}
                            {/* 显示可操作性标识 */}
                            {operationType === 'restart_service' && (
                              <>
                                {service.can_stop === false && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-bold" title="此服务受系统保护，无法重启">
                                    🔒 受保护
                                  </span>
                                )}
                                {service.can_stop === true && service.status === 'running' && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[9px] font-bold" title="此服务可以重启">
                                    ✓ 可重启
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">{service.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600">
                      {service.pid || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        service.status === 'running' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {service.status === 'running' ? '正在运行' : '已停止'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                        service.start_type === 'Automatic' 
                          ? 'bg-blue-50 text-blue-700' 
                          : service.start_type === 'Manual'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {service.start_type === 'Automatic' ? '自动' :
                         service.start_type === 'Manual' ? '手动' : 
                         service.start_type === 'Disabled' ? '禁用' : service.start_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[300px] truncate" title={service.description}>
                      {service.description || '-'}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-500 font-mono">
                      {service.group || 'LocalSystem'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )}
</div>
  );

  // ========== 渲染：执行选项 ==========
  const renderExecutionOptions = () => (
    <div className="space-y-6">
      {/* 并发控制 */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Zap size={14} />
            最大并发数
          </label>
          <input
            type="number"
            value={maxConcurrent}
            onChange={(e) => setMaxConcurrent(Math.max(1, Math.min(20, Number(e.target.value))))}
            min={1}
            max={20}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">同时执行的最大任务数（1-20）</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <RotateCcw size={14} />
            失败重试次数
          </label>
          <input
            type="number"
            value={retryCount}
            onChange={(e) => setRetryCount(Math.max(0, Math.min(5, Number(e.target.value))))}
            min={0}
            max={5}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">失败后自动重试的次数（0-5）</p>
        </div>
      </div>

      {/* 部署应用特殊配置 */}
      {operationType === 'deploy_app' && (
        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 flex items-center gap-2">
            <Upload size={16} />
            部署配置
          </h3>
          
          {/* 部署类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">部署方式</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'script', label: '脚本部署', icon: '📜' },
                { id: 'docker', label: 'Docker', icon: '🐳' },
                { id: 'git', label: 'Git拉取', icon: '📦' },
                { id: 'file', label: '文件复制', icon: '📁' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setDeployType(type.id as any)}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                    deployType === type.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span className="mr-1">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 脚本部署配置 */}
          {deployType === 'script' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">部署脚本</label>
              <textarea
                value={deployScript}
                onChange={(e) => setDeployScript(e.target.value)}
                placeholder="输入自定义部署脚本...&#10;例如: echo 'Deploying app' && npm install && npm start"
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none font-mono text-sm"
              />
            </div>
          )}
          
          {/* Docker部署配置 */}
          {deployType === 'docker' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">镜像名称</label>
                <input
                  type="text"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  placeholder="nginx:latest"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">端口映射</label>
                <input
                  type="text"
                  value={dockerPort}
                  onChange={(e) => setDockerPort(e.target.value)}
                  placeholder="8080"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
            </div>
          )}
          
          {/* Git部署配置 */}
          {deployType === 'git' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">仓库地址</label>
                <input
                  type="text"
                  value={gitRepo}
                  onChange={(e) => setGitRepo(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分支</label>
                  <input
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部署路径</label>
                  <input
                    type="text"
                    value={gitPath}
                    onChange={(e) => setGitPath(e.target.value)}
                    placeholder="./app"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* 文件复制配置 */}
          {deployType === 'file' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">源路径</label>
                <input
                  type="text"
                  value={fileSource}
                  onChange={(e) => setFileSource(e.target.value)}
                  placeholder="C:\\source\\app"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标路径</label>
                <input
                  type="text"
                  value={fileTarget}
                  onChange={(e) => setFileTarget(e.target.value)}
                  placeholder="C:\\deploy\\app"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 超时和灰度 */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Clock size={14} />
            超时时间（秒）
          </label>
          <input
            type="number"
            value={timeout}
            onChange={(e) => setTimeout_val(Math.max(10, Math.max(300, Number(e.target.value))))}
            min={10}
            max={300}
            step={10}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">单个任务的超时限制（10-300秒）</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Shield size={14} />
            灰度比例（%）
          </label>
          <input
            type="number"
            value={canaryPercent}
            onChange={(e) => setCanaryPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
            min={0}
            max={100}
            step={5}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
            disabled={!canaryMode}
          />
          <p className="text-xs text-gray-400 mt-1">先执行此比例的目标进行验证</p>
        </div>
      </div>

      {/* 开关选项 */}
      <div className="space-y-3">
        <label className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-yellow-600" />
            <div>
              <div className="font-medium text-yellow-800">灰度发布模式</div>
              <div className="text-xs text-yellow-600/70">先执行部分目标验证后再全量部署</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={canaryMode}
            onChange={(e) => setCanaryMode(e.target.checked)}
            className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
          />
        </label>

        <label className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-blue-600" />
            <div>
              <div className="font-medium text-blue-800">干运行模式（预览）</div>
              <div className="text-xs text-blue-600/70">只显示将要执行的命令，不实际执行</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </label>
      </div>
    </div>
  );

  // ========== 渲染：确认对话框 ==========
  const renderConfirmDialog = () => (
    showConfirmDialog && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">⚠️ 最后确认</h2>
            <p className="text-gray-600">
              您即将对 <strong className="text-red-600">{selectedTargets.length}</strong> 个目标执行{' '}
              <strong>{currentOpConfig.label}</strong> 操作。
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 space-y-2 text-sm">
            <div className="font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle size={16} /> 风险提示：
            </div>
            <ul className="list-disc list-inside space-y-1 text-red-700 ml-2">
              <li>此操作可能影响系统稳定性</li>
              <li>建议在业务低峰期执行</li>
              <li>请确保已做好数据备份</li>
              {canaryMode && selectedTargets.length > 1 && (
                <li className="font-medium">将启用灰度模式，先执行 {canaryPercent}% 的目标</li>
              )}
            </ul>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              输入确认码 <span className="text-red-500 font-bold">CONFIRM</span> 以继续：
            </label>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
              placeholder="CONFIRM"
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-center font-mono tracking-widest uppercase"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmationCode('');
              }}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (confirmationCode === 'CONFIRM') {
                  setIsConfirmed(true);
                  setShowConfirmDialog(false);
                  executeOperation();
                }
              }}
              disabled={confirmationCode !== 'CONFIRM'}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ 确认执行
            </button>
          </div>
        </div>
      </div>
    )
  );

  // ========== 渲染：进度面板 ==========
  const renderProgressPanel = () => {
    if (!executionResult) return null;

    const { results, summary, operation_id, status } = executionResult;
    const progress = Math.round(((summary.success + summary.failed + summary.skipped) / summary.total) * 100);

    return (
      <div className="space-y-6">
        {/* 头部统计 */}
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">📊 执行结果 #{operation_id}</h3>
              <p className="text-violet-100 text-sm mt-1">{currentOpConfig.label} - {new Date().toLocaleString()}</p>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
              status === 'completed' ? 'bg-green-400 text-green-900' :
              status === 'partial_failed' ? 'bg-yellow-400 text-yellow-900' :
              'bg-red-400 text-red-900'
            }`}>
              {status === 'completed' ? '✅ 全部成功' :
               status === 'partial_failed' ? '⚠️ 部分成功' : '❌ 执行失败'}
            </span>
          </div>

          {/* 进度条 */}
          <div className="relative">
            <div className="h-4 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-emerald-400 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold drop-shadow">{progress}%</span>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '总计', value: summary.total, color: 'gray', icon: Server },
            { label: '成功', value: summary.success, color: 'green', icon: CheckCircle2 },
            { label: '失败', value: summary.failed, color: 'red', icon: XCircle },
            { label: '跳过', value: summary.skipped, color: 'yellow', icon: Clock },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={color} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4 text-center`}>
              <Icon size={24} className={`mx-auto mb-2 text-${color}-600`} />
              <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
              <div className={`text-xs text-${color}-600 mt-1`}>{label}</div>
            </div>
          ))}
        </div>

        {/* 详细结果列表 */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-gray-700">详细结果</span>
            <span className="text-sm text-gray-500">{results.length} 条记录</span>
          </div>
          
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
            {results.map((result, idx) => (
              <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {result.status === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                    {result.status === 'failed' && <XCircle size={16} className="text-red-500" />}
                    {result.status === 'running' && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                    {result.status === 'skipped' && <Clock size={16} className="text-yellow-500" />}
                    <span className="font-medium text-gray-800">{result.target}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {result.duration != null && <span>⏱ {Number(result.duration).toFixed(1)}s</span>}
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      result.status === 'success' ? 'bg-green-100 text-green-700' :
                      result.status === 'failed' ? 'bg-red-100 text-red-700' :
                      result.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {result.status === 'success' ? '成功' :
                       result.status === 'failed' ? '失败' :
                       result.status === 'running' ? '执行中' : '跳过'}
                    </span>
                  </div>
                </div>

                {(result.output || result.error) && (
                  <pre className={`mt-2 p-3 rounded-lg text-xs overflow-x-auto ${
                    result.error ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
                  }`}>
                    {result.error || result.output}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setActiveTab('select');
              setExecutionResult(null);
              setIsConfirmed(false);
            }}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            返回
          </button>
          
          {summary.failed > 0 && (
            <button
              onClick={() => {
                const failedTargets = results.filter(r => r.status === 'failed').map(r => r.target);
                setSelectedTargets(failedTargets);
                setActiveTab('confirm');
              }}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              重试失败项 ({summary.failed})
            </button>
          )}
        </div>
      </div>
    );
  };

  // ========== 主渲染 ==========
  const tabs = [
    { id: 'select' as const, icon: Server, label: '目标选择', count: selectedTargets.length },
    { id: 'options' as const, icon: Settings, label: '执行选项', count: canaryMode ? 1 : 0 },
    { id: 'confirm' as const, icon: Shield, label: '安全确认', count: isConfirmed ? 1 : 0 },
    { id: 'progress' as const, icon: Zap, label: '执行进度', count: executionResult ? 1 : 0 },
  ];

  return (
    <div className={`h-full flex flex-col bg-gradient-to-br from-slate-50 to-violet-50 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* 头部 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${currentOpConfig.color} flex items-center justify-center shadow-lg`}>
              <currentOpConfig.icon size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">🚀 批量操作引擎</h2>
              <p className="text-sm text-gray-500">自动化运维 · 批量操作 · 实时监控 · 安全可靠</p>
            </div>
          </div>
          
          <button
            onClick={onToggleFullscreen}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Maximize2 size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tab 栏 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              disabled={tab.id === 'progress' && !executionResult}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/50 disabled:opacity-40'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'select' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {renderOperationSelector()}
            
            <hr className="border-gray-200" />
            
            {renderTargetSelection()}
          </div>
        )}

        {activeTab === 'options' && (
          <div className="max-w-3xl mx-auto">
            {renderExecutionOptions()}
          </div>
        )}

        {activeTab === 'confirm' && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* 摘要卡片 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield size={20} className="text-violet-600" />
                执行摘要
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">操作类型:</span>
                  <span className="ml-2 font-semibold text-gray-800">{currentOpConfig.label}</span>
                </div>
                <div>
                  <span className="text-gray-500">目标数量:</span>
                  <span className="ml-2 font-semibold text-violet-600">{selectedTargets.length} 个</span>
                </div>
                <div>
                  <span className="text-gray-500">最大并发:</span>
                  <span className="ml-2 font-semibold text-gray-800">{maxConcurrent}</span>
                </div>
                <div>
                  <span className="text-gray-500">超时时间:</span>
                  <span className="ml-2 font-semibold text-gray-800">{timeout}s</span>
                </div>
                {canaryMode && selectedTargets.length > 1 && (
                  <div className="col-span-2">
                    <span className="text-gray-500">灰度策略:</span>
                    <span className="ml-2 font-semibold text-yellow-600">
                      先执行 {canaryPercent}% ({Math.ceil(selectedTargets.length * canaryPercent / 100)} 个)
                    </span>
                  </div>
                )}
                {dryRun && (
                  <div className="col-span-2">
                    <span className="text-blue-600 font-medium">ℹ️ 干运行模式：不会实际执行任何操作</span>
                  </div>
                )}
              </div>

              {/* 目标列表预览 */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500 mb-2">目标列表：</div>
                <div className="flex flex-wrap gap-2">
                  {selectedTargets.slice(0, 10).map(target => (
                    <span key={target} className="px-3 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">
                      {target}
                    </span>
                  ))}
                  {selectedTargets.length > 10 && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                      +{selectedTargets.length - 10} 更多
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 确认按钮 */}
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={selectedTargets.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                selectedTargets.length === 0
                  ? 'bg-gray-200 cursor-not-allowed text-gray-500'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white hover:shadow-xl'
              }`}
            >
              <Play size={22} />
              开始批量操作
            </button>
          </div>
        )}

        {activeTab === 'progress' && renderProgressPanel()}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl max-w-md animate-in slide-in-from-right duration-300">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">执行错误</div>
              <div className="text-sm text-red-100 mt-1">{error}</div>
            </div>
            <button onClick={() => setError(null)} className="ml-auto opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {renderConfirmDialog()}
    </div>
  );
};

export default BatchOperationEngine;