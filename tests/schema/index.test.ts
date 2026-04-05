import { describe, it, expect } from 'vitest';
import { parseModelJson, validateSchema } from '../../src/schema/index.js';
import { isZodLike, zodToJsonSchema } from '../../src/utils.js';
import type { ZodLike, JsonSchema } from '../../src/types.js';

describe('parseModelJson', () => {
  it('parses plain JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences', () => {
    const input = '```json\n{"a":1}\n```';
    expect(parseModelJson(input)).toEqual({ a: 1 });
  });

  it('strips code fences without language tag', () => {
    const input = '```\n{"a":1}\n```';
    expect(parseModelJson(input)).toEqual({ a: 1 });
  });

  it('handles whitespace around JSON', () => {
    expect(parseModelJson('  \n{"a":1}\n  ')).toEqual({ a: 1 });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseModelJson('not json')).toThrow();
  });
});

describe('validateSchema', () => {
  it('validates with a Zod-like schema', () => {
    const mockZod: ZodLike<{ name: string }> = {
      parse: (data) => data as { name: string },
      safeParse: (data) => ({ success: true, data: data as { name: string } }),
      _def: { typeName: 'ZodObject' },
    };

    const result = validateSchema({ name: 'Alice' }, mockZod);
    expect(result).toEqual({ name: 'Alice' });
  });

  it('throws on Zod validation failure', () => {
    const mockZod: ZodLike<{ name: string }> = {
      parse: () => { throw new Error('bad'); },
      safeParse: () => ({ success: false, error: new Error('bad') }),
      _def: { typeName: 'ZodObject' },
    };

    expect(() => validateSchema({ bad: true }, mockZod)).toThrow('schema validation');
  });

  it('passes through for plain JSON schema', () => {
    const schema: JsonSchema = { type: 'object', properties: { a: { type: 'number' } } };
    const result = validateSchema({ a: 1 }, schema);
    expect(result).toEqual({ a: 1 });
  });
});

describe('isZodLike', () => {
  it('detects Zod-like objects', () => {
    expect(isZodLike({ parse: () => {}, safeParse: () => ({}), _def: {} })).toBe(true);
  });

  it('rejects non-Zod objects', () => {
    expect(isZodLike({})).toBe(false);
    expect(isZodLike(null)).toBe(false);
    expect(isZodLike({ parse: 'not a function' })).toBe(false);
  });
});

describe('zodToJsonSchema', () => {
  it('converts a Zod-like string schema', () => {
    const schema = { parse: () => {}, safeParse: () => ({}), _def: { typeName: 'ZodString' } };
    expect(zodToJsonSchema(schema as ZodLike)).toEqual({ type: 'string' });
  });

  it('converts a Zod-like number schema', () => {
    const schema = { parse: () => {}, safeParse: () => ({}), _def: { typeName: 'ZodNumber' } };
    expect(zodToJsonSchema(schema as ZodLike)).toEqual({ type: 'number' });
  });

  it('converts a Zod-like object schema', () => {
    const schema = {
      parse: () => {},
      safeParse: () => ({}),
      _def: {
        typeName: 'ZodObject',
        shape: () => ({
          name: { _def: { typeName: 'ZodString' } },
          age: { _def: { typeName: 'ZodNumber' } },
        }),
      },
    };
    const result = zodToJsonSchema(schema as ZodLike);
    expect(result).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    });
  });
});
