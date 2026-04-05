export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly statusCode?: number;
  readonly provider?: string;

  constructor(
    message: string,
    code: AIErrorCode,
    statusCode?: number,
    provider?: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'AIError';
    this.code = code;
    this.statusCode = statusCode;
    this.provider = provider;
  }

  static authentication(provider: string, cause?: unknown): AIError {
    return new AIError(
      `Authentication failed for provider "${provider}". Check your API key.`,
      'AUTH_ERROR',
      401,
      provider,
      cause,
    );
  }

  static rateLimit(provider: string, cause?: unknown): AIError {
    return new AIError(
      `Rate limit exceeded for provider "${provider}". Try again later.`,
      'RATE_LIMIT',
      429,
      provider,
      cause,
    );
  }

  static providerError(
    provider: string,
    statusCode: number,
    body: string,
  ): AIError {
    return new AIError(
      `Provider "${provider}" returned HTTP ${statusCode}: ${body}`,
      'PROVIDER_ERROR',
      statusCode,
      provider,
    );
  }

  static invalidConfig(message: string): AIError {
    return new AIError(message, 'INVALID_CONFIG');
  }

  static unknownProvider(name: string): AIError {
    return new AIError(
      `Unknown provider "${name}". Register it with registerProvider() or use a built-in: openai, anthropic, google, ollama.`,
      'UNKNOWN_PROVIDER',
    );
  }

  static schemaValidation(message: string, cause?: unknown): AIError {
    return new AIError(message, 'SCHEMA_VALIDATION', undefined, undefined, cause);
  }

  static streamAborted(): AIError {
    return new AIError('Stream was aborted.', 'STREAM_ABORTED');
  }
}

export type AIErrorCode =
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'INVALID_CONFIG'
  | 'UNKNOWN_PROVIDER'
  | 'SCHEMA_VALIDATION'
  | 'STREAM_ABORTED'
  | 'NETWORK_ERROR'
  | 'TOOL_EXECUTION_ERROR';

export function normalizeProviderError(
  provider: string,
  statusCode: number,
  body: string,
): AIError {
  if (statusCode === 401 || statusCode === 403) {
    return AIError.authentication(provider);
  }
  if (statusCode === 429) {
    return AIError.rateLimit(provider);
  }
  return AIError.providerError(provider, statusCode, body);
}
