import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Brain,
  Globe,
  MessageCircle,
  Plus,
  Sparkles,
  Wrench,
  Square,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../store';
import { sendChatMessage, sendCasualChatMessage, streamChatMessage, TimeoutError, RequestAbortedError } from '../services/api';
import type { ChatMode, Message } from '../types';
import type { StreamChunk } from '../services/api';
import { adaptModuleData } from '../utils/moduleAdapters';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function ChatInput() {
  const [input, setInput] = useState('');
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    activeConversationId,
    currentMode,
    setCurrentMode,
    createConversation,
    addMessage,
    updateMessage,
    getActiveConversation,
    requestState,
    startRequest,
    endRequest,
    cancelRequest,
  } = useAppStore();

  const activeConversation = getActiveConversation();
  const isCasualMode = currentMode === 'casual';
  const isLoading = requestState.isPending;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const h = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = h + 'px';
    }
  }, [input]);

  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
    switch (chunk.type) {
      case 'status':
        if (chunk.message) {
          setStreamingStatus(chunk.message);
        }
        if (chunk.elapsed !== undefined) {
          setElapsedTime(chunk.elapsed);
        }
        break;
      case 'content':
        if (chunk.content) {
          const convId = activeConversationId;
          if (convId) {
            const conversation = useAppStore.getState().getActiveConversation();
            if (conversation) {
              const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
              if (lastAssistantMsg) {
                updateMessage(convId, lastAssistantMsg.id, {
                  content: lastAssistantMsg.content + chunk.content,
                });
              }
            }
          }
        }
        if (chunk.elapsed !== undefined) {
          setElapsedTime(chunk.elapsed);
        }
        break;
      case 'module_data':
        const modConvId = activeConversationId;
        if (modConvId && chunk.data) {
          const conversation = useAppStore.getState().getActiveConversation();
          if (conversation) {
            const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
            if (lastAssistantMsg) {
              updateMessage(modConvId, lastAssistantMsg.id, {
                moduleData: adaptModuleData(chunk.data),
              });
            }
          }
        }
        break;
      case 'done':
        setStreamingStatus('');
        const doneConvId = activeConversationId;
        if (doneConvId) {
          const conversation = useAppStore.getState().getActiveConversation();
          if (conversation) {
            const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
            if (lastAssistantMsg) {
              updateMessage(doneConvId, lastAssistantMsg.id, {
                isStreaming: false,
              });
            }
          }
        }
        break;
      case 'error':
        setStreamingStatus(chunk.message || '发生错误');
        const errConvId = activeConversationId;
        if (errConvId) {
          const conversation = useAppStore.getState().getActiveConversation();
          if (conversation) {
            const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
            if (lastAssistantMsg) {
              updateMessage(errConvId, lastAssistantMsg.id, {
                content: lastAssistantMsg.content || `抱歉,${chunk.message || '发生错误'}`,
                isStreaming: false,
                moduleData: null,
              });
            }
          }
        }
        break;
    }
  }, [activeConversationId, updateMessage]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    let convId = activeConversationId;
    if (!convId) convId = createConversation();

    addMessage(convId, {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
      mode: currentMode,
    });

    const assistantMsgId = generateId();
    addMessage(convId, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      mode: currentMode,
      isStreaming: true,
      intermediateSteps: [],
      moduleData: null,
    });

    setInput('');
    setStreamingStatus('');
    setElapsedTime(0);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const controller = startRequest();

    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 0.1);
    }, 100);

    try {
      let response;

      if (isCasualMode) {
        response = await sendCasualChatMessage({
          question: content,
          conversation_id: convId,
        }, {
          signal: controller.signal,
          timeout: 120000,
        });
      } else {
        response = await streamChatMessage({
          question: content,
          mode: currentMode,
          conversation_id: convId,
        }, handleStreamChunk, {
          signal: controller.signal,
          timeout: 180000,
        });
      }

      if (response) {
        const adaptedModuleData = response.module_data ? adaptModuleData(response.module_data) : null;

        updateMessage(convId, assistantMsgId, {
          content: response.answer || '',
          isStreaming: false,
          intermediateSteps: response.intermediate_steps || [],
          moduleData: adaptedModuleData,
        });
      }
    } catch (error) {
      let errorMessage = '请求失败，请重试';
      
      if (error instanceof RequestAbortedError) {
        errorMessage = '请求已取消';
      } else if (error instanceof TimeoutError) {
        errorMessage = '请求超时，模型思考时间过长，请稍后重试';
      } else if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查后端服务是否启动';
        } else {
          errorMessage = error.message;
        }
      }
      
      updateMessage(convId, assistantMsgId, {
        content: `抱歉，${errorMessage}`,
        isStreaming: false,
        moduleData: null,
      });
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setStreamingStatus('');
      endRequest();
    }
  }, [input, isLoading, activeConversationId, currentMode, isCasualMode, createConversation, addMessage, updateMessage, startRequest, endRequest, handleStreamChunk]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancel = () => {
    cancelRequest();
  };

  const modeItems = [
    { mode: 'normal' as ChatMode, icon: <Plus size={14} />, label: '任务处理' },
    { mode: 'thinking' as ChatMode, icon: <Brain size={14} />, label: '深度思考' },
    { mode: 'online' as ChatMode, icon: <Globe size={14} />, label: '联网模式' },
  ];

  return (
    <div className="border-t border-gray-100 bg-white flex items-center justify-center">
      <div className="max-w-[780px] w-full px-6 lg:px-8 xl:px-12 py-4">
        <div className="flex items-center gap-2 mb-3 justify-center">
          <button
            onClick={() => setCurrentMode('casual')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isCasualMode
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 border border-transparent'
            }`}
          >
            <Sparkles size={15} />
            日常聊天
          </button>
          <button
            onClick={() => setCurrentMode('normal')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !isCasualMode
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 border border-transparent'
            }`}
          >
            <Wrench size={15} />
            专业分析
          </button>
        </div>

        <div className="flex items-end gap-2.5 rounded-2xl border border-gray-300 px-4 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100/60 transition-all shadow-sm hover:border-gray-400 bg-gray-50/50">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCasualMode ? "随便聊聊..." : "输入运维问题... (Shift+Enter 换行)"}
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none outline-none bg-transparent text-gray-800 text-[15px] leading-relaxed max-h-[160px] py-0.5 placeholder:text-gray-400 disabled:opacity-50"
          />
          {isLoading ? (
            <button
              onClick={handleCancel}
              className="shrink-0 p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
              title="取消请求"
            >
              <Square size={17} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={`shrink-0 p-2 rounded-xl transition-all ${
                input.trim()
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send size={17} />
            </button>
          )}
        </div>

        {!isCasualMode && (
          <div className="flex items-center gap-3 mt-3 justify-center flex-wrap">
            {modeItems.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setCurrentMode(mode)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  currentMode === mode
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 border border-transparent'
                } disabled:opacity-50`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            <span>{streamingStatus || '模型正在思考中，请耐心等待...'}</span>
            {elapsedTime > 0 && (
              <span className="text-xs text-gray-400">({elapsedTime.toFixed(1)}s)</span>
            )}
            <button
              onClick={handleCancel}
              className="text-red-500 hover:text-red-600 font-medium ml-2"
            >
              取消
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-3">
          AI生成内容仅供参考，请注意甄别
        </p>
      </div>
    </div>
  );
}
