// Models for the docs AI assistant.
//
// Anything added here must be BOTH served by Anthropic and priced by the
// DeepSpace proxy: an id missing from the proxy's CHAT_MODEL_MULTIPLIERS bills
// at the '*' fallback of 5.0x. That is why claude-opus-5 is absent despite
// being current — it would bill $75/MTok against a real $25. Never add a date
// suffix; dated ids are snapshots and get retired. Sonnet 4.6 over Sonnet 5:
// same price, but 5 reasons by default and that competes with the answer for
// the output budget. max_tokens is set explicitly or the SDK reserves 128k.

export interface ChatModel {
    id: string
    label: string
    multiplier: number
}

export const CHAT_MODELS: ReadonlyArray<ChatModel> = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', multiplier: 0.333 },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', multiplier: 1.0 },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', multiplier: 1.0 },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', multiplier: 1.667 },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', multiplier: 1.667 },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', multiplier: 1.667 },
  { id: 'claude-fable-5', label: 'Claude Fable 5', multiplier: 3.333 },
]

export const DOCS_ASSISTANT_MODEL_ID = 'claude-sonnet-4-6'

export const CHAT_MAX_OUTPUT_TOKENS = 4096
