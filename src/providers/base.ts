import type {
  AIProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamEvent,
} from '../types.js';
import { normalizeProviderError } from '../errors.js';
import { parseSSEStream } from '../streaming/sse-parser.js';

/**
 * Abstract base class for providers.
 *
 * Handles the shared HTTP plumbing (fetch, error normalization, SSE parsing)
 * so concrete providers only implement serialization/deserialization.
 */
export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;

  /**
   * Build the request URL for a chat completion.
   */
  protected abstract buildURL(config: ProviderConfig): string;

  /**
   * Serialize our unified request into the provider's API body format.
   */
  protected abstract buildBody(
    request: ProviderRequest,
    stream: boolean,
  ): Record<string, unknown>;

  /**
   * Build provider-specific headers.
   */
  protected abstract buildHeaders(config: ProviderConfig): Record<string, string>;

  /**
   * Parse a non-streaming JSON response into our unified format.
   */
  protected abstract parseResponse(
    body: unknown,
  ): ProviderResponse;

  /**
   * Parse a single SSE data payload into stream events.
   */
  protected abstract parseStreamEvent(
    data: string,
  ): ProviderStreamEvent[];

  async chat(
    request: ProviderRequest,
    config: ProviderConfig,
  ): Promise<ProviderResponse> {
    const response = await this.doFetch(request, config, false);
    const body = await response.json();
    return this.parseResponse(body);
  }

  async *stream(
    request: ProviderRequest,
    config: ProviderConfig,
  ): AsyncIterable<ProviderStreamEvent> {
    const response = await this.doFetch(request, config, true);

    for await (const sseEvent of parseSSEStream(response, request.signal)) {
      if (sseEvent.data === '[DONE]') return;

      const events = this.parseStreamEvent(sseEvent.data);
      for (const event of events) {
        yield event;
        if (event.type === 'error') return;
      }
    }
  }

  private async doFetch(
    request: ProviderRequest,
    config: ProviderConfig,
    stream: boolean,
  ): Promise<Response> {
    const url = this.buildURL(config);
    const headers = {
      'Content-Type': 'application/json',
      ...this.buildHeaders(config),
      ...request.headers,
    };
    const body = JSON.stringify(this.buildBody(request, stream));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: request.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw normalizeProviderError(this.name, response.status, errorBody);
    }

    return response;
  }
}
