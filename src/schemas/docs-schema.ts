/**
 * Documents — per-doc metadata record.
 *
 * The actual rich-text content lives in its own YjsRoom DO (accessed via
 * `useYjsRoom(docId, 'content')`), keyed by the document's recordId.
 * This record holds only metadata + access control.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const docsSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
    { name: 'visibility', storage: 'text', interpretation: { kind: 'select', options: ['private', 'public'] } },
    /** Empty string = not in any folder. */
    { name: 'folderId', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'ownerId',
  visibilityField: 'visibility',
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
