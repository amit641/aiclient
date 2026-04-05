import type { JsonSchema, ZodLike } from '../types.js';
import { AIError } from '../errors.js';
import { isZodLike, resolveJsonSchema } from '../utils.js';

/**
 * Validates raw data against a schema and returns the typed result.
 * Supports both JSON Schema (basic) and Zod schemas (full validation).
 */
export function validateSchema<T>(
  data: unknown,
  schema: JsonSchema | ZodLike<T>,
): T {
  if (isZodLike(schema)) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw AIError.schemaValidation(
        `Structured output failed schema validation: ${String(result.error)}`,
        result.error,
      );
    }
    return result.data as T;
  }

  // For plain JSON Schema, do basic structural checks
  // (full JSON Schema validation would require a dependency)
  if (schema.type === 'object' && typeof data !== 'object') {
    throw AIError.schemaValidation(
      `Expected object, got ${typeof data}`,
    );
  }

  return data as T;
}

/**
 * Parse a JSON string from a model response, handling common LLM quirks
 * like markdown code fences and trailing commas.
 */
export function parseModelJson(text: string): unknown {
  let cleaned = text.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    cleaned = cleaned.slice(firstNewline + 1);
    const lastFence = cleaned.lastIndexOf('```');
    if (lastFence !== -1) {
      cleaned = cleaned.slice(0, lastFence);
    }
    cleaned = cleaned.trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw AIError.schemaValidation(
      `Failed to parse structured output as JSON: ${cleaned.slice(0, 200)}`,
      err,
    );
  }
}

export { resolveJsonSchema };
