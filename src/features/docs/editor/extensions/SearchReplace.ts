/**
 * Search & Replace Extension
 *
 * ProseMirror plugin that highlights search matches using decorations
 * and provides find/replace commands. Activated by Cmd+F / Ctrl+F.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface SearchReplaceOptions {
  searchResultClass: string
  searchResultCurrentClass: string
}

export interface SearchReplaceStorage {
  searchTerm: string
  replaceTerm: string
  results: { from: number; to: number }[]
  currentIndex: number
  caseSensitive: boolean
  isOpen: boolean
}

const searchReplacePluginKey = new PluginKey('searchReplace')

function findMatches(
  doc: { textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; content: { size: number } },
  searchTerm: string,
  caseSensitive: boolean,
): { from: number; to: number }[] {
  if (!searchTerm) return []

  const results: { from: number; to: number }[] = []
  const text = doc.textBetween(0, doc.content.size, '\n')
  const searchStr = caseSensitive ? searchTerm : searchTerm.toLowerCase()
  const docText = caseSensitive ? text : text.toLowerCase()

  let pos = 0
  while (pos < docText.length) {
    const index = docText.indexOf(searchStr, pos)
    if (index === -1) break
    // +1 offset for the document node wrapper
    results.push({ from: index + 1, to: index + searchTerm.length + 1 })
    pos = index + 1
  }

  return results
}

export const SearchReplace = Extension.create<SearchReplaceOptions, SearchReplaceStorage>({
  name: 'searchReplace',

  addOptions() {
    return {
      searchResultClass: 'search-result',
      searchResultCurrentClass: 'search-result-current',
    }
  },

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      results: [] as { from: number; to: number }[],
      currentIndex: 0,
      caseSensitive: false,
      isOpen: false,
    }
  },

  addCommands() {
    return {
      openSearch:
        () =>
        ({ editor }) => {
          this.storage.isOpen = true
          // Get selected text as initial search term
          const { from, to } = editor.state.selection
          if (from !== to) {
            this.storage.searchTerm = editor.state.doc.textBetween(from, to)
          }
          this.storage.results = findMatches(
            editor.state.doc,
            this.storage.searchTerm,
            this.storage.caseSensitive,
          )
          this.storage.currentIndex = 0
          editor.view.dispatch(editor.state.tr)
          return true
        },
      closeSearch:
        () =>
        ({ editor }) => {
          this.storage.isOpen = false
          this.storage.searchTerm = ''
          this.storage.replaceTerm = ''
          this.storage.results = []
          this.storage.currentIndex = 0
          editor.view.dispatch(editor.state.tr)
          return true
        },
      setSearchTerm:
        (term: string) =>
        ({ editor }) => {
          this.storage.searchTerm = term
          this.storage.results = findMatches(
            editor.state.doc,
            term,
            this.storage.caseSensitive,
          )
          this.storage.currentIndex = 0
          editor.view.dispatch(editor.state.tr)
          return true
        },
      setReplaceTerm:
        (term: string) =>
        () => {
          this.storage.replaceTerm = term
          return true
        },
      toggleCaseSensitive:
        () =>
        ({ editor }) => {
          this.storage.caseSensitive = !this.storage.caseSensitive
          this.storage.results = findMatches(
            editor.state.doc,
            this.storage.searchTerm,
            this.storage.caseSensitive,
          )
          this.storage.currentIndex = 0
          editor.view.dispatch(editor.state.tr)
          return true
        },
      nextSearchResult:
        () =>
        ({ editor }) => {
          if (this.storage.results.length === 0) return false
          this.storage.currentIndex =
            (this.storage.currentIndex + 1) % this.storage.results.length
          const match = this.storage.results[this.storage.currentIndex]
          if (match) {
            editor.commands.setTextSelection(match)
            const dom = editor.view.domAtPos(match.from)
            if (dom?.node) {
              const element = dom.node instanceof HTMLElement ? dom.node : (dom.node as Node).parentElement
              element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          }
          editor.view.dispatch(editor.state.tr)
          return true
        },
      prevSearchResult:
        () =>
        ({ editor }) => {
          if (this.storage.results.length === 0) return false
          this.storage.currentIndex =
            (this.storage.currentIndex - 1 + this.storage.results.length) %
            this.storage.results.length
          const match = this.storage.results[this.storage.currentIndex]
          if (match) {
            editor.commands.setTextSelection(match)
            const dom = editor.view.domAtPos(match.from)
            if (dom?.node) {
              const element = dom.node instanceof HTMLElement ? dom.node : (dom.node as Node).parentElement
              element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          }
          editor.view.dispatch(editor.state.tr)
          return true
        },
      replaceCurrentResult:
        () =>
        ({ editor, tr }) => {
          if (this.storage.results.length === 0) return false
          const match = this.storage.results[this.storage.currentIndex]
          if (!match) return false

          tr.insertText(this.storage.replaceTerm, match.from, match.to)
          editor.view.dispatch(tr)

          // Recompute matches
          this.storage.results = findMatches(
            editor.state.doc,
            this.storage.searchTerm,
            this.storage.caseSensitive,
          )
          if (this.storage.currentIndex >= this.storage.results.length) {
            this.storage.currentIndex = 0
          }
          editor.view.dispatch(editor.state.tr)
          return true
        },
      replaceAllResults:
        () =>
        ({ editor }) => {
          if (this.storage.results.length === 0) return false

          const { tr } = editor.state
          const matches = [...this.storage.results].reverse()
          for (const match of matches) {
            tr.insertText(this.storage.replaceTerm, match.from, match.to)
          }
          editor.view.dispatch(tr)

          this.storage.results = []
          this.storage.currentIndex = 0
          editor.view.dispatch(editor.state.tr)
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        this.editor.commands.openSearch()
        return true
      },
      Escape: () => {
        if (this.storage.isOpen) {
          this.editor.commands.closeSearch()
          return true
        }
        return false
      },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    const options = this.options

    return [
      new Plugin({
        key: searchReplacePluginKey,
        props: {
          decorations: (state) => {
            if (!storage.isOpen || !storage.searchTerm || storage.results.length === 0) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []

            for (let i = 0; i < storage.results.length; i++) {
              const match = storage.results[i]
              const cls =
                i === storage.currentIndex
                  ? `${options.searchResultClass} ${options.searchResultCurrentClass}`
                  : options.searchResultClass
              decorations.push(
                Decoration.inline(match.from, match.to, { class: cls }),
              )
            }

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      openSearch: () => ReturnType
      closeSearch: () => ReturnType
      setSearchTerm: (term: string) => ReturnType
      setReplaceTerm: (term: string) => ReturnType
      toggleCaseSensitive: () => ReturnType
      nextSearchResult: () => ReturnType
      prevSearchResult: () => ReturnType
      replaceCurrentResult: () => ReturnType
      replaceAllResults: () => ReturnType
    }
  }
}
