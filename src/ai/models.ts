/**
 * Model catalog for the AI chat assistant.
 *
 * There is exactly one AI call site in this app (`POST /api/ai/chat` in
 * `worker.ts`), and it used to name its model with an inline literal. That is
 * how it broke: `claude-sonnet-4-20250514` was retired by Anthropic and the
 * call started returning a raw provider 404.
 *
 * The DeepSpace proxy cannot catch that for us. `createDeepSpaceAI` points the
 * Vercel AI SDK at `https://api-worker.internal/api/proxy/anthropic/v1`, and
 * the proxy's chat-completion integration declares `model: z.string()` and
 * forwards the value to Anthropic untouched — the provider is the only
 * authority on what is servable.
 *
 * What the proxy *does* own is billing. Its `CHAT_MODEL_MULTIPLIERS` table
 * charges a known model at its real rate and everything else at the `'*'`
 * fallback of 5.0. So an id must satisfy two rules to appear below, both
 * enforced by `models.test.ts`:
 *
 *   1. Anthropic still serves it.
 *   2. The proxy prices it — otherwise the user is silently overcharged.
 *
 * Rule 2 is why `claude-opus-5` is absent even though it is a current
 * Anthropic model and the SDK's own `DEEPSPACE_AI_MODELS` lists it: the proxy
 * has no multiplier row for it, so it bills at 5.0x = $75/MTok against a real
 * rate of $25. Add it here only once the proxy table carries it.
 *
 * Never append a date suffix to a Claude id. Current ids are complete as-is;
 * a dated id is a snapshot, and snapshots get retired.
 */

export interface ChatModel {
  /** Model id sent to the provider, verbatim. */
  id: string
  /** Human-readable name, for logs and any future picker. */
  label: string
  /**
   * Billing multiplier the proxy applies to this id. Recorded so the cost of
   * a swap is visible at the point of the swap rather than after the invoice.
   */
  multiplier: number
}

/**
 * Anthropic models this app may use: served by the provider, priced by the
 * proxy. Ordered cheapest-capable first within a tier.
 */
export const CHAT_MODELS: ReadonlyArray<ChatModel> = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', multiplier: 0.333 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', multiplier: 1.0 },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', multiplier: 1.0 },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', multiplier: 1.667 },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', multiplier: 1.667 },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', multiplier: 1.667 },
  { id: 'claude-fable-5', label: 'Claude Fable 5', multiplier: 3.333 },
]

/**
 * Model behind `POST /api/ai/chat` — a multi-turn assistant that answers
 * questions about the app's documents by calling the read-only record tools
 * in `src/ai/tools.ts`, up to five steps per turn.
 *
 * Sonnet 4.6 rather than Sonnet 5, for two reasons that both come from
 * `@ai-sdk/anthropic`'s `getModelCapabilities` (v2.0.83):
 *
 *  - Sonnet 5 is not in that table, so it resolves to the unknown-model
 *    defaults and the adapter caps the request at `max_tokens: 4096`. Sonnet 5
 *    also reasons by default, so a `thinking` block can consume that whole
 *    budget before any answer text is emitted and the proxy fails the call
 *    with `OutputBudgetExhaustedError`. Sonnet 4.6 only reasons when asked, so
 *    the entire budget is answer.
 *  - The table knows Sonnet 4.6 (128k output, accepts sampling parameters),
 *    so the adapter negotiates it correctly instead of guessing.
 *
 * Both bill at the same 1.0 multiplier, so this costs nothing to prefer.
 */
export const DOCS_ASSISTANT_MODEL_ID = 'claude-sonnet-4-6'

/**
 * Per-step output budget for the chat assistant.
 *
 * Set explicitly because `@ai-sdk/anthropic` otherwise fills `max_tokens` with
 * the model's ceiling — 128k for Sonnet 4.6 — and the proxy's credit gate
 * reserves against that number before the call runs. Reserving 128k of output
 * for a chat reply rejects users who had ample balance for the request they
 * actually made. 4096 is the same default the DeepSpace SDK applies to an
 * Anthropic request that carries no limit of its own
 * (`ANTHROPIC_DEFAULT_MAX_OUTPUT_TOKENS`), and is ample for a chat answer.
 */
export const CHAT_MAX_OUTPUT_TOKENS = 4096
