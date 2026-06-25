/**
 * Invites — pending email-based document shares.
 *
 * The problem this solves: `documents.collaborators` / `editors` store
 * user *ids*, which only exist after a person has signed into the app at
 * least once (the WS-connect `registerUser` flow writes their `users`
 * row). So you cannot grant access to someone who has never opened the
 * app — there is no id to add yet.
 *
 * An `invites` row records a grant keyed by *email* instead. When that
 * person later signs in, the `claimInvites` server action resolves the
 * pending invite to their now-existing user id, appends it to the doc's
 * `collaborators` (+ `editors` for the editor role), and deletes the row.
 *
 * SECURITY: `invitedBy` is `userBound` + `immutable`, so the SDK stamps
 * it with the creating user's id and it can never be forged. The claim
 * action only honors an invite when `invitedBy === documents.ownerId`,
 * so a non-owner who manufactures an invite row cannot use it to grant
 * themselves (or anyone) access to a document they don't own.
 *
 * `read: 'own'` means a user only ever sees invites they created — the
 * owner uses this to list/cancel pending invites in the share dialog.
 * The invitee never reads this collection directly; the claim action
 * runs with the `X-App-Action` privilege bypass.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const invitesSchema: CollectionSchema = {
  name: 'invites',
  columns: [
    /** Target document recordId. */
    { name: 'docId', storage: 'text', interpretation: 'plain', required: true },
    /** Invitee email, stored lowercased. */
    { name: 'email', storage: 'text', interpretation: 'plain', required: true },
    /** Granted role once claimed: 'viewer' | 'editor'. */
    { name: 'role', storage: 'text', interpretation: 'plain', required: true },
    /** Creating user id — must match the doc owner for the invite to be honored. */
    {
      name: 'invitedBy',
      storage: 'text',
      interpretation: 'plain',
      required: true,
      userBound: true,
      immutable: true,
    },
  ],
  // One pending invite per (doc, email, inviter). Including `invitedBy` stops
  // a non-owner from pre-creating a `(docId, email)` row that would otherwise
  // collide with — and silently block — the real owner's later invite (the row
  // is invisible to the owner under `read: 'own'`). Such forged rows are
  // dropped at claim time anyway, since `invitedBy` won't equal the doc owner.
  uniqueOn: ['docId', 'email', 'invitedBy'],
  ownerField: 'invitedBy',
  permissions: {
    viewer: { read: 'own', create: false, update: false, delete: 'own' },
    member: { read: 'own', create: true, update: false, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
