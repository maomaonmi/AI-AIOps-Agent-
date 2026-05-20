import { useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import FeaturePanel from './components/FeaturePanel';
import BrainPanel from './components/BrainPanel';
import DashboardPanel from './components/DashboardPanel';
import CodeOpsPanel from './components/CodeOpsPanel';
import OrchestrationPanel from './components/OrchestrationPanel';
import ReportPanel from './components/ReportPanel';
import FloatingPanel from './components/FloatingPanel';
import QuickActionModal from './components/QuickActionModal';
import { useAppStore } from './store';
import { useIsMobile } from './hooks/useIsMobile';

function App() {
  const { activeFeature, activeModuleType, panelWidth, setSidebarOpen, sidebarOpen, setPanelWidth, userProfile, learningPaths, learningMode, setLearningMode, updateLearningProgress, floatingPanelType, setFloatingPanel, quickActionType, setQuickAction } = useAppStore();
  const isMobile = useIsMobile();
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setPanelWidth]);

  const showPanelWithChat = activeFeature && activeModuleType;
  const showFullPanel = activeFeature && !activeModuleType;
  const showBrainPanel = activeModuleType === 'brain';
  const showDashboardPanel = activeModuleType === 'dashboard';
  const showCodeOpsPanel = activeModuleType === 'codeops';
  const showOrchestrationPanel = activeModuleType === 'orchestration';
  const showReportPanel = activeModuleType === 'reports';

  return (
    <div className="flex h-full w-full bg-white">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`${isMobile && sidebarOpen ? 'fixed z-50 h-full' : ''}`}>
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 relative">
        {showPanelWithChat ? (
          <div className="flex-1 flex flex-row min-h-0">
            {/* Left: Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 relative">
              <ChatArea />
              <ChatInput />
              {floatingPanelType && (
                <FloatingPanel panelType={floatingPanelType as any} onClose={() => setFloatingPanel(null)} onSwitchPanel={setFloatingPanel} />
              )}
            </div>
            {/* Resizer Handle */}
            <div
              className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-indigo-400 hover:w-2 transition-all shrink-0 relative group"
              onMouseDown={handleMouseDown}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            {/* Right: Module Panel */}
            <div className="flex-shrink-0 overflow-y-auto bg-gray-50" style={{ width: `${panelWidth}px` }}>
              <FeaturePanel />
            </div>
          </div>
        ) : showFullPanel ? (
          <div className="flex-1 flex items-start justify-center overflow-y-auto">
            <FeaturePanel />
          </div>
        ) : showBrainPanel ? (
          <div className="flex-1 flex flex-row min-h-0">
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 relative">
              <ChatArea />
              <ChatInput />
              {floatingPanelType && (
                <FloatingPanel panelType={floatingPanelType as any} onClose={() => setFloatingPanel(null)} onSwitchPanel={setFloatingPanel} />
              )}
            </div>
            <div className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-indigo-400 hover:w-2 transition-all shrink-0 relative group" onMouseDown={handleMouseDown}>
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <div className="flex-shrink-0 overflow-y-auto bg-gray-50" style={{ width: `${panelWidth}px` }}>
              <BrainPanel
                userProfile={userProfile}
                learningPaths={learningPaths}
                learningMode={learningMode}
                onSetLearningMode={setLearningMode}
                onUpdateProgress={updateLearningProgress}
              />
            </div>
          </div>
        ) : showDashboardPanel ? (
          <div className="flex-1 flex flex-row min-h-0">
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 relative">
              <ChatArea />
              <ChatInput />
              {floatingPanelType && (
                <FloatingPanel panelType={floatingPanelType as any} onClose={() => setFloatingPanel(null)} onSwitchPanel={setFloatingPanel} />
              )}
            </div>
            <div className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-cyan-400 hover:w-2 transition-all shrink-0 relative group" onMouseDown={handleMouseDown}>
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <div className="flex-shrink-0 overflow-hidden bg-white" style={{ width: `${Math.max(panelWidth, 600)}px` }}>
              <DashboardPanel
                topologyData={{
                  nodes: [
                    { id: "gw-1", name: "API Gateway", type: "gateway", status: "healthy", metrics: { qps: 2350, errorRate: 0.12, p99Latency: 45 } },
                    { id: "svc-user", name: "User Service", type: "service", status: "healthy", metrics: { qps: 1200, errorRate: 0.05, p99Latency: 32 } },
                    { id: "svc-order", name: "Order Service", type: "service", status: "warning", metrics: { qps: 850, errorRate: 2.3, p99Latency: 2800 } },
                    { id: "svc-payment", name: "Payment Service", type: "service", status: "healthy", metrics: { qps: 420, errorRate: 0.08, p99Latency: 95 } },
                    { id: "svc-inventory", name: "Inventory Service", type: "service", status: "warning", metrics: { qps: 680, errorRate: 1.8, p99Latency: 450 } },
                    { id: "svc-notification", name: "Notification Svc", type: "service", status: "healthy", metrics: { qps: 310, errorRate: 0.02, p99Latency: 68 } },
                    { id: "db-mysql", name: "MySQL Primary", type: "database", status: "warning", metrics: { qps: 5200, errorRate: 0.3, p99Latency: 12 } },
                    { id: "db-postgres", name: "PostgreSQL", type: "database", status: "healthy", metrics: { qps: 1800, errorRate: 0.01, p99Latency: 5 } },
                    { id: "cache-redis", name: "Redis Cluster", type: "cache", status: "healthy", metrics: { qps: 15000, errorRate: 0.001, p99Latency: 1 } },
                    { id: "mq-kafka", name: "Kafka Cluster", type: "queue", status: "warning", metrics: { qps: 4500, errorRate: 0.5, p99Latency: 150 } },
                  ],
                  edges: [
                    { source: "gw-1", target: "svc-user", latency: 12, qps: 1200 },
                    { source: "gw-1", target: "svc-order", latency: 15, qps: 850 },
                    { source: "gw-1", target: "svc-payment", latency: 18, qps: 420 },
                    { source: "svc-order", target: "svc-payment", latency: 25, qps: 320 },
                    { source: "svc-order", target: "svc-inventory", latency: 30, qps: 500 },
                    { source: "svc-order", target: "svc-notification", latency: 20, qps: 200 },
                    { source: "svc-order", target: "db-mysql", latency: 5, qps: 3000 },
                    { source: "svc-user", target: "db-mysql", latency: 4, qps: 800 },
                    { source: "svc-payment", target: "db-postgres", latency: 3, qps: 400 },
                    { source: "svc-inventory", target: "cache-redis", latency: 2, qps: 2500 },
                    { source: "svc-notification", target: "mq-kafka", latency: 10, qps: 300 },
                    { source: "svc-order", target: "mq-kafka", latency: 12, qps: 350 },
                  ],
                  timestamp: Date.now(),
                }}
                heatmapData={{
                  nodes: [
                    { id: "web_01", name: "web-prod-01", value: 92.3, status: "critical" },
                    { id: "web_02", name: "web-prod-02", value: 78.1, status: "warning" },
                    { id: "web_03", name: "web-prod-03", value: 56.4, status: "normal" },
                    { id: "web_04", name: "web-prod-04", value: 88.7, status: "warning" },
                    { id: "gw_01", name: "api-gateway-01", value: 95.2, status: "critical" },
                    { id: "gw_02", name: "api-gateway-02", value: 71.8, status: "warning" },
                    { id: "order_01", name: "order-svc-01", value: 85.6, status: "warning" },
                    { id: "order_02", name: "order-svc-02", value: 62.3, status: "normal" },
                    { id: "order_03", name: "order-svc-03", value: 73.9, status: "warning" },
                    { id: "user_01", name: "user-svc-01", value: 45.2, status: "normal" },
                    { id: "user_02", name: "user-svc-02", value: 51.8, status: "normal" },
                    { id: "pay_01", name: "payment-svc-01", value: 38.5, status: "normal" },
                    { id: "inv_01", name: "inventory-svc-01", value: 67.4, status: "normal" },
                    { id: "wk_01", name: "worker-01", value: 82.1, status: "warning" },
                    { id: "wk_02", name: "worker-02", value: 44.7, status: "normal" },
                    { id: "wk_03", name: "worker-03", value: 55.3, status: "normal" },
                    { id: "db_01", name: "db-primary-01", value: 76.8, status: "warning" },
                    { id: "db_r1", name: "db-replica-01", value: 42.1, status: "normal" },
                    { id: "db_r2", name: "db-replica-02", value: 39.5, status: "normal" },
                    { id: "cache_01", name: "cache-node-01", value: 58.9, status: "normal" },
                    { id: "cache_02", name: "cache-node-02", value: 61.2, status: "normal" },
                    { id: "cache_03", name: "cache-node-03", value: 54.6, status: "normal" },
                  ],
                  metricType: "cpu",
                  timestamp: Date.now(),
                  unit: "%",
                  avgValue: 64.8,
                  maxValue: 95.2,
                }}
                faultImpactData={{
                  faultSource: "Order Service",
                  faultType: "timeout",
                  startTime: Date.now() - 300000,
                  affectedServices: [
                    {
                      serviceId: "svc-payment",
                      serviceName: "Payment Service",
                      impactLevel: "high",
                      affectedUsers: 8500,
                      propagationPath: ["Order Service"],
                      metrics: { errorRateIncrease: 12.5, latencyIncrease: 380 },
                    },
                    {
                      serviceId: "svc-inventory",
                      serviceName: "Inventory Service",
                      impactLevel: "medium",
                      affectedUsers: 4200,
                      propagationPath: ["Order Service"],
                      metrics: { errorRateIncrease: 5.2, latencyIncrease: 180 },
                    },
                    {
                      serviceId: "svc-notification",
                      serviceName: "Notification Service",
                      impactLevel: "low",
                      affectedUsers: 1800,
                      propagationPath: ["Order Service"],
                      metrics: { errorRateIncrease: 2.1, latencyIncrease: 50 },
                    },
                    {
                      serviceId: "svc-user-api",
                      serviceName: "User API Endpoint",
                      impactLevel: "medium",
                      affectedUsers: 6500,
                      propagationPath: ["Order Service", "Payment Service"],
                      metrics: { errorRateIncrease: 3.8, latencyIncrease: 220 },
                    },
                  ],
                  totalAffectedUsers: 21000,
                  description: "Order Service 响应超时",
                }}
              />
            </div>
          </div>
        ) : showCodeOpsPanel ? (
          <div className="flex-1 flex flex-row min-h-0">
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 relative">
              <ChatArea />
              <ChatInput />
              {floatingPanelType && (
                <FloatingPanel panelType={floatingPanelType as any} onClose={() => setFloatingPanel(null)} onSwitchPanel={setFloatingPanel} />
              )}
            </div>
            <div className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-orange-400 hover:w-2 transition-all shrink-0 relative group" onMouseDown={handleMouseDown}>
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <div className="flex-shrink-0 overflow-hidden bg-white" style={{ width: `${Math.max(panelWidth, 700)}px` }}>
              <CodeOpsPanel />
            </div>
          </div>
        ) : showOrchestrationPanel ? (
          <div className="flex-1 flex flex-row min-h-0">
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 relative">
              <ChatArea />
              <ChatInput />
              {floatingPanelType && (
                <FloatingPanel panelType={floatingPanelType as any} onClose={() => setFloatingPanel(null)} onSwitchPanel={setFloatingPanel} />
              )}
            </div>
            <div className="w-1.5 cursor-col-resize bg-gray-200 hover:bg-violet-400 hover:w-2 transition-all shrink-0 relative group" onMouseDown={handleMouseDown}>
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
            <div className="flex-shrink-0 overflow-hidden bg-white" style={{ width: `${Math.max(panelWidth, 700)}px` }}>
              <OrchestrationPanel />
            </div>
          </div>
        ) : showReportPanel ? (
          <div className="flex-1 flex flex-row min-h-0">
            <ReportPanel />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
            <ChatArea />
            <ChatInput />
            {floatingPanelType && (
              <FloatingPanel
                panelType={floatingPanelType as any}
                onClose={() => setFloatingPanel(null)}
                onSwitchPanel={setFloatingPanel}
              />
            )}
          </div>
        )}

        {quickActionType && (
          <QuickActionModal
            actionType={quickActionType as any}
            onClose={() => setQuickAction(null)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
