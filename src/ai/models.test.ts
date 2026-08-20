/**
 * Guards the class of bug that broke the AI assistant: a model id the provider
 * has retired, sitting in the code as a literal until a user hits it.
 *
 *   Anthropic API error 404: {"type":"error","error":{"type":"not_found_error",
 *   "message":"model: claude-sonnet-4-20250514"}}
 *
 * The DeepSpace proxy cannot catch this for us. Its chat-completion
 * integration declares `model: z.string()` and forwards the value to Anthropic
 * untouched, so the provider's 404 surfaces verbatim. What the proxy *does*
 * own is billing: an id with no row in `CHAT_MODEL_MULTIPLIERS` still runs, but
 * is charged at the `'*'` fallback of 5.0.
 *
 * So the expectations below are the intersection of "Anthropic still serves
 * it" and "the proxy prices it". `claude-opus-5` is deliberately excluded: it
 * is a current Anthropic model, but the proxy has no multiplier row for it, so
 * it bills at 5.0x = $75/MTok against a real rate of $25 — a silent 3x
 * overcharge.
 *
 * When this test fails after a provider release, re-read the proxy's pricing
 * tables rather than editing the expectations from memory.
 */

import { describe, it, expect } from 'vitest'
import {
  CHAT_MODELS,
  CHAT_MAX_OUTPUT_TOKENS,
  DOCS_ASSISTANT_MODEL_ID,
} from './models'

/** Anthropic id -> proxy `CHAT_MODEL_MULTIPLIERS` value. */
const PROXY_MULTIPLIERS: Record<string, number> = {
  'claude-sonnet-5': 1.0,
  'claude-sonnet-4-6': 1.0,
  'claude-sonnet-4-5': 1.0,
  'claude-opus-4-8': 1.667,
  'claude-opus-4-7': 1.667,
  'claude-opus-4-6': 1.667,
  'claude-opus-4-5': 1.667,
  'claude-opus-4-1': 5.0,
  'claude-haiku-4-5': 0.333,
  'claude-fable-5': 3.333,
}

/** Current Anthropic ids. Complete as-is — none of them carries a date. */
const SERVED_BY_ANTHROPIC = new Set([
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-fable-5',
])

describe('CHAT_MODELS catalog', () => {
  it.each(CHAT_MODELS.map((m) => [m.id] as const))(
    '"%s" is still served by Anthropic',
    (id) => {
      expect(SERVED_BY_ANTHROPIC.has(id)).toBe(true)
    },
  )

  it.each(CHAT_MODELS.map((m) => [m.id, m.multiplier] as const))(
    '"%s" is priced by the proxy at the multiplier the catalog records',
    (id, multiplier) => {
      // A miss here means the id falls to the proxy's `'*'` multiplier of 5.0
      // and the user is billed well above the real rate.
      expect(PROXY_MULTIPLIERS[id]).toBeDefined()
      expect(PROXY_MULTIPLIERS[id]).toBe(multiplier)
    },
  )

  it('carries no dated Claude snapshot suffixes', () => {
    // `claude-sonnet-4-20250514` shipped here once. Current Claude ids are
    // complete without a date; a suffix names a snapshot that gets retired.
    const dated = CHAT_MODELS.filter(
      (m) => /-\d{8}$/.test(m.id) || /-\d{4}-\d{2}-\d{2}$/.test(m.id),
    )
    expect(dated.map((m) => m.id)).toEqual([])
  })

  it('never lists claude-opus-5, which the proxy would bill at 5x', () => {
    expect(CHAT_MODELS.map((m) => m.id)).not.toContain('claude-opus-5')
  })

  it('has unique ids and a non-empty label for each', () => {
    const ids = CHAT_MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of CHAT_MODELS) expect(m.label.trim()).not.toBe('')
  })
})

describe('DOCS_ASSISTANT_MODEL_ID', () => {
  it('is an id from the catalog', () => {
    expect(CHAT_MODELS.map((m) => m.id)).toContain(DOCS_ASSISTANT_MODEL_ID)
  })

  it('is not a model that reasons by default', () => {
    // Sonnet 5 / Opus 5 / Fable 5 emit a `thinking` block before any answer
    // text, which can exhaust the output budget on a tool-using turn and fail
    // the call with `OutputBudgetExhaustedError`.
    expect(['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5']).not.toContain(
      DOCS_ASSISTANT_MODEL_ID,
    )
  })
})

describe('CHAT_MAX_OUTPUT_TOKENS', () => {
  it('is set well below the model ceiling the adapter would otherwise send', () => {
    // `@ai-sdk/anthropic` fills `max_tokens` with the model's ceiling (128k for
    // Sonnet 4.6) when the caller sets none, and the proxy's credit gate
    // reserves against that number before the call runs.
    expect(CHAT_MAX_OUTPUT_TOKENS).toBeGreaterThan(0)
    expect(CHAT_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(8192)
  })
})
