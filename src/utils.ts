import type { JsonSchema, ZodLike } from './types.js';

/**
 * Detect whether a value looks like a Zod schema (duck typing).
 */
export function isZodLike(value: unknown): value is ZodLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'parse' in value &&
    typeof (value as ZodLike).parse === 'function' &&
    '_def' in value
  );
}

/**
 * Lightweight Zod-to-JSON-Schema converter.
 * Handles the most common Zod types without requiring zod-to-json-schema.
 */
export function zodToJsonSchema(schema: ZodLike): JsonSchema {
  const def = schema._def as Record<string, unknown>;
  return zodDefToJsonSchema(def);
}

function zodDefToJsonSchema(def: Record<string, unknown>): JsonSchema {
  const typeName = def['typeName'] as string | undefined;

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodNull':
      return { type: 'null' };
    case 'ZodArray': {
      const itemDef = def['type'] as { _def: Record<string, unknown> } | undefined;
      return {
        type: 'array',
        ...(itemDef && { items: zodDefToJsonSchema(itemDef._def) }),
      };
    }
    case 'ZodObject': {
      const shape = def['shape'] as
        | (() => Record<string, { _def: Record<string, unknown> }>)
        | undefined;
      if (!shape) return { type: 'object' };
      const resolved = typeof shape === 'function' ? shape() : shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, fieldSchema] of Object.entries(resolved)) {
        properties[key] = zodDefToJsonSchema(fieldSchema._def);
        const fieldTypeName = fieldSchema._def['typeName'] as string | undefined;
        if (fieldTypeName !== 'ZodOptional') {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
      };
    }
    case 'ZodOptional': {
      const inner = def['innerType'] as { _def: Record<string, unknown> } | undefined;
      return inner ? zodDefToJsonSchema(inner._def) : {};
    }
    case 'ZodEnum': {
      const values = def['values'] as unknown[] | undefined;
      return { type: 'string', ...(values && { enum: values }) };
    }
    case 'ZodLiteral': {
      const value = def['value'];
      return { type: typeof value as string, enum: [value] };
    }
    default:
      return {};
  }
}

/**
 * Resolve a schema parameter to a plain JSON Schema object.
 */
export function resolveJsonSchema(schema: JsonSchema | ZodLike): JsonSchema {
  return isZodLike(schema) ? zodToJsonSchema(schema) : schema;
}

/**
 * Deep merge two objects. The `overrides` values take precedence.
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: Partial<T>,
): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const val = overrides[key];
    if (val === undefined) continue;

    if (
      typeof val === 'object' &&
      val !== null &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}
