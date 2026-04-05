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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * OpenAI-compatible provider.
 * Works with OpenAI, Azure OpenAI, and any OpenAI-compatible API (Together, Groq, etc).
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';

  protected buildURL(config: ProviderConfig): string {
    return `${config.baseURL || DEFAULT_BASE_URL}/chat/completions`;
  }

  protected buildHeaders(config: ProviderConfig): Record<string, string> {
    return {
      Authorization: `Bearer ${config.apiKey}`,
    };
  }

  protected buildBody(
    request: ProviderRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map(toOpenAIMessage),
      stream,
    };

    if (stream) {
      body['stream_options'] = { include_usage: true };
    }

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
      body['response_format'] = {
        type: 'json_schema',
        json_schema: {
          name: request.responseFormat.jsonSchema.name,
          schema: request.responseFormat.jsonSchema.schema,
          strict: request.responseFormat.jsonSchema.strict ?? true,
        },
      };
    }

    return body;
  }

  protected parseResponse(body: unknown): ProviderResponse {
    const data = body as OpenAIChatResponse;
    const choice = data.choices?.[0];

    const toolCalls: ToolCall[] =
      choice?.message?.tool_calls?.map((tc) => ({
        id: tc.id,
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

    let parsed: OpenAIStreamChunk;
    try {
      parsed = JSON.parse(data);
    } catch {
      return events;
    }

    const choice = parsed.choices?.[0];
    if (!choice) {
      if (parsed.usage) {
        events.push({
          type: 'finish',
          usage: {
            promptTokens: parsed.usage.prompt_tokens ?? 0,
            completionTokens: parsed.usage.completion_tokens ?? 0,
            totalTokens: parsed.usage.total_tokens ?? 0,
          },
        });
      }
      return events;
    }

    const delta = choice.delta;

    if (delta?.content) {
      events.push({ type: 'text', text: delta.content });
    }

    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        events.push({
          type: 'tool_call',
          toolCall: {
            index: tc.index,
            id: tc.id,
            name: tc.function?.name,
            arguments: tc.function?.arguments as unknown as Record<string, unknown>,
          },
        });
      }
    }

    if (choice.finish_reason) {
      events.push({
        type: 'finish',
        finishReason: mapFinishReason(choice.finish_reason),
        usage: parsed.usage
          ? {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0,
            }
          : undefined,
      });
    }

    return events;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toOpenAIMessage(msg: Message): Record<string, unknown> {
  switch (msg.role) {
    case 'system':
      return { role: 'system', content: msg.content };
    case 'user':
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content };
      }
      return {
        role: 'user',
        content: msg.content.map((part) =>
          part.type === 'text'
            ? { type: 'text', text: part.text }
            : { type: 'image_url', image_url: { url: part.url } },
        ),
      };
    case 'assistant':
      return {
        role: 'assistant',
        content: msg.content,
        ...(msg.toolCalls?.length && {
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }),
      };
    case 'tool':
      return {
        role: 'tool',
        content: msg.content,
        tool_call_id: msg.toolCallId,
      };
  }
}

function mapFinishReason(reason?: string): FinishReason {
  switch (reason) {
    case 'stop': return 'stop';
    case 'length': return 'length';
    case 'tool_calls': return 'tool_calls';
    case 'content_filter': return 'content_filter';
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
// OpenAI API types (internal)
// ---------------------------------------------------------------------------

interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
