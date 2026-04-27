/**
 * Google Docs–style document outline: headings from the editor with indent by level.
 */

import { useLayoutEffect, useRef } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'

export type OutlineHeading = {
  level: number
  text: string
  pos: number
  end: number
}

function gatherHeadings(editor: Editor): OutlineHeading[] {
  const items: OutlineHeading[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    items.push({
      level: node.attrs.level as number,
      text: node.textContent.trim() || 'Untitled heading',
      pos,
      end: pos + node.nodeSize,
    })
  })
  return items
}

function activeHeadingIndex(from: number, items: OutlineHeading[]): number {
  if (items.length === 0) return -1
  for (let i = 0; i < items.length; i++) {
    const h = items[i]
    const innerStart = h.pos + 1
    const innerEnd = h.end - 1
    if (from >= innerStart && from <= innerEnd) return i
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].pos < from) return i
  }
  return -1
}

export const DOCUMENT_OUTLINE_WIDTH_PX = 260

export interface DocumentOutlinePanelProps {
  editor: Editor
  /** When false, panel slides off-screen (keep mounted so close transition runs). */
  open: boolean
}

export function DocumentOutlinePanel({ editor, open }: DocumentOutlinePanelProps) {
  const headings = useEditorState({
    editor,
    selector: ({ editor: ed }) => gatherHeadings(ed),
  })
  const selectionFrom = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed.state.selection.from,
  })
  const activeIndex = activeHeadingIndex(selectionFrom, headings)

  const listRef = useRef<HTMLDivElement>(null)
  const activeBtnRef = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (activeIndex < 0 || !activeBtnRef.current || !listRef.current) return
    activeBtnRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIndex, headings.length])

  const goToHeading = (item: OutlineHeading) => {
    const start = item.pos + 1
    editor.chain().focus().setTextSelection(start).scrollIntoView().run()
  }

  return (
    <aside
      data-testid="document-outline-panel"
      aria-hidden={!open}
      className={`doc-outline-panel absolute inset-y-0 left-0 z-[25] flex h-full min-h-0 w-[260px] flex-col border-r border-[#e8eaed] bg-[#f8f9fa] shadow-[4px_0_24px_rgba(0,0,0,0.07)] transition-[transform,box-shadow] duration-200 ease-out will-change-transform print:hidden dark:border-border dark:bg-muted/25 dark:shadow-[4px_0_0_rgba(0,0,0,0.2)] ${
        open ? 'translate-x-0' : 'pointer-events-none -translate-x-full shadow-none'
      }`}
    >
      <div className="shrink-0 border-b border-[#e8eaed] px-3 py-3 dark:border-border">
        <h2 className="truncate pl-1 text-left text-sm font-normal leading-5 text-[#5f6368] dark:text-muted-foreground">
          Document outline
        </h2>
      </div>

      <div
        ref={listRef}
        className="doc-outline-list min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2"
      >
        {headings.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] leading-snug text-[#5f6368] dark:text-muted-foreground">
            Headings you add to the document will appear here.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {headings.map((h, i) => {
              const indentPx = 12 + Math.max(0, h.level - 1) * 12
              const isActive = i === activeIndex
              return (
                <li key={`${h.pos}-${i}`} className="m-0 p-0">
                  <button
                    type="button"
                    ref={isActive ? activeBtnRef : undefined}
                    onClick={() => goToHeading(h)}
                    className={`mb-0.5 w-full rounded-[4px] py-1.5 pr-2 text-left text-[13px] font-normal leading-5 transition-colors ${
                      isActive
                        ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-primary/15 dark:text-primary'
                        : 'text-[#202124] hover:bg-[#f1f3f4] dark:text-foreground dark:hover:bg-muted/60'
                    } `}
                    style={{ paddingLeft: `${indentPx}px` }}
                    title={h.text}
                  >
                    <span className="line-clamp-3 break-words">{h.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
