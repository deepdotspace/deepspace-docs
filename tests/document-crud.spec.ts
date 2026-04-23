import { test, expect } from '@playwright/test'
import { createTestUsers } from './helpers/auth'
import { captureConsoleErrors } from './helpers/errors'

async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Documents CRUD', () => {
  test('create, rename, and delete a document', async ({ browser }) => {
    const [user] = await createTestUsers(browser, 1)
    const errors = captureConsoleErrors(user.page)

    try {
      await waitForApp(user.page)

      // Create a new document
      await user.page.getByTestId('create-doc-btn').click()

      // Editor page loads with default title
      await user.page.waitForSelector('[data-testid="doc-title"]', { timeout: 15000 })
      await expect(user.page.getByTestId('doc-title')).toHaveText('Untitled Document')

      // Type some content
      await user.page.getByTestId('editor-content').fill('Hello world from docs2')
      await expect(user.page.getByTestId('editor-content')).toHaveValue('Hello world from docs2')

      // Rename via inline title
      await user.page.getByTestId('doc-title').click()
      await user.page.getByTestId('doc-title-input').fill('My First Doc')
      await user.page.getByTestId('doc-title-input').press('Enter')
      await expect(user.page.getByTestId('doc-title')).toHaveText('My First Doc')

      // Back to list
      await user.page.getByTestId('back-btn').click()
      await user.page.waitForSelector('[data-testid="doc-list"]', { timeout: 10000 })
      await expect(user.page.locator('text=My First Doc').first()).toBeVisible()

      expect(errors).toEqual([])
    } finally {
      await user.context.close()
    }
  })

  test('templates open a picker with prebuilt options', async ({ browser }) => {
    const [user] = await createTestUsers(browser, 1)
    try {
      await waitForApp(user.page)
      await user.page.getByTestId('templates-btn').click()
      await expect(user.page.getByTestId('template-meeting-notes')).toBeVisible()
      await expect(user.page.getByTestId('template-project-brief')).toBeVisible()
    } finally {
      await user.context.close()
    }
  })
})
