import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { 
  TrendingUp, Activity, Clock, CheckCircle, XCircle, 
  AlertTriangle, RefreshCw, Calendar
} from 'lucide-react';

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

interface ExecutionHistory {
  id: number;
  task_id: string;
  task_name: string;
  task_type: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: string;
  result: string;
  error_message: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const AutomationDashboard: React.FC = () => {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [history, setHistory] = useState<ExecutionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch('/api/scheduler/stats'),
        fetch('/api/scheduler/history?limit=20')
      ]);

      const statsData = await statsRes.json();
      const historyData = await historyRes.json();

      setStats(statsData);
      setHistory(historyData.history || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'failed':
        return <XCircle className="text-red-500" size={16} />;
      case 'running':
        return <Activity className="text-blue-500 animate-pulse" size={16} />;
      default:
        return <AlertTriangle className="text-yellow-500" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'cleanup':
        return 'bg-blue-100 text-blue-700';
      case 'backup':
        return 'bg-green-100 text-green-700';
      case 'script':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(0);
      return `${mins}m ${secs}s`;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-blue-500" size={24} />
          <h2 className="text-xl font-bold text-gray-800">自动化运营中心</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="7d">近7天</option>
            <option value="30d">近30天</option>
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={20} />
                <span className="text-sm opacity-90">本月执行</span>
              </div>
              <div className="text-3xl font-bold">{stats.month_stats.total}</div>
              <div className="text-sm opacity-75 mt-1">次</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={20} />
                <span className="text-sm opacity-90">成功率</span>
              </div>
              <div className="text-3xl font-bold">{stats.success_rate}%</div>
              <div className="text-sm opacity-75 mt-1">
                {stats.month_stats.success}/{stats.month_stats.total}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={20} />
                <span className="text-sm opacity-90">平均耗时</span>
              </div>
              <div className="text-3xl font-bold">{formatDuration(stats.avg_duration)}</div>
              <div className="text-sm opacity-75 mt-1">平均</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={20} />
                <span className="text-sm opacity-90">今日执行</span>
              </div>
              <div className="text-3xl font-bold">{stats.today_stats.total}</div>
              <div className="text-sm opacity-75 mt-1">次</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                执行趋势（近7天）
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.trend_7days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="执行次数"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity size={18} className="text-green-500" />
                任务类型分布
              </h3>
              {stats.task_type_distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.task_type_distribution}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.task_type_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  暂无数据
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold mb-3">🏆 Top 5 高频任务</h3>
              {stats.top_tasks.length > 0 ? (
                <div className="space-y-2">
                  {stats.top_tasks.map((task, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700' :
                          index === 2 ? 'bg-orange-400 text-orange-900' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium">{task.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">{task.count} 次</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">暂无数据</div>
              )}
            </div>

            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold mb-3">📊 今日统计</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-gray-600">总执行次数</span>
                  <span className="text-xl font-bold text-blue-600">{stats.today_stats.total}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-gray-600">成功次数</span>
                  <span className="text-xl font-bold text-green-600">{stats.today_stats.success}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <span className="text-sm text-gray-600">平均耗时</span>
                  <span className="text-xl font-bold text-purple-600">
                    {formatDuration(stats.today_stats.avg_duration)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border p-4 flex-1">
        <h3 className="font-semibold mb-3">📝 最近执行记录</h3>
        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">状态</th>
                  <th className="text-left py-2 px-3">任务名称</th>
                  <th className="text-left py-2 px-3">类型</th>
                  <th className="text-left py-2 px-3">开始时间</th>
                  <th className="text-left py-2 px-3">耗时</th>
                  <th className="text-left py-2 px-3">结果</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(item.status)}`}>
                          {item.status === 'success' ? '成功' : item.status === 'failed' ? '失败' : '运行中'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 font-medium">{item.task_name}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${getTaskTypeColor(item.task_type)}`}>
                        {item.task_type === 'cleanup' ? '清理' : 
                         item.task_type === 'backup' ? '备份' : 
                         item.task_type === 'script' ? '脚本' : item.task_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {new Date(item.start_time).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {item.duration ? formatDuration(item.duration) : '-'}
                    </td>
                    <td className="py-2 px-3 text-gray-500 max-w-xs truncate" title={item.result || item.error_message}>
                      {item.result || item.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Activity size={48} className="mb-4 opacity-50" />
            <div>暂无执行记录</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationDashboard;
