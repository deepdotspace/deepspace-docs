import type { PresencePeerClient } from 'deepspace'
import type { DocsPresenceParticipant } from './DocsPresence'

export const TYPING_IDLE_MS = 1600
export const TYPING_STALE_MS = 5000
/** Re-broadcast presence so clients who connect later still see existing viewers. */
export const PRESENCE_HEARTBEAT_MS = 25_000

/** Stable numeric id for React keys (PresenceRoom peers are not keyed by Yjs clientId). */
export function clientIdFromUserId(userId: string): number {
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}

function peerToDocsParticipant(p: PresencePeerClient): DocsPresenceParticipant {
  const state = p.state
  const mode: DocsPresenceParticipant['mode'] = state.mode === 'view' ? 'view' : 'edit'
  const lastTypedAt = typeof state.lastTypedAt === 'number' ? state.lastTypedAt : undefined
  const participant: DocsPresenceParticipant = {
    clientId: clientIdFromUserId(p.userId),
    userId: p.userId,
    name: p.userName?.trim() || p.userEmail?.trim() || 'Guest',
    mode,
    typing: state.typing === true,
    isSelf: false,
  }
  if (p.userEmail) participant.email = p.userEmail
  if (p.userImageUrl) participant.imageUrl = p.userImageUrl
  if (lastTypedAt != null) participant.lastTypedAt = lastTypedAt
  return participant
}

function sortDocsPresenceParticipants(a: DocsPresenceParticipant, b: DocsPresenceParticipant): number {
  if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
  if (a.mode !== b.mode) return a.mode === 'edit' ? -1 : 1
  return a.name.localeCompare(b.name)
}

export interface DocsPresenceSelfUser {
  id: string
  name?: string | null
  email?: string | null
  imageUrl?: string | null
}

export function buildDocsPresenceParticipants(
  peers: PresencePeerClient[],
  self: DocsPresenceSelfUser | null | undefined,
  effectiveCanWrite: boolean,
  selfAwarenessClientId: number,
): DocsPresenceParticipant[] {
  if (!self) {
    return [...peers.map(peerToDocsParticipant)].sort(sortDocsPresenceParticipants)
  }

  const selfRow: DocsPresenceParticipant = {
    clientId: selfAwarenessClientId,
    userId: self.id,
    name: self.name?.trim() || self.email?.trim() || 'You',
    mode: effectiveCanWrite ? 'edit' : 'view',
    isSelf: true,
  }
  if (self.email) selfRow.email = self.email
  if (self.imageUrl) selfRow.imageUrl = self.imageUrl

  const others = peers.filter((p) => p.userId !== self.id).map(peerToDocsParticipant)
  return [selfRow, ...others].sort(sortDocsPresenceParticipants)
}
