import React, { useState, useEffect } from 'react';
import { 
  HardDrive, Trash2, FileText, RefreshCw, AlertTriangle, 
  CheckCircle, Info, ChevronDown, ChevronUp, X, Eye, Play
} from 'lucide-react';

interface FileDetail {
  path: string;
  size: number;
  size_formatted: string;
  modified: string;
  name: string;
}

interface CleanupCategory {
  type: string;
  size: string;
  size_bytes: number;
  files: number;
  risk: string;
  paths: string[];
  is_directory?: boolean;
  file_details?: FileDetail[];
}

interface DiskScanResult {
  total_releasable: string;
  total_bytes: number;
  categories: CleanupCategory[];
  recommendations: string[];
  disk_usage: {
    total: string;
    used: string;
    free: string;
    percent: number;
  };
}

interface DiskCleanerProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const DiskCleaner: React.FC<DiskCleanerProps> = ({ isFullscreen, onToggleFullscreen }) => {
  const [scanResult, setScanResult] = useState<DiskScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());  // 选中的具体文件
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [daysThreshold, setDaysThreshold] = useState(30);
  const [selectedDisk, setSelectedDisk] = useState<string>('C');  // 默认扫描C盘

  useEffect(() => {
    handleScan();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setCleanupResult(null);
    setSelectedFiles(new Set());  // 清空已选文件
    
    try {
      const response = await fetch('/api/disk/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_paths: [`${selectedDisk}:\\`],
          days_threshold: daysThreshold
        })
      });
      
      const data = await response.json();
      setScanResult(data);
      
      const lowRiskCategories = data.categories
        .filter((cat: CleanupCategory) => cat.risk === 'low')
        .map((cat: CleanupCategory) => cat.type);
      setSelectedCategories(new Set(lowRiskCategories));
      
    } catch (error) {
      console.error('扫描失败:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleCategory = (type: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(type)) {
      newSelected.delete(type);
    } else {
      newSelected.add(type);
    }
    setSelectedCategories(newSelected);
  };

  const toggleCategoryExpand = (type: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedCategories(newExpanded);
  };

  const getSelectedSize = () => {
    if (!scanResult) return '0 B';
    const bytes = scanResult.categories
      .filter(cat => selectedCategories.has(cat.type))
      .reduce((sum, cat) => sum + cat.size_bytes, 0);
    return formatSize(bytes);
  };

  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    for (const unit of units) {
      if (size < 1024) {
        return `${size.toFixed(1)} ${unit}`;
      }
      size /= 1024;
    }
    return `${size.toFixed(1)} PB`;
  };

  const handleCleanup = async (dryRun: boolean) => {
    if (!dryRun) {
      setShowConfirmDialog(true);
      return;
    }
    
    await executeCleanup(dryRun);
  };

  const executeCleanup = async (dryRun: boolean) => {
    setShowConfirmDialog(false);
    setIsCleaning(true);
    setCleanupResult(null);
    
    try {
      // 构建清理项目
      const cleanupItems = scanResult?.categories
        .filter(cat => selectedCategories.has(cat.type))
        .map(cat => {
          // 对于大文件类别，只使用选中的文件
          if (cat.type === '大文件(>100MB)' && cat.file_details) {
            const selectedFilePaths = cat.file_details
              .filter(f => selectedFiles.has(f.path))
              .map(f => f.path);
            
            // 如果没有选中任何文件，使用全部文件
            const pathsToClean = selectedFilePaths.length > 0 ? selectedFilePaths : cat.paths;
            
            return {
              type: cat.type,
              paths: pathsToClean,
              is_directory: false  // 大文件是文件级清理
            };
          }
          
          // 其他类别使用原有逻辑
          return {
            type: cat.type,
            paths: cat.paths,
            is_directory: cat.is_directory ?? true
          };
        }) || [];
      
      const response = await fetch('/api/disk/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanup_items: cleanupItems,
          dry_run: dryRun
        })
      });
      
      const data = await response.json();
      setCleanupResult(data);
      
      if (!dryRun) {
        setTimeout(() => handleScan(), 1000);
      }
      
    } catch (error) {
      console.error('清理失败:', error);
    } finally {
      setIsCleaning(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskText = (risk: string) => {
    switch (risk) {
      case 'low': return '低风险';
      case 'medium': return '中风险';
      case 'high': return '高风险';
      default: return '未知';
    }
  };

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 bg-white z-50 p-6' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <HardDrive className="text-blue-500" size={24} />
          <h2 className="text-xl font-bold text-gray-800">磁盘清理助手</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDisk}
            onChange={(e) => setSelectedDisk(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          >
            <option value="C">C盘</option>
            <option value="D">D盘</option>
            <option value="E">E盘</option>
          </select>
          <select
            value={daysThreshold}
            onChange={(e) => setDaysThreshold(Number(e.target.value))}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value={7}>7天前</option>
            <option value={14}>14天前</option>
            <option value={30}>30天前</option>
            <option value={60}>60天前</option>
            <option value={90}>90天前</option>
          </select>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
            {isScanning ? '扫描中...' : '重新扫描'}
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-gray-600">磁盘使用情况</div>
              <div className="text-2xl font-bold text-gray-800">
                {scanResult.disk_usage.used} / {scanResult.disk_usage.total}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">可用空间</div>
              <div className="text-2xl font-bold text-green-600">{scanResult.disk_usage.free}</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all ${
                scanResult.disk_usage.percent > 80 ? 'bg-red-500' : 
                scanResult.disk_usage.percent > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${scanResult.disk_usage.percent}%` }}
            />
          </div>
          <div className="text-right text-sm text-gray-500 mt-1">
            使用率: {scanResult.disk_usage.percent}%
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {isScanning ? (
          <div className="flex flex-col items-center justify-center h-64">
            <RefreshCw size={48} className="text-blue-500 animate-spin mb-4" />
            <div className="text-gray-600">正在扫描磁盘...</div>
            <div className="text-sm text-gray-400 mt-2">这可能需要几秒钟</div>
          </div>
        ) : scanResult ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="text-orange-500" size={20} />
                  <span className="font-semibold">可清理内容</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">预计可释放</div>
                  <div className="text-xl font-bold text-orange-500">{scanResult.total_releasable}</div>
                </div>
              </div>

              <div className="space-y-3">
                {scanResult.categories.map((category) => (
                  <div key={category.type} className="border rounded-lg overflow-hidden">
                    <div 
                      className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${
                        selectedCategories.has(category.type) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(category.type)}
                        onChange={() => toggleCategory(category.type)}
                        className="w-4 h-4 text-blue-600 rounded mr-3"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{category.type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getRiskColor(category.risk)}`}>
                            {getRiskText(category.risk)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500">{category.files} 个文件</span>
                          <span className="font-semibold text-gray-700">{category.size}</span>
                          <button
                                            onClick={(e) => {
                            e.stopPropagation();
                            toggleCategoryExpand(category.type);
                          }}
                                            className="p-1 hover:bg-gray-200 rounded"
                                          >
                            {expandedCategories.has(category.type) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {expandedCategories.has(category.type) && category.paths.length > 0 && (
                      <div className="bg-gray-50 p-3 border-t">
                        {category.file_details && category.file_details.length > 0 ? (
                          <>
                            <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                              <span>文件列表（可选择删除）:</span>
                              <span className="text-blue-600">
                                已选择 {category.file_details.filter(f => selectedFiles.has(f.path)).length} 个文件
                              </span>
                            </div>
                            <div className="space-y-1 max-h-64 overflow-auto">
                              {category.file_details.map((file, idx) => (
                                <div 
                                  key={idx} 
                                  className={`text-xs bg-white px-2 py-2 rounded flex items-center gap-2 cursor-pointer hover:bg-blue-50 ${
                                    selectedFiles.has(file.path) ? 'bg-blue-100 border border-blue-300' : ''
                                  }`}
                                  onClick={() => {
                                    const newSelected = new Set(selectedFiles);
                                    if (newSelected.has(file.path)) {
                                      newSelected.delete(file.path);
                                    } else {
                                      newSelected.add(file.path);
                                    }
                                    setSelectedFiles(newSelected);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedFiles.has(file.path)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const newSelected = new Set(selectedFiles);
                                      if (newSelected.has(file.path)) {
                                        newSelected.delete(file.path);
                                      } else {
                                        newSelected.add(file.path);
                                      }
                                      setSelectedFiles(newSelected);
                                    }}
                                    className="w-3 h-3 text-blue-600 rounded"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-800 truncate" title={file.name}>
                                      {file.name}
                                    </div>
                                    <div className="text-gray-500 truncate" title={file.path}>
                                      {file.path}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="font-semibold text-gray-700">{file.size_formatted}</div>
                                    <div className="text-gray-400">{file.modified}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-gray-500 mb-2">文件路径:</div>
                            <div className="space-y-1 max-h-32 overflow-auto">
                              {category.paths.map((path, idx) => (
                                <div key={idx} className="text-xs font-mono text-gray-600 bg-white px-2 py-1 rounded">
                                  {path}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-blue-500" />
                <span className="font-semibold text-blue-800">AI 建议</span>
              </div>
              <ul className="space-y-2">
                {scanResult.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {scanResult.categories.some(cat => cat.type === '浏览器缓存') && (
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-orange-500" />
                  <span className="font-semibold text-orange-800">浏览器缓存清理提示</span>
                </div>
                <div className="space-y-2 text-sm text-orange-700">
                  <p>⚠️ 浏览器正在运行时，部分缓存文件可能被锁定无法删除。</p>
                  <p>💡 建议操作：</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>关闭 Chrome/Edge/Firefox 浏览器后重试清理</li>
                    <li>或使用浏览器的设置手动清除缓存（Ctrl+Shift+Delete）</li>
                    <li>系统会尝试强制删除，但可能只清理部分文件</li>
                  </ul>
                </div>
              </div>
            )}

            {cleanupResult && (
              <div className={`rounded-xl p-4 ${
                cleanupResult.status === 'success' ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {cleanupResult.status === 'success' ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : (
                    <Eye className="text-yellow-500" size={20} />
                  )}
                  <span className="font-semibold">
                    {cleanupResult.status === 'success' ? '清理完成' : '预览结果'}
                  </span>
                </div>
                
                {cleanupResult.status === 'preview' && cleanupResult.results && (
                  <div className="space-y-2">
                    {cleanupResult.results.map((result: any, idx: number) => (
                      result.commands && result.commands.length > 0 && (
                        <div key={idx} className="bg-white rounded p-2">
                          <div className="text-xs font-medium text-gray-600 mb-1">{result.type}:</div>
                          <div className="space-y-1">
                            {result.commands.slice(0, 5).map((cmd: string, i: number) => (
                              <div key={i} className="text-xs font-mono text-gray-500">{cmd}</div>
                            ))}
                            {result.commands.length > 5 && (
                              <div className="text-xs text-gray-400">... 还有 {result.commands.length - 5} 个文件</div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
                
                {cleanupResult.status === 'success' && (
                  <div className="text-green-700">
                    成功释放 <strong>{cleanupResult.total_freed}</strong> 空间
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <HardDrive size={48} className="mb-4 opacity-50" />
            <div>点击"重新扫描"开始分析磁盘</div>
          </div>
        )}
      </div>

      {scanResult && selectedCategories.size > 0 && (
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-gray-500">已选择 {selectedCategories.size} 个类别</div>
              <div className="text-lg font-bold text-gray-800">预计释放: {getSelectedSize()}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCleanup(true)}
                disabled={isCleaning}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <Eye size={16} />
                仅预览
              </button>
              <button
                onClick={() => handleCleanup(false)}
                disabled={isCleaning}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                <Play size={16} />
                {isCleaning ? '清理中...' : '执行清理'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-orange-500" size={24} />
              <h3 className="text-lg font-bold">确认清理操作</h3>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-orange-800 mb-2">
                即将删除以下内容:
              </div>
              <ul className="text-sm space-y-1">
                {Array.from(selectedCategories).map(type => {
                  const cat = scanResult?.categories.find(c => c.type === type);
                  return cat ? (
                    <li key={type} className="flex justify-between">
                      <span>{type}</span>
                      <span className="font-medium">{cat.size}</span>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                <span>总计</span>
                <span>{getSelectedSize()}</span>
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <strong>警告:</strong> 此操作不可逆，删除的文件将无法恢复。
                  请确保已备份重要数据。
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => executeCleanup(false)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                确认清理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiskCleaner;
