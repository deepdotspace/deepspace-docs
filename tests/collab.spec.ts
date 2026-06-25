import { test, expect } from '@playwright/test'
import { createTestUsers } from './helpers/auth'

async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 })
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

  test('owner can share a private document by email with viewer and editor roles', async ({ browser }) => {
    const [owner, collaborator, uninvited] = await createTestUsers(browser, 3, 'share')
    const signedOutContext = await browser.newContext()
    const signedOutPage = await signedOutContext.newPage()

    try {
      await waitForApp(owner.page)
      await waitForApp(collaborator.page)
      await waitForApp(uninvited.page)

      await owner.page.getByTestId('create-doc-btn').click()
      await owner.page.waitForSelector('[data-testid="doc-title"]', { timeout: 15000 })

      await owner.page.getByTestId('doc-title').click()
      await owner.page.getByTestId('doc-title-input').fill('Shared Access Doc')
      await owner.page.getByTestId('doc-title-input').press('Enter')
      await expect(owner.page.getByTestId('doc-title')).toHaveText('Shared Access Doc')

      const ownerEditor = owner.page.getByTestId('editor-content')
      await expect(ownerEditor).toBeEditable({ timeout: 15000 })
      const sentinel = `viewer-access-${Date.now()}`
      await ownerEditor.fill(sentinel)
      const docUrl = owner.page.url()
      const docId = docUrl.split('/doc/')[1]?.split('?')[0]
      expect(docId).toBeTruthy()

      await collaborator.page.goto(docUrl, { waitUntil: 'domcontentloaded' })
      await expect(
        collaborator.page.getByText('This document is private'),
      ).toBeVisible({ timeout: 15000 })
      await uninvited.page.goto(docUrl, { waitUntil: 'domcontentloaded' })
      await expect(
        uninvited.page.getByText('This document is private'),
      ).toBeVisible({ timeout: 15000 })
      await signedOutPage.goto(docUrl, { waitUntil: 'domcontentloaded' })
      await expect(signedOutPage.getByTestId('document-sign-in-continue')).toBeVisible({
        timeout: 15000,
      })
      await expect(signedOutPage.getByTestId('editor-content')).toHaveCount(0)

      await owner.page.getByTestId('share-doc-btn').click()
      const dialog = owner.page.getByRole('dialog', { name: 'Share document' })
      await expect(dialog).toBeVisible({ timeout: 10000 })
      await dialog.getByTestId('share-email-input').fill(collaborator.email)
      // Role picker is now a custom dropdown (Radix), not a native <select>:
      // open it and choose the radio item rather than selectOption().
      await dialog.getByTestId('share-role-select').click()
      await owner.page.getByRole('menuitemradio', { name: 'Viewer' }).click()
      await dialog.getByTestId('share-add-btn').click()
      await expect(dialog.getByText(collaborator.email)).toBeVisible({ timeout: 10000 })

      await collaborator.page.goto(docUrl, { waitUntil: 'domcontentloaded' })
      const viewerEditor = collaborator.page.getByTestId('editor-content')
      await expect(viewerEditor).toBeVisible({ timeout: 15000 })
      await expect(viewerEditor).not.toBeEditable({ timeout: 15000 })
      await expect(viewerEditor).toContainText(sentinel, { timeout: 15000 })
      await expect(collaborator.page.getByText('You have view-only access')).toBeVisible({
        timeout: 10000,
      })

      await collaborator.page.goto('/', { waitUntil: 'domcontentloaded' })
      await collaborator.page.getByTestId('library-nav-shared').click()
      await expect(collaborator.page.getByTestId('shared-doc-list')).toBeVisible({
        timeout: 15000,
      })
      await expect(collaborator.page.getByText('Shared Access Doc')).toBeVisible()
      await expect(collaborator.page.getByText('View only')).toBeVisible()
      await collaborator.page.getByTestId(`shared-doc-card-${docId}`).click()
      await expect(collaborator.page).toHaveURL(new RegExp(`/doc/${docId}`))
      await expect(collaborator.page.getByTestId('editor-content')).toBeVisible({ timeout: 15000 })
      await expect(collaborator.page.getByTestId('editor-content')).not.toBeEditable({
        timeout: 15000,
      })

      // Promote the collaborator's row dropdown (nth(0) is the add-invite
      // picker, nth(1) is the first collaborator row) from viewer to editor.
      await dialog.getByTestId(/^share-role-/).nth(1).click()
      await owner.page.getByRole('menuitemradio', { name: 'Editor' }).click()
      await collaborator.page.goto(docUrl, { waitUntil: 'domcontentloaded' })
      const promotedEditor = collaborator.page.getByTestId('editor-content')
      await expect(promotedEditor).toBeEditable({ timeout: 15000 })
      const promotedSentinel = `editor-access-${Date.now()}`
      await promotedEditor.fill(promotedSentinel)
      await expect(ownerEditor).toContainText(promotedSentinel, { timeout: 15000 })

      await dialog.getByTitle('Remove access').click()
      await collaborator.page.reload({ waitUntil: 'domcontentloaded' })
      await expect(
        collaborator.page.getByText('This document is private'),
      ).toBeVisible({ timeout: 15000 })
    } finally {
      await owner.context.close()
      await collaborator.context.close()
      await uninvited.context.close()
      await signedOutContext.close()
    }
  })
})
