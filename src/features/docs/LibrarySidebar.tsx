/**
 * Etheris-style library sidebar: nav items + folder list, collapsible width.
 */

import { useCallback, useState, type ReactNode } from 'react'
import type { RecordData } from 'deepspace'
import {
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
  Trash2,
} from 'lucide-react'
import type { DocFolderFields, LibraryNavSelection } from './types'

const SIDEBAR_COLLAPSED_KEY = 'docs2-library-sidebar-collapsed'

export function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function NavRow({
  active,
  icon: Icon,
  label,
  onClick,
  testId,
  trailing,
  collapsed,
}: {
  active: boolean
  icon: typeof FileText
  label: string
  onClick: () => void
  testId?: string
  trailing?: ReactNode
  collapsed?: boolean
}) {
  return (
    <div className="group flex w-full items-center gap-0.5">
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`relative flex h-9 min-w-0 flex-1 items-center rounded-md px-0 text-left text-[13px] transition-colors ${
          active
            ? 'bg-el-accent font-medium text-white shadow-sm'
            : 'text-el-text/80 hover:bg-black/[0.04] hover:text-el-text dark:hover:bg-white/[0.06]'
        }`}
      >
        <span className="absolute left-4 flex h-4 w-4 items-center justify-center">
          <Icon size={14} strokeWidth={active ? 2.5 : 1.8} />
        </span>
        {!collapsed && <span className="min-w-0 truncate pl-12 pr-2">{label}</span>}
      </button>
      {!collapsed && trailing}
    </div>
  )
}

export interface LibrarySidebarProps {
  selection: LibraryNavSelection
  onSelect: (s: LibraryNavSelection) => void
  folders: RecordData<DocFolderFields>[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onCreateFolder: (name: string) => void | Promise<void>
  onDeleteFolder: (folderId: string) => void | Promise<void>
}

export function LibrarySidebar({
  selection,
  onSelect,
  folders,
  collapsed,
  onToggleCollapsed,
  onCreateFolder,
  onDeleteFolder,
}: LibrarySidebarProps) {
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const submitNewFolder = useCallback(async () => {
    const name = newFolderName.trim()
    if (!name) {
      setAddingFolder(false)
      setNewFolderName('')
      return
    }
    await onCreateFolder(name)
    setNewFolderName('')
    setAddingFolder(false)
  }, [newFolderName, onCreateFolder])

  const sortedFolders = [...folders].sort((a, b) =>
    (a.data.name ?? '').localeCompare(b.data.name ?? ''),
  )

  return (
    <aside
      data-testid="library-sidebar"
      className={`relative z-20 shrink-0 border-r border-el-line bg-el-surface/90 backdrop-blur-xl transition-[width] duration-200 ease-out dark:bg-el-surface/95 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={`flex items-center border-b border-el-line py-4 ${
            collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4'
          }`}
        >
          {!collapsed && (
            <div className="min-w-0">
              <span className="block truncate text-base font-bold leading-tight tracking-tight text-el-text">
                Documents
              </span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-widest text-el-muted/75">
                Workspace
              </span>
            </div>
          )}
          <button
            type="button"
            data-testid="library-sidebar-collapse"
            onClick={onToggleCollapsed}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-el-muted transition-colors hover:bg-el-bg hover:text-el-text"
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          <NavRow
            active={selection.kind === 'all'}
            icon={LayoutGrid}
            label="Library"
            testId="library-nav-all"
            onClick={() => onSelect({ kind: 'all' })}
            collapsed={collapsed}
          />
          <NavRow
            active={selection.kind === 'favorites'}
            icon={Star}
            label="Favorites"
            testId="library-nav-favorites"
            onClick={() => onSelect({ kind: 'favorites' })}
            collapsed={collapsed}
          />
          <NavRow
            active={selection.kind === 'uncategorized'}
            icon={FileText}
            label="Uncategorized"
            testId="library-nav-uncategorized"
            onClick={() => onSelect({ kind: 'uncategorized' })}
            collapsed={collapsed}
          />

          <div className={collapsed ? 'mt-6 border-t border-el-line pt-3' : 'mt-8'}>
            {!collapsed && (
              <span className="mb-2 block px-3 text-[10px] font-bold uppercase tracking-widest text-el-muted/80">
                Folders
              </span>
            )}
            <div className="space-y-0.5">
              {sortedFolders.map((f) => (
                <NavRow
                  key={f.recordId}
                  active={selection.kind === 'folder' && selection.folderId === f.recordId}
                  icon={Folder}
                  label={f.data.name}
                  testId={`library-nav-folder-${f.recordId}`}
                  onClick={() => onSelect({ kind: 'folder', folderId: f.recordId })}
                  collapsed={collapsed}
                  trailing={
                    <button
                      type="button"
                      data-testid={`delete-folder-${f.recordId}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete folder “${f.data.name}”? Documents inside will move to uncategorized.`)) {
                          void onDeleteFolder(f.recordId)
                        }
                      }}
                      className="shrink-0 rounded p-1 text-el-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100"
                      title="Delete folder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              ))}

              {addingFolder ? (
                <div className={collapsed ? 'px-0 py-1' : 'px-3 py-1'}>
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={() => void submitNewFolder()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitNewFolder()
                      if (e.key === 'Escape') {
                        setAddingFolder(false)
                        setNewFolderName('')
                      }
                    }}
                    placeholder="Folder name"
                    data-testid="new-folder-input"
                    className="w-full rounded-md border border-el-line bg-el-bg px-2 py-1.5 text-[13px] text-el-text outline-none focus-visible:ring-2 focus-visible:ring-el-accent/30"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="new-folder-btn"
                  onClick={() => {
                    if (!collapsed) {
                      setAddingFolder(true)
                      return
                    }
                    const name = window.prompt('Folder name')?.trim()
                    if (name) void onCreateFolder(name)
                  }}
                  title={collapsed ? 'New folder' : undefined}
                  className="relative flex h-9 w-full items-center rounded-md px-0 text-left text-[13px] text-el-muted transition-colors hover:bg-black/[0.04] hover:text-el-accent dark:hover:bg-white/[0.06]"
                >
                  <span className="absolute left-4 flex h-4 w-4 items-center justify-center">
                    <FolderPlus className="h-3.5 w-3.5" />
                  </span>
                  {!collapsed && <span className="min-w-0 truncate pl-12 pr-2">New folder</span>}
                </button>
              )}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  )
}
