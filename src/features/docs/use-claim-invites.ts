/**
 * useClaimInvites — fire the `claimInvites` server action once per app load
 * after the user is signed in.
 *
 * This is the bridge that turns a pending email invite into real access:
 * the first time an invited person opens the app, this resolves their
 * `invites` rows into `documents.collaborators` grants server-side.
 *
 * If anything was actually claimed we do a one-time `window.location.reload()`.
 * The `documents` query the user already subscribed to was evaluated *before*
 * they were a collaborator, so it filtered the newly-shared docs out; a fresh
 * load re-subscribes as a collaborator and the docs appear. The claim action
 * deletes invites as it consumes them, so the post-reload run claims 0 and the
 * reload does not recur.
 *
 * The action is idempotent and cheap, so we run it once per app load — guarded
 * in-session by `ranRef` — rather than persisting a device-local "done" flag.
 * A persistent flag was deliberately avoided: it would permanently stop a
 * device from ever picking up an invite created *after* the first claim. That
 * happens in the race where someone is re-invited by email in the brief window
 * before the inviter's client has synced their newly-created account, producing
 * a stale pending invite the flagged device would never resolve.
 */

import { useEffect, useRef } from 'react'
import { getAuthToken, useAuth } from 'deepspace'

export function useClaimInvites() {
  const { isSignedIn } = useAuth()
  const ranRef = useRef(false)

  useEffect(() => {
    if (!isSignedIn || ranRef.current) return
    ranRef.current = true

    void (async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const res = await fetch('/api/actions/claimInvites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: '{}',
        })
        if (!res.ok) return
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { claimed?: number } }
          | null
        if (!json?.success) return
        if ((json.data?.claimed ?? 0) > 0) {
          window.location.reload()
        }
      } catch {
        /* best-effort; invites remain pending and are retried next load */
      }
    })()
  }, [isSignedIn])
}
