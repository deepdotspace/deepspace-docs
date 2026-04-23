/**
 * Document List Page
 *
 * Shows the caller's own documents or another user's public documents.
 * Includes search, sort, templates, favorites, and grid/list views.
 *
 * Usage:
 *   <DocumentListPage />                      // own docs
 *   <DocumentListPage browseUserId="..." />   // another user's public docs
 *
 * Metadata (title, wordCount, lastEditedAt) lives on `content_shares`
 * (workspace:default DO). The `documents` record holds content (title),
 * ownerId, and visibility. Rich content is stored in a per-doc YjsRoom
 * DO — see `DocumentEditorPage`.
 */

import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutations, useUser, type RecordData } from 'deepspace'
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  Lock,
  Globe,
  ArrowLeft,
  Share2,
  Star,
  LayoutGrid,
  LayoutList,
  FileDown,
  Link2,
  Check,
  SortAsc,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from '../../hooks'
import { Modal, SearchInput } from '../../components/ui'
import {
  TEMPLATES,
  SORT_OPTIONS,
  type DocumentFields,
  type ContentShareFields,
  type DocTemplate,
  type SortOption,
  type ViewMode,
} from './types'
import { getFavorites, saveFavorites } from './favorites'

type Share = RecordData<ContentShareFields>

// ---------------------------------------------------------------------------
// Sort utility
// ---------------------------------------------------------------------------

function sortShares(shares: Share[], sortBy: SortOption): Share[] {
  const sorted = [...shares]
  switch (sortBy) {
    case 'lastEdited':
      return sorted.sort((a, b) => (b.data.LastEditedAt ?? '').localeCompare(a.data.LastEditedAt ?? ''))
    case 'titleAZ':
      return sorted.sort((a, b) => (a.data.Title ?? '').localeCompare(b.data.Title ?? ''))
    case 'titleZA':
      return sorted.sort((a, b) => (b.data.Title ?? '').localeCompare(a.data.Title ?? ''))
    case 'created':
      return sorted.sort((a, b) => (b.data.SharedAt ?? '').localeCompare(a.data.SharedAt ?? ''))
    case 'wordCount':
      return sorted.sort((a, b) => (b.data.WordCount ?? 0) - (a.data.WordCount ?? 0))
    default:
      return sorted
  }
}

export interface DocumentListPageProps {
  /** If provided, show another user's public docs instead of the caller's own. */
  browseUserId?: string
}

export default function DocumentListPage({ browseUserId }: DocumentListPageProps = {}) {
  const navigate = useNavigate()
  const { user } = useUser()
  const { theme, toggle: toggleTheme } = useTheme()

  const isOwnScope = !browseUserId

  const { records: documents } = useQuery<DocumentFields>('documents')
  const { create, put, remove } = useMutations<DocumentFields>('documents')

  const { records: allShares } = useQuery<ContentShareFields>('content_shares')
  const { create: createShare, put: putShare, remove: removeShare } = useMutations<ContentShareFields>('content_shares')

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('lastEdited')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [favorites, setFavoritesState] = useState<Set<string>>(getFavorites)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const docPath = (docId: string) =>
    browseUserId ? `/browse/${browseUserId}/doc/${docId}` : `/doc/${docId}`

  const docLookup = useMemo(() => {
    const map = new Map<string, RecordData<DocumentFields>>()
    for (const d of documents ?? []) map.set(d.recordId, d)
    return map
  }, [documents])

  const myShares = useMemo(() => {
    if (!user?.id) return []
    const byContentId = new Map<string, Share>()
    for (const s of allShares ?? []) {
      if (s.data.ContentType !== 'document' || s.data.OwnerId !== user.id) continue
      if (!docLookup.has(s.data.ContentId)) continue
      const existing = byContentId.get(s.data.ContentId)
      if (!existing || s.data.ShareType === 'self') {
        byContentId.set(s.data.ContentId, s)
      }
    }
    return Array.from(byContentId.values())
  }, [allShares, user?.id, docLookup])

  const filterBySearch = (shares: Share[]) => {
    if (!searchQuery.trim()) return shares
    const q = searchQuery.toLowerCase()
    return shares.filter((s) => s.data.Title?.toLowerCase().includes(q))
  }

  const privateDocs = useMemo(
    () => myShares.filter((s) => {
      const doc = docLookup.get(s.data.ContentId)
      return !doc || doc.data.visibility !== 'public'
    }),
    [myShares, docLookup],
  )
  const publicDocs = useMemo(
    () => myShares.filter((s) => {
      const doc = docLookup.get(s.data.ContentId)
      return doc?.data.visibility === 'public'
    }),
    [myShares, docLookup],
  )
  const favoriteDocs = useMemo(
    () => myShares.filter((s) => favorites.has(s.data.ContentId)),
    [myShares, favorites],
  )

  // Browse mode: show public docs owned by `browseUserId`.
  // Server-side RBAC (visibilityField on the documents schema) already
  // hides private docs from viewers, so we just match to existing records.
  const browseDocs = useMemo(() => {
    if (!browseUserId) return []
    const byContentId = new Map<string, Share>()
    for (const s of allShares ?? []) {
      if (s.data.ContentType !== 'document' || s.data.OwnerId !== browseUserId) continue
      if (!docLookup.has(s.data.ContentId)) continue
      const existing = byContentId.get(s.data.ContentId)
      if (!existing || s.data.ShareType === 'self') {
        byContentId.set(s.data.ContentId, s)
      }
    }
    return Array.from(byContentId.values())
  }, [allShares, browseUserId, docLookup])

  const sharesForContent = useCallback(
    (contentId: string) => (allShares ?? []).filter((s) => s.data.ContentId === contentId),
    [allShares],
  )

  const toggleFavorite = useCallback((e: React.MouseEvent, contentId: string) => {
    e.stopPropagation()
    setFavoritesState((prev) => {
      const next = new Set(prev)
      if (next.has(contentId)) next.delete(contentId)
      else next.add(contentId)
      saveFavorites(next)
      return next
    })
  }, [])

  const handleCreate = useCallback(async (template?: DocTemplate) => {
    if (!user) return
    const title = template?.name ?? 'Untitled Document'
    const now = new Date().toISOString()
    const recordId = await create({
      title,
      ownerId: user.id,
      visibility: 'private',
    })
    await createShare({
      ContentType: 'document',
      ContentId: recordId,
      OwnerId: user.id,
      OwnerName: user.name ?? 'Anonymous',
      Title: title,
      ShareType: 'self',
      ShareTarget: '',
      Permission: 'edit',
      SharedAt: now,
      SharedBy: user.id,
      SourceApp: 'docs2',
      WordCount: 0,
      LastEditedAt: now,
    })
    const query = template ? `?template=${encodeURIComponent(template.content)}` : ''
    navigate(docPath(recordId) + query)
  }, [create, createShare, navigate, user])

  const handleCreateFromTemplate = useCallback(
    async (template: DocTemplate) => {
      setShowTemplates(false)
      await handleCreate(template)
    },
    [handleCreate],
  )

  const handleCopyLink = useCallback(
    (e: React.MouseEvent, share: Share) => {
      e.stopPropagation()
      if (!user) return
      const url = `${window.location.origin}/browse/${user.id}/doc/${share.data.ContentId}`
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(share.data.ContentId)
        setTimeout(() => setCopiedId(null), 2000)
      })
    },
    [user],
  )

  const handleDelete = useCallback(
    async (e: React.MouseEvent, contentId: string) => {
      e.stopPropagation()
      if (!confirm('Delete this document?')) return
      await remove(contentId)
      const shares = sharesForContent(contentId)
      await Promise.all(shares.map((s) => removeShare(s.recordId)))
    },
    [remove, removeShare, sharesForContent],
  )

  const handleStartRename = useCallback(
    (e: React.MouseEvent, share: Share) => {
      e.stopPropagation()
      setRenamingId(share.data.ContentId)
      setRenameValue(share.data.Title)
    },
    [],
  )

  const handleRename = useCallback(
    async (contentId: string) => {
      const trimmed = renameValue.trim()
      if (trimmed) {
        const doc = docLookup.get(contentId)
        if (doc) {
          await put(contentId, { ...doc.data, title: trimmed }).catch(() => {})
        }
        const shares = sharesForContent(contentId)
        await Promise.all(
          shares.map((s) => putShare(s.recordId, { ...s.data, Title: trimmed })),
        )
      }
      setRenamingId(null)
    },
    [put, putShare, renameValue, sharesForContent, docLookup],
  )

  const handleToggleVisibility = useCallback(
    async (e: React.MouseEvent, share: Share) => {
      e.stopPropagation()
      const doc = docLookup.get(share.data.ContentId)
      if (!doc) return
      const newVisibility = doc.data.visibility === 'public' ? 'private' : 'public'
      await put(share.data.ContentId, { ...doc.data, visibility: newVisibility })
    },
    [put, docLookup],
  )

  const canModify = isOwnScope

  // -------------------------------------------------------------------------
  // Doc card (grid)
  // -------------------------------------------------------------------------
  function DocCard({ share }: { share: Share }) {
    const doc = docLookup.get(share.data.ContentId)
    const visibility = doc?.data.visibility ?? 'private'
    const contentId = share.data.ContentId
    const isFav = favorites.has(contentId)

    return (
      <div
        key={contentId}
        data-testid={`doc-card-${contentId}`}
        onClick={() => navigate(docPath(contentId))}
        className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-card transition-all group"
      >
        <div className="flex items-start justify-between mb-3">
          {renamingId === contentId ? (
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRename(contentId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(contentId)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-input rounded px-2 py-1 text-sm text-foreground outline-none focus:border-primary flex-1 mr-2"
              autoFocus
              data-testid={`rename-input-${contentId}`}
            />
          ) : (
            <h3 className="font-semibold text-foreground truncate flex-1 mr-2">
              {share.data.Title}
            </h3>
          )}

          {isOwnScope && renamingId !== contentId && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => toggleFavorite(e, contentId)}
                data-testid={`fav-btn-${contentId}`}
                className={`p-1 rounded-md transition-colors ${
                  isFav
                    ? 'text-yellow-500'
                    : 'text-muted-foreground/0 group-hover:text-muted-foreground hover:text-yellow-500'
                }`}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-yellow-500' : ''}`} />
              </button>

              {canModify && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleToggleVisibility(e, share)}
                    data-testid={`visibility-btn-${contentId}`}
                    className={`p-1.5 rounded-md transition-colors ${
                      visibility === 'public'
                        ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    title={visibility === 'public' ? 'Make private' : 'Make public'}
                  >
                    {visibility === 'public' ? (
                      <Globe className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleCopyLink(e, share)}
                      data-testid={`copy-link-btn-${contentId}`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title={copiedId === contentId ? 'Copied!' : 'Copy share link'}
                    >
                      {copiedId === contentId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(e, share)}
                      data-testid={`rename-doc-btn-${contentId}`}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, contentId)}
                      data-testid={`delete-doc-btn-${contentId}`}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {visibility === 'public' ? (
              <Globe className="w-3 h-3 text-emerald-500" />
            ) : (
              <Lock className="w-3 h-3" />
            )}
            {visibility === 'public' ? 'Public' : 'Private'}
          </span>
          <span>·</span>
          <span>{share.data.WordCount ?? 0} words</span>
          <span>·</span>
          <span>
            {share.data.LastEditedAt
              ? new Date(share.data.LastEditedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never edited'}
          </span>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Doc row (list)
  // -------------------------------------------------------------------------
  function DocRow({ share }: { share: Share }) {
    const doc = docLookup.get(share.data.ContentId)
    const visibility = doc?.data.visibility ?? 'private'
    const contentId = share.data.ContentId
    const isFav = favorites.has(contentId)

    return (
      <div
        data-testid={`doc-card-${contentId}`}
        onClick={() => navigate(docPath(contentId))}
        className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/40 hover:shadow-card transition-all group"
      >
        <button
          type="button"
          onClick={(e) => toggleFavorite(e, contentId)}
          className={`p-0.5 transition-colors ${
            isFav ? 'text-yellow-500' : 'text-transparent group-hover:text-muted-foreground'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-yellow-500' : ''}`} />
        </button>

        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="font-medium text-foreground truncate flex-1">
          {share.data.Title}
        </span>

        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 w-20">
          {visibility === 'public' ? (
            <Globe className="w-3 h-3 text-emerald-500" />
          ) : (
            <Lock className="w-3 h-3" />
          )}
          {visibility === 'public' ? 'Public' : 'Private'}
        </span>

        <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
          {share.data.WordCount ?? 0} words
        </span>

        <span className="text-xs text-muted-foreground w-32 text-right">
          {share.data.LastEditedAt
            ? new Date(share.data.LastEditedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>

        {canModify && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              type="button"
              onClick={(e) => handleCopyLink(e, share)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={copiedId === contentId ? 'Copied!' : 'Copy share link'}
            >
              {copiedId === contentId ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => handleStartRename(e, share)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Rename"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(e, contentId)}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Section renderer
  // -------------------------------------------------------------------------
  function DocSection({ title, icon, shares, testId }: {
    title: string
    icon?: React.ReactNode
    shares: Share[]
    testId: string
  }) {
    const filtered = filterBySearch(shares)
    const sorted = sortShares(filtered, sortBy)

    if (sorted.length === 0 && searchQuery) return null
    if (sorted.length === 0 && title !== 'My Documents') return null

    return (
      <section className="mb-10">
        <h2
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"
          data-testid={testId}
        >
          {icon}
          {title}
          {sorted.length > 0 && (
            <span className="text-xs font-normal">({sorted.length})</span>
          )}
        </h2>
        {sorted.length === 0 ? (
          <div
            data-testid="empty-state"
            className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          >
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">
              {canModify
                ? 'Create your first document to get started.'
                : 'No documents yet.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((share) => <DocCard key={share.data.ContentId} share={share} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((share) => <DocRow key={share.data.ContentId} share={share} />)}
          </div>
        )}
      </section>
    )
  }

  function ControlsBar() {
    return (
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search documents..."
            data-testid="doc-search"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            data-testid="sort-dropdown"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <SortAsc className="w-3.5 h-3.5" />
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
          </button>
          {showSortDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)} />
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`sort-${opt.value}`}
                    onClick={() => {
                      setSortBy(opt.value)
                      setShowSortDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                      sortBy === opt.value ? 'text-primary font-medium' : 'text-popover-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            data-testid="view-grid"
            className={`p-2 transition-colors ${
              viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            data-testid="view-list"
            className={`p-2 transition-colors ${
              viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title="List view"
          >
            <LayoutList className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  function TemplatePicker() {
    return (
      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} size="lg">
        <Modal.Header>
          <Modal.Title>Choose a Template</Modal.Title>
          <Modal.Description>Start with a pre-built document structure</Modal.Description>
        </Modal.Header>
        <Modal.Body>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => handleCreateFromTemplate(template)}
                data-testid={`template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-card transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono bg-primary/20 text-primary rounded px-1.5 py-0.5">{template.icon}</span>
                  <h3 className="font-semibold text-foreground">{template.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </button>
            ))}
          </div>
        </Modal.Body>
      </Modal>
    )
  }

  // -------------------------------------------------------------------------
  // Browse mode
  // -------------------------------------------------------------------------
  if (!isOwnScope) {
    const filtered = filterBySearch(browseDocs)
    const sorted = sortShares(filtered, sortBy)
    return (
      <div data-testid="app-root" className="h-full bg-background overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                data-testid="back-to-own-btn"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Back to your documents"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-2xl font-bold text-foreground">Public Documents</h1>
            </div>
          </div>

          <ControlsBar />

          {sorted.length === 0 ? (
            <div
              data-testid="empty-state"
              className="flex flex-col items-center justify-center py-20 text-muted-foreground"
            >
              <FileText className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-lg mb-1">No documents yet</p>
              <p className="text-sm">This user has no public documents.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div data-testid="doc-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((share) => <DocCard key={share.data.ContentId} share={share} />)}
            </div>
          ) : (
            <div data-testid="doc-list" className="flex flex-col gap-2">
              {sorted.map((share) => <DocRow key={share.data.ContentId} share={share} />)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Own-scope view
  // -------------------------------------------------------------------------
  const sharedWithMe = (allShares ?? [])
    .filter((s) => s.data.ContentType === 'document' && s.data.OwnerId !== user?.id)
    .sort((a, b) => (b.data.SharedAt ?? '').localeCompare(a.data.SharedAt ?? ''))

  return (
    <div data-testid="app-root" className="h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              data-testid="theme-toggle"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {canModify && (
              <>
                <button
                  type="button"
                  onClick={() => setShowTemplates(true)}
                  data-testid="templates-btn"
                  className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                >
                  <FileDown className="w-4 h-4" />
                  Templates
                </button>
                <button
                  type="button"
                  onClick={() => handleCreate()}
                  data-testid="create-doc-btn"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Document
                </button>
              </>
            )}
          </div>
        </div>

        <ControlsBar />

        <div data-testid="doc-list">
          {favoriteDocs.length > 0 && (
            <DocSection
              title="Favorites"
              icon={<Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              shares={favoriteDocs}
              testId="favorites-heading"
            />
          )}

          <DocSection
            title="My Documents"
            shares={privateDocs}
            testId="my-docs-heading"
          />

          <DocSection
            title="Published"
            icon={<Globe className="w-4 h-4 text-emerald-500" />}
            shares={publicDocs}
            testId="published-docs-heading"
          />
        </div>

        {sharedWithMe.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2" data-testid="shared-docs-heading">
              <Share2 className="w-4 h-4 text-blue-500" />
              Shared with me
            </h2>
            <div data-testid="shared-doc-list" className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2'}>
              {sharedWithMe.map((share) => (
                <div
                  key={share.recordId}
                  data-testid={`shared-doc-card-${share.data.ContentId}`}
                  onClick={() => navigate(`/browse/${share.data.OwnerId}/doc/${share.data.ContentId}`)}
                  className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-card transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-foreground truncate flex-1 mr-2">
                      {share.data.Title}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      share.data.Permission === 'edit'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {share.data.Permission === 'edit' ? 'Can edit' : 'View only'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Share2 className="w-3 h-3 text-blue-500" />
                      {share.data.OwnerName}
                    </span>
                    <span>·</span>
                    <span>{share.data.WordCount ?? 0} words</span>
                    <span>·</span>
                    <span>
                      {share.data.LastEditedAt
                        ? new Date(share.data.LastEditedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                    {share.data.SourceApp && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{share.data.SourceApp}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <TemplatePicker />
    </div>
  )
}
