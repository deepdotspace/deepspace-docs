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
import type { ContentShareFields, DocumentFields } from './types'

type InviteRole = 'viewer' | 'editor'
type UserFields = {
  email?: string
  name?: string
  imageUrl?: string
}

type ShareRecord = RecordData<ContentShareFields>

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: RecordData<DocumentFields>
  shares: ShareRecord[]
  isOwner: boolean
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

function permissionForRole(role: InviteRole): string {
  return role === 'editor' ? 'edit' : 'view'
}

export function InviteDialog({ open, onOpenChange, doc, shares, isOwner }: InviteDialogProps) {
  const { user } = useUser()
  const { records: users } = useQuery<UserFields>('users')
  const { put } = useMutations<DocumentFields>('documents')
  const {
    create: createShare,
    put: putShare,
    remove: removeShare,
  } = useMutations<ContentShareFields>('content_shares')
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

  const metricsShare = shares.find((s) => s.data.ShareType === 'self') ?? shares[0]

  const saveAccess = async (nextCollaborators: string[], nextEditors: string[]) => {
    await put(doc.recordId, {
      ...doc.data,
      collaborators: JSON.stringify(uniqueIds(nextCollaborators)),
      editors: JSON.stringify(uniqueIds(nextEditors).filter((id) => nextCollaborators.includes(id))),
    })
  }

  const upsertTargetShare = async (target: RecordData<UserFields>, nextRole: InviteRole) => {
    const existing = shares.find(
      (s) => s.data.ShareTarget === target.recordId && s.data.ShareType !== 'self',
    )
    const now = new Date().toISOString()
    const permission = permissionForRole(nextRole)

    if (existing) {
      await putShare(existing.recordId, {
        ...existing.data,
        Permission: permission,
        Title: doc.data.title,
        LastEditedAt: metricsShare?.data.LastEditedAt ?? existing.data.LastEditedAt ?? now,
        WordCount: metricsShare?.data.WordCount ?? existing.data.WordCount ?? 0,
      })
      return
    }

    await createShare({
      ContentType: 'document',
      ContentId: doc.recordId,
      OwnerId: doc.data.ownerId,
      OwnerName: user?.name ?? user?.email ?? 'Owner',
      Title: doc.data.title,
      ShareType: 'direct',
      ShareTarget: target.recordId,
      Permission: permission,
      SharedAt: now,
      SharedBy: user?.id ?? doc.data.ownerId,
      SourceApp: 'docs2',
      WordCount: metricsShare?.data.WordCount ?? 0,
      LastEditedAt: metricsShare?.data.LastEditedAt ?? now,
    })
  }

  const removeTargetShares = async (userId: string) => {
    const targetShares = shares.filter(
      (s) => s.data.ShareTarget === userId && s.data.ShareType !== 'self',
    )
    await Promise.all(targetShares.map((s) => removeShare(s.recordId)))
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

    setSaving(true)
    try {
      const nextCollaborators = [...collaborators, target.recordId]
      const nextEditors = role === 'editor' ? [...editors, target.recordId] : editors
      await saveAccess(nextCollaborators, nextEditors)
      try {
        await upsertTargetShare(target, role)
      } catch (error) {
        await saveAccess(collaborators, editors).catch(() => {})
        throw error
      }
      setEmail('')
      toast.success('Invite added', `${target.data.email ?? normalized} now has ${role} access.`)
    } catch {
      toast.error('Invite failed', 'The document access list was not changed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const setCollaboratorRole = async (target: RecordData<UserFields>, nextRole: InviteRole) => {
    if (saving) return
    setSaving(true)
    try {
      const previousEditors = editors
      const nextEditors =
        nextRole === 'editor'
          ? uniqueIds([...editors, target.recordId])
          : editors.filter((id) => id !== target.recordId)
      await saveAccess(collaborators, nextEditors)
      try {
        await upsertTargetShare(target, nextRole)
      } catch (error) {
        await saveAccess(collaborators, previousEditors).catch(() => {})
        throw error
      }
    } catch {
      toast.error('Role update failed', 'The collaborator role was not changed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const removeCollaborator = async (userId: string) => {
    if (saving) return
    setSaving(true)
    try {
      const previousCollaborators = collaborators
      const previousEditors = editors
      await saveAccess(
        collaborators.filter((id) => id !== userId),
        editors.filter((id) => id !== userId),
      )
      try {
        await removeTargetShares(userId)
      } catch (error) {
        await saveAccess(previousCollaborators, previousEditors).catch(() => {})
        throw error
      }
    } catch {
      toast.error('Remove access failed', 'The collaborator still has their previous access.')
    } finally {
      setSaving(false)
    }
  }

  const ownerName =
    ownerRecord?.data.name?.trim() ||
    ownerRecord?.data.email?.trim() ||
    user?.name ||
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
                        void setCollaboratorRole(collaborator, e.target.value as InviteRole)
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
