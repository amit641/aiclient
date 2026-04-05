/**
 * Zero-dependency Server-Sent Events (SSE) parser.
 *
 * Transforms a raw byte ReadableStream into an async iterable of SSE events.
 * Follows the W3C EventSource specification for parsing.
 */
export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Parse a Response body as SSE and yield individual events.
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal,
): AsyncIterable<SSEEvent> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = extractEvents(buffer);
      buffer = events.remainder;

      for (const event of events.parsed) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

interface ExtractResult {
  parsed: SSEEvent[];
  remainder: string;
}

function extractEvents(buffer: string): ExtractResult {
  const parsed: SSEEvent[] = [];

  // SSE events are separated by double newlines
  const parts = buffer.split(/\n\n/);
  // Last part is incomplete — keep as remainder
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const event = parseEventBlock(part);
    if (event) parsed.push(event);
  }

  return { parsed, remainder };
}

function parseEventBlock(block: string): SSEEvent | null {
  let event: string | undefined;
  let id: string | undefined;
  let retry: number | undefined;
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue; // comment

    const colonIdx = line.indexOf(':');
    let field: string;
    let value: string;

    if (colonIdx === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }

    switch (field) {
      case 'data':
        dataLines.push(value);
        break;
      case 'event':
        event = value;
        break;
      case 'id':
        id = value;
        break;
      case 'retry': {
        const n = parseInt(value, 10);
        if (!isNaN(n)) retry = n;
        break;
      }
    }
  }

  if (dataLines.length === 0) return null;

  return {
    data: dataLines.join('\n'),
    ...(event !== undefined && { event }),
    ...(id !== undefined && { id }),
    ...(retry !== undefined && { retry }),
  };
}
