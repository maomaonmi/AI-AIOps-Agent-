import type { ChatMode } from '../types';

const API_BASE = '/api';
const DEFAULT_TIMEOUT = 120000;

export interface ChatRequest {
  question: string;
  mode: ChatMode;
  conversation_id?: string;
}

export interface ModuleDataWrapper {
  type: string;
  data: Record<string, any>;
}

export interface ChatResponse {
  answer: string;
  intermediate_steps?: Array<{
    tool: string;
    tool_input: string;
    observation: string;
  }>;
  success: boolean;
  error: string | null;
  thinking_content?: string;
  module_data?: ModuleDataWrapper | null;
}

export interface StreamChunk {
  type: 'status' | 'content' | 'module_data' | 'done' | 'error';
  message?: string;
  content?: string;
  data?: any;
  answer?: string;
  success?: boolean;
  error?: string;
  elapsed?: number;
}

interface FetchOptions {
  timeout?: number;
  signal?: AbortSignal;
}

class TimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

class RequestAbortedError extends Error {
  constructor(message: string = 'Request cancelled') {
    super(message);
    this.name = 'RequestAbortedError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  fetchOptions?: FetchOptions
): Promise<Response> {
  const timeout = fetchOptions?.timeout ?? DEFAULT_TIMEOUT;
  const signal = fetchOptions?.signal;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const combinedSignal = signal
    ? AbortSignal.any ? AbortSignal.any([signal, controller.signal]) : controller.signal
    : controller.signal;

  try {
    const response = await fetch(url, {
      ...options,
      signal: combinedSignal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new RequestAbortedError('Request cancelled by user');
        }
        throw new TimeoutError(`Request timed out after ${timeout / 1000} seconds`);
      }
    }
    throw error;
  }
}

export async function sendCasualChatMessage(
  request: Omit<ChatRequest, 'mode'>,
  options?: FetchOptions
): Promise<ChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/chat/casual`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    options
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function sendChatMessage(
  request: ChatRequest,
  options?: FetchOptions
): Promise<ChatResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    options
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function streamChatMessage(
  request: ChatRequest,
  onChunk: (chunk: StreamChunk) => void,
  options?: FetchOptions
): Promise<ChatResponse | null> {
  const timeout = options?.timeout ?? 180000;
  const signal = options?.signal;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const combinedSignal = signal
    ? AbortSignal.any ? AbortSignal.any([signal, controller.signal]) : controller.signal
    : controller.signal;

  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullAnswer = '';
    let moduleData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk: StreamChunk = JSON.parse(line.slice(6));
            onChunk(chunk);

            if (chunk.type === 'content' && chunk.content) {
              fullAnswer += chunk.content;
            }

            if (chunk.type === 'module_data' && chunk.data) {
              moduleData = chunk.data;
            }

            if (chunk.type === 'done') {
              return {
                answer: fullAnswer || chunk.answer || '',
                intermediate_steps: [],
                success: chunk.success ?? true,
                error: chunk.error || null,
                module_data: moduleData,
              };
            }

            if (chunk.type === 'error') {
              return null;
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', line, e);
          }
        }
      }
    }

    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        if (signal?.aborted) {
          throw new RequestAbortedError('Request cancelled by user');
        }
        throw new TimeoutError(`Request timed out after ${timeout / 1000} seconds`);
      }
    }
    throw error;
  }
}

export { TimeoutError, RequestAbortedError };
