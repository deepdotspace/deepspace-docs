import { test, expect } from '@playwright/test'
import { createTestUsers } from './helpers/auth'

async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Multi-user collaboration', () => {
  test('two users are recognized as different users', async ({ browser }) => {
    const users = await createTestUsers(browser, 2)

    try {
      await waitForApp(users[0].page)
      await waitForApp(users[1].page)

      // Both should show signed-in state with their names
      await expect(users[0].page.getByTestId('nav-user-name')).toContainText('User 1')
      await expect(users[1].page.getByTestId('nav-user-name')).toContainText('User 2')
    } finally {
      for (const u of users) await u.context.close()
    }
  })
})
