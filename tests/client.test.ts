import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai, createAIClient } from '../src/client.js';
import '../src/providers/index.js';
import { registerProvider } from '../src/providers/registry.js';
import type {
  AIProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamEvent,
} from '../src/types.js';

// A mock provider we control completely
class MockProvider implements AIProvider {
  readonly name = 'mock';
  chatFn = vi.fn<[ProviderRequest, ProviderConfig], Promise<ProviderResponse>>();
  streamFn = vi.fn<[ProviderRequest, ProviderConfig], AsyncIterable<ProviderStreamEvent>>();

  chat(req: ProviderRequest, config: ProviderConfig) {
    return this.chatFn(req, config);
  }

  async *stream(req: ProviderRequest, config: ProviderConfig) {
    yield* this.streamFn(req, config);
  }
}

let mockProvider: MockProvider;

beforeEach(() => {
  vi.restoreAllMocks();
  mockProvider = new MockProvider();
  registerProvider('mock', mockProvider);
});

describe('ai()', () => {
  it('makes a basic text request', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: 'Hello world',
      toolCalls: [],
      usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
      model: 'mock-model',
      finishReason: 'stop',
      raw: {},
    });

    const result = await ai('Say hello', {
      provider: 'mock',
      model: 'mock-model',
      apiKey: 'key',
    });

    expect(result.text).toBe('Hello world');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.totalTokens).toBe(8);

    const [req] = mockProvider.chatFn.mock.calls[0]!;
    expect(req.model).toBe('mock-model');
    expect(req.messages).toEqual([{ role: 'user', content: 'Say hello' }]);
  });

  it('prepends system message', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: 'Ahoy!',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
      model: 'mock-model',
      finishReason: 'stop',
      raw: {},
    });

    await ai('Hi', {
      provider: 'mock',
      model: 'mock-model',
      apiKey: 'key',
      system: 'You are a pirate',
    });

    const [req] = mockProvider.chatFn.mock.calls[0]!;
    expect(req.messages[0]).toEqual({ role: 'system', content: 'You are a pirate' });
    expect(req.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('accepts message array input', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: 'Fine, you?',
      toolCalls: [],
      usage: { promptTokens: 8, completionTokens: 4, totalTokens: 12 },
      model: 'mock-model',
      finishReason: 'stop',
      raw: {},
    });

    await ai(
      [
        { role: 'user', content: 'How are you?' },
        { role: 'assistant', content: 'I am great!' },
        { role: 'user', content: 'And now?' },
      ],
      { provider: 'mock', model: 'mock-model', apiKey: 'key' },
    );

    const [req] = mockProvider.chatFn.mock.calls[0]!;
    expect(req.messages).toHaveLength(3);
  });

  it('handles structured output', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: '{"colors":["red","blue","green"]}',
      toolCalls: [],
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
      model: 'mock-model',
      finishReason: 'stop',
      raw: {},
    });

    const result = await ai<{ colors: string[] }>('List 3 colors', {
      provider: 'mock',
      model: 'mock-model',
      apiKey: 'key',
      schema: {
        type: 'object',
        properties: { colors: { type: 'array', items: { type: 'string' } } },
      },
    });

    expect(result.data).toEqual({ colors: ['red', 'blue', 'green'] });
    expect(result.text).toBe('{"colors":["red","blue","green"]}');
  });

  it('executes tools when they have execute handlers', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: null,
      toolCalls: [
        { id: 'call_1', name: 'add', arguments: { a: 2, b: 3 } },
      ],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'mock-model',
      finishReason: 'tool_calls',
      raw: {},
    });

    const result = await ai('Add 2 + 3', {
      provider: 'mock',
      model: 'mock-model',
      apiKey: 'key',
      tools: {
        add: {
          description: 'Add two numbers',
          parameters: {
            type: 'object',
            properties: { a: { type: 'number' }, b: { type: 'number' } },
          },
          execute: ({ a, b }: { a: number; b: number }) => a + b,
        },
      },
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0]!.result).toBe(5);
  });

  it('throws for unknown provider', async () => {
    await expect(
      ai('Hello', { provider: 'nonexistent', apiKey: 'key' }),
    ).rejects.toThrow('Unknown provider');
  });
});

describe('createAIClient()', () => {
  it('creates a preconfigured client', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: 'Preconfigured response',
      toolCalls: [],
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      model: 'mock-model',
      finishReason: 'stop',
      raw: {},
    });

    const client = createAIClient({
      provider: 'mock',
      model: 'mock-model',
      apiKey: 'key',
      system: 'Be concise',
    });

    const result = await client('Hello');

    expect(result.text).toBe('Preconfigured response');

    const [req] = mockProvider.chatFn.mock.calls[0]!;
    expect(req.model).toBe('mock-model');
    expect(req.messages[0]).toEqual({ role: 'system', content: 'Be concise' });
  });

  it('allows per-call overrides', async () => {
    mockProvider.chatFn.mockResolvedValue({
      text: 'Override response',
      toolCalls: [],
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      model: 'other-model',
      finishReason: 'stop',
      raw: {},
    });

    const client = createAIClient({
      provider: 'mock',
      model: 'mock-model',
      apiKey: 'key',
    });

    await client('Hello', { model: 'other-model', temperature: 0.5 });

    const [req] = mockProvider.chatFn.mock.calls[0]!;
    expect(req.model).toBe('other-model');
    expect(req.temperature).toBe(0.5);
  });
});
