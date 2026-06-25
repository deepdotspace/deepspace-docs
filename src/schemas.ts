/**
 * Collection Schemas — Docs2
 *
 * App-scope schemas served from the app's own RecordRoom DO
 * (roomId = `app:docs`). Documents and folders live entirely
 * in this scope — there is no cross-app share collection. Sharing
 * is expressed via `documents.collaborators` / `documents.editors`
 * and resolved by `worker.ts` when handing out YJS access. Shares to
 * people who have not signed in yet are held in `invites` (keyed by
 * email) until the `claimInvites` action resolves them to a user id.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { docsSchema } from './schemas/docs-schema'
import { docFoldersSchema } from './schemas/folders-schema'
import { invitesSchema } from './schemas/invites-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  docsSchema,
  docFoldersSchema,
  invitesSchema,
]
