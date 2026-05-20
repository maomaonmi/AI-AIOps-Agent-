import React, { useState, useCallback } from 'react';
import { FileText, BarChart3, Search, Download, Loader2 } from 'lucide-react';
import DailyReport from './DailyReport';
import IncidentReview from './IncidentReview';
import SlaReport from './SlaReport';

type ReportTab = 'daily' | 'incident' | 'sla';

const COLOR_PROPS = [
  'color', 'background-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'text-decoration-color', 'caret-color', 'column-rule-color',
];

function linearSrgbToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;
  let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [linearSrgbToSrgb(r), linearSrgbToSrgb(g), linearSrgbToSrgb(bl)];
}

function oklchToRgbStr(value: string): string {
  return value.replace(/oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/g, (_, lStr, cStr, hStr, aStr) => {
    const L = parseFloat(lStr) / 100;
    const C = parseFloat(cStr);
    const H = parseFloat(hStr);
    const alpha = aStr ? (parseFloat(aStr.replace('%', '')) / 100) : 1;
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);
    const [r, g, bl] = oklabToLinearRgb(L, a, b);
    if (alpha < 1) return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)},${alpha.toFixed(2)})`;
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)})`;
  });
}

function oklabToRgbStr(value: string): string {
  return value.replace(/oklab\(([\d.]+%?)\s+([-\d.]+)\s+([-\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/g, (_, lStr, aStr, bStr, alphaStr) => {
    const L = parseFloat(lStr) / 100;
    const a = parseFloat(aStr);
    const b = parseFloat(bStr);
    const alpha = alphaStr ? (parseFloat(alphaStr.replace('%', '')) / 100) : 1;
    const [r, g, bl] = oklabToLinearRgb(L, a, b);
    if (alpha < 1) return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)},${alpha.toFixed(2)})`;
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bl * 255)})`;
  });
}

function toSafeColor(val: string): string {
  let result = oklabToRgbStr(oklchToRgbStr(val));
  result = result.replace(/oklch\([^)]*\)/gi, '#808080');
  result = result.replace(/oklab\([^)]*\)/gi, '#808080');
  return result;
}

function prepareCloneForExport(clone: HTMLElement) {
  const LAYOUT_PROPS = [
    'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'border-radius', 'border-width', 'border-style',
    'font-size', 'font-weight', 'line-height', 'text-align',
    'overflow', 'position', 'top', 'left', 'right', 'bottom',
    'flex-grow', 'flex-shrink', 'flex-basis', 'grid-template-columns', 'grid-gap',
    ...COLOR_PROPS,
  ];
  const allEls = clone.querySelectorAll('*');
  allEls.forEach(el => {
    const htmlEl = el as HTMLElement;
    const cs = getComputedStyle(htmlEl);
    LAYOUT_PROPS.forEach(prop => {
      const val = cs.getPropertyValue(prop).trim();
      if (val && val !== 'auto' && val !== 'normal' && val !== 'none' && val !== '0px') {
        if (prop.includes('color') || prop.includes('background')) {
          htmlEl.style.setProperty(prop, toSafeColor(val));
        } else {
          htmlEl.style.setProperty(prop, val);
        }
      }
    });
    const bs = cs.getPropertyValue('box-shadow').trim();
    if (bs && bs !== 'none') {
      htmlEl.style.setProperty('box-shadow', toSafeColor(bs));
    }
    if (el instanceof SVGElement) {
      ['fill', 'stroke'].forEach(attr => {
        const av = el.getAttribute(attr);
        if (av) el.setAttribute(attr, toSafeColor(av));
      });
      const styleAttr = el.getAttribute('style');
      if (styleAttr) el.setAttribute('style', toSafeColor(styleAttr));
    }
  });
}

const TABS: { id: ReportTab; label: string; icon: typeof FileText; desc: string }[] = [
  { id: 'daily', label: '日报/周报', icon: FileText, desc: '关键指标 · 异常事件 · AI洞察' },
  { id: 'incident', label: '故障复盘', icon: Search, desc: '时间线 · 根因分析 · 改进建议' },
  { id: 'sla', label: 'SLA报告', icon: BarChart3, desc: '可用性仪表盘 · 服务明细 · 停机统计' },
];

export default function ReportPanel() {
  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = useCallback(async (elementId: string, filename: string) => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById(elementId);
    if (!element) return;

    setIsExporting(true);

    try {
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc: Document) => {
            const SKIP_PROPS = new Set([
              'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
              'border-width', 'border-style', 'border-color',
              'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
              'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
              'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
              'outline', 'outline-width', 'outline-style', 'outline-color',
            ]);
            const allEls = clonedDoc.querySelectorAll('*');
            allEls.forEach(el => {
              const htmlEl = el as HTMLElement;
              const cs = getComputedStyle(htmlEl);
              for (let i = 0; i < cs.length; i++) {
                const prop = cs[i];
                if (SKIP_PROPS.has(prop)) continue;
                const val = cs.getPropertyValue(prop).trim();
                if (!val || val === 'auto' || val === 'normal' || val === 'none' || val === '0px' || val === 'initial' || val === 'inherit') continue;
                if (prop.includes('color') || prop.includes('background') || prop === 'box-shadow') {
                  htmlEl.style.setProperty(prop, toSafeColor(val));
                } else {
                  htmlEl.style.setProperty(prop, val);
                }
              }
              if (el instanceof SVGElement) {
                ['fill', 'stroke'].forEach(attr => {
                  const av = el.getAttribute(attr);
                  if (av) el.setAttribute(attr, toSafeColor(av));
                });
              }
            });
            clonedDoc.querySelectorAll('style').forEach(t => t.remove());
            clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(t => t.remove());
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(element).save();
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return (
    <div className="h-full flex flex-row min-h-0">
      {/* Left Tab Sidebar */}
      <div className="w-52 border-r border-gray-100 bg-white/80 backdrop-blur-sm flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">智能报告</p>
          <p className="text-[9px] text-gray-300 mt-0.5">AI 驱动 · PDF 导出</p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-gray-800 shadow-sm ring-1 ring-emerald-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`shrink-0 p-1.5 rounded-md transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600'
                  }`}>
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${isActive ? 'text-gray-800' : 'text-gray-700'}`}>{tab.label}</p>
                    <p className="text-[9px] leading-tight mt-0.5 truncate">{tab.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Export Status */}
        {isExporting && (
          <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-2 animate-pulse">
            <Loader2 size={13} className="text-blue-500 animate-spin" />
            <span className="text-[11px] text-blue-600">正在导出 PDF...</span>
          </div>
        )}
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-30/30">
        {activeTab === 'daily' && <DailyReport onExportPdf={handleExportPdf} />}
        {activeTab === 'incident' && <IncidentReview onExportPdf={handleExportPdf} />}
        {activeTab === 'sla' && <SlaReport onExportPdf={handleExportPdf} />}
      </div>
    </div>
  );
}
