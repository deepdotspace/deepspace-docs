import { getUserColor } from 'deepspace'

export type CollaborationUser = {
  name?: string | null
  color?: string | null
  userId?: string | null
  email?: string | null
}

const DISALLOWED_COLLABORATION_COLORS = new Set([
  '#fff',
  '#ffff',
  '#ffffff',
  '#ffffffff',
  'white',
  'rgb(255, 255, 255)',
  'rgba(255, 255, 255, 1)',
])

export function collaborationColorFor(user: CollaborationUser, clientId?: number): string {
  const color = user.color?.trim()
  if (color && !DISALLOWED_COLLABORATION_COLORS.has(color.toLowerCase())) {
    return color
  }
  const id =
    user.userId?.trim() ||
    (clientId != null ? `yjs-client:${clientId}` : 'anonymous')
  return getUserColor(id)
}

export function collaborationDisplayName(user: CollaborationUser): string {
  const name = user.name?.trim()
  if (name && name !== 'Anonymous') return name
  const email = user.email?.trim()
  if (email) return email
  return 'Guest'
}

/** Normalize awareness `user` payload for caret rendering. */
export function resolveCollaborationUser(
  aw: Record<string, unknown>,
  clientId: number,
): CollaborationUser {
  const raw =
    typeof aw.user === 'object' && aw.user != null
      ? (aw.user as Record<string, unknown>)
      : {}

  const user: CollaborationUser = {
    name: typeof raw.name === 'string' ? raw.name : null,
    color: typeof raw.color === 'string' ? raw.color : null,
    userId: typeof raw.userId === 'string' ? raw.userId : null,
    email: typeof raw.email === 'string' ? raw.email : null,
  }

  return {
    ...user,
    name: collaborationDisplayName(user),
    color: collaborationColorFor(user, clientId),
  }
}
