// Ensure built-in providers are registered on import
import './providers/index.js';

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

export { ai, createAIClient } from './client.js';
export type { AIClientFunction } from './client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  // Messages
  Message,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  ContentPart,

  // Options & Config
  AIOptions,
  AIClientConfig,

  // Responses
  AIResponse,
  AIStructuredResponse,
  AIStream,
  AIStreamChunk,
  TokenUsage,
  FinishReason,

  // Tools
  ToolCall,
  ToolDefinition,
  ToolResult,

  // Schema
  JsonSchema,
  ZodLike,

  // Provider (for plugin authors)
  AIProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamEvent,
  ProviderToolDefinition,
  ProviderResponseFormat,
} from './types.js';

// ---------------------------------------------------------------------------
// Provider management
// ---------------------------------------------------------------------------

export {
  registerProvider,
  getProvider,
  hasProvider,
  listProviders,
} from './providers/index.js';

// Concrete providers (for advanced use / subclassing)
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { GoogleProvider } from './providers/google.js';
export { OllamaProvider } from './providers/ollama.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export { AIError } from './errors.js';
export type { AIErrorCode } from './errors.js';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { isZodLike, zodToJsonSchema, resolveJsonSchema } from './utils.js';
