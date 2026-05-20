import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive, RefreshCw, AlertTriangle, CheckCircle,
  AlertCircle, XCircle, HelpCircle, Database, Gauge, Clock,
  Shield, Thermometer, Cpu,
} from 'lucide-react';

interface BlockHealthData {
  smart_status: string;
  media_type: string;
  model: string;
  size_gb: number;
  reallocated_sectors: number;
  pending_sectors: number;
  uncorrectable_sectors: number;
  temperature: number | null;
  power_on_hours: number | null;
  health_score: number;
  health_details: string[];
}

interface DiskData {
  device: string;
  mountpoint: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
  fstype: string;
  health_status: string;
  health_details: string[];
  block_health: BlockHealthData | null;
}

interface DiskInfoResponse {
  status: string;
  system: string;
  drives: DiskData[];
  timestamp: string;
}

const healthConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string; label: string; ringColor: string }> = {
  healthy:   { icon: <CheckCircle size={14} />, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', label: '健康', ringColor: '#10b981' },
  notice:    { icon: <AlertCircle size={14} />, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', label: '注意', ringColor: '#3b82f6' },
  warning:   { icon: <AlertTriangle size={14} />, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', label: '警告', ringColor: '#f59e0b' },
  critical:  { icon: <XCircle size={14} />, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', label: '危险', ringColor: '#ef4444' },
  unknown:   { icon: <HelpCircle size={14} />, color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', label: '未知', ringColor: '#9ca3af' },
};

function formatSize(gb: number): string {
  if (gb >= 1000) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(1)} GB`;
}

function DonutChart({ percent, color, size = 110, strokeWidth = 11 }: { percent: number; color: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={`${color}18`} strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{percent.toFixed(1)}%</span>
        <span className="text-[9px] text-gray-400">已使用</span>
      </div>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const label = score >= 80 ? '优秀' : score >= 60 ? '良好' : score >= 40 ? '一般' : '较差';
  const size = 64;
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = r * 2 * Math.PI;
  const off = circ - (score / 100) * circ;
  const c = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
          <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={off} style={{ transition: 'all 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}</span>
          <span className="text-[7px] text-gray-400">{label}</span>
        </div>
      </div>
      <span className="text-[9px] text-gray-500 font-medium">块健康</span>
    </div>
  );
}

function CompactDiskCard({ disk }: { disk: DiskData }) {
  const config = healthConfig[disk.health_status] || healthConfig.unknown;
  const bh = disk.block_health;

  return (
    <div className={`rounded-xl border ${config.borderColor} overflow-hidden bg-white hover:shadow-md transition-all`}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
              <HardDrive size={13} className={config.color} />
            </div>
            <div>
              <span className="font-semibold text-xs text-gray-800">{disk.device}盘</span>
              <span className="text-[10px] text-gray-400 ml-1">{disk.mountpoint}</span>
            </div>
          </div>
          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.bgColor} ${config.color}`}>
            {config.icon} {config.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <DonutChart percent={disk.percent} color={config.ringColor} size={82} strokeWidth={9} />

          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="grid grid-cols-3 gap-1.5">
              <div className="text-center p-1 rounded-md bg-gray-50/80">
                <div className="text-[10px] font-bold text-gray-700 tabular-nums">{formatSize(disk.total_gb)}</div>
                <div className="text-[8px] text-gray-400">总容量</div>
              </div>
              <div className="text-center p-1 rounded-md bg-red-50/70">
                <div className="text-[10px] font-bold text-red-500 tabular-nums">{formatSize(disk.used_gb)}</div>
                <div className="text-[8px] text-red-400">已用</div>
              </div>
              <div className="text-center p-1 rounded-md bg-emerald-50/70">
                <div className="text-[10px] font-bold text-emerald-500 tabular-nums">{formatSize(disk.free_gb)}</div>
                <div className="text-[8px] text-emerald-400">可用</div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[9px] mb-0.5">
                <span className="text-gray-400">使用率</span>
                <span className="font-medium" style={{ color: config.ringColor }}>{disk.percent.toFixed(1)}%</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${disk.percent}%`, backgroundColor: config.ringColor }} />
              </div>
            </div>
          </div>

          {bh && (
            <ScoreGauge score={bh.health_score} />
          )}
        </div>

        {(disk.health_details.length > 0 || (bh && bh.health_details.length > 0)) && (
          <div className={`mt-2.5 p-2 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
            <div className="flex items-start gap-1.5">
              <Shield size={11} className={`shrink-0 mt-0.5 ${config.color}`} />
              <ul className="space-y-0.5 flex-1">
                {bh?.health_details.slice(0, 2).map((d, i) => (
                  <li key={`bh-${i}`} className="text-[9px] text-gray-600 leading-tight">• {d}</li>
                ))}
                {disk.health_details.filter(h => !bh?.health_details.includes(h)).slice(0, 2).map((d, i) => (
                  <li key={`sp-${i}`} className="text-[9px] text-gray-600 leading-tight">• {d}</li>
                ))}
              </ul>
            </div>
            {bh?.model && bh.model !== 'Unknown' && (
              <div className="mt-1 pt-1.5 border-t border-current opacity-20 flex items-center gap-1.5">
                <Cpu size={9} className="opacity-60" />
                <span className="text-[8px] opacity-70 truncate">{bh.model}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default function DiskMonitor({ compact = false }: { compact?: boolean }) {
  const [diskData, setDiskData] = useState<DiskInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/disk/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DiskInfoResponse = await res.json();
      if (data.status === 'error') throw new Error('获取磁盘信息失败');
      setDiskData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取磁盘信息失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInfo(); const iv = setInterval(fetchInfo, 30000); return () => clearInterval(iv); }, [fetchInfo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2.5">
        <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400">获取磁盘信息...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2.5">
        <AlertTriangle size={22} className="text-amber-400" />
        <span className="text-xs text-gray-500">获取失败</span>
        <button onClick={fetchInfo} className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-600 text-[10px] font-medium hover:bg-teal-100">重试</button>
      </div>
    );
  }

  const drives = diskData?.drives || [];
  const cDrive = drives.find(d => d.device === 'C');
  const dDrive = drives.find(d => d.device === 'D');
  const otherDrives = drives.filter(d => d.device !== 'C' && d.device !== 'D');

  if (compact) {
    return (
      <div className="space-y-3">
        {[cDrive, dDrive, ...otherDrives].filter(Boolean).map(d => (
          <CompactDiskCard key={d!.device} disk={d!} />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
            <HardDrive size={12} className="text-white" />
          </div>
          <span className="font-semibold text-xs text-gray-800">磁盘容量监控</span>
        </div>
        <button onClick={fetchInfo} className="p-1 rounded text-gray-400 hover:text-teal-600 hover:bg-teal-50">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {[cDrive, dDrive, ...otherDrives].filter(Boolean).map(d => (
          <CompactDiskCard key={d!.device} disk={d!} />
        ))}

        {!drives.length && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <Database size={26} className="opacity-35" />
            <span className="text-xs">未检测到磁盘</span>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-[9px] text-gray-400">
        <span>磁盘数: {drives.length} | 系统: {diskData?.system}</span>
        <span>30s 自动刷新</span>
      </div>
    </div>
  );
}