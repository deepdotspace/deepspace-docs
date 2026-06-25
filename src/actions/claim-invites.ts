/**
 * claimInvites — resolve pending email invites into real collaborator grants.
 *
 * Runs on sign-in (see `useClaimInvites`). Because it executes as a server
 * action it carries the `X-App-Action` privilege bypass, which is what lets
 * it update a *document it does not own* to add the caller as a collaborator —
 * something the caller could never do directly (docs `update: 'own'`).
 *
 * Flow:
 *   1. Learn the caller's email. It is taken from `params.authEmail`, which
 *      worker.ts injects from the *verified JWT* (never client-supplied), with
 *      a fallback to the caller's `users` row. Using the JWT avoids a race on
 *      first sign-in, when the WS-written `users` row may not exist yet — which
 *      is exactly the case this whole feature targets.
 *   2. Find every `invites` row for that email.
 *   3. For each, load the target doc and add the caller to `collaborators`
 *      (+ `editors` when the invite is for the editor role), then delete the
 *      invite. The grant is keyed by the caller's user id, so all existing
 *      access gates (`read: 'collaborator'`, the YJS role gate in worker.ts)
 *      pick it up with no further changes — and work even before the user's
 *      `users` row exists.
 *
 * SECURITY: an invite is only honored when `invitedBy === doc.ownerId`. Since
 * `invites.invitedBy` is userBound + immutable, it always reflects the true
 * creator; a non-owner who fabricates an invite row for another user's doc
 * gets it silently dropped here instead of escalating access.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { DocumentFields, InviteFields } from '../features/docs/types'
import { parseIds, uniqueIds } from '../features/docs/access-ids'

/** Bound the per-sign-in work; far above any legitimate fan-out. */
const MAX_INVITES_PER_CLAIM = 200

export const claimInvites: ActionHandler<Env> = async ({ userId, params, tools }) => {
  // 1. Resolve the caller's email from the verified JWT claim that worker.ts
  //    injected (never client-supplied), falling back to their users row.
  let email =
    typeof params.authEmail === 'string' ? params.authEmail.trim().toLowerCase() : ''
  if (!email) {
    const me = await tools.get<{ email?: string }>('users', userId)
    const rowEmail = me.success ? me.data.record.data.email : undefined
    if (rowEmail) email = rowEmail.trim().toLowerCase()
  }
  if (!email) return { success: true, data: { claimed: 0 } }

  // 2. Pending invites addressed to this email.
  const pending = await tools.query('invites', {
    where: { email },
    limit: MAX_INVITES_PER_CLAIM,
  })
  if (!pending.success) return { success: false, error: pending.error }

  // `claimed` counts only invites that actually *changed* an access list, so
  // the client only reloads when there is something new to see.
  let claimed = 0
  for (const invite of pending.data.records) {
    const { docId, role, invitedBy } = invite.data as unknown as InviteFields

    const docResult = await tools.get('documents', docId)
    if (!docResult.success) {
      // Only drop the invite if the doc is genuinely gone; a transient error
      // leaves it in place to retry on a later sign-in. Match by substring
      // since the SDK phrases this error as both `Record not found` and
      // `Record not found: <collection>/<id>` depending on the code path.
      if (docResult.error?.includes('Record not found')) {
        await tools.remove('invites', invite.recordId)
      } else {
        // Transient/unexpected error: the invite stays for a later retry, but
        // log it so a persistently failing claim isn't invisible.
        console.error('[claimInvites] doc load failed for', docId, docResult.error)
      }
      continue
    }
    const doc = docResult.data.record.data as unknown as DocumentFields

    // Only honor invites the doc's actual owner created. `invitedBy` is
    // userBound + immutable, so a forged row (invitedBy ≠ ownerId) is dropped.
    if (invitedBy !== doc.ownerId) {
      await tools.remove('invites', invite.recordId)
      continue
    }

    const collaborators = parseIds(doc.collaborators)
    const editors = parseIds(doc.editors)
    const needsCollaborator = !collaborators.includes(userId)
    const needsEditor = role === 'editor' && !editors.includes(userId)

    if (needsCollaborator || needsEditor) {
      // Patch only the access lists; a partial update merges server-side and
      // leaves title/folder/etc. untouched.
      const nextCollaborators = uniqueIds([...collaborators, userId])
      const nextEditors = role === 'editor' ? uniqueIds([...editors, userId]) : editors
      const updated = await tools.update('documents', docId, {
        collaborators: JSON.stringify(nextCollaborators),
        editors: JSON.stringify(nextEditors),
      })
      // If the grant write failed, leave the invite in place to retry; don't
      // count it and don't delete it.
      if (!updated.success) {
        console.error('[claimInvites] grant write failed for', docId, updated.error)
        continue
      }
      claimed++
    }

    // Grant is in place (just applied, or already present) — consume the invite.
    await tools.remove('invites', invite.recordId)
  }

  return { success: true, data: { claimed } }
}
