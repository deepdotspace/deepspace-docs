import type { Page } from '@playwright/test'

const AUTH_BASE = 'http://localhost:5173'

/**
 * Sign up a new user on the dev auth worker. Returns the user ID.
 * Safe to call multiple times — if the email exists, falls back to sign-in.
 */
export async function signUp(
  page: Page,
  email: string,
  opts: { password?: string; name?: string } = {},
) {
  const password = opts.password ?? 'testpass123'
  const name = opts.name ?? email.split('@')[0]

  await page.goto('/')

  // Try sign-up, fall back to sign-in if account exists
  const res = await page.evaluate(
    async ({ email, password, name }) => {
      const signUpRes = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (signUpRes.ok) return 'signed-up'

      const signInRes = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (signInRes.ok) return 'signed-in'
      return 'failed'
    },
    { email, password, name },
  )

  if (res === 'failed') {
    throw new Error(`Failed to sign up/in as ${email}`)
  }

  // Reload to pick up the session cookie
  await page.reload()
}

/**
 * Sign out the current user.
 */
export async function signOut(page: Page) {
  await page.evaluate(async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' })
  })
  await page.reload()
}

/**
 * Create multiple test users, each in their own browser context.
 */
export async function createTestUsers(
  browser: import('@playwright/test').Browser,
  count: number,
  prefix = 'test',
) {
  const users = []
  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const email = `${prefix}-${i + 1}-${Date.now()}@test.local`
    const name = `${prefix} User ${i + 1}`
    await signUp(page, email, { name })
    users.push({ context: ctx, page, email, name })
  }
  return users
}
