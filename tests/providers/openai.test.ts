import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai.js';

const provider = new OpenAIProvider();

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has the correct name', () => {
    expect(provider.name).toBe('openai');
  });

  it('sends correct chat completion request', async () => {
    const responseBody = {
      id: 'chatcmpl-123',
      model: 'gpt-4o',
      choices: [
        {
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    globalThis.fetch = mockFetchResponse(responseBody);

    const result = await provider.chat(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
      },
      { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
    );

    expect(result.text).toBe('Hello!');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
    expect(result.toolCalls).toHaveLength(0);

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(body.stream).toBe(false);
  });

  it('parses tool calls in the response', async () => {
    const responseBody = {
      id: 'chatcmpl-456',
      model: 'gpt-4o',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_abc',
                type: 'function',
                function: {
                  name: 'getWeather',
                  arguments: '{"city":"London"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    };

    globalThis.fetch = mockFetchResponse(responseBody);

    const result = await provider.chat(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Weather in London?' }],
        tools: [
          {
            name: 'getWeather',
            description: 'Get weather',
            parameters: { type: 'object', properties: { city: { type: 'string' } } },
          },
        ],
      },
      { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
    );

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.id).toBe('call_abc');
    expect(result.toolCalls[0]!.name).toBe('getWeather');
    expect(result.toolCalls[0]!.arguments).toEqual({ city: 'London' });
  });

  it('throws on 401 authentication error', async () => {
    globalThis.fetch = mockFetchResponse({ error: 'Unauthorized' }, 401);

    await expect(
      provider.chat(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { apiKey: 'bad-key', baseURL: 'https://api.openai.com/v1' },
      ),
    ).rejects.toThrow('Authentication failed');
  });

  it('throws on 429 rate limit', async () => {
    globalThis.fetch = mockFetchResponse({ error: 'Rate limited' }, 429);

    await expect(
      provider.chat(
        { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hi' }] },
        { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
      ),
    ).rejects.toThrow('Rate limit');
  });

  it('includes response format for structured output', async () => {
    const responseBody = {
      model: 'gpt-4o',
      choices: [
        {
          message: { role: 'assistant', content: '{"colors":["red"]}' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };

    globalThis.fetch = mockFetchResponse(responseBody);

    await provider.chat(
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'List colors' }],
        responseFormat: {
          type: 'json_schema',
          jsonSchema: {
            name: 'colors',
            schema: {
              type: 'object',
              properties: { colors: { type: 'array', items: { type: 'string' } } },
            },
            strict: true,
          },
        },
      },
      { apiKey: 'test-key', baseURL: 'https://api.openai.com/v1' },
    );

    const body = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body,
    );
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'colors',
        schema: {
          type: 'object',
          properties: { colors: { type: 'array', items: { type: 'string' } } },
        },
        strict: true,
      },
    });
  });
});
