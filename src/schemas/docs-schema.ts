/**
 * Documents — per-doc metadata record.
 *
 * The actual rich-text content lives in its own YjsRoom DO (accessed via
 * `useYjsRoom(docId, 'content')`), keyed by the document's recordId.
 * This record holds title + access control fields only.
 *
 * `read: 'collaborator'` means: owner OR anyone listed in `collaborators`
 * can read the row. Editors are a subset of collaborators (kept as a
 * separate JSON list under `editors`). The YJS gate in `worker.ts`
 * uses the same fields to decide who can write to the live document.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const docsSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'ownerId',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      userBound: true,
      immutable: true,
    },
    /** JSON-encoded array of user ids that can read the doc. */
    { name: 'collaborators', storage: 'text', interpretation: 'plain' },
    /** JSON-encoded array of user ids (subset of collaborators) that can write. */
    { name: 'editors', storage: 'text', interpretation: 'plain' },
    /** Empty string = uncategorized. */
    { name: 'folderId', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  collaboratorsField: 'collaborators',
  permissions: {
    viewer: { read: 'collaborator', create: false, update: false, delete: false },
    member: { read: 'collaborator', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
