/**
 * Document Editor Page
 *
 * Google-Docs style collaborative rich-text editor backed by a dedicated
 * YjsRoom Durable Object. Uses Tiptap + Yjs for real-time collaboration
 * with a full toolbar (undo/redo, formatting, headings, lists, tables,
 * links, images, find/replace, export, etc.).
 *
 * Document layout:
 *   - `documents` record (app RecordRoom): title, ownerId, visibility
 *   - `content_shares` record (workspace RecordRoom): cross-app metadata
 *     (title, wordCount, lastEditedAt)
 *   - YjsRoom DO keyed by docId: the actual rich-text content (Yjs XML fragment)
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  AuthOverlay,
  useQuery,
  useMutations,
  useUser,
  useAuth,
  getUserColor,
  usePresenceRoom,
} from 'deepspace'
import type { Transaction } from '@tiptap/pm/state'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import {
  ArrowLeft,
  Lock,
  Download,
  Printer,
  List,
  Share2,
} from 'lucide-react'
import type { DocumentFields, ContentShareFields } from './types'
import { Badge } from '../../components/ui'
import { InviteDialog } from './InviteDialog'
import {
  useDocEditor,
  FindReplaceBar,
  exportAndDownload,
  countWordsInDocument,
  DocEditorSurface,
  DocumentOutlinePanel,
  DOCUMENT_OUTLINE_WIDTH_PX,
  normalizeCanvasZoom,
  stepCanvasZoom,
  TYPICAL_WORDS_PER_PAGE,
  type ExportFormat,
} from './editor'
import EditorToolbar from './editor/EditorToolbar'
import { useEditorState, type Editor } from '@tiptap/react'
import { useYjsRoomWithAwareness } from './use-yjs-room-with-awareness'
import { DocsPresence, type DocsPresenceParticipant } from './DocsPresence'
import {
  buildDocsPresenceParticipants,
  PRESENCE_HEARTBEAT_MS,
  TYPING_IDLE_MS,
  TYPING_STALE_MS,
} from './docs-presence-utils'

function parseIdList(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function WordCountDisplay({ editor, estPages }: { editor: Editor; estPages: number }) {
  const wordCount = useEditorState({
    editor,
    selector: (snapshot) => countWordsInDocument(snapshot.editor.state.doc),
  })
  const perPage = estPages > 0 ? Math.round(wordCount / estPages) : 0
  return (
    <span
      className="text-xs text-muted-foreground tabular-nums"
      data-testid="word-count"
      title={`Letter 8.5"×11" area; body uses symmetric vertical padding. “Pages” = rough estimate (content height ÷ 11"). ~${TYPICAL_WORDS_PER_PAGE} words per full print page, varies by spacing.`}
    >
      {wordCount} words
      {estPages > 0 && (
        <>
          <span className="text-muted-foreground/50"> · </span>
          {estPages} pgs{perPage > 0 ? ` (~${perPage}/pg)` : ''}
        </>
      )}
    </span>
  )
}

function InlineTitle({
  title,
  canEdit,
  onSave,
}: {
  title: string
  canEdit: boolean
  onSave: (newTitle: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(title) }, [title])
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== title) onSave(trimmed)
    else setValue(title)
    setEditing(false)
  }

  if (!canEdit || !editing) {
    return (
      <h1
        className={`text-lg font-semibold text-foreground truncate flex-1 ${
          canEdit ? 'cursor-text hover:bg-muted/50 rounded px-1 -mx-1 transition-colors' : ''
        }`}
        onClick={() => canEdit && setEditing(true)}
        data-testid="doc-title"
        title={canEdit ? 'Click to rename' : undefined}
      >
        {title}
      </h1>
    )
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') { setValue(title); setEditing(false) }
      }}
      className="text-lg font-semibold text-foreground bg-background border border-input rounded px-2 py-0.5 outline-none focus:border-primary flex-1"
      data-testid="doc-title-input"
    />
  )
}

// ---------------------------------------------------------------------------
// Export Dropdown
// ---------------------------------------------------------------------------

function ExportMenu({ editor, title }: { editor: Editor; title: string }) {
  const [open, setOpen] = useState(false)

  const formats: { label: string; format: ExportFormat; icon: string }[] = [
    { label: 'Markdown (.md)', format: 'markdown', icon: 'M↓' },
    { label: 'HTML (.html)', format: 'html', icon: '</>' },
    { label: 'Plain Text (.txt)', format: 'text', icon: 'Aa' },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid="export-btn"
        title="Export document"
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Download className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-[60] mt-1 min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-lg">
            {formats.map(({ label, format, icon }) => (
              <button
                key={format}
                type="button"
                data-testid={`export-${format}`}
                onClick={() => {
                  exportAndDownload(editor, format, title)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors text-popover-foreground flex items-center gap-2"
              >
                <span className="text-xs font-mono w-6 text-muted-foreground">{icon}</span>
                {label}
              </button>
            ))}
            <div className="h-px bg-border my-1" />
            <button
              type="button"
              data-testid="export-print"
              onClick={() => {
                setOpen(false)
                window.print()
              }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors text-popover-foreground flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5 text-muted-foreground" />
              Print / Save as PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor Page
// ---------------------------------------------------------------------------

const CANVAS_ZOOM_STORAGE_KEY = 'docs2-editor-canvas-zoom'
const TYPING_PRESENCE_MIN_INTERVAL_MS = 750

function DocumentSignInPrompt({
  title,
  subtitle,
  onSignIn,
}: {
  title: string
  subtitle: string
  onSignIn: () => void
}) {
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-background/35 px-4 backdrop-blur-[2px] print:hidden">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-6 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Sign in required
        </p>
        <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mb-5 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        <button
          type="button"
          onClick={onSignIn}
          data-testid="document-sign-in-continue"
          className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Sign in to continue
        </button>
      </div>
    </div>
  )
}

function SignedOutDocumentPreview({
  title,
  onSignIn,
  showAuthModal,
  onCloseAuth,
}: {
  title: string
  onSignIn: () => void
  showAuthModal: boolean
  onCloseAuth: () => void
}) {
  return (
    <div data-testid="app-root" className="relative h-full overflow-hidden bg-background">
      <div className="h-full select-none opacity-80 blur-sm" aria-hidden="true">
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 py-3">
            <div className="h-7 w-7 rounded-lg bg-muted" />
            <div className="h-5 w-64 max-w-[55vw] rounded bg-muted" />
            <div className="ml-auto h-5 w-20 rounded bg-muted" />
          </div>
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-7 w-10 rounded-md bg-muted" />
            ))}
          </div>
          <div className="flex min-h-0 flex-1 bg-muted/30">
            <div className="hidden w-64 border-r border-border bg-card/50 p-4 lg:block">
              <div className="mb-4 h-4 w-24 rounded bg-muted" />
              <div className="space-y-3">
                <div className="h-3 w-44 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
                <div className="h-3 w-40 rounded bg-muted" />
              </div>
            </div>
            <div className="flex flex-1 justify-center overflow-hidden p-8">
              <div className="h-[900px] w-full max-w-[760px] rounded-sm bg-card p-12 shadow-xl">
                <div className="mb-8 h-8 w-2/3 rounded bg-muted" />
                <div className="space-y-4">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3 rounded bg-muted"
                      style={{ width: `${i % 4 === 0 ? 82 : i % 4 === 1 ? 94 : i % 4 === 2 ? 76 : 88}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <DocumentSignInPrompt
        title={title}
        subtitle="Sign in with DeepSpace to open this document and continue where you left off."
        onSignIn={onSignIn}
      />
      {showAuthModal && <AuthOverlay onClose={onCloseAuth} />}
    </div>
  )
}

export default function DocumentEditorPage() {
  const params = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const docPathMatch = location.pathname.match(/\/doc\/([^/]+)/)
  const docId = params.docId ?? docPathMatch?.[1]
  const backPath = '/'
  const { user } = useUser()
  const { isSignedIn } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const { records: docs, status: documentsQueryStatus } = useQuery<DocumentFields>('documents')
  const doc = docs?.find((d) => d.recordId === docId)

  const { records: allShares, status: sharesQueryStatus } = useQuery<ContentShareFields>('content_shares')
  const { put: putShare } = useMutations<ContentShareFields>('content_shares')
  const { put: putDocRecord } = useMutations<DocumentFields>('documents')

  const docShares = useMemo(
    () => (allShares ?? []).filter((s) => s.data.ContentId === docId),
    [allShares, docId],
  )
  const recordQueriesSettled =
    (documentsQueryStatus === 'ready' || documentsQueryStatus === 'error') &&
    (sharesQueryStatus === 'ready' || sharesQueryStatus === 'error')
  const targetShare = useMemo(
    () =>
      user?.id
        ? docShares.find(
            (s) =>
              s.data.ShareType !== 'self' &&
              s.data.ShareTarget === user.id &&
              s.data.OwnerId !== user.id,
          )
        : undefined,
    [docShares, user?.id],
  )
  const ownerShare = useMemo(
    () =>
      user?.id
        ? (docShares.find((s) => s.data.ShareType === 'self' && s.data.OwnerId === user.id) ??
          docShares.find((s) => s.data.OwnerId === user.id && !s.data.ShareTarget))
        : undefined,
    [docShares, user?.id],
  )
  const readableShare = targetShare ?? ownerShare
  const hasReadableShareForDoc = Boolean(readableShare)
  const selfShare = readableShare
  const docTitle = useMemo(() => {
    const fromShare = selfShare?.data.Title?.trim()
    const fromRecord = doc?.data.title?.trim()
    if (fromShare) return fromShare
    if (fromRecord) return fromRecord
    return 'Untitled Document'
  }, [selfShare, doc])

  const collaboratorIds = useMemo(
    () => parseIdList(doc?.data.collaborators),
    [doc?.data.collaborators],
  )
  const editorIds = useMemo(() => parseIdList(doc?.data.editors), [doc?.data.editors])
  const effectiveRole: 'owner' | 'editor' | 'viewer' | 'none' = useMemo(() => {
    if (!user?.id) return 'none'
    if (doc?.data.ownerId === user.id || ownerShare?.data.OwnerId === user.id) return 'owner'
    if (editorIds.includes(user.id) || targetShare?.data.Permission === 'edit') return 'editor'
    if (collaboratorIds.includes(user.id) || targetShare) return 'viewer'
    return 'none'
  }, [
    collaboratorIds,
    doc?.data.ownerId,
    editorIds,
    ownerShare?.data.OwnerId,
    targetShare,
    user?.id,
  ])
  const isOwner = effectiveRole === 'owner'
  const policyAllowsRead = effectiveRole !== 'none'
  const policyAllowsWrite = effectiveRole === 'owner' || effectiveRole === 'editor'

  const yjsAccessEnabled = Boolean(isSignedIn && docId && policyAllowsRead)
  // Yjs + awareness relay (MSG_AWARENESS) so CollaborationCaret / presence updates work.
  const { doc: ydoc, synced, canWrite, error: syncError, awareness } = useYjsRoomWithAwareness(
    docId ?? 'unknown',
    'content',
    yjsAccessEnabled,
  )
  const effectiveCanWrite = canWrite && policyAllowsWrite

  /** Presence peers (PresenceRoom DO) — online avatar strip independent of full Yjs sync ordering. */
  const presenceScopeId = yjsAccessEnabled && docId ? `doc:${docId}` : '_'
  const { peers: presencePeers, connected: presenceConnected, updateState: updatePresenceState } =
    usePresenceRoom(presenceScopeId)

  const userName = user?.name ?? 'Anonymous'
  const userColor = useMemo(
    () => (user?.id ? getUserColor(user.id) : '#94a3b8'),
    [user?.id],
  )

  const editor = useDocEditor({
    doc: ydoc,
    awareness,
    userName,
    userColor,
    synced,
    canWrite: effectiveCanWrite,
  })

  const typingRef = useRef(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPresenceSignatureRef = useRef<string | null>(null)
  const lastTypingPresenceAtRef = useRef(0)
  const [awarenessTick, setAwarenessTick] = useState(0)

  const presenceParticipants = useMemo(
    () =>
      buildDocsPresenceParticipants(
        presencePeers,
        user ?? undefined,
        effectiveCanWrite,
        awareness.clientID,
      ),
    [presencePeers, user, effectiveCanWrite, awareness.clientID],
  )

  const visiblePresenceParticipants = useMemo(() => {
    const participants = [...presenceParticipants]
    const seenUserIds = new Set(participants.map((participant) => participant.userId))

    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return
      const remoteUser = state.user as
        | { id?: string; name?: string; email?: string; imageUrl?: string }
        | undefined
      const userId = remoteUser?.id ?? `awareness:${clientId}`
      if (seenUserIds.has(userId)) return
      seenUserIds.add(userId)

      const participant: DocsPresenceParticipant = {
        clientId,
        userId,
        name: remoteUser?.name?.trim() || remoteUser?.email?.trim() || 'Collaborator',
        mode: state.mode === 'view' ? 'view' : 'edit',
        typing: state.typing === true,
        isSelf: false,
      }
      if (remoteUser?.email) participant.email = remoteUser.email
      if (remoteUser?.imageUrl) participant.imageUrl = remoteUser.imageUrl
      if (typeof state.lastTypedAt === 'number') participant.lastTypedAt = state.lastTypedAt
      participants.push(participant)
    })

    return participants
  }, [awareness, awareness.clientID, awarenessTick, presenceParticipants])

  useEffect(() => {
    const onAwarenessChange = () => setAwarenessTick((tick) => tick + 1)
    awareness.on('change', onAwarenessChange)
    return () => {
      awareness.off('change', onAwarenessChange)
    }
  }, [awareness])

  const typingNames = useMemo(() => {
    const names: string[] = []
    const seen = new Set<string>()
    const pushName = (raw: string | undefined) => {
      const name = raw?.trim()
      if (!name || seen.has(name)) return
      seen.add(name)
      names.push(name)
    }

    const isFreshAwarenessTyping = (lastTypedAt: unknown, typing: unknown): boolean => {
      if (typing !== true) return false
      if (typeof lastTypedAt === 'number' && Date.now() - lastTypedAt >= TYPING_STALE_MS) {
        return false
      }
      return true
    }

    const awarenessStates = awareness.getStates()
    for (const participant of visiblePresenceParticipants) {
      if (participant.isSelf) continue
      const presenceTyping =
        participant.typing === true &&
        (participant.lastTypedAt == null || Date.now() - participant.lastTypedAt < TYPING_STALE_MS)

      let awarenessTyping = false
      for (const [clientId, state] of awarenessStates) {
        if (clientId === awareness.clientID) continue
        const remoteUser = state.user as { id?: string } | undefined
        if (remoteUser?.id !== participant.userId) continue
        if (isFreshAwarenessTyping(state.lastTypedAt, state.typing)) {
          awarenessTyping = true
          break
        }
      }

      if (presenceTyping || awarenessTyping) pushName(participant.name)
    }

    awarenessStates.forEach((state, clientId) => {
      if (clientId === awareness.clientID) return
      if (!isFreshAwarenessTyping(state.lastTypedAt, state.typing)) return
      const remoteUser = state.user as { id?: string; name?: string } | undefined
      const remoteUserId = remoteUser?.id
      if (
        remoteUserId &&
        visiblePresenceParticipants.some((participant) => !participant.isSelf && participant.userId === remoteUserId)
      ) {
        return
      }
      pushName(remoteUser?.name)
    })

    return names
  }, [awareness, awareness.clientID, awarenessTick, visiblePresenceParticipants])

  const publishPresence = useCallback(
    (typing: boolean, options: { force?: boolean } = {}) => {
      if (!docId || !user) {
        if (synced) awareness.setLocalState(null)
        return
      }

      const now = Date.now()
      const mode = effectiveCanWrite ? 'edit' : 'view'
      const signature = `${user.id}:${mode}:${typing}`
      const recentlyPublishedTyping =
        typing && now - lastTypingPresenceAtRef.current < TYPING_PRESENCE_MIN_INTERVAL_MS
      if (
        !options.force &&
        lastPresenceSignatureRef.current === signature &&
        (!typing || recentlyPublishedTyping)
      ) {
        return
      }
      if (typing) lastTypingPresenceAtRef.current = now
      lastPresenceSignatureRef.current = signature

      updatePresenceState({
        mode,
        typing,
        ...(typing ? { lastTypedAt: now } : {}),
      })

      // Yjs awareness powers TipTap collaboration carets. setLocalState replaces the
      // whole object, so merge to preserve the caret extension's cursor field.
      if (!synced) return

      const name = user.name || user.email || 'Anonymous'
      const previousState = awareness.getLocalState()
      const nextState: Record<string, unknown> = previousState ? { ...previousState } : {}
      nextState.user = {
        name,
        color: userColor,
        id: user.id,
        email: user.email,
        imageUrl: user.imageUrl,
      }
      nextState.mode = mode
      nextState.typing = typing
      if (typing) {
        nextState.lastTypedAt = now
      } else {
        delete nextState.lastTypedAt
      }

      awareness.setLocalState(nextState)
    },
    [awareness, docId, effectiveCanWrite, synced, updatePresenceState, user, userColor],
  )

  useEffect(() => {
    publishPresence(typingRef.current, { force: true })
  }, [publishPresence, presenceConnected])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      try {
        awareness.setLocalState(null)
      } catch {
        /* ignore */
      }
    }
  }, [awareness])

  useEffect(() => {
    if (!synced || !docId || !user) return
    const intervalId = window.setInterval(() => {
      publishPresence(typingRef.current, { force: true })
    }, PRESENCE_HEARTBEAT_MS)
    return () => clearInterval(intervalId)
  }, [synced, docId, user, publishPresence])

  const markTyping = useCallback(() => {
    if (!user || !effectiveCanWrite || !synced) return
    typingRef.current = true
    publishPresence(true)

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      typingRef.current = false
      publishPresence(false)
    }, TYPING_IDLE_MS)
  }, [user, effectiveCanWrite, publishPresence, synced])

  const stopTyping = useCallback(() => {
    typingRef.current = false
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    publishPresence(false, { force: true })
  }, [publishPresence])

  useEffect(() => {
    if (!editor || !effectiveCanWrite || !synced || !user) return

    const onUpdate = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return
      if (transaction.getMeta(ySyncPluginKey)) return
      markTyping()
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor, effectiveCanWrite, synced, user, markTyping])

  useEffect(() => {
    if (!editor || !synced || !user) return

    const publishCurrentPresence = () => publishPresence(typingRef.current)
    editor.on('focus', publishCurrentPresence)
    editor.on('selectionUpdate', publishCurrentPresence)
    editor.on('blur', stopTyping)

    return () => {
      editor.off('focus', publishCurrentPresence)
      editor.off('selectionUpdate', publishCurrentPresence)
      editor.off('blur', stopTyping)
    }
  }, [editor, publishPresence, stopTyping, synced, user])

  const [inviteOpen, setInviteOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem('docs2-editor-outline-open') !== '0'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('docs2-editor-outline-open', outlineOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [outlineOpen])

  /** Zoom only the page canvas (not header/toolbar); Cmd/Ctrl +/- / 0. Uses CSS `zoom` where supported. */
  const [canvasZoom, setCanvasZoom] = useState(() => {
    if (typeof window === 'undefined') return 1
    try {
      const raw = sessionStorage.getItem(CANVAS_ZOOM_STORAGE_KEY)
      const v = raw == null ? 1 : Number.parseFloat(raw)
      if (!Number.isFinite(v)) return 1
      return normalizeCanvasZoom(v)
    } catch {
      return 1
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(CANVAS_ZOOM_STORAGE_KEY, String(canvasZoom))
    } catch {
      /* ignore */
    }
  }, [canvasZoom])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      const zoomIn =
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd'
      const zoomOut =
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract'
      const zoomReset = e.key === '0' && !e.shiftKey

      if (!zoomIn && !zoomOut && !zoomReset) return

      e.preventDefault()
      e.stopPropagation()

      if (zoomReset) {
        setCanvasZoom(1)
        return
      }
      if (zoomIn) {
        setCanvasZoom((z) => stepCanvasZoom(z, 1))
        return
      }
      setCanvasZoom((z) => stepCanvasZoom(z, -1))
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Template prefill — URL carries `?template=<HTML fragment>` (TipTap parses strings as HTML); only apply if empty.
  const templateApplied = useRef(false)
  useEffect(() => {
    if (!editor || !synced || templateApplied.current) return
    const templateContent = searchParams.get('template')
    if (templateContent) {
      templateApplied.current = true
      if (editor.isEmpty) {
        editor.commands.setContent(templateContent)
      }
      setSearchParams({}, { replace: true })
    }
  }, [editor, synced, searchParams, setSearchParams])

  // Debounced metadata sync (wordCount + lastEditedAt) onto content_shares.
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const metaPendingRef = useRef(false)
  const docSharesRef = useRef(docShares)
  docSharesRef.current = docShares
  const editorRef = useRef(editor)
  editorRef.current = editor
  const canWriteRef = useRef(effectiveCanWrite)
  canWriteRef.current = effectiveCanWrite

  const [estPageCount, setEstPageCount] = useState(1)
  const onPageCountChange = useCallback((n: number) => {
    setEstPageCount((prev) => (prev === n ? prev : n))
  }, [])
  const putShareRef = useRef(putShare)
  putShareRef.current = putShare
  const docIdRef = useRef(docId)
  docIdRef.current = docId

  const flushShareMeta = useCallback(() => {
    metaPendingRef.current = false
    const ed = editorRef.current
    const id = docIdRef.current
    if (!ed || !canWriteRef.current || !id) return
    const words = countWordsInDocument(ed.state.doc)
    const now = new Date().toISOString()
    for (const share of docSharesRef.current) {
      putShareRef.current(share.recordId, {
        ...share.data,
        WordCount: words,
        LastEditedAt: now,
      }).catch(() => {})
    }
  }, [])

  const handleUpdate = useCallback(() => {
    if (!editor || !effectiveCanWrite || !docId) return
    clearTimeout(metaTimerRef.current)
    metaPendingRef.current = true
    metaTimerRef.current = setTimeout(flushShareMeta, 2000)
  }, [editor, effectiveCanWrite, docId, flushShareMeta])

  useEffect(() => {
    if (!editor) return
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, handleUpdate])

  useEffect(() => {
    return () => {
      clearTimeout(metaTimerRef.current)
      if (metaPendingRef.current) {
        metaPendingRef.current = false
        flushShareMeta()
      }
    }
  }, [flushShareMeta])

  const handleTitleSave = useCallback(
    async (newTitle: string) => {
      if (doc) {
        void putDocRecord(doc.recordId, { ...doc.data, title: newTitle }).catch(() => {})
      }
      for (const share of docShares) {
        putShare(share.recordId, {
          ...share.data,
          Title: newTitle,
        }).catch(() => {})
      }
    },
    [doc, docShares, putDocRecord, putShare],
  )

  // Share-link visitors never get the owner’s `documents` row; access is via `content_shares`.
  // `documents` is often `[]` while loading, which is still truthy — do not show "not found" until
  // both list queries have settled, then require either a doc record or a share for this content.
  if (!recordQueriesSettled) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <div className="text-muted-foreground text-sm">Loading document…</div>
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <SignedOutDocumentPreview
        title="Private document"
        onSignIn={() => setShowAuthModal(true)}
        showAuthModal={showAuthModal}
        onCloseAuth={() => setShowAuthModal(false)}
      />
    )
  }

  if (doc && !policyAllowsRead) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="max-w-sm px-4 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground mb-2">This document is private</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Ask the owner for an invite to view or edit this document.
          </p>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-hover transition-colors"
          >
            Back to documents
          </button>
        </div>
      </div>
    )
  }

  if (!doc && !hasReadableShareForDoc) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="max-w-sm px-4 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground mb-2">This document is private</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Ask the owner for an invite to view or edit this document.
          </p>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-hover transition-colors"
          >
            Back to documents
          </button>
        </div>
      </div>
    )
  }

  if (syncError) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="max-w-sm px-4 text-center">
          <Lock className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Unable to open document</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your account does not currently have access to this document, or the sync room is unavailable.
          </p>
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary-hover transition-colors"
          >
            Back to documents
          </button>
        </div>
      </div>
    )
  }

  if (!synced) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <div className="text-muted-foreground text-sm">Connecting to document...</div>
        </div>
      </div>
    )
  }

  const editorContent = (
    <>
      {/* Title bar — must stack above the sticky toolbar (z-30) so export/menus are not covered */}
      <div className="relative z-40 flex shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur-sm print:hidden">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          data-testid="back-btn"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Back to documents"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <InlineTitle
          title={docTitle}
          canEdit={isOwner}
          onSave={handleTitleSave}
        />

        <DocsPresence participants={visiblePresenceParticipants} typingNames={typingNames} />

        {editor && <WordCountDisplay editor={editor} estPages={estPageCount} />}

        {isOwner && doc ? (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            data-testid="share-doc-btn"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Share this document"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        ) : effectiveRole === 'editor' ? (
          <Badge variant="default" className="shrink-0 text-xs">Editor</Badge>
        ) : effectiveRole === 'viewer' ? (
          <Badge variant="secondary" className="shrink-0 text-xs">Viewer</Badge>
        ) : null}

        {editor && <ExportMenu editor={editor} title={docTitle} />}
      </div>

      {!effectiveCanWrite && (
        <div
          data-testid="readonly-banner"
          className="relative z-40 flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground print:hidden"
        >
          <Lock className="w-3.5 h-3.5" />
          {effectiveRole === 'viewer'
            ? 'You have view-only access to this document. Ask the owner for editor access.'
            : doc?.data.visibility === 'private' && !policyAllowsWrite
              ? 'This document is private. Only the owner and invited editors can make changes.'
              : 'You are viewing this document in read-only mode.'}
        </div>
      )}

      {/* Toolbar (sticky below header; z must stay below z-40 header) */}
      {editor && (
        <EditorToolbar
          editor={editor}
          disabled={!effectiveCanWrite}
          canvasZoom={canvasZoom}
          onCanvasZoomChange={setCanvasZoom}
        />
      )}

      {/* Editor canvas: full-width page; outline floats over the left edge */}
      <div className="relative z-0 flex min-h-0 flex-1 flex-col print:block">
        {editor && (
          <>
            <DocumentOutlinePanel editor={editor} open={outlineOpen} />
            <button
              type="button"
              onClick={() => setOutlineOpen((o) => !o)}
              data-testid="toggle-outline"
              title={outlineOpen ? 'Hide document outline' : 'Show document outline'}
              style={{
                top: 12,
                left: outlineOpen ? DOCUMENT_OUTLINE_WIDTH_PX + 10 : 12,
              }}
              className={`absolute z-[35] flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-md backdrop-blur-md transition-[left,box-shadow,background-color,color] duration-200 ease-out hover:bg-card hover:text-foreground hover:shadow-lg print:hidden ${
                outlineOpen ? 'text-foreground' : ''
              }`}
            >
              <List className="h-4 w-4" strokeWidth={2} />
            </button>
            <FindReplaceBar editor={editor} />
            <div
              data-testid="doc-canvas-zoom"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:[zoom:1]"
              style={{ zoom: canvasZoom }}
            >
              <DocEditorSurface editor={editor} onPageCountChange={onPageCountChange} />
            </div>
          </>
        )}
      </div>
      {doc ? (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          doc={doc}
          shares={docShares}
          isOwner={isOwner}
        />
      ) : null}
    </>
  )

  if (!isSignedIn) {
    return (
      <div data-testid="app-root" className="relative h-full overflow-hidden bg-background">
        <div className="pointer-events-none h-full select-none blur-sm" aria-hidden="true">
          <div className="h-full bg-background flex flex-col">{editorContent}</div>
        </div>
        <DocumentSignInPrompt
          title={docTitle}
          subtitle="This public document is protected until you sign in. Continue with DeepSpace to view it."
          onSignIn={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
      </div>
    )
  }

  return (
    <div data-testid="app-root" className="h-full bg-background flex flex-col">
      {editorContent}
    </div>
  )
}
