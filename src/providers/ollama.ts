import type {
  FinishReason,
  Message,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamEvent,
  ToolCall,
} from '../types.js';
import { BaseProvider } from './base.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

/**
 * Ollama provider for local models.
 *
 * Ollama exposes an OpenAI-compatible /v1/chat/completions endpoint,
 * but also has its own native /api/chat endpoint with different formats.
 * We use the OpenAI-compatible endpoint for consistency.
 */
export class OllamaProvider extends BaseProvider {
  readonly name = 'ollama';

  protected buildURL(config: ProviderConfig): string {
    return `${config.baseURL || DEFAULT_BASE_URL}/v1/chat/completions`;
  }

  protected buildHeaders(_config: ProviderConfig): Record<string, string> {
    // Ollama doesn't need auth by default
    return {};
  }

  protected buildBody(
    request: ProviderRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map(toOllamaMessage),
      stream,
    };

    if (request.temperature !== undefined) body['temperature'] = request.temperature;
    if (request.maxTokens !== undefined) body['max_tokens'] = request.maxTokens;
    if (request.stop) body['stop'] = request.stop;

    if (request.tools?.length) {
      body['tools'] = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    if (request.responseFormat) {
      body['format'] = 'json';
    }

    return body;
  }

  protected parseResponse(body: unknown): ProviderResponse {
    const data = body as OllamaChatResponse;
    const choice = data.choices?.[0];

    const toolCalls: ToolCall[] =
      choice?.message?.tool_calls?.map((tc) => ({
        id: tc.id ?? `call_${Math.random().toString(36).slice(2, 11)}`,
        name: tc.function.name,
        arguments: safeParse(tc.function.arguments),
      })) ?? [];

    return {
      text: choice?.message?.content ?? null,
      toolCalls,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model ?? '',
      finishReason: mapFinishReason(choice?.finish_reason),
      raw: body,
    };
  }

  protected parseStreamEvent(data: string): ProviderStreamEvent[] {
    const events: ProviderStreamEvent[] = [];

    let parsed: OllamaStreamChunk;
    try {
      parsed = JSON.parse(data);
    } catch {
      return events;
    }

    const choice = parsed.choices?.[0];
    if (!choice) return events;

    const delta = choice.delta;

    if (delta?.content) {
      events.push({ type: 'text', text: delta.content });
    }

    if (choice.finish_reason) {
      events.push({
        type: 'finish',
        finishReason: mapFinishReason(choice.finish_reason),
      });
    }

    return events;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toOllamaMessage(msg: Message): Record<string, unknown> {
  switch (msg.role) {
    case 'system':
      return { role: 'system', content: msg.content };
    case 'user':
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content };
      }
      return {
        role: 'user',
        content: msg.content
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('\n'),
      };
    case 'assistant':
      return { role: 'assistant', content: msg.content ?? '' };
    case 'tool':
      return { role: 'tool', content: msg.content, tool_call_id: msg.toolCallId };
  }
}

function mapFinishReason(reason?: string): FinishReason {
  switch (reason) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'tool_calls': return 'tool_calls';
    default: return 'unknown';
  }
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Ollama OpenAI-compat types (internal)
// ---------------------------------------------------------------------------

interface OllamaChatResponse {
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id?: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OllamaStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}
