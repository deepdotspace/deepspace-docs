/**
 * Discrete page zoom levels for the editor canvas (toolbar + keyboard).
 */

export const PAGE_ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '90%', value: 0.9 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
] as const

const VALUES = PAGE_ZOOM_PRESETS.map((p) => p.value)

export function normalizeCanvasZoom(z: number): number {
  let best = VALUES[0]
  let bestD = Math.abs(z - best)
  for (const p of VALUES) {
    const d = Math.abs(z - p)
    if (d < bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

/** Move to previous / next preset on the list. */
export function stepCanvasZoom(current: number, direction: 1 | -1): number {
  let idx = VALUES.findIndex((p) => Math.abs(p - current) < 0.001)
  if (idx < 0) {
    idx = VALUES.reduce(
      (bestI, p, i) => (Math.abs(p - current) < Math.abs(VALUES[bestI] - current) ? i : bestI),
      0,
    )
  }
  const next = Math.max(0, Math.min(VALUES.length - 1, idx + direction))
  return VALUES[next]
}
