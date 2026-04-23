/**
 * AI Tool Definitions — converts DeepSpace BUILT_IN_TOOLS to Vercel AI SDK tools.
 *
 * Only exposes read-only tools so the assistant can inspect data but never mutate it.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { BUILT_IN_TOOLS } from 'deepspace/worker'
import type { ToolSchema, CollectionSchema } from 'deepspace/worker'

type ToolExecutor = (toolName: string, params: Record<string, unknown>) => Promise<unknown>

const READ_ONLY_TOOL_NAMES = [
  'schema.list',
  'schema.describe',
  'records.query',
  'records.get',
  'user.current',
]

// ============================================================================
// System prompt
// ============================================================================

type Interpretation = CollectionSchema['columns'][number]['interpretation']

/**
 * Interpretation is `string | Record<string, unknown>`. When it's an object
 * the convention across the SDK's built-in schemas is `{ kind: string, ... }`
 * (see `server/schemas/directory.ts`). Narrow safely to a human-readable name.
 */
function interpretationLabel(interpretation: Interpretation): string {
  if (typeof interpretation === 'string') return interpretation
  const kind = interpretation.kind
  return typeof kind === 'string' ? kind : 'object'
}

export function buildSystemPrompt(appName: string, schemas: CollectionSchema[]): string {
  const schemaSummary = schemas
    .map((s) => {
      const cols = (s.columns ?? [])
        .map((c) => `${c.name}:${interpretationLabel(c.interpretation)}${c.required ? '!' : ''}`)
        .join(', ')
      return `- ${s.name}${cols ? ` (${cols})` : ''}`
    })
    .join('\n')

  return [
    `You are the assistant for the "${appName}" app on DeepSpace.`,
    'You are read-only — you can inspect data but never create, update, or delete anything.',
    'Use the available tools to look up facts before answering. Do not invent data.',
    'If data is missing, say so plainly. Keep answers concise.',
    '',
    'Available collections:',
    schemaSummary || '(none)',
  ].join('\n')
}

// ============================================================================
// Tool definitions
// ============================================================================

export function buildReadOnlyTools(executor: ToolExecutor) {
  const tools: Record<string, ReturnType<typeof tool>> = {}

  for (const def of BUILT_IN_TOOLS) {
    if (!READ_ONLY_TOOL_NAMES.includes(def.name)) continue
    const safeName = def.name.replace('.', '_')
    tools[safeName] = tool({
      description: def.description,
      parameters: buildZodSchema(def),
      execute: async (params) => executor(def.name, params as Record<string, unknown>),
    })
  }

  return tools
}

// ============================================================================
// Convert ToolSchema params → Zod object schema
// ============================================================================

function buildZodSchema(def: ToolSchema) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [name, param] of Object.entries(def.params)) {
    let s: z.ZodTypeAny
    switch (param.type) {
      case 'string':  s = z.string(); break
      case 'number':  s = z.number(); break
      case 'boolean': s = z.boolean(); break
      case 'object':  s = z.record(z.unknown()); break
      case 'array':   s = z.array(z.unknown()); break
      default:        s = z.unknown(); break
    }
    if (param.description) s = s.describe(param.description)
    if (!param.required) s = s.optional()
    shape[name] = s
  }

  return z.object(shape)
}
