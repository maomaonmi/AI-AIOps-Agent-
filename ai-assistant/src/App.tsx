import { useEffect, useMemo, useRef, useState } from 'react';
import type { AiAnalysisResult, DeepSeekConfig, FileAnalysis, FileSummary, FloatingTextPayload } from '../shared/types';

const bytesToHuman = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const defaultFile: FileSummary = { name: '点击「导入文件」开始测试', size: 0, type: 'unknown', fullTextAvailable: false };
const defaultAnalysis: FileAnalysis = { summary: '等待导入文件后生成分析结果。', risks: [], suggestions: [], highlights: [] };
const defaultAi: AiAnalysisResult = { summary: '', risks: [], suggestions: [], highlights: [], actions: [] };
const defaultConfig: DeepSeekConfig = { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' };

type ChatMessage = { role: 'ai' | 'user'; content: string; timestamp?: number; image?: string };
type ToolbarMode = 'chat' | 'summary' | 'translate' | 'explain' | 'rewrite' | 'copy' | 'grammar' | 'explainCode' | 'answer';
const isFloatingMode = new URLSearchParams(window.location.search).get('view') === 'floating';
const isToolbarMode = new URLSearchParams(window.location.search).get('view') === 'toolbar';
const isWebToolbarMode = new URLSearchParams(window.location.search).get('view') === 'web-toolbar';
const isTranslationMode = new URLSearchParams(window.location.search).get('view') === 'translation';
const isSettingsMode = new URLSearchParams(window.location.search).get('view') === 'settings';

// 颜色转换辅助函数
const rgbToHex = (rgba: string): string => {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#0f172a';
  return '#' + [m[1], m[2], m[3]].map((x) => parseInt(x).toString(16).padStart(2, '0')).join('');
};
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function App() {
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileSummary>(defaultFile);
  const [analysis, setAnalysis] = useState<FileAnalysis>(defaultAnalysis);
  const [aiResult, setAiResult] = useState<AiAnalysisResult>(defaultAi);
  const [status, setStatus] = useState('等待导入文件');
  const [showFullText, setShowFullText] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'ai', content: '你好，我是悬浮 AI，可以接收文件内容或选中文本并帮你分析。' }]);
  const [externalSource, setExternalSource] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [configStatus, setConfigStatus] = useState('');
  const [toolbar, setToolbar] = useState<{ visible: boolean; text: string; source: string; x: number; y: number; anchorX: number; anchorY: number; menuOpen: boolean }>({ visible: false, text: '', source: '', x: 0, y: 0, anchorX: 0, anchorY: 0, menuOpen: false });
  const [lastClipboardText, setLastClipboardText] = useState('');
  const [toolbarText, setToolbarText] = useState('');
  const [webToolbarText, setWebToolbarText] = useState('');
  const [webMenuOpen, setWebMenuOpen] = useState(false);
  const [webMenuDirection, setWebMenuDirection] = useState<'up' | 'down'>('down');
  const menuRef = useRef<HTMLDivElement>(null);
  const togglingMenuRef = useRef(false);
  const [translationText, setTranslationText] = useState('');
  const [translationSource, setTranslationSource] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [debugEntries, setDebugEntries] = useState<string[]>(['debug: ready']);
  const [debugOpen, setDebugOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(false);
  // 工具条颜色设置
  const [toolbarColors, setToolbarColorsState] = useState<Record<string, string>>({ bg: 'rgba(15,23,42,.92)', border: 'rgba(148,163,184,.15)', text: '#e2e8f0', iconBg: 'rgba(30,41,59,.7)', opacity: '0.92' });
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);
  // 独立工具条（/?view=toolbar）的"更多"菜单
  const [standaloneMenuOpen, setStandaloneMenuOpen] = useState(false);
  const [standaloneMenuDirection, setStandaloneMenuDirection] = useState<'up' | 'down'>('down');
  // 对话历史面板
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<ChatMessage[]>([]);
  // 主题模式
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  // 图片多模态支持
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const pushDebug = (message: string) => {
    setDebugEntries((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 12));
  };

  // 应用工具条颜色到 CSS 变量
  const applyToolbarColors = (colors: Record<string, string>) => {
    document.documentElement.style.setProperty('--toolbar-bg', colors.bg || 'rgba(15,23,42,.92)');
    document.documentElement.style.setProperty('--toolbar-border', colors.border || 'rgba(148,163,184,.15)');
    document.documentElement.style.setProperty('--toolbar-text', colors.text || '#e2e8f0');
    document.documentElement.style.setProperty('--toolbar-icon-bg', colors.iconBg || 'rgba(30,41,59,.7)');
    document.documentElement.style.setProperty('--toolbar-opacity', colors.opacity || '0.92');
  };

  // 保存颜色设置
  const handleSaveColor = async (key: string, value: string) => {
    const next = { ...toolbarColors, [key]: value };
    setToolbarColorsState(next);
    applyToolbarColors(next);
    await window.api?.setToolbarColors?.(next);
  };
  const handleResetColors = async () => {
    const defaults = { bg: 'rgba(15,23,42,.92)', border: 'rgba(148,163,184,.15)', text: '#e2e8f0', iconBg: 'rgba(30,41,59,.7)', opacity: '0.92' };
    setToolbarColorsState(defaults);
    applyToolbarColors(defaults);
    await window.api?.resetToolbarColors?.();
  };

  useEffect(() => {
    window.api?.getDeepSeekConfig?.().then(setConfig).catch(() => undefined);
    pushDebug('debug: config loaded');
    // 加载工具条颜色
    window.api?.getToolbarColors?.().then((c) => { setToolbarColorsState(c); applyToolbarColors(c); }).catch(() => undefined);
    // 监听颜色变化
    const unbindColors = window.api?.onToolbarColorsChange?.((c) => { setToolbarColorsState(c); applyToolbarColors(c); });
    // 监听托盘"设置"命令
    const unbindSettings = window.api?.onOpenSettings?.(() => { setShowSettings(true); setColorSettingsOpen(true); });
    // 加载主题
    window.api?.getTheme?.().then((t) => { setThemeState(t); document.documentElement.dataset.theme = t; }).catch(() => undefined);
    // 监听主题变化
    const unbindTheme = window.api?.onThemeChange?.((t) => { setThemeState(t); document.documentElement.dataset.theme = t; });
    return () => { unbindColors?.(); unbindSettings?.(); unbindTheme?.(); };
  }, []);

  // 悬浮窗启动时加载历史记录
  useEffect(() => {
    if (!isFloatingMode) return;
    window.api?.getChatHistory?.().then((history) => {
      if (history && history.length > 0) {
        setMessages(history);
        console.log(`[chat-history] loaded ${history.length} messages`);
      }
    }).catch((e) => console.error('[chat-history] load error:', e));
  }, [isFloatingMode]);

  // 图片多模态支持：在悬浮窗模式下监听粘贴事件
  useEffect(() => {
    if (!isFloatingMode) return;

    document.addEventListener('paste', handlePasteImage);
    return () => {
      document.removeEventListener('paste', handlePasteImage);
    };
  }, [isFloatingMode]);

  // 监听流式响应
  useEffect(() => {
    if (!isFloatingMode) return;
    const cleanup = window.api?.onStreamChunk?.((chunk) => {
      if (chunk.error) {
        setMessages((prev) => [...prev, { role: 'ai', content: `错误：${chunk.error}` }]);
      } else if (chunk.done) {
        // 流式完成，保存历史
        setMessages((prev) => {
          const newHistory = [...prev];
          window.api?.saveChatHistory?.(newHistory).catch((e) => console.error('[chat-history] save error:', e));
          return newHistory;
        });
      } else if (chunk.fullText) {
        // 实时更新最后一条 AI 消息
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'ai') {
            return [...prev.slice(0, -1), { ...lastMsg, content: chunk.fullText! }];
          }
          return [...prev, { role: 'ai', content: chunk.fullText! }];
        });
      }
    });
    return () => cleanup?.();
  }, [isFloatingMode]);

  useEffect(() => {
    // 通过 IPC API 直接监听（替代不可靠的 DOM CustomEvent）
    const unbind = window.api?.onFloatingText(async (payload) => {
      pushDebug(`debug: floating text received source=${payload.source ?? 'unknown'} len=${payload.text.length}`);
      setExternalSource(payload.source ?? '外部来源');
      setStatus(`已接收文本：${payload.source ?? '外部来源'}`);
      setSelectedFile({ name: payload.source ?? '外部文本', size: payload.text.length, type: 'text', preview: payload.text, fullTextAvailable: true });
      setAnalysis({ summary: '已接收到外部文本，可继续进行对话或分析。', risks: [], suggestions: ['继续提问', '提取要点', '生成摘要'], highlights: payload.text.split(/\r?\n/).slice(0, 3) });
      setAiResult(defaultAi);
      setShowFullText(false);
      setShowSettings(false);
      setDockOpen(true);
      // 显示用户发送的内容
      const userMsg: ChatMessage = { role: 'user' as const, content: `[来自 ${payload.source ?? '外部来源'}]\n${payload.text.slice(0, 500)}${payload.text.length > 500 ? '\n…(内容过长已截断)' : ''}`, timestamp: Date.now() };
      setMessages((prev) => {
        const newHistory = [...prev, userMsg];
        window.api?.saveChatHistory?.(newHistory).catch((e) => console.error('[chat-history] save error:', e));
        return newHistory;
      });

      // 流式调用 AI
      window.api?.deepSeekStream?.({ content: payload.text, source: payload.source ?? '剪贴板' });
    });

    const toolbarHandler = (event: Event) => {
      const custom = event as CustomEvent<{ text: string; source: string; x?: number; y?: number }>;
      const payload = custom.detail;
      pushDebug(`debug: selection toolbar event source=${payload.source} x=${payload.x ?? 0} y=${payload.y ?? 0} len=${payload.text.length}`);
      setToolbar({ visible: true, text: payload.text, source: payload.source, x: payload.x ?? 0, y: payload.y ?? 0, anchorX: payload.x ?? 0, anchorY: payload.y ?? 0, menuOpen: false });
      setExternalSource(payload.source);
      setMessages((prev) => [...prev, { role: 'ai', content: `已捕获选区，来源：${payload.source}` }]);
    };

    window.addEventListener('selection:toolbar', toolbarHandler);
    return () => {
      unbind?.();
      window.removeEventListener('selection:toolbar', toolbarHandler);
    };
  }, []);

  // 工具条模式：监听主进程发来的文本
  useEffect(() => {
    if (!isToolbarMode && !isWebToolbarMode && !isTranslationMode) return;
    // 透明窗口：清除 body/html/#root 的背景，避免 Electron 窗口边缘出现黑色矩形
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.background = 'transparent';

    if (isTranslationMode) {
      const cleanup = window.api?.onTranslationText?.((payload: { text: string; source: string; loading?: boolean }) => {
        if (payload.loading) {
          setIsLoading(true);
          setTranslationText('');
          setTranslationSource(payload.source ?? '');
        } else {
          setIsLoading(false);
          setTranslationText(payload.text);
          setTranslationSource(payload.source ?? '');
        }
      });
      return () => cleanup?.();
    }
    
    if (isWebToolbarMode) {
      const cleanup = window.api?.onWebToolbarText?.((payload) => {
        if (typeof payload === 'string') {
          setWebToolbarText(payload);
        } else if (payload.text) {
          setWebToolbarText(payload.text);
          setToolbar((prev) => ({ ...prev, x: payload.x ?? prev.x, y: payload.y ?? prev.y }));
        }
      });
      window.api?.getWebToolbarText?.().then((value) => {
        if (typeof value === 'string') {
          if (value && !webToolbarText) setWebToolbarText(value);
        } else if (value && typeof value === 'object') {
          if (value.text && !webToolbarText) setWebToolbarText(value.text);
          setToolbar((prev) => ({ ...prev, x: value.x ?? prev.x, y: value.y ?? prev.y }));
        }
      }).catch(() => {});
      return () => cleanup?.();
    }

    const cleanup = window.api?.onToolbarText?.((text) => {
      const t = typeof text === 'string' ? text : text.text;
      console.log(`[toolbar] received text len=${t.length}`);
      setToolbarText(t);
    });
    window.api?.getToolbarText?.().then((text) => {
      if (text && !toolbarText) setToolbarText(text);
    }).catch(() => {});
    return () => cleanup?.();
  }, [isToolbarMode, isWebToolbarMode, isTranslationMode, toolbarText, webToolbarText]);

  // 网页工具条菜单：点击外部关闭
  useEffect(() => {
    if (!isWebToolbarMode || !webMenuOpen) return;
    // 记录菜单渲染后的实际位置和尺寸，便于排查 Electron 裁剪/点击区域问题
    requestAnimationFrame(() => {
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        console.log(`[web-toolbar] menu rendered rect=(${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)})`);
      }
    });
    const handler = (e: MouseEvent) => {
      console.log(`[web-toolbar] mousedown target=${(e.target as HTMLElement)?.tagName} class=${(e.target as HTMLElement)?.className}`);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWebMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isWebToolbarMode, webMenuOpen]);

  // 网页工具条菜单：关闭时恢复窗口默认大小
  useEffect(() => {
    if (!isWebToolbarMode || webMenuOpen) return;
    const menuHeight = 220;
    const gap = 8;
    const baseHeight = 56;
    const offsetY = webMenuDirection === 'up' ? (gap + menuHeight) : 0;
    console.log(`[web-toolbar] closing menu, resize back to ${baseHeight}px offsetY=${offsetY} direction=${webMenuDirection}`);
    window.api?.resizeWebToolbar?.(210, baseHeight, 0, offsetY);
  }, [isWebToolbarMode, webMenuOpen, webMenuDirection]);
  // 独立工具条（/?view=toolbar）菜单：关闭时恢复窗口默认大小
  useEffect(() => {
    if (!isToolbarMode || standaloneMenuOpen) return;
    const menuHeight = 280;
    const gap = 8;
    const baseHeight = 52;
    const offsetY = standaloneMenuDirection === 'up' ? (gap + menuHeight) : 0;
    console.log(`[toolbar] closing menu, resize back to ${baseHeight}px offsetY=${offsetY} direction=${standaloneMenuDirection}`);
    window.api?.resizeToolbar?.(320, baseHeight, 0, offsetY);
  }, [isToolbarMode, standaloneMenuOpen, standaloneMenuDirection]);

  const handleToolbarAction = async (mode: ToolbarMode) => {
    if (!toolbarText.trim()) return;
    if (mode === 'copy') {
      await navigator.clipboard.writeText(toolbarText);
      window.api?.closeToolbar?.();
      return;
    }
    if (mode === 'chat') {
      // AI 对话：把内容发送到悬浮窗 AI 对话（使用实际选中文本）
      await window.api?.showFloatingText?.({ text: toolbarText, source: '选中文本' });
      window.api?.closeToolbar?.();
      return;
    }
    await window.api?.toolbarAction?.({ mode, text: toolbarText });
    window.api?.closeToolbar?.();
  };

  const requestAiAnalysis = async (file: FileSummary, analysisPayload: FileAnalysis) => {
    if (!window.api?.deepSeekAnalyze) {
      pushDebug('debug: deepseek analyze unavailable');
      return;
    }
    const content = file.preview ?? analysisPayload.summary;
    pushDebug(`debug: deepseek analyze request source=${file.name} len=${content.length}`);
    const result = await window.api.deepSeekAnalyze({ content, source: file.name });
    setMessages((prev) => [...prev, { role: 'ai', content: result.ok ? result.text! : result.error! }]);
  };

  const handleImport = async () => {
    if (!window.api?.selectFiles) { setStatus('当前环境未注入文件选择能力'); return; }
    const result = await window.api.selectFiles();
    if (!result.selected) { setStatus('已取消选择'); return; }
    setFiles(result.files);
    setSelectedFile(result.selected);
    setAnalysis(result.analysis ?? defaultAnalysis);
    setShowFullText(false);
    setStatus(`已导入 ${result.files.length} 个真实文件`);
    setMessages((prev) => [...prev, { role: 'ai', content: `已导入文件「${result.selected.name}」，我可以继续帮你分析。` }]);
    await requestAiAnalysis(result.selected, result.analysis ?? defaultAnalysis);
  };

  const sendChat = async () => {
    const text = chatInput.trim(); if (!text) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    // 流式调用
    window.api?.deepSeekStream?.({ content: text, source: '用户对话' });
  };

  // 图片多模态支持：粘贴图片处理
  const handlePasteImage = async (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        // 转换为 Base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const mimeType = file.type;

          // 添加用户消息（带图片）
          const userMsg: ChatMessage = {
            role: 'user',
            content: '[图片]',
            image: base64,
            timestamp: Date.now()
          };
          setMessages((prev) => [...prev, userMsg]);

          // 调用后端 AI 分析接口（流式，结果通过 onStreamChunk 回调返回）
          if (window.api?.analyzeImage) {
            try {
              pushDebug(`debug: analyzing image type=${mimeType}`);
              // 添加一条空的 AI 消息占位，后续通过 onStreamChunk 实时更新
              setMessages((prev) => [...prev, { role: 'ai', content: '正在分析图片...' }]);
              await window.api.analyzeImage({ base64, mimeType }, '请详细描述这张图片的内容，并分析其中的关键信息。');
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              setMessages((prev) => [...prev, { role: 'ai', content: `分析出错：${errorMsg}` }]);
            }
          } else {
            setMessages((prev) => [...prev, { role: 'ai', content: '当前环境不支持图片分析功能' }]);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  // 图片多模态支持：文件选择处理
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      pushDebug('debug: invalid file type selected');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const mimeType = file.type;

      // 添加用户消息（带图片）
      const userMsg: ChatMessage = {
        role: 'user',
        content: file.name,
        image: base64,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, userMsg]);

      // 调用后端 AI 分析接口（流式，结果通过 onStreamChunk 回调返回）
      if (window.api?.analyzeImage) {
        try {
          pushDebug(`debug: analyzing image file=${file.name} type=${mimeType}`);
          // 添加一条空的 AI 消息占位，后续通过 onStreamChunk 实时更新
          setMessages((prev) => [...prev, { role: 'ai', content: '正在分析图片...' }]);
          await window.api.analyzeImage({ base64, mimeType }, '请详细描述这张图片的内容，并分析其中的关键信息。');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setMessages((prev) => [...prev, { role: 'ai', content: `分析出错：${errorMsg}` }]);
        }
      } else {
        setMessages((prev) => [...prev, { role: 'ai', content: '当前环境不支持图片分析功能' }]);
      }
    };
    reader.readAsDataURL(file);

    // 重置 input 值，允许重复选择同一文件
    event.target.value = '';
  };

  const sendClipboard = async () => {
    try {
      pushDebug(`debug: getClipboardText api exists=${!!window.api?.getClipboardText}`);
      const text = await window.api?.getClipboardText?.();
      pushDebug(`debug: manual clipboard check len=${text?.trim().length ?? 0} raw=${JSON.stringify(text?.slice(0, 50))}`);
      if (!text?.trim()) return;
      setLastClipboardText(text.trim());
      await window.api?.showFloatingText?.({ text, source: '剪贴板' });
    } catch (err) {
      pushDebug(`debug: clipboard error=${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const openFloating = async () => {
    pushDebug('debug: open floating requested');
    await window.api?.openFloatingWindow?.();
  };
  const saveConfig = async () => {
    if (!window.api?.saveDeepSeekConfig) return;
    await window.api.saveDeepSeekConfig(config);
    setConfigStatus('已保存到本地配置文件');
    pushDebug('debug: config saved');
  };

  const analyzeToolbar = async (mode: ToolbarMode) => {
    const text = toolbar.text.trim(); if (!text) return;
    if (mode === 'copy') {
      await navigator.clipboard.writeText(text);
      pushDebug(`debug: copied text len=${text.length}`);
      setMessages((prev) => [...prev, { role: 'ai', content: `已复制：${text.slice(0, 120)}${text.length > 120 ? '…' : ''}` }]);
      setToolbar((prev) => ({ ...prev, visible: false }));
      return;
    }
    if (mode === 'translate') {
      pushDebug(`debug: toolbar action=translate source=${toolbar.source} len=${text.length}`);
      await window.api?.web?.action?.({ mode: 'translate', text });
      setToolbar((prev) => ({ ...prev, visible: false, menuOpen: false }));
      return;
    }
    const prompts: Record<Exclude<ToolbarMode, 'copy' | 'translate'>, string> = {
      chat: `请就下面内容进行对话式回答：\n\n${text}`,
      summary: `请对下面内容做简洁摘要：\n\n${text}`,
      explain: `请解释下面内容的含义、背景和关键点：\n\n${text}`,
      rewrite: `请对下面内容进行润色重写，保持原意但更清晰：\n\n${text}`,
      grammar: `请检查下面内容的语法错误并给出修改建议：\n\n${text}`,
      explainCode: `请解释下面代码的功能、逻辑和关键实现细节：\n\n${text}`,
      answer: `请回答下面这个问题：\n\n${text}`,
    };
    pushDebug(`debug: toolbar action=${mode} source=${toolbar.source} len=${text.length}`);
    const reply = await window.api?.deepSeekAnalyze?.({ content: prompts[mode], source: toolbar.source || '选中文本' });
    if (reply) setMessages((prev) => [...prev, { role: 'ai', content: reply.ok ? reply.text! : reply.error! }]);
    setToolbar((prev) => ({ ...prev, visible: false, menuOpen: false }));
  };

  const previewText = useMemo(() => {
    if (!selectedFile.path) return '请先导入一个真实文件，系统会自动生成分析结果。';
    if (!selectedFile.preview) return '该文件未识别为可安全预览的文本内容，已读取基础元数据。';
    return showFullText ? selectedFile.preview : `${selectedFile.preview.slice(0, 180)}${selectedFile.preview.length > 180 ? '…' : ''}`;
  }, [selectedFile, showFullText]);

  const previewMeta = selectedFile.fullTextAvailable ? '当前文件支持文本解析与全文预览。' : selectedFile.preview ? '当前只显示有限预览内容。' : '当前文件未提取到可显示文本。';
  const sendToFloating = async () => {
    if (!window.api?.showFloatingText) return;
    const text = selectedFile.preview ?? analysis.summary;
    pushDebug(`debug: send to floating source=${selectedFile.name} len=${text.length}`);
    await window.api.showFloatingText({ text, source: selectedFile.name });
  };

  const toolbarButtons: Array<{ key: ToolbarMode; label: string; icon: string }> = [
    { key: 'chat', label: 'AI 对话', icon: '◉' },
    { key: 'summary', label: '摘要', icon: '≡' },
    { key: 'translate', label: '翻译', icon: 'A↔文' },
    { key: 'copy', label: '复制', icon: '⧉' },
  ];

  const moreButtons: Array<{ key: ToolbarMode; label: string }> = [
    { key: 'explain', label: '解释说明' },
    { key: 'rewrite', label: '重写' },
  ];

  if (isWebToolbarMode) {
    const webMenuItems = [
      { key: 'grammar', label: '语法' },
      { key: 'explain', label: '解释说明' },
      { key: 'explainCode', label: '解释代码' },
      { key: 'rewrite', label: '重写' },
      { key: 'answer', label: '回答此问题' },
    ];

    const handleWebAction = async (mode: string) => {
      if (!webToolbarText.trim()) return;
      pushDebug(`debug: web action=${mode} len=${webToolbarText.length}`);
      await window.api?.web?.action?.({ mode, text: webToolbarText });
      setWebMenuOpen(false);
      window.api?.toolbar?.close?.();
    };

    const toggleWebMenu = (e: React.MouseEvent) => {
      e.stopPropagation();
      const willOpen = !webMenuOpen;
      const menuHeight = 220;
      const gap = 8;
      const baseHeight = 56;
      // 以窗口实际 Y 坐标和屏幕边界判断方向，避免菜单超出屏幕
      const winY = (toolbar.y || 0) - baseHeight - 4;
      const screenHeight = typeof window !== 'undefined' ? window.screen.availHeight : 1080;
      const menuUp = (winY + baseHeight + gap + menuHeight) > screenHeight;
      const direction = menuUp ? 'up' : 'down';
      console.log(`[web-toolbar] more clicked willOpen=${willOpen} direction=${direction} toolbar.y=${toolbar.y} winY=${winY}`);

      if (willOpen) {
        setWebMenuDirection(direction);
        const newHeight = baseHeight + gap + menuHeight;
        const offsetY = menuUp ? -(gap + menuHeight) : 0;
        console.log(`[web-toolbar] opening menu resize -> ${newHeight}px offsetY=${offsetY}`);
        setWebMenuOpen(true);
        // 同步触发 resize，不阻塞 UI，让用户立即看到菜单反馈
        window.api?.resizeWebToolbar?.(210, newHeight, 0, offsetY).catch((err) => console.error('[web-toolbar] resize failed', err));
      } else {
        setWebMenuOpen(false);
      }
    };

    return (
      <main className={`web-toolbar-main ${webMenuDirection === 'up' ? 'menu-up' : 'menu-down'}`}>
        <div className="web-toolbar">
          <button className="web-toolbar-btn" title="AI 对话" onClick={() => handleWebAction('chat')}>◉</button>
          <button className="web-toolbar-btn" title="摘要" onClick={() => handleWebAction('summary')}>≡</button>
          <button className="web-toolbar-btn" title="翻译" onClick={() => handleWebAction('translate')}>A↔文</button>
          <button className="web-toolbar-btn" title="复制" onClick={() => { if (webToolbarText.trim()) { navigator.clipboard.writeText(webToolbarText); window.api?.toolbar?.close?.(); } }}>⧉</button>
          <button className={`web-toolbar-btn ${webMenuOpen ? 'active' : ''}`} title="更多" onClick={toggleWebMenu}>⋮</button>

          {webMenuOpen && (
            <div ref={menuRef} className={`web-toolbar-menu ${webMenuDirection === 'up' ? 'up' : 'down'}`}>
              {webMenuItems.map((item) => (
                <button key={item.key} className="web-toolbar-menu-item" onClick={() => handleWebAction(item.key)}>{item.label}</button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (isTranslationMode) {
    return (
      <main style={{ width: '100%', height: '100%', background: 'transparent', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          borderRadius: '24px',
          background: 'rgba(15,23,42,.98)',
          border: '1px solid rgba(148,163,184,.2)',
          color: '#e2e8f0',
          boxShadow: '0 20px 60px rgba(0,0,0,.4)',
          backdropFilter: 'blur(18px)',
          overflow: 'hidden',
        }}>
          {translationSource && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(148,163,184,.12)',
              fontSize: '13px',
              fontWeight: 600,
              color: '#94a3b8',
              flexShrink: 0,
            }}>
              <span>{translationSource}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => window.api?.minimizeWindow?.()}
                  title="最小化"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    lineHeight: 1,
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >−</button>
                <button
                  onClick={() => window.api?.closeWindow?.()}
                  title="关闭"
                  style={{
                    width: '24px',
                    height: '24px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    lineHeight: 1,
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >×</button>
              </div>
            </div>
          )}
          <div style={{
            flex: 1,
            padding: '14px 16px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
            fontSize: '14px',
            userSelect: 'text',
          }}>
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94a3b8' }}>
                <div className="loading-spinner" />
                <span>正在处理...</span>
              </div>
            ) : (
              translationText || '等待内容...'
            )}
          </div>
        </div>
      </main>
    );
  }

  if (isToolbarMode) {
    const btnCls = 'toolbar-btn';
    const moreItems = [
      { key: 'grammar', label: '语法' },
      { key: 'explain', label: '解释说明' },
      { key: 'explainCode', label: '解释代码' },
      { key: 'rewrite', label: '重写' },
      { key: 'answer', label: '回答此问题' },
    ] as const;
    const toggleStandaloneMenu = (e: React.MouseEvent) => {
      e.stopPropagation();
      const willOpen = !standaloneMenuOpen;
      const menuHeight = 280;
      const gap = 8;
      const baseHeight = 52;
      const winY = (toolbar.y || 0) - baseHeight - 4;
      const screenHeight = typeof window !== 'undefined' ? window.screen.availHeight : 1080;
      // 如果向下展开会超出屏幕底部，则改为向上展开
      const direction: 'up' | 'down' = (winY + baseHeight + gap + menuHeight) > screenHeight ? 'up' : 'down';
      console.log(`[toolbar] more clicked willOpen=${willOpen} direction=${direction} winY=${winY} screen=${screenHeight}`);
      if (willOpen) {
        setStandaloneMenuDirection(direction);
        const newHeight = baseHeight + gap + menuHeight;
        const offsetY = direction === 'up' ? -(gap + menuHeight) : 0;
        setStandaloneMenuOpen(true);
        window.api?.resizeToolbar?.(320, newHeight, 0, offsetY).catch((err) => console.error('[toolbar] resize failed', err));
      } else {
        setStandaloneMenuOpen(false);
      }
    };
    return (
      <main className={`toolbar-shell ${standaloneMenuOpen ? `menu-${standaloneMenuDirection}` : ''}`} style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', background: 'transparent', overflow: 'visible' }}>
        <div className="selection-toolbar" style={{ position: 'relative', left: 0, top: 0 }}>
          <div className="selection-toolbar-main">
            <button className={btnCls} title="AI 对话" onClick={() => handleToolbarAction('chat')}><span>◉</span></button>
            <button className={btnCls} title="摘要" onClick={() => handleToolbarAction('summary')}><span>≡</span></button>
            <button className={btnCls} title="翻译" onClick={() => handleToolbarAction('translate')}><span>A↔文</span></button>
            <button className={btnCls} title="复制" onClick={() => handleToolbarAction('copy')}><span>⧉</span></button>
            <button className={`${btnCls} ${standaloneMenuOpen ? 'active' : ''}`} title="更多" onClick={toggleStandaloneMenu}><span>⋮</span></button>
          </div>
          {standaloneMenuOpen && (
            <div className={`selection-toolbar-menu standalone ${standaloneMenuDirection}`}>
              {moreItems.map((item) => (
                <button key={item.key} className="selection-menu-item" onClick={() => { handleToolbarAction(item.key as ToolbarMode); setStandaloneMenuOpen(false); }}>{item.label}</button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // 独立设置窗口
  if (isSettingsMode) {
    return (
      <main className="settings-shell">
        <div className="settings-window-card draggable-window">
          <div className="settings-header drag-area">
            <h2>AI 运维助手 - 设置</h2>
            <button className="settings-close-btn" onClick={() => window.close()}>✕</button>
          </div>

          <div className="settings-content">
            {/* DeepSeek 设置 */}
            <section className="settings-section">
            <h3>DeepSeek 设置</h3>
            <div className="settings-grid">
              <label><span>API Key</span><input value={config.apiKey} onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-..." /></label>
              <label><span>Base URL</span><input value={config.baseUrl} onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))} /></label>
              <label><span>Model</span><input value={config.model} onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))} /></label>
            </div>
            <button className="primary-button" style={{ marginTop: 8 }} onClick={saveConfig}>保存 DeepSeek 配置</button>
          </section>

          {/* 工具条外观 */}
          <section className="settings-section">
            <h3>工具条外观</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { key: 'bg' as const, label: '背景色', alpha: 0.92 },
                { key: 'border' as const, label: '边框色', alpha: 0.15 },
                { key: 'text' as const, label: '文字色', alpha: 1 },
                { key: 'iconBg' as const, label: '按钮背景', alpha: 0.7 },
                { key: 'opacity' as const, label: '整体透明度', alpha: 1 },
              ].map(({ key, label, alpha }) => (
                <label key={key} className="color-setting-row">
                  <span>{label}</span>
                  <div className="color-input-group">
                    {key === 'opacity' ? (
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.01"
                        value={toolbarColors.opacity}
                        onChange={(e) => handleSaveColor('opacity', e.target.value)}
                      />
                    ) : (
                      <input type="color" value={rgbToHex(toolbarColors[key])}
                        onChange={(e) => handleSaveColor(key, hexToRgba(e.target.value, alpha))} />
                    )}
                    <input value={toolbarColors[key]} onChange={(e) => handleSaveColor(key, e.target.value)} placeholder="rgba(...)" />
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="popup-action" onClick={handleResetColors}>恢复默认</button>
              <span className="analysis-summary">颜色修改即时生效</span>
            </div>
          </section>

          {/* 预览 */}
          <section className="settings-section">
            <h3>工具条预览</h3>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,.2)', borderRadius: 12 }}>
              <div className="selection-toolbar-main" style={{ position: 'relative', left: 0, top: 0, transform: 'none', opacity: toolbarColors.opacity }}>
                <button className="toolbar-icon-button"><span>◉</span></button>
                <button className="toolbar-icon-button"><span>≡</span></button>
                <button className="toolbar-icon-button"><span>A↔文</span></button>
                <button className="toolbar-icon-button"><span>⧉</span></button>
                <button className="toolbar-icon-button more"><span>⋮</span></button>
              </div>
            </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (isFloatingMode) {
    // 窗口拖拽调整大小
    const startResize = (e: React.MouseEvent, dir: string) => {
      e.preventDefault();
      const sx = e.screenX, sy = e.screenY;
      const sw = window.innerWidth, sh = window.innerHeight;
      const onMove = (ev: MouseEvent) => {
        let dx = ev.screenX - sx, dy = ev.screenY - sy;
        let w = sw, h = sh;
        if (dir.includes('e')) w = Math.max(360, sw + dx);
        if (dir.includes('w')) w = Math.max(360, sw - dx);
        if (dir.includes('s')) h = Math.max(480, sh + dy);
        if (dir.includes('n')) h = Math.max(480, sh - dy);
        window.api?.resizeWindow?.(Math.round(w), Math.round(h), dir.includes('w') ? dx : 0, dir.includes('n') ? dy : 0);
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    };

    // 简易 Markdown 渲染
    const renderMd = (text: string) => {
      return text.split(/\n\n+/).map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        // 代码块
        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const code = lines.slice(1, lines.length - (trimmed.endsWith('```') ? 1 : 0)).join('\n');
          return <pre key={bi}><code>{code}</code></pre>;
        }
        // 列表项
        if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
          const items = trimmed.split('\n').map((li, ii) => <li key={ii}>{li.replace(/^[-*]\s+|\d+\.\s+/, '')}</li>);
          return <ul key={bi}>{items}</ul>;
        }
        // 普通段落（行内代码高亮）
        const parts = trimmed.split(/(`[^`]+`)/g);
        return <p key={bi}>{parts.map((p, pi) => p.startsWith('`') && p.endsWith('`') ? <code key={pi}>{p.slice(1, -1)}</code> : p)}</p>;
      });
    };

    return (
      <main className="floating-shell">
        {/* 调整大小手柄 */}
        <div className="resize-handle resize-n" onMouseDown={(e) => startResize(e, 'n')} />
        <div className="resize-handle resize-s" onMouseDown={(e) => startResize(e, 's')} />
        <div className="resize-handle resize-w" onMouseDown={(e) => startResize(e, 'w')} />
        <div className="resize-handle resize-e" onMouseDown={(e) => startResize(e, 'e')} />
        <div className="resize-handle resize-ne" onMouseDown={(e) => startResize(e, 'ne')} />
        <div className="resize-handle resize-nw" onMouseDown={(e) => startResize(e, 'nw')} />
        <div className="resize-handle resize-se" onMouseDown={(e) => startResize(e, 'se')} />
        <div className="resize-handle resize-sw" onMouseDown={(e) => startResize(e, 'sw')} />

        <header className="floating-header drag-area" style={{ padding: '10px 16px', position: 'relative' }}>
          <div>
            <p className="eyebrow" style={{ fontSize: '11px' }}>悬浮 AI</p>
            <h2 style={{ fontSize: '16px', margin: '2px 0' }}>{selectedFile.name}</h2>
            <p className="analysis-summary" style={{ fontSize: '12px' }}>{status}</p>
          </div>
          <div className="floating-header-actions">
            <button
              className="icon-button"
              title="对话历史"
              onClick={async () => {
                const list = await window.api?.getChatHistory?.();
                if (list) setHistoryList(list);
                setHistoryOpen((v) => !v);
              }}
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                background: historyOpen ? 'rgba(99,102,241,.3)' : 'transparent',
                border: '1px solid rgba(148,163,184,.2)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>🕐</span>
              <span style={{ fontSize: 11 }}>历史</span>
            </button>
            <button
              className="icon-button"
              title="切换昼夜主题"
              onClick={async () => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setThemeState(next);
                document.documentElement.dataset.theme = next;
                await window.api?.setTheme?.(next);
              }}
              style={{
                padding: '6px 10px',
                fontSize: '13px',
                background: 'transparent',
                border: '1px solid rgba(148,163,184,.2)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span style={{ fontSize: 11 }}>{theme === 'dark' ? '日间' : '夜间'}</span>
            </button>
            <button className="primary-button" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => window.api?.openSettingsWindow?.()}>设置</button>
          </div>

          {/* 对话历史面板 */}
          {historyOpen && (
            <section className="history-panel">
              <div className="history-panel-header">
                <h3>对话历史 ({historyList.length})</h3>
                <div className="history-panel-actions">
                  <button
                    className="history-clear-btn"
                    onClick={async () => {
                      if (confirm('确定要清除所有对话历史吗？')) {
                        await window.api?.clearChatHistory?.();
                        setHistoryList([]);
                        setMessages([{ role: 'ai', content: '你好，我是悬浮 AI，可以接收文件内容或选中文本并帮你分析。' }]);
                      }
                    }}
                  >
                    清除历史
                  </button>
                  <button className="history-close-btn" onClick={() => setHistoryOpen(false)}>×</button>
                </div>
              </div>
              <div className="history-panel-body">
                {historyList.length === 0 ? (
                  <p className="history-empty">暂无对话历史</p>
                ) : (
                  <div className="history-list">
                    {historyList.map((msg, i) => (
                      <button
                        key={i}
                        className={`history-item ${msg.role}`}
                        onClick={() => {
                          // 点击历史项加载到对话
                          setMessages(historyList.slice(0, i + 1));
                          setHistoryOpen(false);
                        }}
                      >
                        <div className="history-item-meta">
                          <strong>{msg.role === 'ai' ? 'AI' : '你'}</strong>
                          {msg.timestamp && (
                            <span>{new Date(msg.timestamp).toLocaleString()}</span>
                          )}
                        </div>
                        <p className="history-item-text">
                          {msg.content.slice(0, 100)}{msg.content.length > 100 ? '…' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </header>

        {toolbar.visible ? (
          <div className="selection-toolbar" style={{ left: toolbar.x, top: toolbar.y, transform: 'translate(-50%, -100%)' }}>
            <div className="selection-toolbar-main">
              {toolbarButtons.map((button) => (
                <button key={button.key} className="toolbar-icon-button" title={button.label} onClick={() => analyzeToolbar(button.key)}>
                  <span>{button.icon}</span>
                </button>
              ))}
              <button className="toolbar-icon-button more" title="更多" onClick={() => setToolbar((prev) => ({ ...prev, menuOpen: !prev.menuOpen }))}>
                <span>⋮</span>
              </button>
            </div>
            {toolbar.menuOpen ? (
              <div className="selection-toolbar-menu">
                {moreButtons.map((button) => (
                  <button key={button.key} className="selection-menu-item" onClick={() => analyzeToolbar(button.key)}>{button.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showSettings ? (
          <section className="floating-context-drawer">
            <div className="floating-context-card">
              <h3>DeepSeek 设置</h3>
              <div className="settings-grid">
                <label><span>API Key</span><input value={config.apiKey} onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-..." /></label>
                <label><span>Base URL</span><input value={config.baseUrl} onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))} /></label>
                <label><span>Model</span><input value={config.model} onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))} /></label>
              </div>
              <div className="action-list"><button className="popup-action" onClick={saveConfig}>保存配置</button><span className="analysis-summary">{configStatus}</span></div>

              <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid rgba(148,163,184,.1)' }} />
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setColorSettingsOpen((v) => !v)}>
                工具条外观 {colorSettingsOpen ? '▼' : '▶'}
              </h3>
              {colorSettingsOpen ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 70, flexShrink: 0 }}>背景色</span>
                    <input type="color" value={rgbToHex(toolbarColors.bg)} onChange={(e) => handleSaveColor('bg', hexToRgba(e.target.value, 0.92))} style={{ width: 32, height: 24, padding: 0, border: '1px solid rgba(148,163,184,.2)', borderRadius: 4, cursor: 'pointer' }} />
                    <input value={toolbarColors.bg} onChange={(e) => handleSaveColor('bg', e.target.value)} placeholder="rgba(...)" style={{ flex: 1, background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 6, color: '#cbd5e1', padding: '4px 8px', fontSize: 12 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 70, flexShrink: 0 }}>边框色</span>
                    <input type="color" value={rgbToHex(toolbarColors.border)} onChange={(e) => handleSaveColor('border', hexToRgba(e.target.value, 0.15))} style={{ width: 32, height: 24, padding: 0, border: '1px solid rgba(148,163,184,.2)', borderRadius: 4, cursor: 'pointer' }} />
                    <input value={toolbarColors.border} onChange={(e) => handleSaveColor('border', e.target.value)} placeholder="rgba(...)" style={{ flex: 1, background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 6, color: '#cbd5e1', padding: '4px 8px', fontSize: 12 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 70, flexShrink: 0 }}>文字色</span>
                    <input type="color" value={toolbarColors.text.startsWith('#') ? toolbarColors.text : rgbToHex(toolbarColors.text)} onChange={(e) => handleSaveColor('text', e.target.value)} style={{ width: 32, height: 24, padding: 0, border: '1px solid rgba(148,163,184,.2)', borderRadius: 4, cursor: 'pointer' }} />
                    <input value={toolbarColors.text} onChange={(e) => handleSaveColor('text', e.target.value)} placeholder="#..." style={{ flex: 1, background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 6, color: '#cbd5e1', padding: '4px 8px', fontSize: 12 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 70, flexShrink: 0 }}>按钮背景</span>
                    <input type="color" value={rgbToHex(toolbarColors.iconBg)} onChange={(e) => handleSaveColor('iconBg', hexToRgba(e.target.value, 0.7))} style={{ width: 32, height: 24, padding: 0, border: '1px solid rgba(148,163,184,.2)', borderRadius: 4, cursor: 'pointer' }} />
                    <input value={toolbarColors.iconBg} onChange={(e) => handleSaveColor('iconBg', e.target.value)} placeholder="rgba(...)" style={{ flex: 1, background: 'rgba(15,23,42,.5)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 6, color: '#cbd5e1', padding: '4px 8px', fontSize: 12 }} />
                  </label>
                  <button className="popup-action" onClick={handleResetColors} style={{ marginTop: 4 }}>恢复默认</button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {dockOpen ? (
          <section className="floating-context-drawer debug-panel">
            <div className="floating-context-card">
              <div className="panel-header">
                <h3>调试信息</h3>
                <button className="popup-action" onClick={() => setDockOpen(false)}>隐藏</button>
              </div>
              <p className="analysis-summary">最后剪贴板长度：{lastClipboardText.length}</p>
              <div className="action-list" style={{ marginBottom: 8 }}>
                <button className="popup-action" onClick={sendClipboard}>剪贴板文本</button>
              </div>
              <div className="debug-list">
                {debugEntries.map((entry, i) => (
                  <div key={i} className="debug-line">{entry}</div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="chat-panel floating-chat-layout">
          <div className="popup-section chat-messages">{messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
              <strong>{message.role === 'ai' ? 'AI' : '你'}</strong>
              {/* 图片消息渲染 */}
              {message.image && <img src={message.image} alt="用户发送的图片" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />}
              {message.role === 'ai' ? renderMd(message.content) : <p>{message.content}</p>}
            </div>
          ))}</div>
          <footer className="floating-input-bar">
            {/* 隐藏的文件输入控件 */}
            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            {/* 图片按钮 */}
            <button
              className="popup-action"
              style={{ padding: '8px 12px', fontSize: '13px' }}
              onClick={() => imageInputRef.current?.click()}
              title="选择图片文件"
            >
              📷 图片
            </button>
            <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="输入问题，回车或点击发送" onKeyDown={(event) => { if (event.key === 'Enter') sendChat(); }} />
            <button className="popup-action" onClick={sendChat}>发送</button>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-card"><div><p className="eyebrow">AI Assistant · Real Data Test</p><h1>现在已经切换到真实数据模式</h1><p className="subtitle">你可以通过系统对话框导入本地文件，列表、详情和分析结果会同步更新。</p></div><div className="hero-actions"><button className="primary-button" onClick={handleImport}>导入文件</button><button className="primary-button" onClick={openFloating}>打开悬浮 AI</button><button className="primary-button" onClick={sendToFloating} disabled={!selectedFile.path}>发送到悬浮窗</button><button className="primary-button" onClick={sendClipboard}>剪贴板文本</button><div className="status-pill">{status}</div></div></section>
      <section className="layout-grid"><aside className="panel"><div className="panel-header"><h2>文件列表</h2><span>{files.length} 个文件</span></div><div className="file-list">{files.length === 0 ? <div className="empty-state">尚未导入文件</div> : files.map((file) => (<button key={`${file.name}-${file.size}`} className={file.name === selectedFile.name ? 'file-item active' : 'file-item'} onClick={() => { setSelectedFile(file); setAnalysis(defaultAnalysis); setShowFullText(false); }}><strong>{file.name}</strong><span>{file.type || 'unknown'}</span><small>{bytesToHuman(file.size)}</small></button>))}</div></aside><section className="panel"><div className="panel-header"><h2>文件信息</h2><button className="primary-button" onClick={openFloating}>打开悬浮 AI</button></div><div className="detail-card"><div><p className="label">文件名</p><p>{selectedFile.name}</p></div><div><p className="label">类型</p><p>{selectedFile.type || 'unknown'}</p></div><div><p className="label">大小</p><p>{bytesToHuman(selectedFile.size)}</p></div><div><p className="label">修改时间</p><p>{selectedFile.updatedAt ? new Date(selectedFile.updatedAt).toLocaleString() : '-'}</p></div></div><div className="analysis-box"><h3>智能分析结果</h3><p className="analysis-summary">{analysis.summary}</p><div className="analysis-columns"><div><h4>风险点</h4><ul>{analysis.risks.length > 0 ? analysis.risks.map((item) => <li key={item}>{item}</li>) : <li>暂无明显风险</li>}</ul></div><div><h4>建议操作</h4><ul>{analysis.suggestions.length > 0 ? analysis.suggestions.map((item) => <li key={item}>{item}</li>) : <li>暂无建议</li>}</ul></div></div><div><h4>关键内容</h4><ul>{analysis.highlights.length > 0 ? analysis.highlights.map((item) => <li key={item}>{item}</li>) : <li>暂无关键内容</li>}</ul></div><div className="analysis-box secondary"><div className="panel-header"><div><h4>内容预览</h4><p className="analysis-summary">{previewMeta}</p></div>{selectedFile.preview ? <button className="primary-button" onClick={() => setShowFullText((value) => !value)}>{showFullText ? '收起全文' : '预览全文'}</button> : null}</div><p className="analysis-summary preview-text">{previewText}</p>{selectedFile.fullTextAvailable ? <p className="analysis-summary">{showFullText ? '当前显示全文' : '当前显示摘要，可切换为全文预览。'}</p> : null}</div></div></section></section>
    </main>
  );
}
