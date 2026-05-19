import { useMemo, useState } from 'react'
import type { RecordData } from 'deepspace'
import { useMutations, useQuery, useUser } from 'deepspace'
import { Check, Link2, Mail, ShieldCheck, UserMinus, Users } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  useToast,
} from '../../components/ui'
import type { DocumentFields } from './types'

type InviteRole = 'viewer' | 'editor'
type UserFields = {
  email?: string
  name?: string
  imageUrl?: string
}

/**
 * Diff that resulted from an InviteDialog save. The editor page rebroadcasts
 * this over the doc's presence channel so the affected peer gets the change
 * even when the docs schema's `read: 'collaborator'` rule prevents the
 * `documents` record update from reaching a now-removed user.
 */
export interface InviteAclDiff {
  /** Users dropped from `collaborators` entirely. */
  removedUserIds: string[]
  /** Users who lost the editor role but remain collaborators (now viewers). */
  demotedUserIds: string[]
  /** Existing collaborators who gained the editor role. */
  promotedUserIds: string[]
}

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: RecordData<DocumentFields>
  isOwner: boolean
  /**
   * Called after a save mutation that changed the ACL. The parent uses it to
   * publish a one-shot permission-change signal over the doc's presence room
   * so peers (including ones who just lost read access to the doc record)
   * can react immediately instead of waiting for the next refresh.
   */
  onAclChange?: (diff: InviteAclDiff) => void
}

function parseIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function InviteDialog({ open, onOpenChange, doc, isOwner, onAclChange }: InviteDialogProps) {
  const { user } = useUser()
  const { records: users } = useQuery<UserFields>('users')
  const { put } = useMutations<DocumentFields>('documents')
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const collaborators = useMemo(() => parseIds(doc.data.collaborators), [doc.data.collaborators])
  const editors = useMemo(() => parseIds(doc.data.editors), [doc.data.editors])

  const ownerRecord = useMemo(
    () => users.find((u) => u.recordId === doc.data.ownerId),
    [doc.data.ownerId, users],
  )

  const collaboratorRecords = useMemo(
    () =>
      collaborators
        .map((id) => users.find((u) => u.recordId === id))
        .filter((u): u is RecordData<UserFields> => Boolean(u)),
    [collaborators, users],
  )

  if (!isOwner) return null

  const saveAccess = async (nextCollaborators: string[], nextEditors: string[]) => {
    const prevCollaborators = parseIds(doc.data.collaborators)
    const prevEditors = parseIds(doc.data.editors)
    const nextCollabList = uniqueIds(nextCollaborators)
    const nextCollabSet = new Set(nextCollabList)
    const nextEditorList = uniqueIds(nextEditors).filter((id) => nextCollabSet.has(id))
    const nextEditorSet = new Set(nextEditorList)

    setSaving(true)
    try {
      await put(doc.recordId, {
        ...doc.data,
        collaborators: JSON.stringify(nextCollabList),
        editors: JSON.stringify(nextEditorList),
      })

      if (onAclChange) {
        const removedUserIds = prevCollaborators.filter((id) => !nextCollabSet.has(id))
        const demotedUserIds = prevEditors.filter(
          (id) => nextCollabSet.has(id) && !nextEditorSet.has(id),
        )
        const promotedUserIds = nextEditorList.filter(
          (id) => prevCollaborators.includes(id) && !prevEditors.includes(id),
        )
        if (removedUserIds.length || demotedUserIds.length || promotedUserIds.length) {
          onAclChange({ removedUserIds, demotedUserIds, promotedUserIds })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const addInvite = async () => {
    const normalized = email.trim().toLowerCase()
    if (!normalized || saving) return

    const target = users.find((u) => u.data.email?.trim().toLowerCase() === normalized)
    if (!target) {
      toast.error('User not found', 'No DeepSpace user with that email has used this app yet.')
      return
    }
    if (target.recordId === doc.data.ownerId || target.recordId === user?.id) {
      toast.info('Already has access', 'That user is the document owner.')
      return
    }
    if (collaborators.includes(target.recordId)) {
      toast.info('Already invited', `${target.data.email ?? normalized} already has access.`)
      return
    }

    try {
      const nextCollaborators = [...collaborators, target.recordId]
      const nextEditors = role === 'editor' ? [...editors, target.recordId] : editors
      await saveAccess(nextCollaborators, nextEditors)
      setEmail('')
      toast.success('Invite added', `${target.data.email ?? normalized} now has ${role} access.`)
    } catch {
      toast.error('Invite failed', 'The document access list was not changed. Please try again.')
    }
  }

  const setCollaboratorRole = async (userId: string, nextRole: InviteRole) => {
    if (saving) return
    try {
      const nextEditors =
        nextRole === 'editor'
          ? uniqueIds([...editors, userId])
          : editors.filter((id) => id !== userId)
      await saveAccess(collaborators, nextEditors)
    } catch {
      toast.error('Role update failed', 'The collaborator role was not changed. Please try again.')
    }
  }

  const removeCollaborator = async (userId: string) => {
    if (saving) return
    try {
      await saveAccess(
        collaborators.filter((id) => id !== userId),
        editors.filter((id) => id !== userId),
      )
    } catch {
      toast.error('Remove access failed', 'The collaborator still has their previous access.')
    }
  }

  /**
   * "Anonymous" is the SDK's placeholder when a WS connect arrives with
   * no `userName` query param. Treat it the same as a missing name so we
   * fall through to email instead of leaking the sentinel into the share
   * dialog. The new worker.ts forwards JWT claims on every connect, so
   * after one fresh socket every users-row is rewritten with the real
   * name and this fallback only matters for stale rows.
   */
  const realName = (raw: string | null | undefined): string | null => {
    const trimmed = raw?.trim()
    if (!trimmed || trimmed === 'Anonymous') return null
    return trimmed
  }
  const ownerName =
    realName(ownerRecord?.data.name) ||
    ownerRecord?.data.email?.trim() ||
    realName(user?.name) ||
    user?.email ||
    'Owner'

  const copyPrivateLink = async () => {
    const url = `${window.location.origin}/doc/${doc.recordId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-el-line bg-el-surface text-el-text">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Invite DeepSpace users by the email address on their account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-col gap-2 rounded-xl border border-el-line p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Private link</div>
              <p className="text-xs text-el-muted">
                Only invited DeepSpace users can open this link.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void copyPrivateLink()}
              data-testid="copy-private-share-link"
              className="h-9 shrink-0"
            >
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>

          <div className="rounded-xl border border-el-line p-3">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-el-muted">
              Add people
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-el-muted" />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addInvite()
                  }}
                  placeholder="person@gmail.com"
                  data-testid="share-email-input"
                  className="h-10 border-el-line bg-transparent pl-9 text-el-text"
                />
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                data-testid="share-role-select"
                className="h-10 rounded-lg border border-el-line bg-el-surface px-3 text-sm font-medium text-el-text outline-none focus-visible:ring-2 focus-visible:ring-el-accent/30"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button
                type="button"
                onClick={() => void addInvite()}
                disabled={saving || !email.trim()}
                data-testid="share-add-btn"
                className="h-10"
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-el-muted" />
              <h3 className="text-sm font-semibold">People with access</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-el-line p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-el-bg text-xs font-bold">
                  {initialsFor(ownerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{ownerName}</div>
                  <div className="truncate text-xs text-el-muted">
                    {ownerRecord?.data.email ?? user?.email ?? 'Owner'}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-el-line px-2.5 py-1 text-xs font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Owner
                </span>
              </div>

              {collaboratorRecords.map((collaborator) => {
                const name =
                  collaborator.data.name?.trim() || collaborator.data.email?.trim() || 'Collaborator'
                const userRole: InviteRole = editors.includes(collaborator.recordId)
                  ? 'editor'
                  : 'viewer'
                return (
                  <div
                    key={collaborator.recordId}
                    className="flex items-center gap-3 rounded-xl border border-el-line p-3"
                  >
                    {collaborator.data.imageUrl ? (
                      <img
                        src={collaborator.data.imageUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-el-bg text-xs font-bold">
                        {initialsFor(name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{name}</div>
                      <div className="truncate text-xs text-el-muted">
                        {collaborator.data.email ?? 'No email'}
                      </div>
                    </div>
                    <select
                      value={userRole}
                      onChange={(e) =>
                        void setCollaboratorRole(collaborator.recordId, e.target.value as InviteRole)
                      }
                      disabled={saving}
                      data-testid={`share-role-${collaborator.recordId}`}
                      className="h-8 rounded-lg border border-el-line bg-el-surface px-2 text-xs font-medium text-el-text outline-none"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void removeCollaborator(collaborator.recordId)}
                      disabled={saving}
                      className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      title="Remove access"
                      aria-label={`Remove access for ${name}`}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}

              {collaboratorRecords.length === 0 ? (
                <p className="rounded-xl border border-el-line p-3 text-sm text-el-muted">
                  Only the owner can access this document.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
