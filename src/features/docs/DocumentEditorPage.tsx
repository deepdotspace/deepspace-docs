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
  useQuery,
  useMutations,
  useUser,
  useYjsRoom,
  getUserColor,
} from 'deepspace'
import {
  ArrowLeft,
  Users,
  Lock,
  Check,
  Link2,
  Download,
  Printer,
  List,
} from 'lucide-react'
import type { DocumentFields, ContentShareFields } from './types'
import {
  useDocEditor,
  EditorToolbar,
  FindReplaceBar,
  exportAndDownload,
  countWordsInDocument,
  DocEditorSurface,
  DocumentOutlinePanel,
  DOCUMENT_OUTLINE_WIDTH_PX,
  TYPICAL_WORDS_PER_PAGE,
  type ExportFormat,
} from './editor'
import { useEditorState, type Editor } from '@tiptap/react'

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
const CANVAS_ZOOM_MIN = 0.5
const CANVAS_ZOOM_MAX = 2
const CANVAS_ZOOM_STEP = 0.1

export default function DocumentEditorPage() {
  const params = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const browseMatch = location.pathname.match(/^\/browse\/([^/]+)/)
  const docPathMatch = location.pathname.match(/\/doc\/([^/]+)/)
  const docId = params.docId ?? docPathMatch?.[1]
  const backPath = browseMatch ? `/browse/${browseMatch[1]}` : '/'
  const { user } = useUser()

  const { records: docs, status: documentsQueryStatus } = useQuery<DocumentFields>('documents')
  const doc = docs?.find((d) => d.recordId === docId)

  const { records: allShares, status: sharesQueryStatus } = useQuery<ContentShareFields>('content_shares')
  const { put: putShare } = useMutations<ContentShareFields>('content_shares')
  const { put: putDocRecord } = useMutations<DocumentFields>('documents')

  const docShares = useMemo(
    () => (allShares ?? []).filter((s) => s.data.ContentId === docId),
    [allShares, docId],
  )
  const hasShareForDoc = docShares.length > 0
  const recordQueriesSettled =
    (documentsQueryStatus === 'ready' || documentsQueryStatus === 'error') &&
    (sharesQueryStatus === 'ready' || sharesQueryStatus === 'error')
  const selfShare = docShares.find((s) => s.data.ShareType === 'self') ?? docShares[0]
  const docTitle = useMemo(() => {
    const fromShare = selfShare?.data.Title?.trim()
    const fromRecord = doc?.data.title?.trim()
    if (fromShare) return fromShare
    if (fromRecord) return fromRecord
    return 'Untitled Document'
  }, [selfShare, doc])

  // Yjs connection — YjsRoom DO. We rely on the Y.Doc directly and let
  // Tiptap's Collaboration extension handle XML fragment sync. The `text`
  // field returned here is unused for the rich editor but keeps the hook
  // wired up for schema compatibility.
  const { doc: ydoc, synced, canWrite } = useYjsRoom(docId ?? 'unknown', 'content')

  // Yjs `canWrite` ignores `documents.visibility`. Also, link visitors often never receive the
  // owner’s app-scoped `documents` row (`doc` stays undefined), so we must not treat `!doc` as
  // "allow" for `/browse/.../doc/...` — otherwise make-private has no effect for them.
  const browseUserId = browseMatch?.[1]
  const contentOwnerId = selfShare?.data.OwnerId

  const policyAllowsWrite = useMemo(() => {
    if (doc) {
      if (doc.data.visibility === 'public') return true
      if (!user?.id) return false
      if (user.id === doc.data.ownerId) return true
      return docShares.some(
        (s) => s.data.ShareTarget === user.id && s.data.Permission === 'edit',
      )
    }

    if (browseUserId) {
      if (user?.id && user.id === browseUserId) return true
      return false
    }

    if (contentOwnerId) {
      if (user?.id && user.id === contentOwnerId) return true
      return false
    }

    return true
  }, [doc, user?.id, docShares, browseUserId, contentOwnerId])
  const effectiveCanWrite = canWrite && policyAllowsWrite

  const userName = user?.name ?? 'Anonymous'
  const userColor = useMemo(
    () => (user?.id ? getUserColor(user.id) : '#94a3b8'),
    [user?.id],
  )

  const editor = useDocEditor({
    doc: ydoc,
    userName,
    userColor,
    synced,
    canWrite: effectiveCanWrite,
  })

  const [linkCopied, setLinkCopied] = useState(false)
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
      return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.round(v * 100) / 100))
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
    const clamp = (z: number) =>
      Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.round(z * 100) / 100))

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
        setCanvasZoom((z) => clamp(z + CANVAS_ZOOM_STEP))
        return
      }
      setCanvasZoom((z) => clamp(z - CANVAS_ZOOM_STEP))
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Template prefill — URL carries `?template=<markdown or html>`; only apply if empty.
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

  if (!doc && !hasShareForDoc) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-40">Document</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Document not found</h2>
          <p className="text-sm text-muted-foreground mb-4">This document may have been deleted or you don&apos;t have access.</p>
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

  return (
    <div data-testid="app-root" className="h-full bg-background flex flex-col">
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
          canEdit={effectiveCanWrite}
          onSave={handleTitleSave}
        />

        <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="collaborator-avatars">
          <Users className="w-3.5 h-3.5 mr-1" />
        </div>

        {editor && <WordCountDisplay editor={editor} estPages={estPageCount} />}

        {effectiveCanWrite && user && doc?.data.visibility === 'public' && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/browse/${user.id}/doc/${docId}`
              navigator.clipboard.writeText(url).then(() => {
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              })
            }}
            data-testid="copy-share-link"
            title={linkCopied ? 'Copied!' : 'Copy share link'}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {linkCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />}
          </button>
        )}

        {editor && <ExportMenu editor={editor} title={docTitle} />}
      </div>

      {!effectiveCanWrite && (
        <div
          data-testid="readonly-banner"
          className="relative z-40 flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground print:hidden"
        >
          <Lock className="w-3.5 h-3.5" />
          {doc?.data.visibility === 'private' && !policyAllowsWrite
            ? 'This document is private. Only the owner and invited editors can make changes.'
            : 'You are viewing this document in read-only mode.'}
        </div>
      )}

      {/* Toolbar (sticky below header; z must stay below z-40 header) */}
      {editor && <EditorToolbar editor={editor} disabled={!effectiveCanWrite} />}

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
    </div>
  )
}
