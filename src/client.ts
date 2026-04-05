import type {
  AIClientConfig,
  AIOptions,
  AIResponse,
  AIStream,
  AIStructuredResponse,
  JsonSchema,
  Message,
  ProviderConfig,
  ProviderRequest,
  ProviderResponseFormat,
  ZodLike,
} from './types.js';
import { AIError } from './errors.js';
import { getProvider } from './providers/registry.js';
import { createAIStream } from './streaming/ai-stream.js';
import { buildProviderTools, executeToolCalls } from './tools/index.js';
import { parseModelJson, resolveJsonSchema, validateSchema } from './schema/index.js';
import { deepMerge, isZodLike } from './utils.js';

// ---------------------------------------------------------------------------
// Environment variable helpers
// ---------------------------------------------------------------------------

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;

function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  if (typeof Deno !== 'undefined') {
    try {
      return Deno.env.get(name);
    } catch { /* permission denied */ }
  }
  return undefined;
}

const ENV_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
};

function resolveApiKey(provider: string, explicit?: string): string {
  if (explicit) return explicit;
  const envKey = ENV_KEYS[provider];
  if (envKey) {
    const value = getEnvVar(envKey);
    if (value) return value;
  }
  if (provider === 'ollama') return '';
  throw AIError.invalidConfig(
    `No API key for provider "${provider}". Pass it as options.apiKey or set ${envKey ?? `${provider.toUpperCase()}_API_KEY`}.`,
  );
}

// ---------------------------------------------------------------------------
// Default model per provider
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.1',
};

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

function normalizeInput(
  promptOrMessages: string | Message[],
  system?: string,
): Message[] {
  const messages: Message[] = [];

  if (system) {
    messages.push({ role: 'system', content: system });
  }

  if (typeof promptOrMessages === 'string') {
    messages.push({ role: 'user', content: promptOrMessages });
  } else {
    messages.push(...promptOrMessages);
  }

  return messages;
}

// ---------------------------------------------------------------------------
// The ai() function — core public API
// ---------------------------------------------------------------------------

/**
 * Call any AI model with a simple, unified API.
 *
 * @example
 * // Simple text completion
 * const res = await ai('Explain quantum computing');
 * console.log(res.text);
 *
 * @example
 * // Streaming
 * const stream = await ai('Write a poem', { stream: true });
 * for await (const chunk of stream) process.stdout.write(chunk);
 *
 * @example
 * // Structured output with Zod
 * const res = await ai('List 3 colors', { schema: z.object({ colors: z.array(z.string()) }) });
 * console.log(res.data.colors);
 */
export function ai(
  promptOrMessages: string | Message[],
  options?: AIOptions & { stream?: false; schema?: undefined },
): Promise<AIResponse>;

export function ai(
  promptOrMessages: string | Message[],
  options: AIOptions & { stream: true },
): Promise<AIStream>;

export function ai<T>(
  promptOrMessages: string | Message[],
  options: AIOptions<ZodLike<T>> & { stream?: false },
): Promise<AIStructuredResponse<T>>;

export function ai<T>(
  promptOrMessages: string | Message[],
  options: AIOptions<JsonSchema> & { stream?: false },
): Promise<AIStructuredResponse<T>>;

export async function ai(
  promptOrMessages: string | Message[],
  options: AIOptions<any> = {},
): Promise<AIResponse | AIStream | AIStructuredResponse<any>> {
  return executeRequest(promptOrMessages, options);
}

// ---------------------------------------------------------------------------
// createAIClient — factory for preconfigured instances
// ---------------------------------------------------------------------------

export type AIClientFunction = {
  (
    promptOrMessages: string | Message[],
    options?: AIOptions & { stream?: false; schema?: undefined },
  ): Promise<AIResponse>;

  (
    promptOrMessages: string | Message[],
    options: AIOptions & { stream: true },
  ): Promise<AIStream>;

  <T>(
    promptOrMessages: string | Message[],
    options: AIOptions<ZodLike<T>> & { stream?: false },
  ): Promise<AIStructuredResponse<T>>;

  <T>(
    promptOrMessages: string | Message[],
    options: AIOptions<JsonSchema> & { stream?: false },
  ): Promise<AIStructuredResponse<T>>;
};

/**
 * Create a preconfigured AI client.
 *
 * @example
 * const gpt = createAIClient({ provider: 'openai', model: 'gpt-4o' });
 * const res = await gpt('Hello!');
 *
 * const claude = createAIClient({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
 * const res = await claude('Hello!');
 */
export function createAIClient(config: AIClientConfig): AIClientFunction {
  const fn = (
    promptOrMessages: string | Message[],
    options: AIOptions<any> = {},
  ) => {
    const merged: AIOptions<any> = {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      system: config.system,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      headers: config.headers,
      ...options,
    };
    return executeRequest(promptOrMessages, merged);
  };

  return fn as AIClientFunction;
}

// ---------------------------------------------------------------------------
// Internal execution
// ---------------------------------------------------------------------------

async function executeRequest(
  promptOrMessages: string | Message[],
  options: AIOptions<any>,
): Promise<AIResponse | AIStream | AIStructuredResponse<any>> {
  const providerName = options.provider ?? 'openai';
  const provider = getProvider(providerName);
  const model = options.model ?? DEFAULT_MODELS[providerName] ?? '';
  const apiKey = resolveApiKey(providerName, options.apiKey);

  const providerConfig: ProviderConfig = {
    apiKey,
    baseURL: options.baseURL ?? '',
    headers: options.headers,
  };

  const messages = normalizeInput(promptOrMessages, options.system);

  let responseFormat: ProviderResponseFormat | undefined;
  if (options.schema) {
    const jsonSchema = resolveJsonSchema(options.schema);
    responseFormat = {
      type: 'json_schema',
      jsonSchema: {
        name: options.schemaName ?? 'response',
        schema: jsonSchema,
        strict: true,
      },
    };
  }

  const providerTools = options.tools
    ? buildProviderTools(options.tools)
    : undefined;

  const request: ProviderRequest = {
    model,
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stop: options.stop,
    tools: providerTools,
    responseFormat,
    signal: options.signal,
    headers: options.headers,
  };

  // ---- Streaming path ----
  if (options.stream) {
    const abortController = new AbortController();

    if (options.signal) {
      options.signal.addEventListener('abort', () => abortController.abort());
    }

    const streamRequest = { ...request, signal: abortController.signal };
    const source = provider.stream(streamRequest, providerConfig);

    return createAIStream(source, model, abortController);
  }

  // ---- Non-streaming path ----
  const response = await provider.chat(request, providerConfig);

  let toolResults = response.toolCalls.length > 0 && options.tools
    ? await executeToolCalls(response.toolCalls, options.tools)
    : [];

  const result: AIResponse = {
    text: response.text ?? '',
    toolCalls: response.toolCalls,
    toolResults,
    usage: response.usage,
    model: response.model || model,
    finishReason: response.finishReason,
    raw: response.raw,
  };

  // ---- Structured output path ----
  if (options.schema) {
    const parsed = parseModelJson(result.text);
    const validated = validateSchema(parsed, options.schema);
    return {
      ...result,
      data: validated,
    } as AIStructuredResponse<any>;
  }

  return result;
}
