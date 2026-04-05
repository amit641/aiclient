import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
  ProviderToolDefinition,
  JsonSchema,
} from '../types.js';
import { AIError } from '../errors.js';
import { resolveJsonSchema } from '../utils.js';

/**
 * Convert user-facing tool definitions into the provider-level format.
 */
export function buildProviderTools(
  tools: Record<string, ToolDefinition>,
): ProviderToolDefinition[] {
  return Object.entries(tools).map(([name, def]) => ({
    name,
    description: def.description,
    parameters: resolveJsonSchema(def.parameters) as JsonSchema,
  }));
}

/**
 * Execute tool calls against their registered handlers.
 * Returns results in order, skipping tools without `execute` handlers.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  tools: Record<string, ToolDefinition>,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const call of toolCalls) {
    const tool = tools[call.name];
    if (!tool?.execute) continue;

    try {
      const result = await tool.execute(call.arguments);
      results.push({
        toolCallId: call.id,
        toolName: call.name,
        result,
      });
    } catch (err) {
      throw new AIError(
        `Tool "${call.name}" execution failed: ${err instanceof Error ? err.message : String(err)}`,
        'TOOL_EXECUTION_ERROR',
        undefined,
        undefined,
        err,
      );
    }
  }

  return results;
}
