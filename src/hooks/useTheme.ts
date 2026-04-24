/**
 * Theme is fixed to light. Dark mode and the toggle were removed; `data-theme`
 * is set to `light` in `_app.tsx` on load.
 */
export type Theme = 'light'

export function useTheme() {
  return { theme: 'light' as const }
}
