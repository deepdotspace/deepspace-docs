/**
 * Doc folders — user-owned labels for organizing documents.
 *
 * Documents reference a folder via `documents.folderId` (empty = uncategorized).
 */

import type { CollectionSchema } from 'deepspace/worker'

export const docFoldersSchema: CollectionSchema = {
  name: 'doc_folders',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
