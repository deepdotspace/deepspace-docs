/**
 * Documents home — list the signed-in user's own documents.
 *
 * Ported from the Miyagi3 `DocumentListPage` (own-scope variant).
 * Sections:
 *   - Favorites — pinned docs (localStorage-backed)
 *   - My Documents — your private docs
 *   - Shared with me — documents others have shared via content_shares
 *
 * Under the new DeepSpace architecture all docs share a single
 * `app:docs` RecordRoom DO. Records are filtered by `ownerId`
 * (managed by the `ownerField` and collaborator RBAC) instead of
 * per-user DO scopes.
 */

import DocumentListPage from '../features/docs/DocumentListPage'

export default function Index() {
  return <DocumentListPage />
}
