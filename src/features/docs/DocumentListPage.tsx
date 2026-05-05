/**
 * Document List Page
 *
 * Shows the caller's own documents or invite-only shared documents.
 * Includes search, sort, templates, favorites, and grid/list views.
 *
 * Usage:
 *   <DocumentListPage />                      // own docs
 *
 * Metadata (title, last edited, share fields, etc.) lives on `content_shares`
 * (workspace:default DO). The `documents` record holds content (title),
 * ownerId, and visibility. Rich content is stored in a per-doc YjsRoom
 * DO — see `DocumentEditorPage`.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  useQuery,
  useMutations,
  useUser,
  useAuth,
  AuthOverlay,
  signOut,
  type RecordData,
} from 'deepspace'
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  Lock,
  Share2,
  Star,
  LayoutGrid,
  LayoutList,
  FileDown,
  Link2,
  Check,
  SortAsc,
  Folder,
  ChevronRight,
  MoreVertical,
} from 'lucide-react'
import { DocumentPreview } from './DocumentPreview'
import {
  LibrarySidebar,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from './LibrarySidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Modal,
  SearchInput,
  UserProfileButton,
} from '../../components/ui'
import {
  TEMPLATES,
  SORT_OPTIONS,
  type DocumentFields,
  type DocFolderFields,
  type ContentShareFields,
  type DocTemplate,
  type LibraryNavSelection,
  type SortOption,
  type ViewMode,
} from './types'
import { getFavorites, saveFavorites } from './favorites'

type Share = RecordData<ContentShareFields>

function parseShareIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Own-docs list table: meta columns — header + DocRow must stay identical */
const OWN_LIST_META_GAP = 'gap-6'
const OWN_COL_VISIBILITY = 'w-28 shrink-0'
const OWN_COL_OWNER = 'w-32 shrink-0 min-w-0'
const OWN_COL_MODIFIED = 'w-36 shrink-0 text-right'
const OWN_COL_ACTIONS = 'w-10 shrink-0'

/** Shared-with-me list table */
const SHARED_LIST_META_GAP = 'gap-8'
const SHARED_COL_OWNER = 'w-36 shrink-0 min-w-0'
const SHARED_COL_MODIFIED = 'w-36 shrink-0 text-right'
const SHARED_COL_APP = 'w-20 shrink-0'
const SHARED_COL_ACCESS = 'w-24 shrink-0 flex justify-end'

const FOLDER_SHORTCUT_RENAME_BLUR_DEFER_MS = 200
const FOLDER_SHORTCUT_RENAME_BLUR_GRACE_MS = 520

function SignedOutLibraryGate({
  onSignIn,
  showAuthModal,
  onCloseAuth,
}: {
  onSignIn: () => void
  showAuthModal: boolean
  onCloseAuth: () => void
}) {
  const previewCards = ['Project plan', 'Meeting notes', 'Product brief', 'Research notes']

  return (
    <div
      data-testid="app-root"
      className="relative flex min-h-full overflow-hidden bg-el-bg selection:bg-el-accent/20"
    >
      <div className="pointer-events-none flex min-h-full w-full select-none opacity-80 blur-sm" aria-hidden="true">
        <aside className="hidden w-72 shrink-0 border-r border-el-line bg-el-surface/70 p-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-el-accent/10 text-el-accent">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="h-4 w-24 rounded bg-el-line" />
              <div className="mt-2 h-3 w-32 rounded bg-el-line/70" />
            </div>
          </div>
          <div className="space-y-2">
            {['All documents', 'Favorites', 'Uncategorized'].map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  i === 0 ? 'bg-el-accent/10' : 'bg-transparent'
                }`}
              >
                <div className="h-4 w-4 rounded bg-el-line" />
                <div className="h-3 w-32 rounded bg-el-line" />
              </div>
            ))}
          </div>
          <div className="mt-8">
            <div className="mb-3 h-3 w-20 rounded bg-el-line" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2">
                  <Folder className="h-4 w-4 text-el-muted" />
                  <div className="h-3 w-28 rounded bg-el-line" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="px-6 pb-10 pt-9 md:px-12 md:pb-12 md:pt-10 lg:px-16 lg:pb-16 lg:pt-10">
            <div className="mb-8 flex min-w-0 items-center justify-between gap-4">
              <div>
                <div className="h-10 w-72 rounded bg-el-line" />
                <div className="mt-3 h-4 w-44 rounded bg-el-line/80" />
              </div>
              <div className="h-9 w-24 rounded-full bg-el-accent" />
            </div>
            <div className="mb-10 flex gap-3">
              <div className="h-11 flex-1 rounded-xl bg-el-surface" />
              <div className="h-11 w-32 rounded-xl bg-el-surface" />
              <div className="h-11 w-32 rounded-xl bg-el-accent" />
            </div>
            <div className="mb-6 flex items-center justify-between">
              <div className="h-3 w-28 rounded bg-el-line" />
              <div className="h-9 w-36 rounded-lg bg-el-surface" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {previewCards.map((title, i) => (
                <div key={title} className="rounded-xl border border-el-line bg-el-surface p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <FileText className="h-5 w-5 text-el-muted" />
                    <div className="h-6 w-14 rounded-full bg-el-line" />
                  </div>
                  <div className="mb-3 h-4 rounded bg-el-line" style={{ width: `${60 + i * 8}%` }} />
                  <div className="space-y-2">
                    <div className="h-3 rounded bg-el-line/80" />
                    <div className="h-3 w-4/5 rounded bg-el-line/80" />
                    <div className="h-3 w-2/3 rounded bg-el-line/80" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <div className="absolute inset-0 z-30 flex items-center justify-center bg-el-bg/35 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-2xl border border-el-line bg-el-surface/95 p-6 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-el-accent/10 text-el-accent">
            <Lock className="h-5 w-5" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-el-muted">
            Welcome to Docs2
          </p>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-el-text">Sign in to continue</h1>
          <p className="mb-5 text-sm leading-6 text-el-muted">
            Your document library stays ready in the background. Sign in with DeepSpace to view and edit your docs.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            data-testid="library-sign-in-continue"
            className="w-full rounded-full bg-el-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Sign in to continue
          </button>
        </div>
      </div>

      {showAuthModal && <AuthOverlay onClose={onCloseAuth} />}
    </div>
  )
}

function FolderShortcutRenameField({
  folderId,
  renameFolderValue,
  setRenameFolderValue,
  commitRenameFolderRef,
  cancelRenameFolder,
  blurTimerRef,
  sessionStartRef,
  testId,
}: {
  folderId: string
  renameFolderValue: string
  setRenameFolderValue: (v: string) => void
  commitRenameFolderRef: MutableRefObject<() => void | Promise<void>>
  cancelRenameFolder: () => void
  blurTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  sessionStartRef: MutableRefObject<number>
  testId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const t =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    sessionStartRef.current = t
    const el = inputRef.current
    if (!el) return
    const placeCaretAtEnd = () => {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
    el.focus({ preventScroll: true })
    placeCaretAtEnd()
    const raf = requestAnimationFrame(() => {
      if (document.activeElement !== el) {
        el.focus({ preventScroll: true })
        placeCaretAtEnd()
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [folderId])

  return (
    <input
      ref={inputRef}
      value={renameFolderValue}
      onChange={(e) => setRenameFolderValue(e.target.value)}
      onFocus={() => {
        if (blurTimerRef.current) {
          clearTimeout(blurTimerRef.current)
          blurTimerRef.current = null
        }
      }}
      onBlur={() => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
        blurTimerRef.current = setTimeout(() => {
          blurTimerRef.current = null
          const t0 = sessionStartRef.current
          const now =
            typeof performance !== 'undefined' ? performance.now() : Date.now()
          if (now - t0 < FOLDER_SHORTCUT_RENAME_BLUR_GRACE_MS) return
          void commitRenameFolderRef.current()
        }, FOLDER_SHORTCUT_RENAME_BLUR_DEFER_MS)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current)
            blurTimerRef.current = null
          }
          void commitRenameFolderRef.current()
        }
        if (e.key === 'Escape') {
          if (blurTimerRef.current) {
            clearTimeout(blurTimerRef.current)
            blurTimerRef.current = null
          }
          cancelRenameFolder()
        }
      }}
      data-testid={testId}
      className="min-w-0 flex-1 rounded-md border border-el-line bg-el-bg px-2 py-1.5 text-[13px] font-semibold text-el-text outline-none focus-visible:ring-2 focus-visible:ring-el-accent/30"
    />
  )
}

function greetingForTime(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

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

function filterSharesBySearch(shares: Share[], searchQuery: string): Share[] {
  if (!searchQuery.trim()) return shares
  const q = searchQuery.toLowerCase()
  return shares.filter((s) => s.data.Title?.toLowerCase().includes(q))
}

function formatShareDate(share: Share): string {
  return share.data.LastEditedAt
    ? new Date(share.data.LastEditedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'
}

function DocumentDescription({
  ownerLabel,
  dateLabel,
}: {
  ownerLabel: string
  dateLabel: string
}) {
  return (
    <div className="mt-0.5 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium leading-4 tracking-tight text-el-muted">
      <span className="inline-flex shrink-0 items-center gap-1">
        <Lock className="h-3 w-3" />
        Private
      </span>
      <span className="shrink-0 text-el-muted/70">&middot;</span>
      <span className="shrink-0 whitespace-nowrap">{dateLabel}</span>
      <span className="shrink-0 text-el-muted/70">&middot;</span>
      <span className="min-w-0 max-w-full truncate">{ownerLabel}</span>
    </div>
  )
}

function SharedDocumentDescription({
  ownerName,
  dateLabel,
  sourceApp,
}: {
  ownerName: string
  dateLabel: string
  sourceApp?: string
}) {
  return (
    <div className="mt-0.5 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-medium leading-4 tracking-tight text-el-muted">
      <span className="inline-flex shrink-0 items-center text-blue-500">
        <Share2 className="h-3 w-3" />
      </span>
      <span className="shrink-0 text-el-muted/70">&middot;</span>
      <span className="shrink-0 whitespace-nowrap">{dateLabel}</span>
      <span className="shrink-0 text-el-muted/70">&middot;</span>
      <span className="min-w-0 max-w-full truncate text-blue-500">{ownerName}</span>
      {sourceApp && (
        <>
          <span className="shrink-0 text-el-muted/70">&middot;</span>
          <span className="shrink-0 capitalize">{sourceApp}</span>
        </>
      )}
    </div>
  )
}

type DocumentActionsMenuProps = {
  share: Share
  isFav: boolean
  docLookup: Map<string, RecordData<DocumentFields>>
  sortedFolders: RecordData<DocFolderFields>[]
  canModify: boolean
  copiedId: string | null
  toggleFavoriteById: (contentId: string) => void
  handleMoveDocToFolder: (contentId: string, folderId: string) => void | Promise<void>
  copyShareLink: (share: Share) => void | Promise<void>
  startRename: (share: Share) => void
  deleteDocument: (contentId: string) => void | Promise<void>
}

function DocumentActionsMenu({
  share,
  isFav,
  docLookup,
  sortedFolders,
  canModify,
  copiedId,
  toggleFavoriteById,
  handleMoveDocToFolder,
  copyShareLink,
  startRename,
  deleteDocument,
}: DocumentActionsMenuProps) {
  const contentId = share.data.ContentId
  const doc = docLookup.get(contentId)
  const currentF = doc?.data.folderId ?? ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          data-testid={`doc-actions-btn-${contentId}`}
          className="rounded-lg p-1.5 text-el-muted transition-colors hover:bg-el-bg hover:text-el-text data-[state=open]:bg-el-bg data-[state=open]:text-el-text"
          title="Document actions"
          aria-label={`Actions for ${share.data.Title}`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[190px] border-el-line bg-el-surface text-el-text"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] text-el-muted">
          Document actions
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => toggleFavoriteById(contentId)}
          data-testid={`fav-btn-${contentId}`}
        >
          <Star className={`h-4 w-4 ${isFav ? 'fill-yellow-500 text-yellow-500' : ''}`} />
          {isFav ? 'Remove favorite' : 'Add favorite'}
        </DropdownMenuItem>
        {canModify && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <Folder className="h-4 w-4" />
                Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[180px] border-el-line bg-el-surface text-el-text">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={currentF === ''}
                  onSelect={() => void handleMoveDocToFolder(contentId, '')}
                >
                  Uncategorized
                </DropdownMenuItem>
                {sortedFolders.map((f) => (
                  <DropdownMenuItem
                    key={f.recordId}
                    className="cursor-pointer"
                    disabled={currentF === f.recordId}
                    onSelect={() => void handleMoveDocToFolder(contentId, f.recordId)}
                  >
                    {f.data.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => void copyShareLink(share)}
              data-testid={`copy-link-btn-${contentId}`}
            >
              {copiedId === contentId ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {copiedId === contentId ? 'Copied link' : 'Copy private link'}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => startRename(share)}
              data-testid={`rename-doc-btn-${contentId}`}
            >
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600"
              onSelect={() => void deleteDocument(contentId)}
              data-testid={`delete-doc-btn-${contentId}`}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type OwnDocTileSharedProps = {
  docLookup: Map<string, RecordData<DocumentFields>>
  favorites: Set<string>
  isOwnScope: boolean
  canPreview: boolean
  userName: string | undefined
  onOpenDoc: (contentId: string) => void
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  handleRename: (contentId: string) => void
  setRenamingId: (v: string | null) => void
  renderActions?: (share: Share) => ReactNode
}

function DocCard({ share, ...tile }: OwnDocTileSharedProps & { share: Share }) {
  const {
    docLookup,
    isOwnScope,
    canPreview,
    userName,
    onOpenDoc,
    renamingId,
    renameValue,
    setRenameValue,
    handleRename,
    setRenamingId,
    renderActions,
  } = tile
  const contentId = share.data.ContentId
  const ownerLabel = isOwnScope ? (userName ?? 'Me') : (share.data.OwnerName ?? 'User')
  const dateLabel = formatShareDate(share)

  return (
    <motion.div
      data-testid={`doc-card-${contentId}`}
      onClick={() => onOpenDoc(contentId)}
      whileHover={{ y: -2 }}
      className="animate-etheris-fade-in group cursor-pointer rounded-xl border border-el-line bg-el-surface p-4 shadow-sm transition-all hover:border-el-accent/35 hover:shadow-md"
    >
      <DocumentPreview docId={contentId} variant="grid" canPreview={canPreview} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
              className="mb-0.5 w-full rounded-md border border-el-line bg-el-bg px-2 py-1 text-[13px] font-semibold text-el-text outline-none focus-visible:ring-2 focus-visible:ring-el-accent/30"
              autoFocus
              data-testid={`rename-input-${contentId}`}
            />
          ) : (
            <h3 className="truncate text-[13px] font-semibold leading-snug text-el-text transition-colors group-hover:text-el-accent">
              {share.data.Title}
            </h3>
          )}
          <DocumentDescription
            ownerLabel={ownerLabel}
            dateLabel={dateLabel}
          />
        </div>

        {isOwnScope && renamingId !== contentId && renderActions && (
          <div className="shrink-0">{renderActions(share)}</div>
        )}
      </div>
    </motion.div>
  )
}

function DocRow({ share, ...tile }: OwnDocTileSharedProps & { share: Share }) {
  const {
    docLookup,
    isOwnScope,
    canPreview,
    userName,
    onOpenDoc,
    renamingId,
    renameValue,
    setRenameValue,
    handleRename,
    setRenamingId,
    renderActions,
  } = tile
  const contentId = share.data.ContentId
  const ownerLabel = isOwnScope ? (userName ?? 'Me') : (share.data.OwnerName ?? 'User')
  const dateLabel = formatShareDate(share)

  return (
    <motion.div
      data-testid={`doc-card-${contentId}`}
      onClick={() => onOpenDoc(contentId)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex cursor-pointer items-center gap-4 border-b border-el-line bg-el-surface px-4 py-3 transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <DocumentPreview docId={contentId} variant="list" canPreview={canPreview} />

        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-el-text transition-colors group-hover:text-el-accent">
            {share.data.Title}
          </h4>
          <div className="md:hidden">
            <DocumentDescription
              ownerLabel={ownerLabel}
              dateLabel={dateLabel}
            />
          </div>
        </div>
      </div>

      <div
        className={`hidden min-w-0 flex-nowrap items-center text-[12px] text-el-muted md:flex ${OWN_LIST_META_GAP}`}
      >
        <div className={`inline-flex ${OWN_COL_VISIBILITY} items-center gap-1`}>
          <Lock className="h-3 w-3 shrink-0" />
          <span className="truncate">Private</span>
        </div>
        <div className={`${OWN_COL_OWNER} truncate`}>{ownerLabel}</div>
        <div className={OWN_COL_MODIFIED}>{dateLabel}</div>
      </div>

      <div className={`${OWN_COL_ACTIONS} hidden justify-end md:flex`}>
        {isOwnScope && renderActions ? renderActions(share) : null}
      </div>
    </motion.div>
  )
}

function SharedDocTile({ share, onOpen }: { share: Share; onOpen: (share: Share) => void }) {
  const contentId = share.data.ContentId
  const dateLabel = formatShareDate(share)
  return (
    <motion.div
      data-testid={`shared-doc-card-${contentId}`}
      whileHover={{ y: -2 }}
      onClick={() => onOpen(share)}
      className="animate-etheris-fade-in group cursor-pointer rounded-xl border border-el-line bg-el-surface p-4 shadow-sm transition-all hover:border-el-accent/35 hover:shadow-md"
    >
      <DocumentPreview docId={contentId} variant="grid" canPreview />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-semibold leading-snug text-el-text transition-colors group-hover:text-el-accent">
            {share.data.Title}
          </h3>
          <SharedDocumentDescription
            ownerName={share.data.OwnerName}
            dateLabel={dateLabel}
            sourceApp={share.data.SourceApp}
          />
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${
            share.data.Permission === 'edit'
              ? 'bg-blue-500/10 text-blue-500'
              : 'bg-el-bg text-el-muted'
          }`}
        >
          {share.data.Permission === 'edit' ? 'Can edit' : 'View only'}
        </span>
      </div>
    </motion.div>
  )
}

function SharedDocListRow({ share, onOpen }: { share: Share; onOpen: (share: Share) => void }) {
  const contentId = share.data.ContentId
  const dateLabel = formatShareDate(share)
  const appLabel = share.data.SourceApp?.trim() || '—'
  return (
    <motion.div
      data-testid={`shared-doc-card-${contentId}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(share)}
      className="group flex cursor-pointer items-center gap-4 border-b border-el-line bg-el-surface px-4 py-3 transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <DocumentPreview docId={contentId} variant="list" canPreview />
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-el-text transition-colors group-hover:text-el-accent">
            {share.data.Title}
          </h4>
          <div className="md:hidden">
            <SharedDocumentDescription
              ownerName={share.data.OwnerName}
              dateLabel={dateLabel}
              sourceApp={share.data.SourceApp}
            />
          </div>
        </div>
      </div>
      <div
        className={`hidden min-w-0 flex-nowrap items-center text-[12px] text-el-muted md:flex ${SHARED_LIST_META_GAP}`}
      >
        <div className={`${SHARED_COL_OWNER} truncate`}>{share.data.OwnerName}</div>
        <div className={SHARED_COL_MODIFIED}>{dateLabel}</div>
        <div className={`${SHARED_COL_APP} truncate capitalize`}>{appLabel}</div>
        <div className={SHARED_COL_ACCESS}>
          <span
            className={`rounded px-2 py-0.5 text-[10px] ${
              share.data.Permission === 'edit'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-el-bg text-el-muted'
            }`}
          >
            {share.data.Permission === 'edit' ? 'Can edit' : 'View only'}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

type DocSectionProps = {
  title: string
  icon?: ReactNode
  shares: Share[]
  testId: string
  showLeadingBlank?: boolean
  showTitle?: boolean
  searchQuery: string
  sortBy: SortOption
  viewMode: ViewMode
  canModify: boolean
  onCreateDoc: () => void
  tileProps: OwnDocTileSharedProps
}

function DocSection({
  title,
  icon,
  shares,
  testId,
  showLeadingBlank,
  showTitle = true,
  searchQuery,
  sortBy,
  viewMode,
  canModify,
  onCreateDoc,
  tileProps,
}: DocSectionProps) {
  const filtered = filterSharesBySearch(shares, searchQuery)
  const sorted = sortShares(filtered, sortBy)

  if (sorted.length === 0 && searchQuery) return null
  if (sorted.length === 0 && title !== 'My Documents') return null

  const blankTile =
    showLeadingBlank && canModify && viewMode === 'grid' ? (
      <motion.button
        key="blank-doc-tile"
        type="button"
        whileHover={{ y: -2 }}
        onClick={() => onCreateDoc()}
        data-testid="blank-doc-tile"
        className="animate-etheris-fade-in group w-full cursor-pointer rounded-xl border-2 border-dashed border-el-line bg-el-surface/20 p-4 text-left shadow-sm transition-all hover:border-el-accent/35 hover:shadow-md"
      >
        {/* Same frame + aspect as `DocumentPreview` so the cell matches `DocCard` */}
        <div className="relative mb-4 aspect-[3/4] w-full overflow-hidden rounded-lg border border-black/[0.03] bg-el-bg shadow-sm dark:border-el-line">
          <div className="flex h-full w-full items-center justify-center text-el-muted">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-el-surface ring-1 ring-el-line group-hover:text-el-accent">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold leading-snug text-el-text transition-colors group-hover:text-el-accent">
            Blank doc
          </h3>
          <p className="mt-0.5 text-[10px] font-medium text-el-muted">Create a new document</p>
        </div>
      </motion.button>
    ) : null

  return (
    <section
      className="mb-12"
      data-testid={!showTitle ? (testId === 'my-docs-heading' ? undefined : testId) : undefined}
    >
      {showTitle && (
        <h2
          className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-el-muted"
          data-testid={testId}
        >
          {icon}
          {title}
          {sorted.length > 0 && (
            <span className="text-[10px] font-semibold normal-case tracking-normal text-el-muted/80">
              ({sorted.length})
            </span>
          )}
        </h2>
      )}
      {sorted.length === 0 ? (
        <div
          data-testid="empty-state"
          className="flex flex-col items-center justify-center py-12 text-el-muted"
        >
          <FileText className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">
            {canModify ? 'Create your first document to get started.' : 'No documents yet.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {blankTile}
          {sorted.map((share) => (
            <DocCard key={share.data.ContentId} share={share} {...tileProps} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-el-line bg-el-surface shadow-sm">
          <div className="flex items-center gap-4 border-b border-el-line bg-black/[0.02] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-el-muted dark:bg-white/[0.03]">
            <div className="min-w-0 flex-1">Name</div>
            <div className={`hidden flex-nowrap md:flex ${OWN_LIST_META_GAP}`}>
              <div className={OWN_COL_VISIBILITY}>Visibility</div>
              <div className={OWN_COL_OWNER}>Owner</div>
              <div className={OWN_COL_MODIFIED}>Last modified</div>
            </div>
            <div className={`hidden md:block ${OWN_COL_ACTIONS}`} aria-hidden />
          </div>
          {sorted.map((share) => (
            <DocRow key={share.data.ContentId} share={share} {...tileProps} />
          ))}
        </div>
      )}
    </section>
  )
}

// Toolbar must stay at module scope. Defining it inside DocumentListPage creates a new
// component type every render, so React remounts the search input on each keystroke
// and focus is lost after one character.
type LibrarySearchToolbarRowProps = {
  searchQuery: string
  onSearchQueryChange: (next: string) => void
  includeDocActions: boolean
  canModify: boolean
  onOpenTemplates: () => void
  onCreateDoc: () => void
}

function LibrarySearchToolbarRow({
  searchQuery,
  onSearchQueryChange,
  includeDocActions,
  canModify,
  onOpenTemplates,
  onCreateDoc,
}: LibrarySearchToolbarRowProps) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 sm:justify-between">
      <div className="relative min-w-0 max-w-md flex-1">
        <SearchInput
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onClear={() => onSearchQueryChange('')}
          placeholder="Search your library..."
          data-testid="doc-search"
          className="h-auto w-full rounded-lg border-el-line bg-el-surface py-2 pl-10 pr-10 text-[13px] text-el-text shadow-sm placeholder:text-el-muted/60 focus-visible:ring-2 focus-visible:ring-el-accent/20"
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:ml-auto">
        {includeDocActions && canModify && (
          <>
            <button
              type="button"
              onClick={onOpenTemplates}
              data-testid="templates-btn"
              className="flex h-9 items-center gap-2 rounded-lg border border-el-line bg-el-surface px-4 text-[12px] font-semibold text-el-text shadow-sm transition-colors hover:bg-el-bg"
            >
              <FileDown className="h-4 w-4" />
              Templates
            </button>
            <button
              type="button"
              onClick={onCreateDoc}
              data-testid="create-doc-btn"
              className="flex h-9 items-center gap-2 rounded-lg bg-el-accent px-4 text-[12px] font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Document
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function DocumentListPage() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { isSignedIn } = useAuth()

  const isOwnScope = true

  const { records: documents } = useQuery<DocumentFields>('documents')
  const { create, put, remove } = useMutations<DocumentFields>('documents')

  const { records: folderRecords } = useQuery<DocFolderFields>('doc_folders')
  const {
    create: createFolder,
    put: putFolder,
    remove: removeFolder,
  } = useMutations<DocFolderFields>('doc_folders')

  const { records: allShares } = useQuery<ContentShareFields>('content_shares')
  const { create: createShare, put: putShare, remove: removeShare } = useMutations<ContentShareFields>('content_shares')

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [folderRenamingId, setFolderRenamingId] = useState<string | null>(null)
  const [folderRenameValue, setFolderRenameValue] = useState('')
  const folderShortcutRenameBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderShortcutRenameSessionStartRef = useRef(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('lastEdited')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [favorites, setFavoritesState] = useState<Set<string>>(getFavorites)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [libraryNav, setLibraryNav] = useState<LibraryNavSelection>({ kind: 'all' })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)

  useEffect(() => {
    if (libraryNav.kind !== 'folder') return
    const exists = (folderRecords ?? []).some((f) => f.recordId === libraryNav.folderId)
    if (!exists) setLibraryNav({ kind: 'all' })
  }, [folderRecords, libraryNav])

  useEffect(() => {
    return () => {
      if (folderShortcutRenameBlurTimerRef.current)
        clearTimeout(folderShortcutRenameBlurTimerRef.current)
    }
  }, [])

  const displayFirstName = user?.name?.trim().split(/\s+/)[0] ?? 'there'

  const myFolders = useMemo(() => {
    if (!user?.id) return []
    return (folderRecords ?? []).filter((f) => f.data.ownerId === user.id)
  }, [folderRecords, user?.id])

  const sortedFolders = useMemo(
    () => [...myFolders].sort((a, b) => (a.data.name ?? '').localeCompare(b.data.name ?? '')),
    [myFolders],
  )

  const listControlsHeading = useMemo((): string => {
    if (libraryNav.kind === 'shared') return 'Shared with me'
    if (libraryNav.kind === 'favorites') return 'Favorites'
    if (libraryNav.kind === 'uncategorized') return 'Uncategorized'
    if (libraryNav.kind === 'folder') {
      return (
        sortedFolders.find((f) => f.recordId === libraryNav.folderId)?.data.name?.trim() || 'Folder'
      )
    }
    return 'My Documents'
  }, [libraryNav, sortedFolders])

  const docPath = (docId: string) => `/doc/${docId}`

  const docLookup = useMemo(() => {
    const map = new Map<string, RecordData<DocumentFields>>()
    for (const d of documents ?? []) map.set(d.recordId, d)
    return map
  }, [documents])

  /** Per-doc "self" share (or first) indexed by content id. */
  const mySharesByContentId = useMemo(() => {
    if (!user?.id) return new Map<string, Share>()
    const byContentId = new Map<string, Share>()
    for (const s of allShares ?? []) {
      if (s.data.ContentType !== 'document' || s.data.OwnerId !== user.id) continue
      const existing = byContentId.get(s.data.ContentId)
      if (!existing || s.data.ShareType === 'self') {
        byContentId.set(s.data.ContentId, s)
      }
    }
    return byContentId
  }, [allShares, user?.id])

  /**
   * My documents list, keyed from `documents` so we never miss a new doc when
   * the `content_shares` row and the `documents` row hit the client in either order.
   */
  const myShares = useMemo(() => {
    if (!user?.id) return []
    const out: Share[] = []
    const now = new Date().toISOString()
    for (const d of documents ?? []) {
      if (d.data.ownerId !== user.id) continue
      const s = mySharesByContentId.get(d.recordId)
      if (s) {
        out.push(s)
      } else {
        // Share row not synced yet — show the doc with metadata from the record.
        out.push({
          recordId: `__pending__:${d.recordId}`,
          data: {
            ContentType: 'document',
            ContentId: d.recordId,
            OwnerId: user.id,
            OwnerName: user.name ?? 'Anonymous',
            Title: d.data.title,
            ShareType: 'self',
            ShareTarget: '',
            Permission: 'edit',
            SharedAt: now,
            SharedBy: user.id,
            SourceApp: 'docs2',
            WordCount: 0,
            LastEditedAt: now,
          },
        } as Share)
      }
    }
    return out
  }, [documents, mySharesByContentId, user])

  const privateDocs = myShares
  const favoriteDocs = useMemo(
    () => myShares.filter((s) => favorites.has(s.data.ContentId)),
    [myShares, favorites],
  )

  const shareMatchesLibraryNav = useCallback(
    (share: Share) => {
      const doc = docLookup.get(share.data.ContentId)
      const fid = doc?.data.folderId ?? ''
      if (libraryNav.kind === 'all') return true
      if (libraryNav.kind === 'shared') return false
      if (libraryNav.kind === 'favorites') return favorites.has(share.data.ContentId)
      if (libraryNav.kind === 'uncategorized') return fid === ''
      if (libraryNav.kind === 'folder') return fid === libraryNav.folderId
      return true
    },
    [libraryNav, docLookup, favorites],
  )

  const filteredFavoriteDocs = useMemo(
    () => favoriteDocs.filter(shareMatchesLibraryNav),
    [favoriteDocs, shareMatchesLibraryNav],
  )
  const filteredPrivateDocs = useMemo(
    () => privateDocs.filter(shareMatchesLibraryNav),
    [privateDocs, shareMatchesLibraryNav],
  )
  const sharesForContent = useCallback(
    (contentId: string) => (allShares ?? []).filter((s) => s.data.ContentId === contentId),
    [allShares],
  )

  const toggleFavoriteById = useCallback((contentId: string) => {
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
    const folderIdForNew =
      libraryNav.kind === 'folder' ? libraryNav.folderId : ''
    const recordId = await create({
      title,
      ownerId: user.id,
      visibility: 'private',
      collaborators: '[]',
      editors: '[]',
      folderId: folderIdForNew,
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
  }, [create, createShare, libraryNav, navigate, user])

  const handleCreateFromTemplate = useCallback(
    async (template: DocTemplate) => {
      setShowTemplates(false)
      await handleCreate(template)
    },
    [handleCreate],
  )

  const copyShareLink = useCallback(
    async (share: Share) => {
      if (!user) return
      const url = `${window.location.origin}${docPath(share.data.ContentId)}`

      await navigator.clipboard.writeText(url)
      setCopiedId(share.data.ContentId)
      setTimeout(() => setCopiedId(null), 2000)
    },
    [docPath, user],
  )

  const deleteDocument = useCallback(
    async (contentId: string) => {
      if (!confirm('Delete this document?')) return
      await remove(contentId)
      const shares = sharesForContent(contentId)
      await Promise.all(shares.map((s) => removeShare(s.recordId)))
    },
    [remove, removeShare, sharesForContent],
  )

  const startRename = useCallback((share: Share) => {
    setRenamingId(share.data.ContentId)
    setRenameValue(share.data.Title)
  }, [])

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

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c
      writeSidebarCollapsed(next)
      return next
    })
  }, [])

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!user) return
      await createFolder({
        name,
        ownerId: user.id,
      })
    },
    [createFolder, user],
  )

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      const owned = (documents ?? []).filter(
        (d) => d.data.ownerId === user?.id && (d.data.folderId ?? '') === folderId,
      )
      await Promise.all(
        owned.map((d) => put(d.recordId, { ...d.data, folderId: '' })),
      )
      await removeFolder(folderId)
      setFolderRenamingId((id) => (id === folderId ? null : id))
      setLibraryNav((nav) =>
        nav.kind === 'folder' && nav.folderId === folderId ? { kind: 'all' } : nav,
      )
    },
    [documents, put, removeFolder, user?.id],
  )

  const startRenameFolder = useCallback((folder: RecordData<DocFolderFields>) => {
    setFolderRenamingId(folder.recordId)
    setFolderRenameValue(folder.data.name ?? '')
  }, [])

  const commitRenameFolder = useCallback(async () => {
    if (folderShortcutRenameBlurTimerRef.current) {
      clearTimeout(folderShortcutRenameBlurTimerRef.current)
      folderShortcutRenameBlurTimerRef.current = null
    }
    const id = folderRenamingId
    const trimmed = folderRenameValue.trim()
    setFolderRenamingId(null)
    if (!id || !trimmed) return
    const folder = myFolders.find((f) => f.recordId === id)
    if (!folder || trimmed === (folder.data.name ?? '').trim()) return
    await putFolder(id, { ...folder.data, name: trimmed }).catch(() => {})
  }, [folderRenamingId, folderRenameValue, myFolders, putFolder])

  const commitRenameFolderRef = useRef(commitRenameFolder)
  commitRenameFolderRef.current = commitRenameFolder

  const cancelRenameFolder = useCallback(() => {
    if (folderShortcutRenameBlurTimerRef.current) {
      clearTimeout(folderShortcutRenameBlurTimerRef.current)
      folderShortcutRenameBlurTimerRef.current = null
    }
    setFolderRenamingId(null)
  }, [])

  const handleMoveDocToFolder = useCallback(
    async (contentId: string, folderId: string) => {
      const doc = docLookup.get(contentId)
      if (!doc) return
      await put(contentId, { ...doc.data, folderId })
    },
    [put, docLookup],
  )

  const canModify = isOwnScope
  const sharedWithMe = useMemo(() => {
    if (!user?.id) return []
    const byContentId = new Map<string, Share>()
    for (const s of allShares ?? []) {
      if (
        s.data.ContentType === 'document' &&
        s.data.OwnerId !== user.id &&
        s.data.ShareTarget === user.id
      ) {
        byContentId.set(s.data.ContentId, s)
      }
    }

    const now = new Date().toISOString()
    for (const d of documents ?? []) {
      if (d.data.ownerId === user.id) continue
      const collaborators = parseShareIds(d.data.collaborators)
      if (!collaborators.includes(user.id) || byContentId.has(d.recordId)) continue
      const editors = parseShareIds(d.data.editors)
      byContentId.set(d.recordId, {
        recordId: `__collaborator__:${d.recordId}`,
        data: {
          ContentType: 'document',
          ContentId: d.recordId,
          OwnerId: d.data.ownerId,
          OwnerName: 'Owner',
          Title: d.data.title,
          ShareType: 'user',
          ShareTarget: user.id,
          Permission: editors.includes(user.id) ? 'edit' : 'view',
          SharedAt: now,
          SharedBy: d.data.ownerId,
          SourceApp: 'docs2',
          WordCount: 0,
          LastEditedAt: now,
        },
      } as Share)
    }

    return [...byContentId.values()].sort((a, b) =>
      (b.data.SharedAt ?? '').localeCompare(a.data.SharedAt ?? ''),
    )
  }, [allShares, documents, user?.id])
  const filteredSharedWithMe = sortShares(filterSharesBySearch(sharedWithMe, searchQuery), sortBy)
  const leadingBlankForNav =
    canModify && libraryNav.kind !== 'favorites' && libraryNav.kind !== 'shared'

  if (isOwnScope && !isSignedIn) {
    return (
      <SignedOutLibraryGate
        onSignIn={() => setShowAuthModal(true)}
        showAuthModal={showAuthModal}
        onCloseAuth={() => setShowAuthModal(false)}
      />
    )
  }

  const ownDocTileProps: OwnDocTileSharedProps = {
    docLookup,
    favorites,
    isOwnScope: true,
      canPreview: true,
    userName: user?.name,
    onOpenDoc: (contentId) => navigate(docPath(contentId)),
    renamingId,
    renameValue,
    setRenameValue,
    handleRename,
    setRenamingId,
    renderActions: (s) => {
      const isFav = favorites.has(s.data.ContentId)
      return (
        <DocumentActionsMenu
          share={s}
          isFav={isFav}
          docLookup={docLookup}
          sortedFolders={sortedFolders}
          canModify={canModify}
          copiedId={copiedId}
          toggleFavoriteById={toggleFavoriteById}
          handleMoveDocToFolder={handleMoveDocToFolder}
          copyShareLink={copyShareLink}
          startRename={startRename}
          deleteDocument={deleteDocument}
        />
      )
    },
  }

  function ProfileMenu() {
    if (!isSignedIn) {
      return (
        <>
          <button
            type="button"
            data-testid="nav-sign-in-button"
            onClick={() => setShowAuthModal(true)}
            className="shrink-0 rounded-full bg-el-accent px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Sign In
          </button>
          {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
        </>
      )
    }
    if (!user) return null
    return (
      <div className="relative shrink-0">
        <UserProfileButton
          type="button"
          data-testid="library-profile-btn"
          name={user.name || user.email || 'User'}
          email={user.email}
          imageUrl={user.imageUrl}
          title="Account"
          avatarSizeClassName="h-8 w-8"
          onClick={() => setProfileMenuOpen((o) => !o)}
          className="h-auto max-w-[min(16rem,45vw)] border-el-line bg-el-surface py-1.5 pl-1.5 pr-2.5 text-el-text shadow-sm hover:bg-el-bg [&_span]:text-el-text"
        />
        {profileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-el-line bg-el-surface py-1 shadow-lg">
              <div className="border-b border-el-line px-3 py-2">
                <div className="truncate text-sm font-medium text-el-text">{user.name}</div>
                <div className="truncate text-xs text-el-muted">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false)
                  signOut()
                }}
                className="w-full px-3 py-2 text-left text-sm text-el-muted transition-colors hover:bg-el-bg hover:text-el-text"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  function FolderShortcutRow() {
    if (!canModify) return null

    const createFromShortcut = async () => {
      const name = window.prompt('Folder name')
      const trimmed = name?.trim()
      if (!trimmed) return
      await handleCreateFolder(trimmed)
    }

    return (
      <div className="mb-12 grid grid-cols-1 gap-3 md:grid-cols-4">
        {sortedFolders.map((folder) => {
          const selected = libraryNav.kind === 'folder' && libraryNav.folderId === folder.recordId
          const isRenaming = folderRenamingId === folder.recordId

          if (isRenaming) {
            return (
              <div
                key={folder.recordId}
                className="flex items-center gap-3 rounded-xl border border-el-accent/40 bg-el-surface p-3.5 shadow-sm ring-2 ring-el-accent/15"
              >
                <div className="rounded-lg bg-el-bg p-2 text-el-muted">
                  <Folder className="h-4 w-4" />
                </div>
                <FolderShortcutRenameField
                  folderId={folder.recordId}
                  renameFolderValue={folderRenameValue}
                  setRenameFolderValue={setFolderRenameValue}
                  commitRenameFolderRef={commitRenameFolderRef}
                  cancelRenameFolder={cancelRenameFolder}
                  blurTimerRef={folderShortcutRenameBlurTimerRef}
                  sessionStartRef={folderShortcutRenameSessionStartRef}
                  testId={`folder-shortcut-rename-input-${folder.recordId}`}
                />
              </div>
            )
          }

          return (
            <div
              key={folder.recordId}
              className={`group flex min-w-0 items-center rounded-xl border bg-el-surface shadow-sm transition-all ${
                selected
                  ? 'border-el-accent/50 ring-2 ring-el-accent/10'
                  : 'border-el-line hover:border-el-accent/35'
              }`}
            >
              <button
                type="button"
                data-testid={`folder-shortcut-${folder.recordId}`}
                onClick={() => setLibraryNav({ kind: 'folder', folderId: folder.recordId })}
                className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left min-h-[52px]"
              >
                <div className="rounded-lg bg-el-bg p-2 text-el-muted transition-all group-hover:bg-el-accent/5 group-hover:text-el-accent">
                  <Folder className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-el-text">{folder.data.name}</span>
                </div>
              </button>
              <button
                type="button"
                data-testid={`folder-shortcut-rename-${folder.recordId}`}
                title="Rename folder"
                aria-label={`Rename folder ${folder.data.name}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  startRenameFolder(folder)
                }}
                className="relative z-[1] shrink-0 rounded-md p-2 text-el-muted opacity-0 transition-opacity hover:bg-el-bg hover:text-el-accent group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <ChevronRight
                className="mr-3 h-3 w-3 shrink-0 text-el-muted/50 transition-colors group-hover:text-el-accent pointer-events-none"
                aria-hidden
              />
            </div>
          )
        })}

        <button
          type="button"
          data-testid="folder-shortcut-new"
          onClick={() => void createFromShortcut()}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-el-line bg-el-surface/20 p-3.5 text-[13px] font-semibold text-el-muted transition-all hover:border-el-accent hover:text-el-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          New Folder
        </button>
      </div>
    )
  }

  function LibraryControlsRow() {
    // Only "My Documents" is duplicated: toolbar label + list section share this id.
    const toolbarTestId = listControlsHeading === 'My Documents' ? 'my-docs-heading' : undefined
    return (
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2
          className="text-[11px] font-bold uppercase tracking-widest text-el-muted"
          data-testid={toolbarTestId}
        >
          {listControlsHeading}
        </h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              data-testid="sort-dropdown"
              className="flex items-center gap-1.5 rounded-lg border border-el-line bg-el-surface px-3 py-2 text-xs font-medium text-el-muted shadow-sm transition-colors hover:text-el-text"
            >
              <SortAsc className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            </button>
            {showSortDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[168px] rounded-lg border border-el-line bg-el-surface py-1 shadow-lg">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`sort-${opt.value}`}
                      onClick={() => {
                        setSortBy(opt.value)
                        setShowSortDropdown(false)
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-el-bg ${
                        sortBy === opt.value ? 'font-medium text-el-accent' : 'text-el-text'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center rounded-lg border border-black/5 bg-black/5 p-0.5 dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              data-testid="view-grid"
              className={`rounded-md p-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-el-surface text-el-text shadow-sm'
                  : 'text-el-muted hover:text-el-text'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-[13px] w-[13px]" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              data-testid="view-list"
              className={`rounded-md p-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-el-surface text-el-text shadow-sm'
                  : 'text-el-muted hover:text-el-text'
              }`}
              title="List view"
            >
              <LayoutList className="h-[13px] w-[13px]" />
            </button>
          </div>
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
  // Own-scope view
  // -------------------------------------------------------------------------
  return (
    <div
      data-testid="app-root"
      className="flex min-h-full overflow-hidden bg-el-bg selection:bg-el-accent/20"
    >
      {user ? (
        <LibrarySidebar
          selection={libraryNav}
          onSelect={setLibraryNav}
          folders={myFolders}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onStartRenameFolder={startRenameFolder}
          renamingFolderId={folderRenamingId}
          renameFolderValue={folderRenameValue}
          setRenameFolderValue={setFolderRenameValue}
          onCommitRenameFolder={commitRenameFolder}
          onCancelRenameFolder={cancelRenameFolder}
        />
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="px-6 pb-10 pt-9 md:px-12 md:pb-12 md:pt-10 lg:px-16 lg:pb-16 lg:pt-10">
          <div className="mb-1 flex min-w-0 items-center justify-between gap-4">
            <h1 className="min-w-0 text-3xl font-bold leading-tight tracking-tight text-el-text sm:text-4xl">
              {greetingForTime()}, {displayFirstName}
            </h1>
            <div className="shrink-0">
              <ProfileMenu />
            </div>
          </div>
          <p className="mb-4 text-[13px] font-medium text-el-muted">
            {myShares.length} {myShares.length === 1 ? 'document' : 'documents'} in your workspace.
          </p>
          <div className="mb-8 w-full min-w-0">
            <LibrarySearchToolbarRow
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              includeDocActions
              canModify={canModify}
              onOpenTemplates={() => setShowTemplates(true)}
              onCreateDoc={() => void handleCreate()}
            />
          </div>
          {libraryNav.kind !== 'shared' ? (
            <div className="mb-10">
              <FolderShortcutRow />
            </div>
          ) : null}

          <LibraryControlsRow />

          <div data-testid="doc-list">
            {libraryNav.kind === 'shared' ? (
              filteredSharedWithMe.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-el-muted">
                  <Share2 className="mb-4 h-12 w-12 opacity-40" />
                  <p className="mb-1 text-lg text-el-text">No shared documents</p>
                  <p className="text-sm">Documents shared directly with you will appear here.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div
                  data-testid="shared-doc-list"
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
                >
                  {filteredSharedWithMe.map((share) => (
                    <SharedDocTile
                      key={share.recordId}
                      share={share}
                      onOpen={(s) => navigate(docPath(s.data.ContentId))}
                    />
                  ))}
                </div>
              ) : (
                <div
                  data-testid="shared-doc-list"
                  className="overflow-hidden rounded-xl border border-el-line bg-el-surface shadow-sm"
                >
                  <div className="flex items-center gap-4 border-b border-el-line bg-black/[0.02] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-el-muted dark:bg-white/[0.03]">
                    <div className="min-w-0 flex-1">Name</div>
                    <div className={`hidden flex-nowrap md:flex ${SHARED_LIST_META_GAP}`}>
                      <div className={SHARED_COL_OWNER}>Owner</div>
                      <div className={SHARED_COL_MODIFIED}>Modified</div>
                      <div className={SHARED_COL_APP}>App</div>
                      <div className={SHARED_COL_ACCESS}>Access</div>
                    </div>
                  </div>
                  {filteredSharedWithMe.map((share) => (
                    <SharedDocListRow
                      key={share.recordId}
                      share={share}
                      onOpen={(s) => navigate(docPath(s.data.ContentId))}
                    />
                  ))}
                </div>
              )
            ) : libraryNav.kind === 'favorites' ? (
              <DocSection
                title="Favorites"
                icon={<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                shares={filteredFavoriteDocs}
                testId="favorites-heading"
                showTitle={false}
                searchQuery={searchQuery}
                sortBy={sortBy}
                viewMode={viewMode}
                canModify={canModify}
                onCreateDoc={handleCreate}
                tileProps={ownDocTileProps}
              />
            ) : (
              <>
                {filteredFavoriteDocs.length > 0 && (
                  <DocSection
                    title="Favorites"
                    icon={<Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />}
                    shares={filteredFavoriteDocs}
                    testId="favorites-heading"
                    searchQuery={searchQuery}
                    sortBy={sortBy}
                    viewMode={viewMode}
                    canModify={canModify}
                    onCreateDoc={handleCreate}
                    tileProps={ownDocTileProps}
                  />
                )}

                <DocSection
                  title="My Documents"
                  shares={filteredPrivateDocs}
                  testId="my-docs-heading"
                  showLeadingBlank={leadingBlankForNav}
                  showTitle={libraryNav.kind === 'uncategorized' || libraryNav.kind === 'folder'}
                  searchQuery={searchQuery}
                  sortBy={sortBy}
                  viewMode={viewMode}
                  canModify={canModify}
                  onCreateDoc={handleCreate}
                  tileProps={ownDocTileProps}
                />

              </>
            )}
          </div>

          {libraryNav.kind === 'all' && sharedWithMe.length > 0 && (
          <section className="mt-4">
            <h2
              className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-el-muted"
              data-testid="shared-docs-heading"
            >
              <Share2 className="h-4 w-4 text-blue-500" />
              Shared with me
            </h2>
            {viewMode === 'grid' ? (
              <div
                data-testid="shared-doc-list"
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
              >
                {sharedWithMe.map((share) => (
                  <SharedDocTile
                    key={share.recordId}
                    share={share}
                    onOpen={(s) => navigate(docPath(s.data.ContentId))}
                  />
                ))}
              </div>
            ) : (
              <div
                data-testid="shared-doc-list"
                className="overflow-hidden rounded-xl border border-el-line bg-el-surface shadow-sm"
              >
                <div className="flex items-center gap-4 border-b border-el-line bg-black/[0.02] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-el-muted dark:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">Name</div>
                  <div className={`hidden flex-nowrap md:flex ${SHARED_LIST_META_GAP}`}>
                    <div className={SHARED_COL_OWNER}>Owner</div>
                    <div className={SHARED_COL_MODIFIED}>Modified</div>
                    <div className={SHARED_COL_APP}>App</div>
                    <div className={SHARED_COL_ACCESS}>Access</div>
                  </div>
                </div>
                {sharedWithMe.map((share) => (
                  <SharedDocListRow
                    key={share.recordId}
                    share={share}
                    onOpen={(s) => navigate(docPath(s.data.ContentId))}
                  />
                ))}
              </div>
            )}
          </section>
          )}
        </div>

        <TemplatePicker />
      </div>
    </div>
  )
}
