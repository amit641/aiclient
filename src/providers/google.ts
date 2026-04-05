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

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

/**
 * Google Gemini provider.
 *
 * Key differences from OpenAI:
 * - Uses `generateContent` / `streamGenerateContent` endpoints
 * - API key goes as a query parameter, not a header
 * - Different message format: `parts` instead of `content`
 * - Tool calls are `functionCall` / `functionResponse`
 */
export class GoogleProvider extends BaseProvider {
  readonly name = 'google';

  protected buildURL(config: ProviderConfig): string {
    const base = config.baseURL || DEFAULT_BASE_URL;
    return base; // Will be completed in buildFullURL with model name
  }

  /**
   * Override doFetch to handle Google's unique URL structure with the model
   * embedded in the path and API key as a query param.
   */
  override async chat(
    request: ProviderRequest,
    config: ProviderConfig,
  ): Promise<ProviderResponse> {
    const url = this.getFullURL(config, request.model, false);
    const body = this.buildBody(request, false);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...request.headers },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const { normalizeProviderError } = await import('../errors.js');
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw normalizeProviderError(this.name, response.status, errorBody);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  override async *stream(
    request: ProviderRequest,
    config: ProviderConfig,
  ): AsyncIterable<ProviderStreamEvent> {
    const url = this.getFullURL(config, request.model, true);
    const body = this.buildBody(request, true);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...request.headers },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const { normalizeProviderError } = await import('../errors.js');
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw normalizeProviderError(this.name, response.status, errorBody);
    }

    // Google streams as JSON array chunks, not SSE
    const text = await response.text();
    const chunks = this.parseStreamResponse(text);
    for (const event of chunks) {
      yield event;
    }
  }

  protected buildHeaders(_config: ProviderConfig): Record<string, string> {
    return {};
  }

  protected buildBody(
    request: ProviderRequest,
    _stream: boolean,
  ): Record<string, unknown> {
    const systemParts: string[] = [];
    const contents: Record<string, unknown>[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        contents.push(toGeminiContent(msg));
      }
    }

    const body: Record<string, unknown> = { contents };

    if (systemParts.length > 0) {
      body['systemInstruction'] = {
        parts: [{ text: systemParts.join('\n\n') }],
      };
    }

    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig['temperature'] = request.temperature;
    if (request.maxTokens !== undefined) generationConfig['maxOutputTokens'] = request.maxTokens;
    if (request.stop) generationConfig['stopSequences'] = request.stop;

    if (request.responseFormat) {
      generationConfig['responseMimeType'] = 'application/json';
      generationConfig['responseSchema'] = request.responseFormat.jsonSchema.schema;
    }

    if (Object.keys(generationConfig).length > 0) {
      body['generationConfig'] = generationConfig;
    }

    if (request.tools?.length) {
      body['tools'] = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    return body;
  }

  protected parseResponse(body: unknown): ProviderResponse {
    const data = body as GeminiResponse;
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    let text = '';
    const toolCalls: ToolCall[] = [];

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).slice(2, 11)}`,
          name: part.functionCall.name,
          arguments: (part.functionCall.args as Record<string, unknown>) ?? {},
        });
      }
    }

    return {
      text: text || null,
      toolCalls,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      model: '',
      finishReason: mapGeminiFinishReason(candidate?.finishReason),
      raw: body,
    };
  }

  protected parseStreamEvent(data: string): ProviderStreamEvent[] {
    // Not used — Google doesn't use standard SSE
    return [];
  }

  private parseStreamResponse(text: string): ProviderStreamEvent[] {
    const events: ProviderStreamEvent[] = [];

    try {
      // Google streams a JSON array: [{...}, {...}, ...]
      const chunks = JSON.parse(text) as GeminiResponse[];
      for (const chunk of Array.isArray(chunks) ? chunks : [chunks]) {
        const candidate = chunk.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];

        for (const part of parts) {
          if (part.text) {
            events.push({ type: 'text', text: part.text });
          }
          if (part.functionCall) {
            events.push({
              type: 'tool_call',
              toolCall: {
                id: `call_${Math.random().toString(36).slice(2, 11)}`,
                name: part.functionCall.name,
                arguments: (part.functionCall.args as Record<string, unknown>) ?? {},
              },
            });
          }
        }

        if (candidate?.finishReason) {
          events.push({
            type: 'finish',
            finishReason: mapGeminiFinishReason(candidate.finishReason),
            usage: chunk.usageMetadata
              ? {
                  promptTokens: chunk.usageMetadata.promptTokenCount ?? 0,
                  completionTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
                  totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
                }
              : undefined,
          });
        }
      }
    } catch {
      events.push({
        type: 'error',
        error: new Error('Failed to parse Google stream response'),
      });
    }

    return events;
  }

  private getFullURL(
    config: ProviderConfig,
    model: string,
    stream: boolean,
  ): string {
    const base = config.baseURL || DEFAULT_BASE_URL;
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    const streamParam = stream ? '&alt=sse' : '';
    return `${base}/v1beta/models/${model}:${action}?key=${config.apiKey}${streamParam}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGeminiContent(msg: Message): Record<string, unknown> {
  switch (msg.role) {
    case 'user':
      if (typeof msg.content === 'string') {
        return { role: 'user', parts: [{ text: msg.content }] };
      }
      return {
        role: 'user',
        parts: msg.content.map((part) =>
          part.type === 'text'
            ? { text: part.text }
            : { inlineData: { mimeType: part.mimeType ?? 'image/png', data: part.url } },
        ),
      };
    case 'assistant':
      if (msg.toolCalls?.length) {
        return {
          role: 'model',
          parts: msg.toolCalls.map((tc) => ({
            functionCall: { name: tc.name, args: tc.arguments },
          })),
        };
      }
      return { role: 'model', parts: [{ text: msg.content ?? '' }] };
    case 'tool':
      return {
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: msg.toolCallId,
              response: { result: msg.content },
            },
          },
        ],
      };
    default:
      return { role: 'user', parts: [{ text: '' }] };
  }
}

function mapGeminiFinishReason(reason?: string): FinishReason {
  switch (reason) {
    case 'STOP': return 'stop';
    case 'MAX_TOKENS': return 'length';
    case 'SAFETY': return 'content_filter';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Google API types (internal)
// ---------------------------------------------------------------------------

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts: Array<{
        text?: string;
        functionCall?: { name: string; args: unknown };
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}
