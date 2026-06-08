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
import { sendChatMessage, sendCasualChatMessage, streamChatMessage, streamThinkMessage, TimeoutError, RequestAbortedError } from '../services/api';
import type { ChatMode, Message, ThinkingStepType, ToolCallEntry } from '../types';
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
    capabilities,
    setCapability,
    setCapabilities,
    thinkingOptions,
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
        if (chunk.data?.search_results) {
          const convId = activeConversationId;
          if (convId) {
            const conversation = useAppStore.getState().getActiveConversation();
            if (conversation) {
              const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
              if (lastAssistantMsg) {
                updateMessage(convId, lastAssistantMsg.id, {
                  searchResults: {
                    results: chunk.data.search_results,
                    engine: chunk.data.engine || 'Unknown',
                    answer: chunk.data.answer,
                  },
                });
              }
            }
          }
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

  const handleThinkStreamChunk = useCallback((chunk: StreamChunk) => {
    switch (chunk.type) {
      case 'status':
        if (chunk.message) {
          setStreamingStatus(chunk.message);
        }
        if (chunk.elapsed !== undefined) {
          setElapsedTime(chunk.elapsed);
        }
        if (chunk.data?.search_results) {
          const convId = activeConversationId;
          if (convId) {
            const conversation = useAppStore.getState().getActiveConversation();
            if (conversation) {
              const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
              if (lastAssistantMsg) {
                updateMessage(convId, lastAssistantMsg.id, {
                  searchResults: {
                    results: chunk.data.search_results,
                    engine: chunk.data.engine || 'Unknown',
                    answer: chunk.data.answer,
                  },
                });
              }
            }
          }
        }
        break;
      case 'thinking': {
        const convId = activeConversationId;
        if (convId && chunk.subtype && chunk.step !== undefined) {
          const conversation = useAppStore.getState().getActiveConversation();
          if (conversation) {
            const lastAssistantMsg = [...conversation.messages].reverse().find(m => m.role === 'assistant' && m.isStreaming);
            if (lastAssistantMsg) {
              const existingSteps = lastAssistantMsg.thinkingSteps || {};
              const existingToolCalls = lastAssistantMsg.toolCalls || [];

              let newToolCalls = [...existingToolCalls];

              if (chunk.subtype === 'tool_call' && chunk.data?.tool) {
                const existingIdx = newToolCalls.findIndex(tc => tc.step === chunk.step);
                const entry: ToolCallEntry = existingIdx >= 0
                  ? { ...newToolCalls[existingIdx], tool: chunk.data.tool!, input: chunk.data.input || null }
                  : { step: chunk.step, tool: chunk.data.tool, input: chunk.data.input || null, output: '', success: false };
                if (existingIdx >= 0) {
                  newToolCalls[existingIdx] = entry;
                } else {
                  newToolCalls.push(entry);
                }
              }

              if (chunk.subtype === 'tool_result') {
                const existingIdx = newToolCalls.findIndex(tc => tc.step === chunk.step);
                const toolCallStep = existingSteps[chunk.step - 1];
                const toolName = toolCallStep?.data?.tool || chunk.data?.tool || '';
                const rawOutput = chunk.data?.raw_result || chunk.content || '';
                const entry: ToolCallEntry = existingIdx >= 0
                  ? { ...newToolCalls[existingIdx], output: rawOutput, success: chunk.data?.success ?? true, elapsedMs: chunk.data?.elapsed_ms }
                  : { step: chunk.step, tool: toolName, input: null, output: rawOutput, success: chunk.data?.success ?? true, elapsedMs: chunk.data?.elapsed_ms };
                if (existingIdx >= 0) {
                  newToolCalls[existingIdx] = entry;
                } else {
                  newToolCalls.push(entry);
                }
              }

              updateMessage(convId, lastAssistantMsg.id, {
                thinkingSteps: {
                  ...existingSteps,
                  [chunk.step]: {
                    step: chunk.step,
                    subtype: chunk.subtype as ThinkingStepType,
                    content: chunk.content || '',
                    data: chunk.data,
                    collapsed: thinkingOptions.autoExpand ? false : true,
                    elapsed: chunk.elapsed,
                  },
                },
                toolCalls: newToolCalls,
              });
            }
          }
        }
        break;
      }
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
                content: lastAssistantMsg.content || `抱歉，${chunk.message || '发生错误'}`,
                isStreaming: false,
                moduleData: null,
              });
            }
          }
        }
        break;
    }
  }, [activeConversationId, updateMessage, thinkingOptions.autoExpand]);

  const INTENT_KEYWORDS = {
    disk_cleanup: ['清理', '垃圾', '缓存', '磁盘空间', '释放空间', '临时文件', '磁盘清理', '清理磁盘', '清理垃圾', '清理缓存', '空间不足', '磁盘满了'],
    service_manage: ['重启', '启动', '停止', '开启', '关闭', '服务管理', '查看服务', '服务列表', '列出服务', '所有服务', '系统服务'],
    vulnerability_fix: ['漏洞', '安全', 'CVE', '补丁', '修复漏洞', '安全风险', '漏洞检测', '安全检测']
  };

  const SERVICE_QUERY_PATTERNS = [
    /(.+?)(?:服务|service)\s*(?:是)?(?:什么|干嘛|干吗|做什么|用来|有啥|有何)/i,
    /(?:什么是|啥是|介绍[一下]?|解释[一下]?|说明[一下]?|分析[一下]?|详细说说|告诉我)(.+?)(?:服务|service)/i,
    /(.+?)\s*(?:服务的?(?:作用|用途|功能|目的)|干什么用的)/i
  ];

  const detectOperationIntent = (query: string): { intent: string | null, isQueryOnly: boolean } => {
    const queryLower = query.toLowerCase();
    
    let isQueryOnly = false;
    
    for (const pattern of SERVICE_QUERY_PATTERNS) {
      if (pattern.test(query)) {
        isQueryOnly = true;
        break;
      }
    }
    
    if (queryLower.includes('是干嘛用的') || queryLower.includes('是什么') || 
        queryLower.includes('用来做什么') || queryLower.includes('有什么用')) {
      if (queryLower.includes('服务')) {
        isQueryOnly = true;
      }
    }
    
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (keywords.some(kw => queryLower.includes(kw))) {
        return { intent, isQueryOnly };
      }
    }
    return { intent: null, isQueryOnly: false };
  };

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
    
    const { intent: operationIntent, isQueryOnly } = detectOperationIntent(content);
    
    if (operationIntent && !isQueryOnly && !isCasualMode) {
      addMessage(convId, {
        id: assistantMsgId,
        role: 'assistant',
        content: '正在分析您的请求...',
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

      try {
        const response = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: content })
        });
        
        const operationData = await response.json();
        
        if (operationData.intent) {
          updateMessage(convId, assistantMsgId, {
            content: operationData.description || '已为您分析操作建议，请确认后执行：',
            isStreaming: false,
            operationData: operationData,
          });
        } else {
          updateMessage(convId, assistantMsgId, {
            content: operationData.message || '未识别到明确的运维操作意图，请描述您想要执行的具体操作。',
            isStreaming: false,
          });
        }
      } catch (error) {
        updateMessage(convId, assistantMsgId, {
          content: '分析请求失败，请稍后重试。',
          isStreaming: false,
        });
      }
      return;
    }

    const isThinkMode = capabilities.thinking;
    const isWebMode = currentMode === 'online' || capabilities.web_search;
    const isWebSearch = capabilities.web_search;

    if (isThinkMode) {
      addMessage(convId, {
        id: assistantMsgId,
        role: 'assistant',
        content: '🧠 开始深度思考...',
        timestamp: Date.now(),
        mode: 'thinking',
        isStreaming: true,
        thinkingSteps: {},
        moduleData: null,
      });

      setInput('');
      setStreamingStatus('正在思考...');
      setElapsedTime(0);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const controller = startRequest();

      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 0.1);
      }, 100);

      try {
        const response = await streamThinkMessage({
          question: content,
          capabilities: {
            thinking: true,
            web_search: isWebSearch,
            reflection: capabilities.reflection,
            auto_retry: capabilities.auto_retry,
            search_count: capabilities.search_count || 5,
          },
          conversation_id: convId,
        }, handleThinkStreamChunk, {
          signal: controller.signal,
          timeout: 300000,
        });

        if (response) {
          const adaptedModuleData = response.module_data ? adaptModuleData(response.module_data) : null;

          updateMessage(convId, assistantMsgId, {
            content: response.answer || '',
            isStreaming: false,
            moduleData: adaptedModuleData,
          });
        }
      } catch (error) {
        let errorMessage = '深度思考请求失败，请重试';

        if (error instanceof RequestAbortedError) {
          errorMessage = '思考已取消';
        } else if (error instanceof TimeoutError) {
          errorMessage = '思考超时，请尝试简化问题后重试';
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
      return;
    }

    if (isWebMode) {
      addMessage(convId, {
        id: assistantMsgId,
        role: 'assistant',
        content: '🔍 正在联网搜索...',
        timestamp: Date.now(),
        mode: currentMode,
        isStreaming: true,
        intermediateSteps: [],
        moduleData: null,
      });

      setInput('');
      setStreamingStatus('正在搜索网络...');
      setElapsedTime(0);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      try {
        const searchResponse = await fetch('/api/ai/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: content, force_search: true })
        });
        
        const searchData = await searchResponse.json();
        
        if (searchData.skip_reason) {
          updateMessage(convId, assistantMsgId, {
            content: `💡 **智能判断**: ${searchData.skip_reason}\n\n${searchData.suggestion || ''}`,
            isStreaming: false,
            intermediateSteps: [{
              type: 'info', title: '跳过搜索', content: searchData.skip_reason,
              tool: '',
              tool_input: '',
              observation: ''
            }],
          });
          return;
        }
        
        if (searchData.success && searchData.results && searchData.results.length > 0) {
          let searchInfo = `💡 **AI 深度分析** (基于 ${searchData.engine_used || '联网'} 搜索结果)\n\n`;
          
          if (searchData.tavily_answer && !searchData.tavily_answer.includes('I couldn\'t find')) {
            searchInfo += `> ${searchData.tavily_answer}\n\n---\n\n`;
          }
          
          updateMessage(convId, assistantMsgId, {
            content: searchInfo,
            isStreaming: true,
            intermediateSteps: [{
              type: 'web_search',
              title: `联网搜索 (${searchData.engine_used || 'Unknown'})`,
              content: `找到 ${searchData.results.length} 条相关信息`,
              data: searchData.results,
              tool: '',
              tool_input: '',
              observation: ''
            }],
            searchResults: {
              results: searchData.results,
              engine: searchData.engine_used || 'Unknown',
              answer: searchData.tavily_answer
            },
          });

          setStreamingStatus('正在生成深度分析...');
          
          const controller = startRequest();
          
          const chatResponse = await streamChatMessage({
            question: `${content}\n\n【参考信息 - 来自网络搜索】\n${searchData.context}`,
            mode: currentMode,
            conversation_id: convId,
          }, handleStreamChunk, {
            signal: controller.signal,
            timeout: 180000,
          });

          if (chatResponse) {
            const adaptedModuleData = chatResponse.module_data ? adaptModuleData(chatResponse.module_data) : null;

            updateMessage(convId, assistantMsgId, {
              content: `${searchInfo}${chatResponse.answer ? '\n\n' + chatResponse.answer : ''}`,
              isStreaming: false,
              intermediateSteps: [
                ...[{ type: 'web_search', title: `联网搜索 (${searchData.engine_used || 'Unknown'})`, content: `找到 ${searchData.results.length} 条相关信息`, data: searchData.results, tool: '', tool_input: '', observation: '' }],
                ...(chatResponse.intermediate_steps || [])
              ],
              moduleData: adaptedModuleData,
              searchResults: {
                results: searchData.results,
                engine: searchData.engine_used || 'Unknown',
                answer: searchData.tavily_answer
              },
            });
          }
        } else {
          updateMessage(convId, assistantMsgId, {
            content: `🔍 **未找到相关搜索结果**\n\n抱歉，没有找到关于「${content}」的相关信息。\n\n可能的原因：\n1. 搜索关键词过于具体或特殊\n2. 该内容在网络上较少被讨论\n3. 搜索引擎暂时无法访问\n\n建议：尝试简化问题或换个方式提问，或者切换到"日常聊天"模式使用本地知识库。`,
            isStreaming: false,
            intermediateSteps: [{ type: 'info', title: '搜索无结果', content: `使用引擎: ${searchData.engine_used || 'Unknown'}`,
            tool: '',
            tool_input: '',
            observation: ''
            }],
          });
        }
      } catch (error) {
        updateMessage(convId, assistantMsgId, {
          content: '❌ 联网搜索失败，请检查网络连接或稍后重试。',
          isStreaming: false,
        });
      } finally {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setStreamingStatus('');
        endRequest();
      }
      return;
    }

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
  }, [input, isLoading, activeConversationId, currentMode, capabilities, isCasualMode, createConversation, addMessage, updateMessage, startRequest, endRequest, handleStreamChunk, handleThinkStreamChunk]);

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
    { mode: 'online' as ChatMode, icon: <Globe size={14} />, label: '联网模式' },
  ];

  const toggleThinking = () => {
    setCapability('thinking', !capabilities.thinking);
  };

  const toggleWebSearch = () => {
    setCapability('web_search', !capabilities.web_search);
  };

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

            <div className="w-px h-5 bg-gray-200" />

            <button
              onClick={toggleThinking}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                capabilities.thinking
                  ? 'bg-purple-50 text-purple-600 border-purple-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-gray-200'
              } disabled:opacity-50`}
            >
              <Brain size={14} />
              深度思考
            </button>

            <button
              onClick={toggleWebSearch}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                capabilities.web_search
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 border-gray-200'
              } disabled:opacity-50`}
            >
              <Globe size={14} />
              联网搜索
            </button>

            {capabilities.web_search && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500">参考</span>
                <select
                  value={capabilities.search_count || 5}
                  onChange={(e) => setCapability('search_count', parseInt(e.target.value) as unknown as boolean)}
                  disabled={isLoading}
                  className="text-[10px] bg-transparent text-gray-700 outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
                <span className="text-[10px] text-gray-500">个</span>
              </div>
            )}
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
