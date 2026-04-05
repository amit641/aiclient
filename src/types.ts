// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string | ContentPart[];
}

export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface ToolResultMessage {
  role: 'tool';
  content: string;
  toolCallId: string;
}

export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage;

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; mimeType?: string };

// ---------------------------------------------------------------------------
// Tool Calling
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition<TParams = unknown> {
  description?: string;
  parameters: JsonSchema | ZodLike<TParams>;
  execute?: (params: TParams) => unknown | Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Schema (JSON Schema & Zod duck-typing)
// ---------------------------------------------------------------------------

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Duck-type interface for Zod-like schemas.
 * Avoids a hard dependency on Zod while supporting it seamlessly.
 */
export interface ZodLike<T = unknown> {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown };
  _def: unknown;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AIOptions<TSchema = undefined> {
  /** Provider name: 'openai' | 'anthropic' | 'google' | 'ollama' | custom */
  provider?: string;
  /** Model identifier, e.g. 'gpt-4o', 'claude-sonnet-4-20250514' */
  model?: string;
  /** Provider API key (can also be set via env vars) */
  apiKey?: string;
  /** Custom base URL for the provider API */
  baseURL?: string;
  /** System prompt prepended to the conversation */
  system?: string;
  /** Enable streaming response */
  stream?: boolean;
  /** Schema for structured (JSON) output */
  schema?: TSchema;
  /** Name for the structured output schema (used by some providers) */
  schemaName?: string;
  /** Tool definitions for function calling */
  tools?: Record<string, ToolDefinition>;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Stop sequences */
  stop?: string[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Custom headers to include in the request */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export interface AIResponse {
  /** The generated text content */
  text: string;
  /** Tool calls requested by the model (if any) */
  toolCalls: ToolCall[];
  /** Tool execution results (if tools had `execute` handlers) */
  toolResults: ToolResult[];
  /** Token usage statistics */
  usage: TokenUsage;
  /** The model that was used */
  model: string;
  /** Why the model stopped generating */
  finishReason: FinishReason;
  /** Raw response from the provider (for advanced use) */
  raw: unknown;
}

export interface AIStructuredResponse<T> extends AIResponse {
  /** The parsed, type-safe structured data */
  data: T;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'unknown';

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export interface AIStreamChunk {
  /** Incremental text delta */
  text: string;
  /** Tool call deltas (accumulated) */
  toolCalls?: ToolCall[];
  /** Set on the final chunk */
  finishReason?: FinishReason;
  /** Set on the final chunk */
  usage?: TokenUsage;
}

export interface AIStream extends AsyncIterable<string> {
  /** Collect the full text response (consumes the stream) */
  text(): Promise<string>;
  /** Get the full response object after stream completes */
  response(): Promise<AIResponse>;
  /** Convert to a Web ReadableStream of text chunks */
  toReadableStream(): ReadableStream<string>;
  /** Abort the stream */
  abort(): void;
}

// ---------------------------------------------------------------------------
// Provider Interface (Strategy Pattern)
// ---------------------------------------------------------------------------

export interface ProviderRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  tools?: ProviderToolDefinition[];
  responseFormat?: ProviderResponseFormat;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface ProviderToolDefinition {
  name: string;
  description?: string;
  parameters: JsonSchema;
}

export interface ProviderResponseFormat {
  type: 'json_schema';
  jsonSchema: {
    name: string;
    schema: JsonSchema;
    strict?: boolean;
  };
}

export interface ProviderResponse {
  text: string | null;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: FinishReason;
  raw: unknown;
}

export interface ProviderStreamEvent {
  type: 'text' | 'tool_call' | 'finish' | 'error';
  text?: string;
  toolCall?: Partial<ToolCall> & { index?: number };
  finishReason?: FinishReason;
  usage?: TokenUsage;
  error?: Error;
}

export interface AIProvider {
  readonly name: string;

  chat(
    request: ProviderRequest,
    config: ProviderConfig,
  ): Promise<ProviderResponse>;

  stream(
    request: ProviderRequest,
    config: ProviderConfig,
  ): AsyncIterable<ProviderStreamEvent>;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Client Configuration
// ---------------------------------------------------------------------------

export interface AIClientConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
}
