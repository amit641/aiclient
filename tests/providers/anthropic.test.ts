import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from '../../src/providers/anthropic.js';

const provider = new AnthropicProvider();

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

describe('AnthropicProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has the correct name', () => {
    expect(provider.name).toBe('anthropic');
  });

  it('sends correct chat request with system extracted', async () => {
    const responseBody = {
      id: 'msg_123',
      model: 'claude-sonnet-4-20250514',
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 15, output_tokens: 8 },
    };

    globalThis.fetch = mockFetchResponse(responseBody);

    const result = await provider.chat(
      {
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hi' },
        ],
        maxTokens: 1024,
      },
      { apiKey: 'test-key', baseURL: 'https://api.anthropic.com' },
    );

    expect(result.text).toBe('Hello from Claude!');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.promptTokens).toBe(15);
    expect(result.usage.completionTokens).toBe(8);

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');

    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(init.body);
    expect(body.system).toBe('Be helpful');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(body.stream).toBe(false);
  });

  it('parses tool use in the response', async () => {
    const responseBody = {
      id: 'msg_456',
      model: 'claude-sonnet-4-20250514',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_abc',
          name: 'getWeather',
          input: { city: 'Paris' },
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 20, output_tokens: 15 },
    };

    globalThis.fetch = mockFetchResponse(responseBody);

    const result = await provider.chat(
      {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Weather in Paris?' }],
      },
      { apiKey: 'test-key', baseURL: 'https://api.anthropic.com' },
    );

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe('getWeather');
    expect(result.toolCalls[0]!.arguments).toEqual({ city: 'Paris' });
  });
});
