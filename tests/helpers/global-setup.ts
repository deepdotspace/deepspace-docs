/**
 * Playwright global setup — warms up external services before tests run.
 *
 * The dev auth worker has cold start latency. Pinging it here prevents
 * the first test from seeing transient fetch errors.
 */

export default async function globalSetup() {
  const maxRetries = 5
  const baseUrl = 'http://localhost:5173'

  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/auth/ok`)
      if (res.ok) return
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  // Don't fail — tests will catch real issues
}
