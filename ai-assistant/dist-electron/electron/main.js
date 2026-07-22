import { app, BrowserWindow, clipboard, dialog, ipcMain, screen, Tray, Menu, nativeImage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import { uiaBridge } from './uia-bridge.js';
// 开启远程调试端口，方便排查渲染进程问题
app.commandLine.appendSwitch('remote-debugging-port', '9223');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged || true; // 测试时强制加载 localhost，生产构建请改回 !app.isPackaged
console.log(`[main] isDev=${isDev} isPackaged=${app.isPackaged}`);
const textExtensions = new Set(['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'yaml', 'yml', 'csv', 'log', 'ini', 'env', 'xml']);
const docxExtensions = new Set(['docx']);
const pdfExtensions = new Set(['pdf']);
const pptxExtensions = new Set(['pptx']);
const configPath = path.join(app.getPath('userData'), 'deepseek-config.json');
const chatHistoryPath = path.join(app.getPath('userData'), 'chat-history.json');
const defaultChatHistory = [
    { role: 'ai', content: '你好，我是悬浮 AI，可以接收文件内容或选中文本并帮你分析。', timestamp: Date.now() }
];
const MAX_HISTORY = 100; // 最多保存 100 条消息
const loadChatHistory = async () => {
    try {
        const data = await fs.readFile(chatHistoryPath, 'utf8');
        const history = JSON.parse(data);
        return Array.isArray(history) && history.length > 0 ? history : defaultChatHistory;
    }
    catch {
        return defaultChatHistory;
    }
};
const saveChatHistory = async (messages) => {
    try {
        await fs.mkdir(path.dirname(chatHistoryPath), { recursive: true });
        // 只保留最近的 MAX_HISTORY 条消息
        const toSave = messages.slice(-MAX_HISTORY);
        await fs.writeFile(chatHistoryPath, JSON.stringify(toSave, null, 2), 'utf8');
    }
    catch (e) {
        console.error('[chat-history] save error:', e);
    }
};
let mainWindow = null;
let floatingWindow = null;
let webSelectionWindow = null;
let selectionToolbarWindow = null;
let translationWindow = null;
const hideTranslationWindow = () => {
    if (translationWindow && !translationWindow.isDestroyed() && translationWindow.isVisible()) {
        translationWindow.hide();
        console.log('[translation][debug] hidden because selection toolbar/floating is showing');
    }
};
const createWebSelectionWindow = () => {
    if (webSelectionWindow && !webSelectionWindow.isDestroyed())
        return webSelectionWindow;
    webSelectionWindow = new BrowserWindow({
        width: 210,
        height: 56,
        minWidth: 210,
        minHeight: 56,
        frame: false,
        transparent: true,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
        roundedCorners: false,
    });
    webSelectionWindow.setAlwaysOnTop(true, 'screen-saver');
    webSelectionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    webSelectionWindow.setIgnoreMouseEvents(false);
    if (isDev)
        webSelectionWindow.loadURL('http://localhost:5173/?view=web-toolbar');
    else
        webSelectionWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { view: 'web-toolbar' } });
    webSelectionWindow.webContents.openDevTools({ mode: 'detach' });
    // 保留窗口实例以便复用；不再失焦自动隐藏，避免点击菜单过程中窗口被意外关闭
    webSelectionWindow.on('closed', () => { webSelectionWindow = null; });
    return webSelectionWindow;
};
let lastWebText = '';
let lastSelectionAnchor = { x: 80, y: 80 };
let lastSelectionRect = { x: 80, y: 80, width: 0, height: 0, source: 'unknown' };
let lastWebToolbarRect = { x: 0, y: 0, width: 210, height: 52 };
const showWebSelectionToolbar = (text, cursorX, cursorY) => {
    const win = createWebSelectionWindow();
    // 优先使用 lastSelectionRect（选区矩形），它包含完整位置信息；cursorX/cursorY 可能是不准确的鼠标/边界坐标
    const anchorX = typeof lastSelectionRect.x === 'number' && lastSelectionRect.width > 0
        ? Math.round(lastSelectionRect.x + lastSelectionRect.width / 2)
        : Math.round(cursorX);
    const anchorY = typeof lastSelectionRect.y === 'number' && lastSelectionRect.height > 0
        ? Math.round(lastSelectionRect.y)
        : Math.round(cursorY);
    const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY });
    const toolbarWidth = 210;
    const toolbarHeight = 56;
    // 工具条以选区中心上方为目标
    let tbX = anchorX - Math.round(toolbarWidth / 2);
    if (tbX < display.workArea.x + 4)
        tbX = display.workArea.x + 4;
    if (tbX + toolbarWidth > display.workArea.x + display.workArea.width - 4) {
        tbX = display.workArea.x + display.workArea.width - toolbarWidth - 4;
    }
    let tbY = anchorY - toolbarHeight - 4;
    if (tbY < display.workArea.y + 4) {
        tbY = display.workArea.y + 4;
    }
    console.log(`[web-toolbar][debug] input cursor=(${Math.round(cursorX)},${Math.round(cursorY)}) rect=(${lastSelectionRect.x},${lastSelectionRect.y},${lastSelectionRect.width},${lastSelectionRect.height}) anchor=(${anchorX},${anchorY}) display=(${display.workArea.x},${display.workArea.y},${display.workArea.width},${display.workArea.height}) computed=(${Math.round(tbX)},${Math.round(tbY)})`);
    win.setSize(toolbarWidth, toolbarHeight, false);
    win.setPosition(Math.round(tbX), Math.round(tbY));
    lastWebText = text;
    lastSelectionAnchor = { x: Math.round(cursorX), y: Math.round(cursorY) };
    lastWebToolbarRect = { x: Math.round(tbX), y: Math.round(tbY), width: toolbarWidth, height: toolbarHeight };
    console.log(`[web-toolbar][debug] anchor=(${lastSelectionAnchor.x},${lastSelectionAnchor.y}) toolbar=(${lastWebToolbarRect.x},${lastWebToolbarRect.y},${lastWebToolbarRect.width},${lastWebToolbarRect.height}) dx=${lastWebToolbarRect.x - lastSelectionAnchor.x} dy=${lastWebToolbarRect.y - lastSelectionAnchor.y}`);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.show();
    win.moveTop();
    const payload = { text, source: 'web', x: anchorX, y: anchorY, width: toolbarWidth, height: toolbarHeight };
    if (!win.webContents.isLoadingMainFrame()) {
        win.webContents.send('web-toolbar:text', payload);
    }
    else {
        win.webContents.once('did-finish-load', () => {
            win.webContents.send('web-toolbar:text', payload);
        });
    }
    // 不再设置固定的 4 秒自动隐藏，改为失焦隐藏，给用户足够时间点击菜单
    console.log(`[web-toolbar] show at (${Math.round(tbX)},${Math.round(tbY)}) size=${toolbarWidth}x${toolbarHeight} len=${text.length}`);
};
const computeResultWindowSize = (text) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const charCount = text.length;
    const lineCount = Math.max(1, lines.length);
    const width = Math.min(760, Math.max(320, Math.ceil(Math.min(120, Math.max(...lines.map((l) => l.length), 40)) * 8 + 60)));
    const height = Math.min(720, Math.max(180, Math.ceil(lineCount * 28 + 120 + Math.min(120, charCount / 6))));
    return { width, height };
};
const showResultWindow = (text, source, cursorX, cursorY) => {
    const { width, height } = computeResultWindowSize(text);
    const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
    let x = Math.round(cursorX - width / 2);
    let y = Math.round(cursorY - height - 10);
    if (x + width > display.workArea.x + display.workArea.width) {
        x = display.workArea.x + display.workArea.width - width - 12;
    }
    if (x < display.workArea.x + 12)
        x = display.workArea.x + 12;
    if (y < display.workArea.y + 12) {
        y = cursorY + 12;
    }
    if (y + height > display.workArea.y + display.workArea.height) {
        y = display.workArea.y + display.workArea.height - height - 12;
    }
    if (!translationWindow || translationWindow.isDestroyed()) {
        translationWindow = new BrowserWindow({
            width,
            height,
            x,
            y,
            frame: false,
            transparent: true,
            resizable: true,
            movable: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            hasShadow: false,
            backgroundColor: '#00000000',
            webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
        });
        translationWindow.setAlwaysOnTop(true, 'screen-saver');
        translationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        translationWindow.on('closed', () => { translationWindow = null; });
        if (isDev)
            translationWindow.loadURL('http://localhost:5173/?view=translation');
        else
            translationWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { view: 'translation' } });
        translationWindow.webContents.once('did-finish-load', () => {
            translationWindow?.showInactive();
            translationWindow?.moveTop();
        });
    }
    else {
        translationWindow.setSize(width, height, false);
        translationWindow.setPosition(Math.round(x), Math.round(y));
    }
    const win = translationWindow;
    if (!win)
        return;
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.showInactive();
    win.moveTop();
    if (!win.webContents.isLoadingMainFrame()) {
        win.webContents.send('translation:text', { text, source });
    }
    else {
        win.webContents.once('did-finish-load', () => {
            win.webContents.send('translation:text', { text, source });
        });
    }
    console.log(`[result] show source="${source}" at (${Math.round(x)},${Math.round(y)}) size=${width}x${height} chars=${text.length}`);
};
const showLoadingResultWindow = (source, cursorX, cursorY) => {
    // 用固定大小显示加载窗口
    const width = 360;
    const height = 180;
    const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
    let x = Math.round(cursorX - width / 2);
    let y = Math.round(cursorY - height - 10);
    if (x + width > display.workArea.x + display.workArea.width) {
        x = display.workArea.x + display.workArea.width - width - 12;
    }
    if (x < display.workArea.x + 12)
        x = display.workArea.x + 12;
    if (y < display.workArea.y + 12) {
        y = cursorY + 12;
    }
    if (y + height > display.workArea.y + display.workArea.height) {
        y = display.workArea.y + display.workArea.height - height - 12;
    }
    if (!translationWindow || translationWindow.isDestroyed()) {
        translationWindow = new BrowserWindow({
            width,
            height,
            x,
            y,
            frame: false,
            transparent: true,
            resizable: true,
            movable: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            hasShadow: false,
            backgroundColor: '#00000000',
            webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
        });
        translationWindow.setAlwaysOnTop(true, 'screen-saver');
        translationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        translationWindow.on('closed', () => { translationWindow = null; });
        if (isDev)
            translationWindow.loadURL('http://localhost:5173/?view=translation');
        else
            translationWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { view: 'translation' } });
        translationWindow.webContents.once('did-finish-load', () => {
            translationWindow?.showInactive();
            translationWindow?.moveTop();
        });
    }
    else {
        translationWindow.setSize(width, height, false);
        translationWindow.setPosition(Math.round(x), Math.round(y));
    }
    const win = translationWindow;
    if (!win)
        return;
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.showInactive();
    win.moveTop();
    // 发送加载状态
    if (!win.webContents.isLoadingMainFrame()) {
        win.webContents.send('translation:text', { text: '', source, loading: true });
    }
    else {
        win.webContents.once('did-finish-load', () => {
            win.webContents.send('translation:text', { text: '', source, loading: true });
        });
    }
    console.log(`[result] show loading source="${source}" at (${Math.round(x)},${Math.round(y)}) size=${width}x${height}`);
};
const showTranslationWindow = async (text, cursorX, cursorY) => {
    showLoadingResultWindow('翻译', cursorX, cursorY);
    const result = await analyzeWithDeepSeek(`请将下面内容翻译成简体中文，并尽量保持自然、准确、简洁：\n\n${text}`, '网页选区-翻译');
    if (result.ok) {
        showResultWindow(result.text, '翻译', cursorX, cursorY);
    }
    else {
        showResultWindow(result.error, '翻译失败', cursorX, cursorY);
    }
};
let clipboardTimer = null;
let toolbarHideTimer = null;
let lastClipboardText = '';
let pendingSelectionPayload = null;
let internalClipboardWrite = false; // 标记程序内部写入，避免误触发
let lastClipboardChangeTime = 0; // 用于防抖
let uiaPollTimer = null; // UIA 轮询定时器
let lastUiaSelectionText = ''; // 上次 UIA 选区文本，用于去重
let uiaHasSelection = false; // 是否有选区，用于动态调整轮询频率
let uiaNoSelectionCount = 0; // 连续无选区次数，用于延迟降低频率
let appTray = null;
const defaultToolbarColors = {
    bg: 'rgba(15,23,42,.92)',
    border: 'rgba(148,163,184,.15)',
    text: '#e2e8f0',
    iconBg: 'rgba(30,41,59,.7)',
};
const toolbarColorPath = path.join(app.getPath('userData'), 'toolbar-colors.json');
let toolbarColors = { ...defaultToolbarColors };
const defaultConfig = { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' };
let deepseekConfig = { ...defaultConfig };
const loadConfig = async () => {
    try {
        deepseekConfig = { ...defaultConfig, ...JSON.parse(await fs.readFile(configPath, 'utf8')) };
    }
    catch {
        deepseekConfig = { ...defaultConfig };
    }
};
const saveConfig = async (next) => {
    deepseekConfig = { ...defaultConfig, ...next };
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(deepseekConfig, null, 2), 'utf8');
    return deepseekConfig;
};
// 工具条颜色配置
const loadToolbarColors = async () => {
    try {
        toolbarColors = { ...defaultToolbarColors, ...JSON.parse(await fs.readFile(toolbarColorPath, 'utf8')) };
    }
    catch {
        toolbarColors = { ...defaultToolbarColors };
    }
};
const saveToolbarColors = async (next) => {
    toolbarColors = { ...toolbarColors, ...next };
    await fs.mkdir(path.dirname(toolbarColorPath), { recursive: true });
    await fs.writeFile(toolbarColorPath, JSON.stringify(toolbarColors, null, 2), 'utf8');
    // 广播给所有窗口
    [floatingWindow, mainWindow].forEach((w) => {
        if (w && !w.isDestroyed())
            w.webContents.send('toolbar:colors', toolbarColors);
    });
    return toolbarColors;
};
// 创建系统托盘图标
const createTray = () => {
    if (appTray)
        return;
    // 生成一个最小的 16x16 蓝紫色圆形 PNG（纯 Buffer 构建）
    const w = 16, h = 16;
    const raw = Buffer.alloc(w * h * 4);
    // 绘制蓝紫色圆形
    const cx = 7.5, cy = 7.5, r = 7;
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) {
                const i = (y * w + x) * 4;
                raw[i] = 99;
                raw[i + 1] = 102;
                raw[i + 2] = 241;
                raw[i + 3] = 255; // #6366f1 蓝紫
            }
        }
    const img = nativeImage.createFromBuffer(raw, { width: w, height: h });
    appTray = new Tray(img.resize({ width: 16, height: 16 }));
    appTray.setToolTip('AI 运维助手');
    const contextMenu = Menu.buildFromTemplate([
        { label: '打开主窗口', click: () => createFloatingWindow().show() },
        { type: 'separator' },
        { label: '设置', click: () => openSettingsWindow() },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
    ]);
    appTray.setContextMenu(contextMenu);
};
// 设置窗口（独立弹窗）
let settingsWindow = null;
const openSettingsWindow = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return;
    }
    settingsWindow = new BrowserWindow({
        width: 480, height: 520,
        frame: false, transparent: false, resizable: true,
        alwaysOnTop: true, skipTaskbar: true,
        hasShadow: true,
        parent: floatingWindow || undefined,
        modal: !!floatingWindow,
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
    });
    if (isDev)
        settingsWindow.loadURL('http://localhost:5173/?view=settings');
    else
        settingsWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { view: 'settings' } });
    settingsWindow.on('closed', () => { settingsWindow = null; });
};
const detectFormat = (ext) => (textExtensions.has(ext) ? 'text' : docxExtensions.has(ext) ? 'docx' : pdfExtensions.has(ext) ? 'pdf' : pptxExtensions.has(ext) ? 'pptx' : 'other');
const extractText = async (filePath, ext) => {
    try {
        if (textExtensions.has(ext)) {
            const buffer = await fs.readFile(filePath);
            const text = buffer.toString('utf8');
            const nullByteCount = buffer.subarray(0, Math.min(buffer.length, 2048)).filter((byte) => byte === 0).length;
            if (nullByteCount > 0)
                return { preview: '', fullTextAvailable: false };
            return { preview: text.replace(/\0/g, '').slice(0, 800), fullTextAvailable: true };
        }
        if (docxExtensions.has(ext)) {
            const result = await mammoth.extractRawText({ path: filePath });
            return { preview: result.value.replace(/\0/g, '').slice(0, 800), fullTextAvailable: true };
        }
    }
    catch {
        return { preview: '', fullTextAvailable: false };
    }
    return { preview: '', fullTextAvailable: false };
};
const buildAnalysis = (summary) => {
    const preview = summary.preview?.trim() ?? '';
    const ext = summary.type.toLowerCase();
    const summaryText = preview ? `已读取 ${summary.name} 的内容预览，可继续做结构化分析。` : `已识别 ${summary.name} 为 ${ext} 文件，当前仅获取到基础元数据。`;
    const risks = [];
    if (summary.size > 5 * 1024 * 1024)
        risks.push('文件体积较大，建议分段解析。');
    if (!preview && summary.format === 'text')
        risks.push('文本文件未成功预览，可能存在编码或格式问题。');
    if (summary.format === 'other' || summary.format === 'pptx')
        risks.push('当前仅展示元信息，后续可增加专用解析器。');
    if (summary.format === 'pdf')
        risks.push('PDF 内容提取可能受扫描件或加密影响。');
    if (summary.format === 'docx' && !preview)
        risks.push('Word 文档未能成功解析，可能为损坏或特殊结构。');
    const suggestions = ['优先检查文件格式与编码。', '如果是日志文件，可进一步提取错误行与时间线。', '如果是配置文件，可继续做字段校验与缺失项检查。'];
    const highlights = preview ? preview.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5) : ['已完成基础元数据读取'];
    return { summary: summaryText, risks, suggestions, highlights };
};
const toSummary = async (filePath) => {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const format = detectFormat(ext);
    const { preview, fullTextAvailable } = await extractText(filePath, ext);
    return { name: path.basename(filePath), size: stat.size, type: ext || 'unknown', updatedAt: stat.mtime.toISOString(), path: filePath, preview, fullTextAvailable, format };
};
const analyzeWithAi = async (request) => {
    const preview = request.file.preview?.trim() ?? '';
    const baseActions = ['复制摘要', '发送到对话', '标记为待处理'];
    return { summary: request.analysis.summary, risks: request.analysis.risks, suggestions: request.analysis.suggestions, highlights: request.analysis.highlights, actions: preview ? [...baseActions, '打开全文', '定位关键内容'] : [...baseActions, '重新解析文件', '切换其他文件'] };
};
const analyzeWithDeepSeek = async (content, source) => {
    if (!deepseekConfig.apiKey)
        return { ok: false, error: '未配置 DeepSeek API Key，请在设置中配置后再试。' };
    try {
        const response = await fetch(`${deepseekConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekConfig.apiKey}` },
            body: JSON.stringify({ model: deepseekConfig.model, messages: [{ role: 'system', content: '你是一个中文 AI 助手，擅长分析用户选中的文本、文档内容和文件摘要。' }, { role: 'user', content: `来源：${source}\n\n内容：\n${content}` }], temperature: 0.2 }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[deepseek] request failed: ${response.status} ${errorText}`);
            return { ok: false, error: `AI 请求失败 (${response.status})，请检查网络或 API Key 是否有效。` };
        }
        const data = (await response.json());
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text)
            return { ok: false, error: 'AI 未返回内容，请稍后重试。' };
        return { ok: true, text };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[deepseek] error:', msg);
        return { ok: false, error: `AI 调用异常：${msg}` };
    }
};
// 流式调用 DeepSeek，实时推送内容到窗口
const analyzeWithDeepSeekStream = async (content, source, window) => {
    if (!deepseekConfig.apiKey) {
        window.webContents.send('stream:chunk', { done: false, error: '未配置 DeepSeek API Key' });
        return;
    }
    try {
        const response = await fetch(`${deepseekConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekConfig.apiKey}` },
            body: JSON.stringify({
                model: deepseekConfig.model,
                messages: [{ role: 'system', content: '你是一个中文 AI 助手，擅长分析用户选中的文本、文档内容和文件摘要。' }, { role: 'user', content: `来源：${source}\n\n内容：\n${content}` }],
                temperature: 0.2,
                stream: true,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            window.webContents.send('stream:chunk', { done: false, error: `AI 请求失败 (${response.status})` });
            return;
        }
        if (!response.body) {
            window.webContents.send('stream:chunk', { done: false, error: 'AI 未返回内容' });
            return;
        }
        // 逐块读取 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // SSE 格式：data: {...}\n\n
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: '))
                    continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === '[DONE]')
                    continue;
                try {
                    const data = JSON.parse(jsonStr);
                    const chunk = data.choices?.[0]?.delta?.content;
                    if (chunk) {
                        fullText += chunk;
                        window.webContents.send('stream:chunk', { done: false, chunk, fullText });
                    }
                }
                catch {
                    // 忽略解析错误
                }
            }
        }
        window.webContents.send('stream:chunk', { done: true, fullText });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[deepseek stream] error:', msg);
        window.webContents.send('stream:chunk', { done: false, error: `AI 调用异常：${msg}` });
    }
};
const createSelectionToolbar = () => {
    if (selectionToolbarWindow && !selectionToolbarWindow.isDestroyed())
        return selectionToolbarWindow;
    selectionToolbarWindow = new BrowserWindow({
        width: 320, height: 52,
        frame: false, transparent: true, resizable: true,
        alwaysOnTop: true, skipTaskbar: true,
        hasShadow: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
    });
    selectionToolbarWindow.setAlwaysOnTop(true, 'screen-saver');
    selectionToolbarWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (isDev)
        selectionToolbarWindow.loadURL('http://localhost:5173/?view=toolbar');
    else
        selectionToolbarWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { view: 'toolbar' } });
    // 不再自动隐藏：只要选区还在就应保持可见，避免用户点击菜单或结果窗口时工具条消失
    selectionToolbarWindow.on('closed', () => { selectionToolbarWindow = null; });
    return selectionToolbarWindow;
};
// 保存最后一次发给工具条的文本（用于工具条窗口主动拉取）
let lastToolbarText = '';
const showSelectionToolbar = (text, cursorX, cursorY) => {
    const win = createSelectionToolbar();
    // 工具条显示在光标上方居中，类似 macOS/iOS 的选区工具条
    const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
    const toolbarWidth = 320;
    const toolbarHeight = 52;
    const offsetAbove = 8; // 光标上方间距
    // 默认在光标上方居中
    let tbX = cursorX - toolbarWidth / 2;
    let tbY = cursorY - toolbarHeight - offsetAbove;
    // 边界检测：不超出屏幕工作区
    if (tbX < display.workArea.x)
        tbX = display.workArea.x + 4;
    if (tbX + toolbarWidth > display.workArea.x + display.workArea.width)
        tbX = display.workArea.x + display.workArea.width - toolbarWidth - 4;
    if (tbY < display.workArea.y) {
        // 上方空间不够，改到光标下方
        tbY = cursorY + offsetAbove + 20; // 加上行高偏移
    }
    win.setPosition(Math.round(tbX), Math.round(tbY));
    console.log(`[selection-toolbar][debug] anchor=(${Math.round(cursorX)},${Math.round(cursorY)}) toolbar=(${Math.round(tbX)},${Math.round(tbY)},${toolbarWidth},${toolbarHeight}) dx=${Math.round(tbX) - Math.round(cursorX)} dy=${Math.round(tbY) - Math.round(cursorY)}`);
    cancelToolbarHide();
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.showInactive();
    win.moveTop();
    // 保存文本并发送给工具条窗口
    lastToolbarText = text;
    if (!win.webContents.isLoadingMainFrame()) {
        win.webContents.send('toolbar:text', text);
    }
    else {
        win.webContents.once('did-finish-load', () => {
            win.webContents.send('toolbar:text', text);
        });
    }
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.showInactive();
    win.moveTop();
    console.log(`[selection-toolbar] show at (${Math.round(tbX)},${Math.round(tbY)}) len=${text.length}`);
};
const scheduleToolbarHide = (delay) => {
    toolbarHideTimer = setTimeout(() => {
        if (selectionToolbarWindow && !selectionToolbarWindow.isDestroyed()) {
            selectionToolbarWindow.hide();
        }
    }, delay);
};
const cancelToolbarHide = () => {
    if (toolbarHideTimer) {
        clearTimeout(toolbarHideTimer);
        toolbarHideTimer = null;
    }
};
// 文本来源优先级：UIA > 剪贴板（防止剪贴板覆盖 UIA 检测到的选区）
let lastSourceTime = 0;
let lastSourcePriority = 0; // 0=无, 1=剪贴板, 2=UIA, 3=PPT-COM
const dispatchSelectionPayload = (payload) => {
    const isWeb = /WEB\(/i.test(payload.source);
    const priority = payload.source === '剪贴板' ? 1 : payload.source === 'POWERPNT' ? 3 : isWeb ? 4 : 2;
    const now = Date.now();
    if (now - lastSourceTime < 800 && priority <= lastSourcePriority) {
        console.log(`[selection] skip ${payload.source} (priority ${priority} <= ${lastSourcePriority}, ${(now - lastSourceTime)}ms ago)`);
        return;
    }
    lastSourceTime = now;
    lastSourcePriority = priority;
    // 统一记录“选区锚点”，只基于选中的文字，不追踪鼠标
    if (typeof payload.x === 'number' && typeof payload.y === 'number') {
        lastSelectionAnchor = { x: Math.round(payload.x), y: Math.round(payload.y) };
    }
    // 网页来源单独处理：仅显示胶囊工具条，不发送给悬浮窗
    if (isWeb) {
        if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
            console.log(`[web-selection] skipped because selection rect is missing source=${payload.source}`);
            return;
        }
        const anchorX = payload.x;
        const anchorY = payload.y;
        const rectW = typeof payload.width === 'number' ? payload.width : 0;
        const rectH = typeof payload.height === 'number' ? payload.height : 0;
        lastSelectionRect = { x: anchorX, y: anchorY, width: rectW, height: rectH, source: payload.source };
        console.log(`[web-selection] detected source=${payload.source} len=${payload.text.length} rect=(${payload.x},${payload.y},${rectW},${rectH}) anchor=(${anchorX},${anchorY})`);
        const cleaned = payload.text
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1000);
        if (cleaned.length < 2) {
            console.log(`[web-selection] text too short after cleaning, skipped`);
            return;
        }
        console.log(`[web-selection] cleaned len=${cleaned.length}`);
        showWebSelectionToolbar(cleaned, anchorX, anchorY);
        return; // ← 重要：网页选区到此为止，不继续处理
    }
    // PPT 单独处理
    if (payload.source === 'POWERPNT') {
        clipboard.writeText(payload.text);
        const existed = floatingWindow && !floatingWindow.isDestroyed();
        const win = createFloatingWindow();
        win.setOpacity(1);
        win.setBackgroundColor('#00000000');
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        if (!existed) {
            win.setBounds({ x: 40, y: 40, width: 520, height: 320 });
        }
        win.webContents.send('floating:text', { text: payload.text, source: payload.source });
        win.show();
        win.showInactive();
        win.moveTop();
        win.focus();
        pendingSelectionPayload = null;
        return;
    }
    // ❌ 禁用自动发送给悬浮窗 ❌
    // 只显示通用工具条，不发送 floating:text 事件
    console.log(`[selection-toolbar] dispatch: source=${payload.source} len=${payload.text.length} (NOT sending to floating window)`);
    if (typeof payload.x === 'number' && typeof payload.y === 'number') {
        showSelectionToolbar(payload.text, payload.x, payload.y);
    }
    else {
        console.log(`[selection-toolbar][debug] skipped because selection rect is missing source=${payload.source}`);
    }
};
const createFloatingWindow = () => {
    if (floatingWindow)
        return floatingWindow;
    floatingWindow = new BrowserWindow({
        width: 420,
        height: 620,
        minWidth: 360,
        minHeight: 480,
        x: 40,
        y: 40,
        frame: false,
        transparent: true,
        resizable: true,
        movable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#00000000',
        title: 'AI Assistant Floating',
        hasShadow: true,
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
    });
    // Windows 10+ 系统上启用圆角（DWM 支持）
    if (process.platform === 'win32') {
        try {
            const hwnd = floatingWindow.getNativeWindowHandle().readUInt32LE(0);
            // 尝试应用 Windows 11 的圆角效果（需要 win32-api）
            // 这里只能通过 Electron 的 native 模块或 ffi 实现，简化处理
        }
        catch (e) {
            // 忽略错误，视觉样式由 CSS 处理
        }
    }
    floatingWindow.setAlwaysOnTop(true, 'screen-saver');
    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (isDev)
        floatingWindow.loadURL('http://localhost:5173/?view=floating');
    else
        floatingWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { view: 'floating' } });
    floatingWindow.once('ready-to-show', () => { floatingWindow?.showInactive(); floatingWindow?.moveTop(); floatingWindow?.setAlwaysOnTop(true, 'screen-saver'); });
    floatingWindow.on('closed', () => { floatingWindow = null; });
    return floatingWindow;
};
function createMainWindow() {
    mainWindow = new BrowserWindow({ width: 1280, height: 860, minWidth: 1100, minHeight: 720, backgroundColor: '#0b1020', title: 'AI Assistant', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
    }
    mainWindow.on('closed', () => { mainWindow = null; });
}
const startClipboardWatch = () => {
    if (clipboardTimer)
        return;
    // 方案：轮询剪贴板，但仅在"非网页源激活"时处理
    // 这样避免网页选区激活时，剪贴板又混进来
    clipboardTimer = setInterval(() => {
        // 跳过程序内部写入的剪贴板变化（比如"复制"按钮操作）
        if (internalClipboardWrite) {
            internalClipboardWrite = false;
            return;
        }
        // 核心修复：如果网页工具条已经显示，就不处理剪贴板变化
        if (webSelectionWindow && !webSelectionWindow.isDestroyed() && webSelectionWindow.isVisible()) {
            console.log('[clipboard-watch] skip due to visible web toolbar');
            return;
        }
        const current = clipboard.readText().trim();
        const now = Date.now();
        // 空内容或未变化，跳过
        if (!current || current === lastClipboardText)
            return;
        // 防抖：300ms 内的变化才认为是用户主动复制
        if (now - lastClipboardChangeTime < 300)
            return;
        lastClipboardText = current;
        lastClipboardChangeTime = now;
        console.log(`[clipboard-watch] new text len=${current.length} ignored for toolbar positioning`);
        return;
    }, 300);
};
// ─── 方案 B：UI Automation 轮询（优先级高于剪贴板） ──
const startUIAWatch = () => {
    if (uiaPollTimer)
        return;
    // 延迟启动，等 UiaBridge 初始化完成
    setTimeout(async () => {
        const ready = await uiaBridge.init();
        if (!ready) {
            console.log('[uia] bridge not available, clipboard-only mode');
            return;
        }
        console.log('[uia] starting poll (dynamic interval)');
        const poll = async () => {
            try {
                const { changed, selection } = await uiaBridge.poll();
                // 动态调整轮询频率
                if (changed && selection?.text) {
                    uiaHasSelection = true;
                    uiaNoSelectionCount = 0;
                    console.log(`[uia] poll: CHANGED source=${selection?.source} len=${selection?.text.length}`);
                }
                else {
                    uiaNoSelectionCount++;
                    // 连续 5 次无选区，切换到低频模式
                    if (uiaHasSelection && uiaNoSelectionCount >= 5) {
                        uiaHasSelection = false;
                        console.log('[uia] no selection, switching to slow poll (2000ms)');
                    }
                }
                if (!changed || !selection) {
                    // 无选区变化，跳过处理，继续下一次轮询
                }
                else {
                    // 去重：如果文本相同但位置明显变化，也允许刷新
                    const rectKey = `${Math.round(selection.rect.x)}:${Math.round(selection.rect.y)}:${Math.round(selection.rect.width)}:${Math.round(selection.rect.height)}`;
                    const lastRectKey = `${lastSelectionRect.x}:${lastSelectionRect.y}:${lastSelectionRect.width}:${lastSelectionRect.height}`;
                    if (selection.text === lastUiaSelectionText && rectKey === lastRectKey) {
                        // 重复选区，跳过处理
                    }
                    else {
                        lastUiaSelectionText = selection.text;
                        // 同步到剪贴板标记，防止剪贴板轮询重复触发
                        internalClipboardWrite = true;
                        lastClipboardText = selection.text;
                        lastClipboardChangeTime = Date.now();
                        const isPpt = selection.source === 'POWERPNT' || selection.source.toUpperCase().includes('POWERPNT');
                        const rect = selection.rect;
                        // 过滤无效选区坐标（Chrome UIA 经常返回 0,0,0,0）
                        if (rect.width <= 0 || rect.height <= 0 || rect.x <= 0 || rect.y <= 0) {
                            console.log(`[uia] ignore invalid rect source=${selection.source} rect=(${rect.x},${rect.y},${rect.width},${rect.height})`);
                        }
                        else {
                            // 有效选区才处理
                            const cursor = screen.getCursorScreenPoint();
                            const rectCenterX = rect.x + rect.width / 2;
                            const rectCenterY = rect.y + rect.height / 2;
                            const distToCursor = Math.hypot(cursor.x - rectCenterX, cursor.y - rectCenterY);
                            let anchorX = Math.round(rect.x);
                            let anchorY = Math.round(rect.y);
                            let useRect = true;
                            if (distToCursor > 120) {
                                console.log(`[uia] rect too far from cursor (${Math.round(distToCursor)}px), fallback to cursor`);
                                anchorX = cursor.x;
                                anchorY = cursor.y;
                                useRect = false;
                            }
                            lastSelectionRect = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), source: selection.source };
                            console.log(`[uia] selection changed source=${selection.source} len=${selection.text.length} rect=(${selection.rect.x},${selection.rect.y},${selection.rect.width},${selection.rect.height}) cursor=(${cursor.x},${cursor.y}) dist=${Math.round(distToCursor)} anchor=(${anchorX},${anchorY})`);
                            dispatchSelectionPayload({
                                text: selection.text,
                                source: selection.source,
                                x: isPpt ? Math.max(20, anchorX - 120) : anchorX,
                                y: isPpt ? Math.max(20, anchorY - 70) : anchorY,
                                width: useRect ? Math.round(rect.width) : 0,
                                height: useRect ? Math.round(rect.height) : 0,
                            });
                            // 选区变化后立即切换到高频模式
                            uiaHasSelection = true;
                            uiaNoSelectionCount = 0;
                        }
                    }
                }
            }
            catch (e) {
                // UIA 轮询出错时静默，不影响剪贴板 fallback
                if (e.message?.includes('process exited') || e.message?.includes('killed')) {
                    console.warn('[uia] process died, stopping poll');
                    if (uiaPollTimer) {
                        clearTimeout(uiaPollTimer);
                        uiaPollTimer = null;
                    }
                    return;
                }
            }
            // 动态调整下一次轮询间隔
            const nextInterval = uiaHasSelection ? 500 : 2000;
            uiaPollTimer = setTimeout(poll, nextInterval);
        };
        // 启动第一次轮询
        uiaPollTimer = setTimeout(poll, 500);
    }, 1500); // 等 init 完成
};
app.whenReady().then(async () => {
    await loadConfig();
    ipcMain.handle('app:get-version', () => app.getVersion());
    ipcMain.handle('files:select', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
        if (result.canceled || result.filePaths.length === 0)
            return { files: [], selected: null, analysis: null };
        const files = await Promise.all(result.filePaths.map((filePath) => toSummary(filePath)));
        const selected = files[0];
        return { files, selected, analysis: buildAnalysis(selected) };
    });
    ipcMain.handle('analysis:run', async (_event, request) => analyzeWithAi(request));
    ipcMain.handle('floating:open', async () => { const win = createFloatingWindow(); win.setOpacity(1); win.setAlwaysOnTop(true, 'screen-saver'); win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); win.show(); win.showInactive(); win.moveTop(); });
    ipcMain.handle('floating:close', async () => { floatingWindow?.close(); });
    ipcMain.handle('window:resize', async (_event, { width, height, offsetX = 0, offsetY = 0 }) => {
        // 优先调整当前焦点窗口；网页工具条使用独立的 web-toolbar:resize
        const win = BrowserWindow.getFocusedWindow() ?? (floatingWindow && !floatingWindow.isDestroyed() ? floatingWindow : null);
        if (win && !win.isDestroyed()) {
            const [x, y] = win.getPosition();
            console.log(`[window:resize] target=${win === webSelectionWindow ? 'web-toolbar' : win === floatingWindow ? 'floating' : 'other'} from=(${x},${y}) to size=${width}x${height} offset=(${offsetX},${offsetY})`);
            win.setBounds({ x: x + Math.round(offsetX), y: y + Math.round(offsetY), width, height });
        }
        else {
            console.log('[window:resize] no suitable window found');
        }
    });
    ipcMain.handle('window:close', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            console.log('[window:close] closing window');
            win.close();
        }
    });
    ipcMain.handle('window:minimize', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            console.log('[window:minimize] hiding window');
            win.hide();
        }
    });
    // 网页工具条专用 resize：只操作 webSelectionWindow，避免误调整悬浮窗
    ipcMain.handle('web-toolbar:resize', async (_event, { width, height, offsetX = 0, offsetY = 0 }) => {
        const win = webSelectionWindow;
        if (win && !win.isDestroyed()) {
            const [x, y] = win.getPosition();
            const display = screen.getDisplayNearestPoint({ x, y });
            let newX = x + Math.round(offsetX);
            let newY = y + Math.round(offsetY);
            if (newY + height > display.workArea.y + display.workArea.height - 4) {
                newY = display.workArea.y + display.workArea.height - height - 4;
            }
            if (newY < display.workArea.y + 4)
                newY = display.workArea.y + 4;
            if (newX + width > display.workArea.x + display.workArea.width - 4) {
                newX = display.workArea.x + display.workArea.width - width - 4;
            }
            if (newX < display.workArea.x + 4)
                newX = display.workArea.x + 4;
            console.log(`[web-toolbar:resize] from=(${x},${y}) to=(${newX},${newY}) size=${width}x${height}`);
            win.setSize(width, height, false);
            win.setPosition(newX, newY);
            // 透明 frameless 窗口 resize 后强制恢复鼠标事件区域，避免新区域无法点击
            win.setIgnoreMouseEvents(false);
            win.focus();
        }
        else {
            console.log('[web-toolbar:resize] no web toolbar window found');
        }
    });
    // 独立工具条（/?view=toolbar）专用 resize：只操作 selectionToolbarWindow
    ipcMain.handle('toolbar:resize', async (_event, { width, height, offsetX = 0, offsetY = 0 }) => {
        const win = selectionToolbarWindow;
        if (win && !win.isDestroyed()) {
            const [x, y] = win.getPosition();
            const display = screen.getDisplayNearestPoint({ x, y });
            let newX = x + Math.round(offsetX);
            let newY = y + Math.round(offsetY);
            // 边界检查：避免窗口超出当前屏幕工作区，防止系统/OS自动调整位置造成“掉落”
            if (newY + height > display.workArea.y + display.workArea.height - 4) {
                newY = display.workArea.y + display.workArea.height - height - 4;
            }
            if (newY < display.workArea.y + 4)
                newY = display.workArea.y + 4;
            if (newX + width > display.workArea.x + display.workArea.width - 4) {
                newX = display.workArea.x + display.workArea.width - width - 4;
            }
            if (newX < display.workArea.x + 4)
                newX = display.workArea.x + 4;
            console.log(`[toolbar:resize] from=(${x},${y}) to=(${newX},${newY}) size=${width}x${height} display=(${display.workArea.x},${display.workArea.y},${display.workArea.width},${display.workArea.height})`);
            // 分开设置大小和位置，避免 setBounds 一次性改变造成意外偏移
            win.setSize(width, height, false);
            win.setPosition(newX, newY);
        }
        else {
            console.log('[toolbar:resize] no selection toolbar window found');
        }
    });
    ipcMain.handle('floating:show-text', async (_event, payload) => {
        const existed = floatingWindow && !floatingWindow.isDestroyed();
        const win = createFloatingWindow();
        // 仅当窗口原本不存在时才设置默认大小和位置，避免覆盖用户手动调整
        if (!existed) {
            const width = 520;
            const height = 320;
            const anchorX = payload.x ?? lastSelectionAnchor.x;
            const anchorY = payload.y ?? lastSelectionAnchor.y;
            const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY });
            let x = Math.round(anchorX - width / 2);
            let y = Math.round(anchorY - height - 8);
            if (x + width > display.workArea.x + display.workArea.width - 12)
                x = display.workArea.x + display.workArea.width - width - 12;
            if (x < display.workArea.x + 12)
                x = display.workArea.x + 12;
            if (y < display.workArea.y + 12)
                y = Math.round(anchorY + 8);
            if (y + height > display.workArea.y + display.workArea.height - 12)
                y = display.workArea.y + display.workArea.height - height - 12;
            console.log(`[floating][debug] new window anchor=(${anchorX},${anchorY}) bounds=(${x},${y},${width},${height})`);
            win.setBounds({ x, y, width, height });
        }
        else {
            console.log('[floating][debug] window already exists, preserve bounds');
        }
        win.webContents.send('floating:text', payload);
        win.show();
        win.showInactive();
        win.moveTop();
        win.focus();
    });
    ipcMain.handle('clipboard:get-text', async () => clipboard.readText());
    ipcMain.handle('deepseek:get-config', async () => deepseekConfig);
    ipcMain.handle('deepseek:save-config', async (_event, next) => saveConfig(next));
    ipcMain.handle('chat-history:get', async () => loadChatHistory());
    ipcMain.handle('chat-history:save', async (_event, messages) => saveChatHistory(messages));
    ipcMain.handle('chat-history:clear', async () => { await saveChatHistory(defaultChatHistory); return defaultChatHistory; });
    ipcMain.handle('deepseek:stream', async (_event, { content, source }) => {
        const win = BrowserWindow.getFocusedWindow() ?? floatingWindow;
        if (win && !win.isDestroyed()) {
            analyzeWithDeepSeekStream(content, source, win);
        }
    });
    ipcMain.handle('deepseek:analyze', async (_event, payload) => analyzeWithDeepSeek(payload.content, payload.source));
    ipcMain.handle('selection-toolbar:open', async (_event, payload) => dispatchSelectionPayload(payload));
    ipcMain.handle('selection:capture', async () => ({ text: clipboard.readText(), source: '剪贴板' }));
    ipcMain.handle('toolbar:action', async (_event, { mode, text }) => {
        if (mode === 'copy') {
            internalClipboardWrite = true;
            clipboard.writeText(text);
            return '已复制';
        }
        if (mode === 'translate') {
            console.log(`[toolbar][debug] translate trigger lastSelectionAnchor=(${lastSelectionAnchor.x},${lastSelectionAnchor.y}) lastWebToolbarRect=(${lastWebToolbarRect.x},${lastWebToolbarRect.y},${lastWebToolbarRect.width},${lastWebToolbarRect.height})`);
            await showTranslationWindow(text, lastSelectionAnchor.x, lastSelectionAnchor.y);
            return '已翻译';
        }
        const prompts = {
            chat: `请就下面内容进行对话式回答：\n\n${text}`,
            summary: `请对下面内容做简洁摘要：\n\n${text}`,
            explain: `请解释下面内容的含义、背景和关键点：\n\n${text}`,
            rewrite: `请对下面内容进行润色重写，保持原意但更清晰：\n\n${text}`,
            grammar: `请检查下面内容的语法，指出错误并给出修改建议：\n\n${text}`,
            explainCode: `请解释下面代码的功能、逻辑和关键步骤（如果是非代码文本，请说明它不像代码）：\n\n${text}`,
            answer: `请回答下面的问题：\n\n${text}`,
        };
        const prompt = prompts[mode];
        if (!prompt)
            return;
        const source = `${mode} 结果`;
        if (mode === 'chat') {
            // AI 对话模式：发送到悬浮窗作为对话消息
            const result = await analyzeWithDeepSeek(prompt, '选中文本');
            const existed = floatingWindow && !floatingWindow.isDestroyed();
            const win = createFloatingWindow();
            if (!existed) {
                const width = 520;
                const height = 320;
                const display = screen.getDisplayNearestPoint({ x: lastSelectionAnchor.x, y: lastSelectionAnchor.y });
                let x = Math.round(lastSelectionAnchor.x - width / 2);
                let y = Math.round(lastSelectionAnchor.y - height - 8);
                if (x + width > display.workArea.x + display.workArea.width - 12)
                    x = display.workArea.x + display.workArea.width - width - 12;
                if (x < display.workArea.x + 12)
                    x = display.workArea.x + 12;
                if (y < display.workArea.y + 12)
                    y = Math.round(lastSelectionAnchor.y + 8);
                if (y + height > display.workArea.y + display.workArea.height - 12)
                    y = display.workArea.y + display.workArea.height - height - 12;
                win.setBounds({ x, y, width, height });
            }
            win.webContents.send('floating:text', { text: result.ok ? result.text : result.error, source: result.ok ? source : `${source} - 错误` });
            win.show();
        }
        else {
            // 其他功能：先显示加载窗口，再调用 AI，最后更新结果
            showLoadingResultWindow(source, lastSelectionAnchor.x, lastSelectionAnchor.y);
            const result = await analyzeWithDeepSeek(prompt, '选中文本');
            showResultWindow(result.ok ? result.text : result.error, result.ok ? source : `${mode} 失败`, lastSelectionAnchor.x, lastSelectionAnchor.y);
        }
    });
    ipcMain.handle('toolbar:close', async () => {
        if (selectionToolbarWindow && !selectionToolbarWindow.isDestroyed())
            selectionToolbarWindow.hide();
        if (webSelectionWindow && !webSelectionWindow.isDestroyed())
            webSelectionWindow.hide();
    });
    ipcMain.handle('toolbar:colors:get', async () => toolbarColors);
    ipcMain.handle('toolbar:colors:set', async (_event, next) => saveToolbarColors(next));
    ipcMain.handle('toolbar:colors:reset', async () => saveToolbarColors(defaultToolbarColors));
    ipcMain.handle('settings:open', async () => { openSettingsWindow(); return true; });
    ipcMain.handle('toolbar:text:get', async () => lastToolbarText);
    ipcMain.handle('web-toolbar:text:get', async () => ({ text: lastWebText, x: lastWebToolbarRect.x, y: lastWebToolbarRect.y, width: lastWebToolbarRect.width, height: lastWebToolbarRect.height }));
    ipcMain.handle('web-toolbar:action', async (_event, { mode, text }) => {
        console.log(`[web-toolbar][debug] action=${mode} len=${text.length} anchor=(${lastSelectionAnchor.x},${lastSelectionAnchor.y}) toolbar=(${lastWebToolbarRect.x},${lastWebToolbarRect.y},${lastWebToolbarRect.width},${lastWebToolbarRect.height})`);
        if (mode === 'copy') {
            internalClipboardWrite = true;
            clipboard.writeText(text);
            return '已复制';
        }
        if (mode === 'translate') {
            await showTranslationWindow(text, lastSelectionAnchor.x, lastSelectionAnchor.y);
            return '已翻译';
        }
        const prompts = {
            chat: `请就下面内容进行对话式回答：\n\n${text}`,
            summary: `请对下面内容做简洁摘要：\n\n${text}`,
            explain: `请解释下面内容的含义、背景和关键点：\n\n${text}`,
            rewrite: `请对下面内容进行润色重写，保持原意但更清晰：\n\n${text}`,
            grammar: `请检查下面内容的语法，指出错误并给出修改建议：\n\n${text}`,
            explainCode: `请解释下面代码的功能、逻辑和关键步骤（如果是非代码文本，请说明它不像代码）：\n\n${text}`,
            answer: `请回答下面的问题：\n\n${text}`,
        };
        const prompt = prompts[mode];
        if (!prompt)
            return;
        const source = `${mode} 结果`;
        if (mode === 'chat') {
            // AI 对话模式：发送到悬浮窗作为对话消息
            const result = await analyzeWithDeepSeek(prompt, `网页选区-${mode}`);
            const existed = floatingWindow && !floatingWindow.isDestroyed();
            const win = createFloatingWindow();
            if (!existed) {
                const width = 520;
                const height = 320;
                const display = screen.getDisplayNearestPoint({ x: lastSelectionAnchor.x, y: lastSelectionAnchor.y });
                let x = Math.round(lastSelectionAnchor.x - width / 2);
                let y = Math.round(lastSelectionAnchor.y - height - 8);
                if (x + width > display.workArea.x + display.workArea.width - 12)
                    x = display.workArea.x + display.workArea.width - width - 12;
                if (x < display.workArea.x + 12)
                    x = display.workArea.x + 12;
                if (y < display.workArea.y + 12)
                    y = Math.round(lastSelectionAnchor.y + 8);
                if (y + height > display.workArea.y + display.workArea.height - 12)
                    y = display.workArea.y + display.workArea.height - height - 12;
                win.setBounds({ x, y, width, height });
            }
            win.webContents.send('floating:text', { text: result.ok ? result.text : result.error, source: result.ok ? source : `${source} - 错误` });
            win.show();
            win.focus();
        }
        else {
            // 其他功能：先显示加载窗口，再调用 AI，最后更新结果
            showLoadingResultWindow(source, lastSelectionAnchor.x, lastSelectionAnchor.y);
            const result = await analyzeWithDeepSeek(prompt, `网页选区-${mode}`);
            showResultWindow(result.ok ? result.text : result.error, result.ok ? source : `${mode} 失败`, lastSelectionAnchor.x, lastSelectionAnchor.y);
        }
    });
    createMainWindow();
    startClipboardWatch();
    await loadToolbarColors();
    createTray();
    startUIAWatch(); // 方案 B：UI Automation（与剪贴板并行，优先级更高）
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0)
        createMainWindow(); });
});
app.on('window-all-closed', () => {
    // 有托盘图标时不退出，用户可通过托盘菜单退出
    if (!appTray) {
        if (clipboardTimer)
            clearInterval(clipboardTimer);
        if (uiaPollTimer) {
            clearTimeout(uiaPollTimer);
            uiaPollTimer = null;
        }
        uiaBridge.dispose();
    }
});
