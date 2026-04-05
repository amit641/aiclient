<p align="center">
  <h1 align="center">aiclientjs</h1>
  <p align="center">
    <strong>The lightweight, universal AI client for JavaScript & TypeScript.</strong>
  </p>
  <p align="center">
    One function. Any model. Zero dependencies.
  </p>
  <p align="center">
    <a href="#install">Install</a> · <a href="#quickstart">Quickstart</a> · <a href="#providers">Providers</a> · <a href="#streaming">Streaming</a> · <a href="#structured-output">Structured Output</a> · <a href="#tool-calling">Tool Calling</a>
  </p>
</p>

<p align="center">
  <img src="./assets/demo.gif" alt="aiclientjs demo" width="700" />
</p>

---

```bash
npm install aiclientjs
```

```typescript
import { ai } from 'aiclientjs';

const { text } = await ai('Explain quantum computing in one sentence');
```

That's it. No boilerplate. No framework lock-in. Works everywhere.

---

## Why aiclient?

| | aiclient | Vercel AI SDK | Direct API calls |
|---|---|---|---|
| **Bundle size** | ~8 KB gzipped | ~150 KB+ | N/A |
| **Dependencies** | 0 | 20+ | varies |
| **Providers** | OpenAI, Anthropic, Google, Ollama, custom | OpenAI, Anthropic, Google, more | 1 per SDK |
| **Runtimes** | Node, Deno, Bun, Browser, Edge | Primarily Node/Edge | varies |
| **Streaming** | `for await...of` | React hooks / streams | manual SSE parsing |
| **TypeScript** | First-class, fully typed | Yes | varies |
| **Learning curve** | 1 function | Framework concepts | Per-provider docs |

## Install

```bash
npm install aiclientjs    # npm
pnpm add aiclientjs       # pnpm
yarn add aiclientjs       # yarn
bun add aiclientjs        # bun
```

## Quickstart

### 1. Set your API key

```bash
export OPENAI_API_KEY=sk-...
# or
export ANTHROPIC_API_KEY=sk-ant-...
# or
export GOOGLE_API_KEY=AI...
```

### 2. Call any model

```typescript
import { ai } from 'aiclientjs';

// OpenAI (default)
const res = await ai('Hello!');
console.log(res.text);

// Anthropic Claude
const res = await ai('Hello!', { provider: 'anthropic' });

// Google Gemini
const res = await ai('Hello!', { provider: 'google' });

// Local model via Ollama
const res = await ai('Hello!', { provider: 'ollama', model: 'llama3.1' });
```

## Streaming

```typescript
const stream = await ai('Write a poem about code', { stream: true });

for await (const chunk of stream) {
  process.stdout.write(chunk); // tokens arrive in real-time
}
```

### Collect the full response after streaming

```typescript
const stream = await ai('Tell me a story', { stream: true });
const response = await stream.response(); // waits for stream to finish
console.log(response.text);
console.log(response.usage);
```

### Use with Web APIs (Hono, Express, Next.js)

```typescript
const stream = await ai('Hello', { stream: true });
return new Response(stream.toReadableStream());
```

## Structured Output

Get type-safe JSON responses. Works with JSON Schema or Zod.

### With JSON Schema

```typescript
const res = await ai<{ colors: string[] }>('List 5 colors', {
  schema: {
    type: 'object',
    properties: {
      colors: { type: 'array', items: { type: 'string' } },
    },
    required: ['colors'],
  },
});

console.log(res.data.colors); // string[] — fully typed
```

### With Zod (zero-config, no adapter needed)

```typescript
import { z } from 'zod';

const res = await ai('List 5 colors', {
  schema: z.object({
    colors: z.array(z.string()),
  }),
});

console.log(res.data.colors); // inferred as string[]
```

aiclient detects Zod schemas automatically — no plugins, no adapters, no `zodToJsonSchema` calls.

## Tool Calling

Define tools with execute handlers and aiclient runs them automatically.

```typescript
const res = await ai('What is the weather in London?', {
  tools: {
    getWeather: {
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
        required: ['city'],
      },
      execute: async ({ city }) => {
        const data = await fetch(`https://api.weather.com/${city}`);
        return data.json();
      },
    },
  },
});

console.log(res.toolResults); // [{ toolName: 'getWeather', result: { temp: 15 } }]
```

## Preconfigured Clients

Create reusable clients with `createAIClient`:

```typescript
import { createAIClient } from 'aiclientjs';

const gpt = createAIClient({
  provider: 'openai',
  model: 'gpt-4o',
  system: 'You are a helpful assistant. Be concise.',
  temperature: 0.7,
});

const claude = createAIClient({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
});

// Use without repeating config
const answer = await gpt('What is 2+2?');
const story = await claude('Tell me a short story', { stream: true });
```

## Providers

### Built-in

| Provider | Models | Auth |
|---|---|---|
| `openai` | GPT-4o, GPT-4, o1, etc. | `OPENAI_API_KEY` |
| `anthropic` | Claude Sonnet, Opus, Haiku | `ANTHROPIC_API_KEY` |
| `google` | Gemini 2.0, 1.5, etc. | `GOOGLE_API_KEY` |
| `ollama` | Llama, Mistral, Phi, any local model | No auth needed |

### OpenAI-Compatible APIs

Any OpenAI-compatible endpoint works with the `openai` provider + a custom `baseURL`:

```typescript
// Together AI
const res = await ai('Hello', {
  provider: 'openai',
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
  model: 'meta-llama/Llama-3-70b-chat-hf',
});

// Groq
const res = await ai('Hello', {
  provider: 'openai',
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama3-70b-8192',
});
```

### Custom Providers

Register your own provider:

```typescript
import { registerProvider } from 'aiclientjs';

registerProvider('my-provider', {
  name: 'my-provider',
  async chat(request, config) {
    // Implement your provider logic
    return { text: '...', toolCalls: [], usage: { ... }, ... };
  },
  async *stream(request, config) {
    // Yield stream events
    yield { type: 'text', text: 'Hello' };
    yield { type: 'finish', finishReason: 'stop' };
  },
});

const res = await ai('Hello', { provider: 'my-provider' });
```

## Multi-modal (Vision)

```typescript
const res = await ai([
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', url: 'https://example.com/photo.jpg' },
    ],
  },
]);
```

## Cancellation

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

const res = await ai('Write a very long essay', {
  signal: controller.signal,
});
```

## Error Handling

```typescript
import { ai, AIError } from 'aiclientjs';

try {
  const res = await ai('Hello');
} catch (err) {
  if (err instanceof AIError) {
    console.log(err.code);       // 'AUTH_ERROR' | 'RATE_LIMIT' | 'PROVIDER_ERROR' | ...
    console.log(err.statusCode); // 401, 429, 500, etc.
    console.log(err.provider);   // 'openai', 'anthropic', etc.
  }
}
```

## API Reference

### `ai(prompt, options?)`

| Parameter | Type | Description |
|---|---|---|
| `prompt` | `string \| Message[]` | Text prompt or conversation messages |
| `options.provider` | `string` | Provider name (default: `'openai'`) |
| `options.model` | `string` | Model ID (default varies by provider) |
| `options.apiKey` | `string` | API key (or use env vars) |
| `options.baseURL` | `string` | Custom API endpoint |
| `options.system` | `string` | System prompt |
| `options.stream` | `boolean` | Enable streaming |
| `options.schema` | `JsonSchema \| ZodSchema` | Structured output schema |
| `options.tools` | `Record<string, ToolDefinition>` | Tool definitions |
| `options.temperature` | `number` | Sampling temperature (0-2) |
| `options.maxTokens` | `number` | Max response tokens |
| `options.signal` | `AbortSignal` | Cancellation signal |

### `createAIClient(config)`

Creates a preconfigured `ai` function with defaults baked in.

### `registerProvider(name, provider)`

Register a custom provider. See [Custom Providers](#custom-providers).

## Architecture

```
┌─────────────────────────────────────────┐
│              ai() / client              │  ← Simple public API
├─────────────────────────────────────────┤
│           Provider Registry             │  ← Strategy pattern
├──────────┬──────────┬───────┬───────────┤
│  OpenAI  │Anthropic │Google │  Ollama   │  ← Adapters
├──────────┴──────────┴───────┴───────────┤
│    BaseProvider (shared HTTP/SSE)       │  ← Template method
├─────────────────────────────────────────┤
│  SSE Parser │ Schema │ Tool Executor    │  ← Zero-dep utilities
└─────────────────────────────────────────┘
```

**Design principles:**
- **Zero dependencies** — uses native `fetch`, `ReadableStream`, `TextDecoder`
- **Strategy pattern** — providers are interchangeable strategies
- **Template method** — `BaseProvider` handles HTTP; subclasses handle serialization
- **Open/Closed** — add providers without modifying core code
- **Dependency inversion** — core depends on `AIProvider` interface, not implementations

## Runtime Support

| Runtime | Supported |
|---|---|
| Node.js 18+ | Yes |
| Deno | Yes |
| Bun | Yes |
| Cloudflare Workers | Yes |
| Browser | Yes |
| Vercel Edge | Yes |

## License

MIT
