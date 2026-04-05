import type {
  AIResponse,
  AIStream,
  AIStreamChunk,
  FinishReason,
  ProviderStreamEvent,
  TokenUsage,
  ToolCall,
  ToolResult,
} from '../types.js';
import { AIError } from '../errors.js';

/**
 * Creates an AIStream that wraps provider stream events into a
 * developer-friendly async iterable of text chunks.
 */
export function createAIStream(
  source: AsyncIterable<ProviderStreamEvent>,
  model: string,
  abortController: AbortController,
  toolResultsPromise?: Promise<ToolResult[]>,
): AIStream {
  let consumed = false;
  let fullText = '';
  const toolCalls: ToolCall[] = [];
  let finishReason: FinishReason = 'unknown';
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let responseResolve: ((value: AIResponse) => void) | null = null;
  let responseReject: ((reason: unknown) => void) | null = null;

  const responsePromise = new Promise<AIResponse>((resolve, reject) => {
    responseResolve = resolve;
    responseReject = reject;
  });

  const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

  async function* iterateText(): AsyncGenerator<string> {
    if (consumed) throw new AIError('Stream already consumed.', 'STREAM_ABORTED');
    consumed = true;

    try {
      for await (const event of source) {
        switch (event.type) {
          case 'text':
            if (event.text) {
              fullText += event.text;
              yield event.text;
            }
            break;

          case 'tool_call':
            if (event.toolCall) {
              const idx = event.toolCall.index ?? 0;
              let pending = pendingToolCalls.get(idx);
              if (!pending) {
                pending = { id: '', name: '', arguments: '' };
                pendingToolCalls.set(idx, pending);
              }
              if (event.toolCall.id) pending.id = event.toolCall.id;
              if (event.toolCall.name) pending.name = event.toolCall.name;
              if (event.toolCall.arguments) {
                const args = event.toolCall.arguments as unknown as Record<string, unknown>;
                pending.arguments += typeof args === 'string' ? args : JSON.stringify(args);
              }
            }
            break;

          case 'finish':
            if (event.finishReason) finishReason = event.finishReason;
            if (event.usage) usage = event.usage;
            break;

          case 'error':
            if (event.error) throw event.error;
            break;
        }
      }

      for (const pending of pendingToolCalls.values()) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(pending.arguments || '{}');
        } catch { /* use empty object */ }
        toolCalls.push({ id: pending.id, name: pending.name, arguments: parsedArgs });
      }

      const toolResults = (await toolResultsPromise) ?? [];

      responseResolve?.({
        text: fullText,
        toolCalls,
        toolResults,
        usage,
        model,
        finishReason,
        raw: null,
      });
    } catch (err) {
      responseReject?.(err);
      throw err;
    }
  }

  const iterator = iterateText();

  const stream: AIStream = {
    [Symbol.asyncIterator]() {
      return iterator;
    },

    async text(): Promise<string> {
      if (consumed && fullText) return fullText;
      for await (const _ of stream) { /* drain */ }
      return fullText;
    },

    response(): Promise<AIResponse> {
      if (!consumed) {
        // Auto-drain the stream so response() works without iterating
        (async () => { for await (const _ of stream) { /* drain */ } })();
      }
      return responsePromise;
    },

    toReadableStream(): ReadableStream<string> {
      return new ReadableStream<string>({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              controller.enqueue(chunk);
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
    },

    abort() {
      abortController.abort();
    },
  };

  return stream;
}
