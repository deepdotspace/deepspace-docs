/**
 * Collection Schemas — Docs2
 *
 * App-scope schemas are served from the app's own RecordRoom DO
 * (roomId = `app:docs2`). The cross-app `content_shares` collection
 * lives in the shared `workspace:default` DO — it's mounted as a
 * sharedScope in `src/pages/_app.tsx` so the same `useQuery`/`useMutations`
 * hooks resolve collection names to the right scope automatically.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { docsSchema } from './schemas/docs-schema'
import { docFoldersSchema } from './schemas/folders-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  docsSchema,
  docFoldersSchema,
]
