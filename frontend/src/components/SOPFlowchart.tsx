import React, { useState, useMemo } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import type { FlowStep } from '../types/moduleData';

interface SOPFlowchartProps {
  steps: FlowStep[];
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 52;
const HORIZONTAL_GAP = 50;
const VERTICAL_GAP = 20;
const PADDING = 30;

function getStepColor(type: FlowStep['type']) {
  switch (type) {
    case 'start':
      return { bg: '#10b981', light: '#d1fae5', dark: '#059669', text: '#065f46' };
    case 'end':
      return { bg: '#6b7280', light: '#f3f4f6', dark: '#4b5563', text: '#374151' };
    case 'decision':
      return { bg: '#f59e0b', light: '#fef3c7', dark: '#d97706', text: '#92400e' };
    case 'action':
      return { bg: '#ef4444', light: '#fee2e2', dark: '#dc2626', text: '#991b1b' };
    default:
      return { bg: '#3b82f6', light: '#dbeafe', dark: '#2563eb', text: '#1e40af' };
  }
}

function getTypeLabel(type: FlowStep['type']) {
  switch (type) {
    case 'start': return '开始';
    case 'end': return '结束';
    case 'decision': return '判断';
    case 'action': return '操作';
    default: return '步骤';
  }
}

function computeLayout(steps: FlowStep[]) {
  const stepMap = new Map<string, FlowStep>();
  steps.forEach(s => stepMap.set(s.id, s));

  const colMap = new Map<string, number>();
  const rowMap = new Map<string, number>();
  const visited = new Set<string>();

  const queue: { id: string; col: number }[] = [];
  const startStep = steps[0];
  if (!startStep) return { colMap, rowMap, numCols: 0, maxRows: 0 };

  queue.push({ id: startStep.id, col: 0 });
  visited.add(startStep.id);
  colMap.set(startStep.id, 0);
  rowMap.set(startStep.id, 0);

  const colItems = new Map<number, string[]>();
  colItems.set(0, [startStep.id]);

  while (queue.length > 0) {
    const { id, col } = queue.shift()!;
    const step = stepMap.get(id);
    if (!step) continue;

    const nextIds = [...(step.nextSteps || []), ...(step.decisionBranches || []).map(b => b.nextStep)];

    nextIds.forEach(nextId => {
      if (!visited.has(nextId)) {
        visited.add(nextId);
        const nextCol = col + 1;
        const items = colItems.get(nextCol) || [];
        const row = items.length;
        items.push(nextId);
        colItems.set(nextCol, items);
        colMap.set(nextId, nextCol);
        rowMap.set(nextId, row);
        queue.push({ id: nextId, col: nextCol });
      }
    });
  }

  const numCols = colItems.size;
  const maxRows = Math.max(...Array.from(colItems.values()).map(arr => arr.length));

  return { colMap, rowMap, numCols, maxRows };
}

export function SOPFlowchart({ steps }: SOPFlowchartProps) {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const { colMap, rowMap, numCols, maxRows } = useMemo(() => computeLayout(steps), [steps]);

  const svgWidth = numCols * (NODE_WIDTH + HORIZONTAL_GAP) + PADDING * 2;
  const svgHeight = maxRows * (NODE_HEIGHT + VERTICAL_GAP) + PADDING * 2;

  const getNodeX = (col: number) => PADDING + col * (NODE_WIDTH + HORIZONTAL_GAP);
  const getNodeY = (row: number) => PADDING + row * (NODE_HEIGHT + VERTICAL_GAP);

  const renderConnections = () => {
    const elements: React.ReactNode[] = [];

    steps.forEach(step => {
      const col = colMap.get(step.id);
      const row = rowMap.get(step.id);
      if (col === undefined || row === undefined) return;

      const startX = getNodeX(col) + NODE_WIDTH;
      const startY = getNodeY(row) + NODE_HEIGHT / 2;
      const color = getStepColor(step.type);

      const nextIds = step.nextSteps || [];
      const branches = step.decisionBranches || [];

      nextIds.forEach(nextId => {
        const nextCol = colMap.get(nextId);
        const nextRow = rowMap.get(nextId);
        if (nextCol === undefined || nextRow === undefined) return;

        const endX = getNodeX(nextCol);
        const endY = getNodeY(nextRow) + NODE_HEIGHT / 2;
        const midX = (startX + endX) / 2;

        elements.push(
          <path
            key={`conn-${step.id}-${nextId}`}
            d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
            fill="none"
            stroke={color.bg}
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
            opacity={0.5}
          />
        );
      });

      branches.forEach((branch, bi) => {
        const nextCol = colMap.get(branch.nextStep);
        const nextRow = rowMap.get(branch.nextStep);
        if (nextCol === undefined || nextRow === undefined) return;

        const endX = getNodeX(nextCol);
        const endY = getNodeY(nextRow) + NODE_HEIGHT / 2;

        const branchY = startY + (bi === 0 ? -14 : 14);
        const midX = (startX + endX) / 2;

        elements.push(
          <g key={`branch-${step.id}-${branch.nextStep}`}>
            <path
              d={`M ${startX} ${branchY} C ${midX} ${branchY}, ${midX} ${endY}, ${endX} ${endY}`}
              fill="none"
              stroke={color.bg}
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
              opacity={0.5}
            />
            <rect
              x={midX - 28}
              y={Math.min(branchY, endY) - 9}
              width={56}
              height={18}
              rx={9}
              fill="white"
              stroke={color.dark}
              strokeWidth={1}
              opacity={0.95}
            />
            <text
              x={midX}
              y={Math.min(branchY, endY) + 3}
              textAnchor="middle"
              fontSize={9}
              fill={color.text}
              fontWeight={600}
            >
              {branch.label}
            </text>
          </g>
        );
      });
    });

    return elements;
  };

  const renderNodes = () => {
    return steps.map((step, index) => {
      const col = colMap.get(step.id);
      const row = rowMap.get(step.id);
      if (col === undefined || row === undefined) return null;

      const x = getNodeX(col);
      const y = getNodeY(row);
      const color = getStepColor(step.type);
      const isHovered = hoveredStep === step.id;
      const isExpanded = expandedStep === step.id;
      const hasBranches = step.decisionBranches && step.decisionBranches.length > 0;
      const shortLabel = step.label.length > 10 ? step.label.slice(0, 10) + '…' : step.label;

      return (
        <g
          key={step.id}
          onMouseEnter={() => setHoveredStep(step.id)}
          onMouseLeave={() => setHoveredStep(null)}
          onClick={() => setExpandedStep(isExpanded ? null : step.id)}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <filter id={`shadow-${step.id}`} x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy={isHovered ? 4 : 2} stdDeviation={isHovered ? 6 : 4} floodColor={color.bg} floodOpacity={isHovered ? 0.3 : 0.12} />
            </filter>
            <linearGradient id={`grad-${step.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color.bg} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color.bg} stopOpacity={0.04} />
            </linearGradient>
          </defs>

          <rect
            x={x}
            y={y}
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={12}
            fill="white"
            stroke={isHovered ? color.bg : color.dark}
            strokeWidth={isHovered ? 2 : 1.5}
            filter={`url(#shadow-${step.id})`}
            opacity={isHovered ? 1 : 0.95}
          />

          <rect
            x={x}
            y={y}
            width={4}
            height={NODE_HEIGHT}
            rx={2}
            fill={color.bg}
          />

          <circle
            cx={x + 22}
            cy={y + NODE_HEIGHT / 2}
            r={13}
            fill={`url(#grad-${step.id})`}
            stroke={color.bg}
            strokeWidth={1.5}
          />

          {step.type === 'start' && (
            <polygon points={`${x + 18},${y + 20} ${x + 18},${y + 34} ${x + 28},${y + 27}`} fill={color.bg} />
          )}
          {step.type === 'end' && (
            <rect x={x + 17} y={y + 21} width={10} height={10} rx={2} fill={color.bg} />
          )}
          {step.type === 'decision' && (
            <polygon points={`${x + 22},${y + 17} ${x + 28},${y + 26} ${x + 22},${y + 35} ${x + 16},${y + 26}`} fill={color.bg} />
          )}
          {step.type === 'action' && (
            <>
              <circle cx={x + 22} cy={y + 26} r={5} fill="none" stroke={color.bg} strokeWidth={2} />
              <line x1={x + 22} y1={y + 22} x2={x + 22} y2={y + 26} stroke={color.bg} strokeWidth={2} />
            </>
          )}
          {step.type === 'process' && (
            <>
              <polyline points={`${x + 18},${y + 26} ${x + 21},${y + 29} ${x + 27},${y + 23}`} fill="none" stroke={color.bg} strokeWidth={2} />
            </>
          )}

          <rect
            x={x + NODE_WIDTH - 26}
            y={y + 5}
            width={20}
            height={16}
            rx={8}
            fill={color.light}
            stroke={color.dark}
            strokeWidth={0.5}
          />
          <text
            x={x + NODE_WIDTH - 16}
            y={y + 17}
            textAnchor="middle"
            fontSize={9}
            fill={color.text}
            fontWeight={700}
          >
            {index + 1}
          </text>

          <text
            x={x + 42}
            y={y + 22}
            fontSize={11.5}
            fill="#1f2937"
            fontWeight={600}
          >
            {shortLabel}
          </text>

          <rect
            x={x + 42}
            y={y + 32}
            width={36}
            height={13}
            rx={6.5}
            fill={color.light}
          />
          <text
            x={x + 60}
            y={y + 41.5}
            textAnchor="middle"
            fontSize={8.5}
            fill={color.text}
            fontWeight={600}
          >
            {getTypeLabel(step.type)}
          </text>

          {isExpanded && step.description && (
            <g>
              <rect
                x={x - 8}
                y={y + NODE_HEIGHT + 6}
                width={NODE_WIDTH + 16}
                height={hasBranches ? 72 : 44}
                rx={10}
                fill="white"
                stroke="#e5e7eb"
                strokeWidth={1}
                filter="url(#shadow-detail)"
              />
              <text
                x={x + 2}
                y={y + NODE_HEIGHT + 22}
                fontSize={9.5}
                fill="#6b7280"
              >
                {step.description.length > 50 ? step.description.slice(0, 50) + '…' : step.description}
              </text>
              {hasBranches && step.decisionBranches && (
                <>
                  <text
                    x={x + 2}
                    y={y + NODE_HEIGHT + 40}
                    fontSize={9}
                    fill="#9ca3af"
                    fontWeight={600}
                  >
                    分支:
                  </text>
                  {step.decisionBranches.map((branch, bi) => (
                    <g key={bi}>
                      <rect
                        x={x + 2 + bi * 90}
                        y={y + NODE_HEIGHT + 46}
                        width={84}
                        height={18}
                        rx={6}
                        fill={color.light}
                        stroke={color.dark}
                        strokeWidth={0.5}
                      />
                      <text
                        x={x + 44 + bi * 90}
                        y={y + NODE_HEIGHT + 58}
                        textAnchor="middle"
                        fontSize={8.5}
                        fill={color.text}
                        fontWeight={600}
                      >
                        {branch.label}
                      </text>
                    </g>
                  ))}
                </>
              )}
            </g>
          )}
        </g>
      );
    });
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-gray-500">开始</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[10px] text-gray-500">步骤</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-gray-500">判断</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-gray-500">操作</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
            <span className="text-[10px] text-gray-500">结束</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          点击节点查看详情
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/50">
        <svg
          width={svgWidth}
          height={svgHeight + (expandedStep ? 90 : 0)}
          className="min-w-full"
          style={{ minHeight: svgHeight }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" opacity={0.5} />
            </marker>
            <filter id="shadow-detail" x="-5%" y="-5%" width="110%" height="120%">
              <feDropShadow dx="0" dy={2} stdDeviation={3} floodColor="#000" floodOpacity={0.06} />
            </filter>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth={0.5} />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />
          {renderConnections()}
          {renderNodes()}
        </svg>
      </div>
    </div>
  );
}

interface SOPDocumentCardProps {
  document: {
    id: string;
    title: string;
    category: string;
    description: string;
    steps: FlowStep[];
    tags: string[];
    lastUpdated: string;
    version: string;
    author: string;
    estimatedTime: string;
  };
  onApply?: (query: string) => void;
}

export function SOPDocumentCard({ document, onApply }: SOPDocumentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-transparent">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-md shadow-indigo-200">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">{document.title}</h3>
              <p className="text-[11px] text-indigo-600 font-medium">{document.category}</p>
            </div>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
            v{document.version}
          </span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{document.description}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {document.author}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {document.estimatedTime}
          </span>
          <span className="text-gray-400">更新于 {document.lastUpdated}</span>
        </div>
      </div>

      <div className="px-5 py-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group"
        >
          <div className={`p-1 rounded-md bg-indigo-50 group-hover:bg-indigo-100 transition-colors ${isExpanded ? 'rotate-90' : ''}`}>
            <ChevronRight size={14} />
          </div>
          查看流程图
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
            {document.steps.length} 个步骤
          </span>
        </button>

        {isExpanded && (
          <div className="mt-4">
            <SOPFlowchart steps={document.steps} />
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {document.tags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
          {onApply && (
            <button
              onClick={() => onApply(`执行SOP: ${document.title}`)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-xs font-semibold hover:from-indigo-600 hover:to-blue-700 transition-all shadow-sm hover:shadow-md"
            >
              应用到当前故障
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
