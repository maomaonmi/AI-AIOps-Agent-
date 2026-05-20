import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wifi, ArrowUp, ArrowDown, Activity, Globe,
  Server, Radio, Network, Cable, Router,
  AlertCircle, Zap, ChevronDown, MoveUp, MoveDown, Monitor,
} from 'lucide-react';
import ReactEChartsCore from 'echarts-for-react';
import * as echarts from 'echarts';

interface IPAddr {
  address: string;
  netmask: string | null;
  broadcast: string | null;
  family: string;
}

interface NetInterface {
  name: string;
  display_name: string;
  nic_type: string;
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
  errin: number;
  errout: number;
  dropin: number;
  dropout: number;
  upload_speed_bytes: number;
  download_speed_bytes: number;
  is_up: boolean;
  speed_mbps: number;
  mtu: number;
  ipv4_addresses: IPAddr[];
  ipv6_addresses: IPAddr[];
  total_bytes_sent: number;
  total_bytes_recv: number;
}

interface NetInfoResponse {
  status: string;
  interfaces: NetInterface[];
  timestamp: string;
}

const MAX_HISTORY = 90;

const nicTypeIcons: Record<string, React.ReactNode> = {
  'Ethernet': <Cable size={12} />,
  'Wi-Fi': <Wifi size={12} />,
  'Loopback': <Server size={12} />,
  'Virtual': <Monitor size={12} />,
  'Tunnel/VPN': <Network size={12} />,
  'Bluetooth': <Radio size={12} />,
};

const nicTypeColors: Record<string, string> = {
  'Ethernet': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'Wi-Fi': 'text-blue-600 bg-blue-50 border-blue-200',
  'Loopback': 'text-gray-500 bg-gray-50 border-gray-200',
  'Virtual': 'text-violet-600 bg-violet-50 border-violet-200',
  'Tunnel/VPN': 'text-purple-600 bg-purple-50 border-purple-200',
  'Bluetooth': 'text-cyan-600 bg-cyan-50 border-cyan-200',
  'Other': 'text-slate-500 bg-slate-50 border-slate-200',
};

interface HistoryPoint {
  time: string;
  upload: number;
  download: number;
}

function formatSpeed(bps: number): { val: string; unit: string } {
  const abs = Math.abs(bps);
  if (abs >= 1024**3) return { val: (bps / 1024**3).toFixed(2), unit: 'GB/s' };
  if (abs >= 1024**2) return { val: (bps / 1024**2).toFixed(1), unit: 'MB/s' };
  if (abs >= 1024) return { val: (bps / 1024).toFixed(0), unit: 'KB/s' };
  return { val: bps.toFixed(0), unit: 'B/s' };
}

function formatTraffic(total: number): string {
  const abs = Math.abs(total);
  if (abs >= 1024**4) return `${(total / 1024**4).toFixed(2)} TB`;
  if (abs >= 1024**3) return `${(total / 1024**3).toFixed(2)} GB`;
  if (abs >= 1024**2) return `${(total / 1024**2).toFixed(1)} MB`;
  if (abs >= 1024) return `${(total / 1024).toFixed(0)} KB`;
  return `${total} B`;
}

function cleanIPv6(addr: string): string {
  return addr.split('%')[0];
}

export default function NetworkMonitor() {
  const [netData, setNetData] = useState<NetInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNic, setSelectedNic] = useState<string>('');
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [showAllNics, setShowAllNics] = useState(false);
  const echartsRef = useRef<any>(null);

  const fetchNetwork = useCallback(async () => {
    try {
      const res = await fetch('/api/network/info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NetInfoResponse = await res.json();
      if (data.status === 'error') throw new Error('Network info request failed');
      setNetData(data);

      const activeNics = data.interfaces.filter(i => i.is_up);
      const currentNic = selectedNic && data.interfaces.find(i => i.name === selectedNic)?.is_up
        ? selectedNic
        : (activeNics.length > 0 ? activeNics[0].name : '');

      if (currentNic !== selectedNic && currentNic) {
        setSelectedNic(currentNic);
        setHistory([]);
      }

      const target = data.interfaces.find(i => i.name === currentNic);
      if (target) {
        const now = new Date();
        const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        setHistory(prev => {
          const pt: HistoryPoint = {
            time: ts,
            upload: target.upload_speed_bytes,
            download: target.download_speed_bytes,
          };
          const next = [...prev, pt];
          if (next.length > MAX_HISTORY) return next.slice(-MAX_HISTORY);
          return next;
        });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取网络数据失败');
    } finally {
      setLoading(false);
    }
  }, [selectedNic]);

  useEffect(() => { fetchNetwork(); const iv = setInterval(fetchNetwork, 2000); return () => clearInterval(iv); }, [fetchNetwork]);

  if (loading && !netData) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <div className="relative">
          <Globe size={36} className="text-emerald-300 animate-pulse" />
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
        </div>
        <span className="text-sm text-gray-400">正在采集网络流量数据...</span>
      </div>
    );
  }

  if (error && !netData) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3">
        <Wifi size={32} className="text-red-300" />
        <span className="text-sm text-red-500">{error}</span>
        <button onClick={fetchNetwork} className="mt-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100">重试</button>
      </div>
    );
  }

  if (!netData) return null;

  const activeNics = netData.interfaces.filter(i => i.is_up);
  const currentNic = netData.interfaces.find(i => i.name === selectedNic) || activeNics[0];
  const displayedNics = showAllNics ? netData.interfaces : activeNics.slice(0, 6);

  const chartOption = history.length < 2 ? {} : {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      borderRadius: 12,
      padding: [12, 16],
      textStyle: { color: '#334155', fontSize: 12, fontFamily: 'inherit' },
      formatter: (params: any) => {
        const pts = Array.isArray(params) ? params : [params];
        const time = pts[0]?.axisValue || '';
        let html = `<div style="font-weight:700;margin-bottom:6px;color:#64748b;">${time}</div>`;
        pts.forEach((p: any) => {
          const sp = formatSpeed(p.value);
          html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
            <span style="color:#64748b;">${p.seriesName}:</span>
            <span style="font-weight:700;color:#1e293b;">${sp.val} ${sp.unit}</span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 12, itemHeight: 8, itemGap: 24,
    },
    grid: { top: 12, right: 20, bottom: 32, left: 52 },
    xAxis: {
      type: 'category',
      data: history.map(h => h.time),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, interval: Math.max(Math.floor(history.length / 6), 1) },
    },
    yAxis: {
      type: 'value',
      name: '速度',
      nameTextStyle: { color: '#94a3b8', fontSize: 9 },
      axisLabel: {
        color: '#94a3b8', fontSize: 9,
        formatter: (v: number) => v >= 1024**2 ? `${(v / 1024**2).toFixed(0)} MB/s` : v >= 1024 ? `${(v / 1024).toFixed(0)} KB/s` : `${v} B/s`,
      },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [
      {
        name: '下载速度',
        type: 'line',
        data: history.map(h => h.download),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#10b981' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16,185,129,0.22)' },
            { offset: 1, color: 'rgba(16,185,129,0.01)' },
          ]),
        },
      },
      {
        name: '上传速度',
        type: 'line',
        data: history.map(h => h.upload),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#f59e0b' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245,158,11,0.22)' },
            { offset: 1, color: 'rgba(245,158,11,0.01)' },
          ]),
        },
      },
    ],
  };

  const upSpeed = formatSpeed(currentNic?.upload_speed_bytes || 0);
  const dnSpeed = formatSpeed(currentNic?.download_speed_bytes || 0);

  return (
    <div className="space-y-4">

      {/* NIC Selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-gray-400 shrink-0 mr-1">网卡:</span>
        {displayedNics.map(nic => {
          const colors = nicTypeColors[nic.nic_type] || nicTypeColors['Other'];
          const isActive = nic.name === selectedNic;
          return (
            <button
              key={nic.name}
              onClick={() => { setSelectedNic(nic.name); setHistory([]); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap border ${
                isActive ? `${colors} shadow-sm ring-1 ring-offset-0` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              } ${!nic.is_up ? 'opacity-50 line-through' : ''}`}
              title={nic.display_name}
            >
              {nicTypeIcons[nic.nic_type] || <Globe size={12} />}
              <span className="max-w-[80px] truncate">{nic.display_name}</span>
              {!nic.is_up && <AlertCircle size={9} className="text-gray-400" />}
            </button>
          );
        })}
        {netData.interfaces.filter(i => i.is_up).length > 6 && (
          <button
            onClick={() => setShowAllNics(!showAllNics)}
            className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
          >
            <ChevronDown size={10} className={showAllNics ? 'rotate-180' : ''} />
            <span>{showAllNics ? '收起' : `${netData.interfaces.filter(i => i.is_up).length - 6}+`}</span>
          </button>
        )}
      </div>

      {/* Speed Gauges */}
      {currentNic && (
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-cyan-50/30 border border-emerald-100/60">
          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl p-3.5 border border-white shadow-sm">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <ArrowDown size={20} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400">下载速度 (Download)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-black text-emerald-600 tabular-nums">{dnSpeed.val}</span>
                <span className="text-[11px] text-emerald-500 font-medium">{dnSpeed.unit}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl p-3.5 border border-white shadow-sm">
            <div className="p-2.5 rounded-xl bg-amber-100">
              <ArrowUp size={20} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-gray-400">上传速度 (Upload)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-black text-amber-600 tabular-nums">{upSpeed.val}</span>
                <span className="text-[11px] text-amber-500 font-medium">{upSpeed.unit}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards */}
      {currentNic && (
        <div className="grid grid-cols-4 gap-x-3 gap-y-2">
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="text-[9px] text-gray-400 mb-0.5">累计下载</div>
            <div className="text-xs font-bold text-emerald-600 truncate">{formatTraffic(currentNic.total_bytes_recv)}</div>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="text-[9px] text-gray-400 mb-0.5">累计上传</div>
            <div className="text-xs font-bold text-amber-600 truncate">{formatTraffic(currentNic.total_bytes_sent)}</div>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="text-[9px] text-gray-400 mb-0.5">链路速率</div>
            <div className="text-xs font-bold text-blue-600">{currentNic.speed_mbps > 0 ? `${currentNic.speed_mbps} Mbps` : '--'}</div>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="text-[9px] text-gray-400 mb-0.5">MTU</div>
            <div className="text-xs font-bold text-violet-600">{currentNic.mtu > 0 ? currentNic.mtu : '--'}</div>
          </div>
        </div>
      )}

      {/* Packets Stats */}
      {currentNic && (
        <div className="grid grid-cols-4 gap-x-3 gap-y-2">
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="flex items-center gap-1 text-[9px] text-gray-400 mb-0.5">
              <MoveDown size={9} /> 收发数据包
            </div>
            <div className="text-[10px] font-medium text-gray-700 tabular-nums space-x-1">
              <span className="text-emerald-600">{currentNic.packets_recv.toLocaleString()}</span>
              <span className="text-gray-300">/</span>
              <span className="text-amber-600">{currentNic.packets_sent.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="flex items-center gap-1 text-[9px] text-gray-400 mb-0.5">
              <AlertCircle size={9} /> 错误包
            </div>
            <div className="text-[10px] font-medium tabular-nums space-x-1">
              <span className={currentNic.errin > 0 ? 'text-red-500' : 'text-gray-500'}>{currentNic.errin.toLocaleString()}</span>
              <span className="text-gray-300">/</span>
              <span className={currentNic.errout > 0 ? 'text-red-500' : 'text-gray-500'}>{currentNic.errout.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="flex items-center gap-1 text-[9px] text-gray-400 mb-0.5">
              <Zap size={9} /> 丢弃包
            </div>
            <div className="text-[10px] font-medium tabular-nums space-x-1">
              <span className={currentNic.dropin > 0 ? 'text-orange-500' : 'text-gray-500'}>{currentNic.dropin.toLocaleString()}</span>
              <span className="text-gray-300">/</span>
              <span className={currentNic.dropout > 0 ? 'text-orange-500' : 'text-gray-500'}>{currentNic.dropout.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-2.5 border border-gray-100">
            <div className="flex items-center gap-1 text-[9px] text-gray-400 mb-0.5">
              <Router size={9} /> 连接速率
            </div>
            <div className="text-[10px] font-medium text-gray-700">
              <span className={currentNic.speed_mbps >= 1000 ? 'text-emerald-600 font-bold' : 'text-gray-600'}>
                {currentNic.speed_mbps > 0 ? `${currentNic.speed_mbps} Mbps` : '未知'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ECharts Live Traffic Curve */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
            <Activity size={13} className="text-emerald-500" />
            {currentNic ? `${currentNic.display_name} - 实时流量` : '实时流量'}
          </span>
          <span className="text-[9px] text-gray-400">每 2 秒刷新 · 共 {history.length} 点</span>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          {history.length >= 2 ? (
            <ReactEChartsCore
              ref={echartsRef}
              echarts={echarts}
              option={chartOption}
              style={{ height: 220, width: '100%' }}
              notMerge={true}
              lazyUpdate={true}
            />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-gray-300 text-xs">
              <Activity size={14} className="mr-2 animate-pulse" />
              收集数据中...
            </div>
          )}
        </div>
      </div>

      {/* IP Addresses */}
      {currentNic && (currentNic.ipv4_addresses.length > 0 || currentNic.ipv6_addresses.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-100/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1 rounded bg-blue-100">
                <Globe size={11} className="text-blue-600" />
              </div>
              <span className="text-[11px] font-semibold text-blue-700">IPv4 地址</span>
            </div>
            {currentNic.ipv4_addresses.length > 0 ? (
              <div className="space-y-1.5">
                {currentNic.ipv4_addresses.map((ip, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/70 rounded-lg px-2.5 py-1.5 border border-blue-50">
                    <code className="text-xs font-mono font-bold text-blue-700">{ip.address}</code>
                    {ip.netmask && <span className="text-[9px] text-gray-400">{ip.netmask}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400">无 IPv4 地址</span>
            )}
          </div>

          <div className="rounded-xl bg-gradient-to-br from-violet-50/60 to-purple-50/40 border border-violet-100/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="p-1 rounded bg-violet-100">
                <Network size={11} className="text-violet-600" />
              </div>
              <span className="text-[11px] font-semibold text-violet-700">IPv6 地址</span>
            </div>
            {currentNic.ipv6_addresses.length > 0 ? (
              <div className="space-y-1.5 max-h-[80px] overflow-y-auto">
                {currentNic.ipv6_addresses.map((ip, i) => (
                  <div key={i} className="bg-white/70 rounded-lg px-2.5 py-1 border border-violet-50">
                    <code className="text-[10px] font-mono text-violet-700 break-all">{cleanIPv6(ip.address)}</code>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400">无 IPv6 地址</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}