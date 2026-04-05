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

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

/**
 * Anthropic Claude provider.
 *
 * Handles the differences in Anthropic's API format:
 * - System messages are a top-level `system` parameter, not in the messages array
 * - Streaming uses a different event format (not standard SSE data-only)
 * - Tool use is returned as content blocks, not a separate field
 */
export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';

  protected buildURL(config: ProviderConfig): string {
    return `${config.baseURL || DEFAULT_BASE_URL}/v1/messages`;
  }

  protected buildHeaders(config: ProviderConfig): Record<string, string> {
    return {
      'x-api-key': config.apiKey,
      'anthropic-version': API_VERSION,
    };
  }

  protected buildBody(
    request: ProviderRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const systemMessages: string[] = [];
    const messages: Record<string, unknown>[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else {
        messages.push(toAnthropicMessage(msg));
      }
    }

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      stream,
    };

    if (systemMessages.length > 0) {
      body['system'] = systemMessages.join('\n\n');
    }

    if (request.temperature !== undefined) body['temperature'] = request.temperature;
    if (request.stop) body['stop_sequences'] = request.stop;

    if (request.tools?.length) {
      body['tools'] = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    if (request.responseFormat) {
      body['tools'] = [
        ...(body['tools'] as unknown[] ?? []),
      ];
      // Anthropic doesn't have native JSON Schema mode in the same way.
      // We guide it with the system prompt instead.
      body['system'] = [
        body['system'] || '',
        `You must respond with valid JSON matching this schema: ${JSON.stringify(request.responseFormat.jsonSchema.schema)}`,
      ].filter(Boolean).join('\n\n');
    }

    return body;
  }

  protected parseResponse(body: unknown): ProviderResponse {
    const data = body as AnthropicResponse;

    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }

    return {
      text: text || null,
      toolCalls,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens:
          (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      model: data.model ?? '',
      finishReason: mapAnthropicStopReason(data.stop_reason),
      raw: body,
    };
  }

  protected parseStreamEvent(data: string): ProviderStreamEvent[] {
    const events: ProviderStreamEvent[] = [];

    let parsed: AnthropicStreamEvent;
    try {
      parsed = JSON.parse(data);
    } catch {
      return events;
    }

    switch (parsed.type) {
      case 'content_block_delta': {
        const delta = parsed.delta;
        if (delta?.type === 'text_delta' && delta.text) {
          events.push({ type: 'text', text: delta.text });
        } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
          events.push({
            type: 'tool_call',
            toolCall: {
              index: parsed.index,
              arguments: delta.partial_json as unknown as Record<string, unknown>,
            },
          });
        }
        break;
      }

      case 'content_block_start': {
        if (parsed.content_block?.type === 'tool_use') {
          events.push({
            type: 'tool_call',
            toolCall: {
              index: parsed.index,
              id: parsed.content_block.id,
              name: parsed.content_block.name,
            },
          });
        }
        break;
      }

      case 'message_delta': {
        events.push({
          type: 'finish',
          finishReason: mapAnthropicStopReason(parsed.delta?.stop_reason),
          usage: parsed.usage
            ? {
                promptTokens: 0,
                completionTokens: parsed.usage.output_tokens ?? 0,
                totalTokens: parsed.usage.output_tokens ?? 0,
              }
            : undefined,
        });
        break;
      }

      case 'message_start': {
        if (parsed.message?.usage) {
          events.push({
            type: 'finish',
            usage: {
              promptTokens: parsed.message.usage.input_tokens ?? 0,
              completionTokens: 0,
              totalTokens: parsed.message.usage.input_tokens ?? 0,
            },
          });
        }
        break;
      }

      case 'error': {
        events.push({
          type: 'error',
          error: new Error(parsed.error?.message ?? 'Unknown Anthropic error'),
        });
        break;
      }
    }

    return events;
  }

  /**
   * Anthropic uses a different SSE format where the event type is in the
   * `event:` field, not just data. Override the base stream method to
   * handle both formats.
   */
  override async *stream(
    request: ProviderRequest,
    config: ProviderConfig,
  ): AsyncIterable<ProviderStreamEvent> {
    // The base class SSE parser already handles the `event:` + `data:` format,
    // and Anthropic sends `data:` as JSON on each line. We just reuse base.
    yield* super.stream(request, config);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAnthropicMessage(msg: Message): Record<string, unknown> {
  switch (msg.role) {
    case 'user':
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content };
      }
      return {
        role: 'user',
        content: msg.content.map((part) =>
          part.type === 'text'
            ? { type: 'text', text: part.text }
            : {
                type: 'image',
                source: {
                  type: 'url',
                  url: part.url,
                  media_type: part.mimeType ?? 'image/png',
                },
              },
        ),
      };
    case 'assistant':
      return {
        role: 'assistant',
        content: msg.content
          ? [{ type: 'text', text: msg.content }]
          : msg.toolCalls?.map((tc) => ({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })) ?? [],
      };
    case 'tool':
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content,
          },
        ],
      };
    default:
      return { role: msg.role, content: (msg as Message & { content: string }).content };
  }
}

function mapAnthropicStopReason(reason?: string): FinishReason {
  switch (reason) {
    case 'end_turn': return 'stop';
    case 'max_tokens': return 'length';
    case 'tool_use': return 'tool_calls';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Anthropic API types (internal)
// ---------------------------------------------------------------------------

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    text?: string;
  };
  message?: {
    usage?: { input_tokens: number; output_tokens: number };
  };
  usage?: { output_tokens: number };
  error?: { message: string };
}
