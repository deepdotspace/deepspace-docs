/**
 * Document Editor Page
 *
 * Collaborative markdown/plain-text editor backed by a dedicated YjsRoom
 * Durable Object. We intentionally use a simple `<textarea>` (with
 * `useYjsText`) instead of the Miyagi3 Tiptap editor — `@spaces/editor`
 * does not exist in the DeepSpace SDK, so richer features (toolbar,
 * comments, find/replace, exports) were dropped from the Miyagi3 port.
 *
 * Document layout:
 *   - `documents` record (app RecordRoom): title, ownerId, visibility
 *   - `content_shares` record (workspace RecordRoom): cross-app metadata
 *     (title, wordCount, lastEditedAt)
 *   - YjsRoom DO keyed by docId: the actual text content
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  useQuery,
  useMutations,
  useUser,
  useYjsRoom,
  getUserColor,
  type RecordData,
} from 'deepspace'
import {
  ArrowLeft,
  Users,
  Lock,
  Sun,
  Moon,
  Check,
  Link2,
} from 'lucide-react'
import { useTheme } from '../../hooks'
import type { DocumentFields, ContentShareFields } from './types'

type Share = RecordData<ContentShareFields>

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

export default function DocumentEditorPage() {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const browseMatch = location.pathname.match(/^\/browse\/([^/]+)/)
  const backPath = browseMatch ? `/browse/${browseMatch[1]}` : '/'
  const { user } = useUser()
  const { theme, toggle: toggleTheme } = useTheme()

  const { records: docs } = useQuery<DocumentFields>('documents')
  const doc = docs?.find((d) => d.recordId === docId)

  const { records: allShares } = useQuery<ContentShareFields>('content_shares')
  const { put: putShare } = useMutations<ContentShareFields>('content_shares')

  const docShares = useMemo(
    () => (allShares ?? []).filter((s) => s.data.ContentId === docId),
    [allShares, docId],
  )
  const selfShare = docShares.find((s) => s.data.ShareType === 'self') ?? docShares[0]
  const docTitle = selfShare?.data.Title ?? 'Document'

  const { text, setText, synced, canWrite } = useYjsRoom(docId ?? 'unknown', 'content')

  const userName = user?.name ?? 'Anonymous'
  const userColor = useMemo(
    () => (user?.id ? getUserColor(user.id) : '#94a3b8'),
    [user?.id],
  )
  void userName
  void userColor

  const [linkCopied, setLinkCopied] = useState(false)

  // Template prefill — URL carries `?template=<markdown>`; only apply if empty.
  const templateApplied = useRef(false)
  useEffect(() => {
    if (!synced || templateApplied.current) return
    const templateContent = searchParams.get('template')
    if (templateContent) {
      templateApplied.current = true
      if (!text) setText(templateContent)
      setSearchParams({}, { replace: true })
    }
  }, [synced, text, searchParams, setText, setSearchParams])

  // Debounced metadata sync (wordCount + lastEditedAt) onto content_shares.
  const metaTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const docSharesRef = useRef(docShares)
  docSharesRef.current = docShares

  useEffect(() => {
    if (!canWrite || !docId || !synced) return
    clearTimeout(metaTimerRef.current)
    metaTimerRef.current = setTimeout(() => {
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      const now = new Date().toISOString()
      for (const share of docSharesRef.current) {
        putShare(share.recordId, {
          ...share.data,
          WordCount: words,
          LastEditedAt: now,
        }).catch(() => {})
      }
    }, 2000)
    return () => clearTimeout(metaTimerRef.current)
  }, [text, canWrite, docId, synced, putShare])

  const handleTitleSave = useCallback(
    async (newTitle: string) => {
      for (const share of docShares) {
        putShare(share.recordId, {
          ...share.data,
          Title: newTitle,
        }).catch(() => {})
      }
    },
    [docShares, putShare],
  )

  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  )

  if (docs && !doc) {
    return (
      <div data-testid="app-root" className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-40">Document</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Document not found</h2>
          <p className="text-sm text-muted-foreground mb-4">This document may have been deleted or you don't have access.</p>
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/60 backdrop-blur-sm">
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
          canEdit={canWrite}
          onSave={handleTitleSave}
        />

        <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="collaborator-avatars">
          <Users className="w-3.5 h-3.5 mr-1" />
        </div>

        <span className="text-xs text-muted-foreground tabular-nums" data-testid="word-count">
          {wordCount} words
        </span>

        {canWrite && user && doc?.data.visibility === 'public' && (
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

        <button
          type="button"
          onClick={toggleTheme}
          data-testid="theme-toggle"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {!canWrite && (
        <div
          data-testid="readonly-banner"
          className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border text-sm text-muted-foreground"
        >
          <Lock className="w-3.5 h-3.5" />
          You are viewing this document in read-only mode.
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 lg:px-12 py-8">
          <textarea
            data-testid="editor-content"
            value={text}
            onChange={(e) => canWrite && setText(e.target.value)}
            readOnly={!canWrite}
            placeholder={canWrite ? 'Start writing...' : ''}
            className="w-full min-h-[60vh] bg-transparent text-foreground text-base leading-relaxed outline-none resize-none font-mono"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  )
}
