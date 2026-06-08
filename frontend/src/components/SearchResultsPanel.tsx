import { useState } from 'react';
import { Globe, ExternalLink, X, ChevronRight } from 'lucide-react';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date?: string;
}

interface SearchResultsPanelProps {
  results: SearchResult[];
  engine?: string;
  answer?: string;
}

export default function SearchResultsPanel({ results, engine = 'Tavily', answer }: SearchResultsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!results || results.length === 0) return null;

  // 获取来源域名
  const getDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '未知来源';
    }
  };

  // 获取来源图标颜色
  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'Tavily': 'bg-orange-500',
      'Bing': 'bg-blue-500',
      'Google': 'bg-red-500',
    };
    return colors[source] || 'bg-gray-400';
  };

  return (
    <>
      {/* 简洁展示：已阅读 N 个网页 */}
      <button
        onClick={() => setIsOpen(true)}
        className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-200 transition-all group"
      >
        <Globe size={12} className="text-blue-500" />
        <span>已阅读 {results.length} 个网页</span>
        <ChevronRight size={12} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* 右侧滑出面板 */}
      {isOpen && (
        <>
          {/* 遮罩层 - 去掉模糊 */}
          <div
            className="fixed inset-0 bg-black/20 z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* 右侧面板 */}
          <div className="fixed right-0 top-0 h-full w-[480px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
            {/* 面板头部 - 更简洁 */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-semibold text-gray-800">
                参考来源 ({results.length})
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* 搜索结果列表 - 更大间距 */}
            <div className="flex-1 overflow-y-auto py-6 px-6 space-y-6">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="group pb-6 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  {/* 序号 + 标题 */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[11px] font-medium shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <h4 className="text-[15px] font-medium text-gray-800 leading-snug group-hover:text-blue-600 transition-colors cursor-pointer">
                      {result.title}
                    </h4>
                  </div>

                  {/* 来源信息 */}
                  <div className="flex items-center gap-2 ml-8 mb-3">
                    <div className={`w-4 h-4 rounded-sm ${getSourceColor(result.source)} flex items-center justify-center`}>
                      <span className="text-[8px] text-white font-bold">
                        {result.source.charAt(0)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{getDomain(result.url)}</span>
                    {result.date && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{result.date}</span>
                      </>
                    )}
                  </div>

                  {/* 摘要 */}
                  <p className="text-sm text-gray-500 leading-relaxed ml-8 line-clamp-3">
                    {result.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
