/**
 * Find & Replace Bar
 *
 * Floating search bar overlay (Google Docs style) that appears
 * at the top-right of the editor when Cmd+F is pressed.
 */

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { X, ChevronUp, ChevronDown, CaseSensitive, Replace } from 'lucide-react'
import type { SearchReplaceStorage } from './extensions/SearchReplace'

interface FindReplaceBarProps {
  editor: Editor
}

export default function FindReplaceBar({ editor }: FindReplaceBarProps) {
  const storage = (editor.storage as unknown as Record<string, unknown>).searchReplace as SearchReplaceStorage | undefined
  const isOpen = storage?.isOpen
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showReplace, setShowReplace] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [localReplace, setLocalReplace] = useState('')

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setLocalSearch(storage.searchTerm || '')
      setLocalReplace(storage.replaceTerm || '')
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const results = storage.results ?? []
  const currentIndex = storage.currentIndex ?? 0
  const caseSensitive = storage.caseSensitive ?? false

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    editor.commands.setSearchTerm(value)
  }

  const handleReplaceChange = (value: string) => {
    setLocalReplace(value)
    editor.commands.setReplaceTerm(value)
  }

  const handleClose = () => {
    editor.commands.closeSearch()
    setShowReplace(false)
    setLocalSearch('')
    setLocalReplace('')
  }

  return (
    <div
      data-testid="find-replace-bar"
      className="absolute top-2 right-4 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 flex flex-col gap-2"
      style={{ minWidth: '320px' }}
    >
      {/* Search row */}
      <div className="flex items-center gap-1.5">
        <input
          ref={searchInputRef}
          type="text"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.shiftKey
                ? editor.commands.prevSearchResult()
                : editor.commands.nextSearchResult()
            }
            if (e.key === 'Escape') handleClose()
          }}
          placeholder="Find..."
          data-testid="find-input"
          className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
        />
        <span className="text-xs text-muted-foreground tabular-nums min-w-[48px] text-center">
          {results.length > 0 ? `${currentIndex + 1}/${results.length}` : '0/0'}
        </span>
        <button
          type="button"
          onClick={() => editor.commands.prevSearchResult()}
          disabled={results.length === 0}
          data-testid="find-prev"
          title="Previous (Shift+Enter)"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.commands.nextSearchResult()}
          disabled={results.length === 0}
          data-testid="find-next"
          title="Next (Enter)"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.commands.toggleCaseSensitive()}
          data-testid="find-case-sensitive"
          title="Case sensitive"
          className={`p-1 rounded transition-colors ${
            caseSensitive
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <CaseSensitive className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowReplace(!showReplace)}
          data-testid="find-toggle-replace"
          title="Toggle replace"
          className={`p-1 rounded transition-colors ${
            showReplace
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Replace className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          data-testid="find-close"
          title="Close (Escape)"
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={localReplace}
            onChange={(e) => handleReplaceChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') editor.commands.replaceCurrentResult()
              if (e.key === 'Escape') handleClose()
            }}
            placeholder="Replace..."
            data-testid="replace-input"
            className="flex-1 bg-background border border-input rounded px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => editor.commands.replaceCurrentResult()}
            disabled={results.length === 0}
            data-testid="replace-btn"
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-primary/20 text-foreground disabled:opacity-40 transition-colors"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => editor.commands.replaceAllResults()}
            disabled={results.length === 0}
            data-testid="replace-all-btn"
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-primary/20 text-foreground disabled:opacity-40 transition-colors"
          >
            All
          </button>
        </div>
      )}
    </div>
  )
}
