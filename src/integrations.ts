/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default). Works for anonymous users.
 * - 'user': The calling user pays. Requires sign-in.
 *
 * Integrations not listed here default to 'developer'.
 */

export const integrations: Record<string, { billing: 'developer' | 'user' }> = {
  // openai: { billing: 'developer' },
  // weather: { billing: 'user' },
}
