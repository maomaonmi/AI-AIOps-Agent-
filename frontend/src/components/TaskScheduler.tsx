import React, { useState, useEffect } from 'react';
import { 
  Clock, Play, Pause, Trash2, Edit, Plus, RefreshCw, 
  CheckCircle, XCircle, AlertCircle, Calendar, Settings,
  ChevronDown, ChevronUp, Save, X
} from 'lucide-react';

interface ScheduledTask {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
  enabled: boolean;
}

interface TaskStats {
  total_executions: number;
  success_rate: number;
  avg_duration: number;
  recent_executions: any[];
  top_tasks: any[];
  today_stats: {
    total: number;
    success: number;
    avg_duration: number;
  };
  month_stats: {
    total: number;
    success: number;
    avg_duration: number;
  };
  trend_7days: any[];
  task_type_distribution: any[];
}

interface TaskFormData {
  name: string;
  task_type: 'cleanup' | 'backup' | 'script';
  cron_expression: string;
  enabled: boolean;
  config: {
    cleanup_types?: string[];
    disk?: string;
    backup_path?: string;
    backup_type?: string;
    source_paths?: string[];
    script_path?: string;
    script_content?: string;
  };
  description: string;
}

const defaultFormData: TaskFormData = {
  name: '',
  task_type: 'cleanup',
  cron_expression: '0 2 * * *',
  enabled: true,
  config: {
    cleanup_types: ['Windows更新缓存', '浏览器缓存'],
    disk: 'C'
  },
  description: ''
};

const TaskScheduler: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>(defaultFormData);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
    loadStats();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/scheduler/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('加载任务失败:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/scheduler/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!formData.name.trim()) {
      alert('请输入任务名称');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/scheduler/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowCreateForm(false);
        setFormData(defaultFormData);
        loadTasks();
        loadStats();
      } else {
        const error = await response.json();
        alert(`创建失败: ${error.detail}`);
      }
    } catch (error) {
      console.error('创建任务失败:', error);
      alert('创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}/toggle`, {
        method: 'POST'
      });

      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error('切换任务状态失败:', error);
    }
  };

  const handleExecuteTask = async (taskId: string) => {
    if (!confirm('确定要立即执行此任务吗？')) return;

    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}/execute`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('任务已开始执行');
        setTimeout(loadStats, 2000);
      }
    } catch (error) {
      console.error('执行任务失败:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除此任务吗？')) return;

    try {
      const response = await fetch(`/api/scheduler/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadTasks();
      }
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  const parseCronExpression = (cron: string) => {
    const parts = cron.split(' ');
    if (parts.length !== 5) return '无效表达式';

    const [min, hour, day, month, weekday] = parts;

    if (min === '0' && hour === '2' && day === '*' && month === '*' && weekday === '*') {
      return '每天凌晨2点';
    } else if (min === '0' && hour === '3' && day === '*' && month === '*' && weekday === '*') {
      return '每天凌晨3点';
    } else if (min === '0' && hour === '18' && day === '*' && month === '*' && weekday === '1') {
      return '每周一18点';
    } else if (min === '0' && hour === '0' && day === '1' && month === '*' && weekday === '*') {
      return '每月1号凌晨';
    } else {
      return `自定义: ${cron}`;
    }
  };

  const getStatusIcon = (enabled: boolean) => {
    return enabled ? (
      <CheckCircle className="text-green-500" size={16} />
    ) : (
      <Pause className="text-gray-400" size={16} />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-500" size={24} />
          <h2 className="text-xl font-bold text-gray-800">定时任务调度器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus size={16} />
            新建任务
          </button>
          <button
            onClick={() => { loadTasks(); loadStats(); }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">本月执行</div>
            <div className="text-2xl font-bold text-gray-800">{stats.month_stats.total}次</div>
            <div className="text-xs text-green-500 mt-1">成功率 {stats.success_rate}%</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">今日执行</div>
            <div className="text-2xl font-bold text-gray-800">{stats.today_stats.total}次</div>
            <div className="text-xs text-blue-500 mt-1">平均耗时 {stats.today_stats.avg_duration}s</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">活跃任务</div>
            <div className="text-2xl font-bold text-gray-800">{tasks.filter(t => t.enabled).length}</div>
            <div className="text-xs text-gray-500 mt-1">共 {tasks.length} 个任务</div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">创建新任务</h3>
            <button onClick={() => setShowCreateForm(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">任务名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="例如: 每日备份任务"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">任务类型</label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  task_type: e.target.value as any,
                  config: e.target.value === 'cleanup' 
                    ? { cleanup_types: ['Windows更新缓存'], disk: 'C' }
                    : e.target.value === 'backup'
                    ? { backup_path: 'C:\\Backups', backup_type: 'database' }
                    : { script_content: '' }
                })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="cleanup">自动清理</option>
                <option value="backup">数据备份</option>
                <option value="script">自定义脚本</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Cron表达式</label>
              <select
                value={formData.cron_expression}
                onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="0 2 * * *">每天凌晨2点</option>
                <option value="0 3 * * *">每天凌晨3点</option>
                <option value="0 18 * * 1">每周一18点</option>
                <option value="0 0 1 * *">每月1号凌晨</option>
                <option value="0 */6 * * *">每6小时</option>
                <option value="*/30 * * * *">每30分钟</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">
                {parseCronExpression(formData.cron_expression)}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">启用状态</label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">立即启用</span>
              </label>
            </div>
          </div>

          {formData.task_type === 'cleanup' && (
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-2">清理类型</label>
              <div className="grid grid-cols-2 gap-2">
                {['Windows更新缓存', '浏览器缓存', '临时文件', '缩略图缓存'].map(type => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.config.cleanup_types?.includes(type)}
                      onChange={(e) => {
                        const types = formData.config.cleanup_types || [];
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            config: { ...formData.config, cleanup_types: [...types, type] }
                          });
                        } else {
                          setFormData({
                            ...formData,
                            config: { ...formData.config, cleanup_types: types.filter(t => t !== type) }
                          });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {formData.task_type === 'backup' && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">备份路径</label>
                <input
                  type="text"
                  value={formData.config.backup_path}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, backup_path: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="C:\Backups"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">备份类型</label>
                <select
                  value={formData.config.backup_type}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, backup_type: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="database">数据库备份</option>
                  <option value="files">文件备份</option>
                </select>
              </div>
            </div>
          )}

          {formData.task_type === 'script' && (
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">脚本内容 (PowerShell)</label>
              <textarea
                value={formData.config.script_content}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, script_content: e.target.value }
                })}
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                rows={5}
                placeholder="# 输入PowerShell脚本&#10;Get-Process | Select-Object -First 10"
              />
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm text-gray-600 mb-1">描述（可选）</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="任务描述..."
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleCreateTask}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? '创建中...' : '创建任务'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Clock size={48} className="mb-4 opacity-50" />
            <div>暂无定时任务</div>
            <div className="text-sm mt-2">点击"新建任务"创建第一个定时任务</div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="bg-white rounded-lg border overflow-hidden">
                <div className="flex items-center p-4">
                  <div className="mr-3">
                    {getStatusIcon(task.enabled)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{task.name}</div>
                    <div className="text-sm text-gray-500">
                      {parseCronExpression(task.trigger)}
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    {task.next_run_time && (
                      <div className="text-sm">
                        <span className="text-gray-500">下次执行: </span>
                        <span className="text-gray-700">
                          {new Date(task.next_run_time).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExecuteTask(task.id)}
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-500"
                      title="立即执行"
                    >
                      <Play size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      className={`p-2 hover:bg-gray-100 rounded-lg ${task.enabled ? 'text-orange-500' : 'text-green-500'}`}
                      title={task.enabled ? '暂停' : '启用'}
                    >
                      {task.enabled ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      {expandedTask === task.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskScheduler;
