import { describe, it, expect } from 'vitest';
import { parseSSEStream } from '../../src/streaming/sse-parser.js';

function createSSEResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream);
}

describe('parseSSEStream', () => {
  it('parses a single SSE event', async () => {
    const response = createSSEResponse('data: {"msg":"hello"}\n\n');
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe('{"msg":"hello"}');
  });

  it('parses multiple SSE events', async () => {
    const raw = 'data: {"id":1}\n\ndata: {"id":2}\n\ndata: [DONE]\n\n';

    const response = createSSEResponse(raw);
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(3);
    expect(events[0]!.data).toBe('{"id":1}');
    expect(events[1]!.data).toBe('{"id":2}');
    expect(events[2]!.data).toBe('[DONE]');
  });

  it('handles event type fields', async () => {
    const raw = 'event: message\ndata: hello\n\n';
    const response = createSSEResponse(raw);
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('message');
    expect(events[0]!.data).toBe('hello');
  });

  it('handles multi-line data', async () => {
    const raw = 'data: line1\ndata: line2\n\n';
    const response = createSSEResponse(raw);
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe('line1\nline2');
  });

  it('ignores comments', async () => {
    const raw = ':this is a comment\ndata: actual\n\n';
    const response = createSSEResponse(raw);
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe('actual');
  });

  it('returns empty for response with no body', async () => {
    const response = new Response(null);
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(0);
  });

  it('handles chunked delivery', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Deliver in two chunks, splitting an event
        controller.enqueue(encoder.encode('data: hel'));
        controller.enqueue(encoder.encode('lo\n\ndata: world\n\n'));
        controller.close();
      },
    });
    const response = new Response(stream);
    const events = [];
    for await (const event of parseSSEStream(response)) {
      events.push(event);
    }
    expect(events).toHaveLength(2);
    expect(events[0]!.data).toBe('hello');
    expect(events[1]!.data).toBe('world');
  });
});
