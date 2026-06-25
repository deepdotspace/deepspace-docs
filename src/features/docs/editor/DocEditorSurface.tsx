/**
 * Letter-size paged editor surface.
 *
 * Pagination spacers are ProseMirror widget decorations (not Yjs content).
 * Matches doctesting's view.setProps decoration merge — separate pagination
 * plugins can interfere with yCursorPlugin decoration ordering.
 */
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

const PX_PER_IN = 96
const PAGE_W_IN = 8.5
const PAGE_H_IN = 11
export const PAGE_HEIGHT_PX = Math.round(PAGE_H_IN * PX_PER_IN)
export const PAGE_WIDTH_PX = Math.round(PAGE_W_IN * PX_PER_IN)
export const GAP_PX = 24
const PAGE_STRIDE_PX = PAGE_HEIGHT_PX + GAP_PX
const PAGE_EPSILON_PX = 3
const MAX_SOFT_PAGE_BREAKS = 80
const PAGINATION_UPDATE_DELAY_MS = 180

type PageMetricStyle = CSSProperties &
  Record<'--doc-page-width' | '--doc-page-height' | '--doc-page-gap', string>

export const TYPICAL_WORDS_PER_PAGE = 480

type SoftPageBreak = {
  pos: number
  height: number
}

/**
 * Block types that must never be sliced by a page boundary — there is no
 * meaningful split point inside them, so the whole node moves to the next page
 * instead. Related to the `page-break-inside: avoid` print rules in editor.css,
 * though not identical: those also cover `pre` (code blocks), which we still
 * allow to slice on screen.
 */
const KEEP_TOGETHER_NODES = new Set(['image', 'table', 'horizontalRule'])

function isKeepTogether(node: ProseMirrorNode): boolean {
  if (KEEP_TOGETHER_NODES.has(node.type.name)) return true
  // A block (e.g. a paragraph) whose sole child is an image — a chart dropped
  // on its own line — is treated as one indivisible unit.
  const onlyChild = node.childCount === 1 ? node.firstChild : null
  return !!onlyChild && KEEP_TOGETHER_NODES.has(onlyChild.type.name)
}

/**
 * If the page boundary at `pageBottom` cuts through a keep-together block that
 * would still fit on a page by itself, return the position + top offset to
 * break *before* it, dropping the whole block onto the next page. Returns null
 * when no such block straddles the boundary (or it is taller than a page and
 * therefore cannot be rescued), so the caller falls back to a line-level break.
 *
 * `domTop` is the surface's viewport top; offsets are returned relative to it.
 */
function keepTogetherBreakBefore(
  view: EditorView,
  domTop: number,
  pageBottom: number,
  pageBodyHeight: number,
  lastBreakPos: number,
  probePos: number,
): { pos: number; topY: number } | null {
  const { doc } = view.state
  const $pos = doc.resolve(Math.max(0, Math.min(probePos, doc.content.size)))

  // The straddling top-level block may sit on either side of the probe — e.g.
  // an atomic image resolves the probe to the gap before or after it. Only the
  // depth-1 ancestor is inspected, so a keep-together node nested inside a list
  // item or blockquote is not rescued (a rare case, left to line-level breaks).
  const candidates: { node: ProseMirrorNode; start: number }[] = []
  if ($pos.depth >= 1) {
    candidates.push({ node: $pos.node(1), start: $pos.before(1) })
  } else {
    if ($pos.nodeBefore) {
      candidates.push({ node: $pos.nodeBefore, start: $pos.pos - $pos.nodeBefore.nodeSize })
    }
    if ($pos.nodeAfter) {
      candidates.push({ node: $pos.nodeAfter, start: $pos.pos })
    }
  }

  for (const { node, start } of candidates) {
    if (start <= lastBreakPos || !isKeepTogether(node)) continue
    const el = view.nodeDOM(start)
    if (!(el instanceof HTMLElement)) continue
    const rect = el.getBoundingClientRect()
    const top = rect.top - domTop
    const bottom = rect.bottom - domTop
    const straddles = top < pageBottom - PAGE_EPSILON_PX && bottom > pageBottom + PAGE_EPSILON_PX
    const fitsOnAPage = rect.height <= pageBodyHeight + PAGE_EPSILON_PX
    if (straddles && fitsOnAPage) {
      return { pos: start, topY: top }
    }
  }
  return null
}

function pageCountForBodyHeight(bodyHeight: number, pageBodyHeight: number) {
  let pages = 1
  while (bodyHeight > (pages - 1) * PAGE_STRIDE_PX + pageBodyHeight + PAGE_EPSILON_PX) {
    pages += 1
  }
  return pages
}

function makeSoftPageBreakDecorations(editor: Editor, breaks: SoftPageBreak[]) {
  if (breaks.length === 0) return DecorationSet.empty

  const docSize = editor.state.doc.content.size
  return DecorationSet.create(
    editor.state.doc,
    breaks.map((pageBreak, index) =>
      Decoration.widget(
        Math.min(pageBreak.pos, docSize),
        () => {
          const spacer = document.createElement('span')
          spacer.className = 'doc-soft-page-break'
          spacer.style.height = `${pageBreak.height}px`
          spacer.contentEditable = 'false'
          spacer.setAttribute('aria-hidden', 'true')
          return spacer
        },
        {
          key: `doc-page-break-${index}-${pageBreak.pos}-${Math.round(pageBreak.height)}`,
          side: 1,
          ignoreSelection: true,
        },
      ),
    ),
  )
}

type DocEditorSurfaceProps = {
  editor: Editor
  onPageCountChange: (n: number) => void
}

export function DocEditorSurface({ editor, onPageCountChange }: DocEditorSurfaceProps) {
  const [pageCount, setPageCount] = useState(1)
  const pageBreaksRef = useRef<SoftPageBreak[]>([])
  const rafRef = useRef<number | undefined>(undefined)
  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const report = useCallback(
    (n: number) => {
      onPageCountChange(n)
      setPageCount((prev) => (prev === n ? prev : n))
    },
    [onPageCountChange],
  )

  useLayoutEffect(() => {
    const view = editor.view
    const dom = view?.dom
    if (!dom) return

    const viewIsAlive = () => !editor.isDestroyed

    const previousDecorations = view.props.decorations
    const refreshDecorations = () => {
      if (!viewIsAlive()) return
      view.dispatch(
        view.state.tr.setMeta('addToHistory', false).setMeta('docPagination', true),
      )
    }

    view.setProps({
      decorations: (state) => {
        const externalDecorations =
          typeof previousDecorations === 'function'
            ? previousDecorations(state)
            : previousDecorations
        const pageDecorations = makeSoftPageBreakDecorations(editor, pageBreaksRef.current)

        if (!externalDecorations) return pageDecorations
        const externalDecorationItems: Decoration[] = []
        externalDecorations.forEachSet((set) => {
          externalDecorationItems.push(...set.find())
        })
        return DecorationSet.create(state.doc, [
          ...externalDecorationItems,
          ...pageDecorations.find(),
        ])
      },
    })

    const recalc = () => {
      if (recalcTimerRef.current !== undefined) {
        clearTimeout(recalcTimerRef.current)
        recalcTimerRef.current = undefined
      }
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined
        if (!viewIsAlive()) return
        const shell = dom.closest<HTMLElement>('.doc-paged-content')
        if (!shell) return

        const shellStyle = window.getComputedStyle(shell)
        const paddingTop = Number.parseFloat(shellStyle.paddingTop) || 0
        const paddingBottom = Number.parseFloat(shellStyle.paddingBottom) || 0
        const pageBodyHeight = PAGE_HEIGHT_PX - paddingTop - paddingBottom

        pageBreaksRef.current = []
        refreshDecorations()

        let lastBreakPos = -1
        for (let pageIndex = 0; pageIndex < MAX_SOFT_PAGE_BREAKS; pageIndex += 1) {
          if (!viewIsAlive()) return
          const bodyHeight = dom.scrollHeight
          const pageBottom = pageIndex * PAGE_STRIDE_PX + pageBodyHeight
          if (bodyHeight <= pageBottom + PAGE_EPSILON_PX) break

          const domRect = dom.getBoundingClientRect()
          const posAtBoundary = view.posAtCoords({
            left: domRect.right - 2,
            top: domRect.top + pageBottom - 2,
          })

          if (!posAtBoundary || posAtBoundary.pos <= lastBreakPos) break

          // Decide *where* to break. Default: just below the last line that
          // fits on this page. But if an unsplittable block (image / graph /
          // table) or a single line of text straddles the page edge, break
          // *before* it so the whole unit drops onto the next page instead of
          // being sliced and left dangling in the gap between pages.
          let breakPos = posAtBoundary.pos
          let breakTopY: number

          const keptWhole = keepTogetherBreakBefore(
            view,
            domRect.top,
            pageBottom,
            pageBodyHeight,
            lastBreakPos,
            posAtBoundary.pos,
          )
          if (keptWhole) {
            breakPos = keptWhole.pos
            breakTopY = keptWhole.topY
          } else {
            const coords = view.coordsAtPos(posAtBoundary.pos)
            const lineTop = coords.top - domRect.top
            const lineBottom = coords.bottom - domRect.top
            if (lineTop < pageBottom - PAGE_EPSILON_PX && lineBottom > pageBottom + PAGE_EPSILON_PX) {
              // The boundary slices through a line of text — break at the line's
              // start so the whole line moves down rather than half-clipping.
              // Assumes LTR: probes the left edge for the visual line start.
              const lineStart = view.posAtCoords({
                left: domRect.left + 1,
                top: coords.top + 1,
              })
              if (lineStart && lineStart.pos > lastBreakPos) {
                breakPos = lineStart.pos
                breakTopY = lineTop
              } else {
                breakTopY = lineBottom
              }
            } else {
              breakTopY = lineBottom
            }
          }

          if (breakPos <= lastBreakPos) break

          const breakY = Math.max(breakTopY, pageIndex * PAGE_STRIDE_PX)
          const breakHeight = Math.max(0, (pageIndex + 1) * PAGE_STRIDE_PX - breakY)

          if (breakHeight <= PAGE_EPSILON_PX) break

          lastBreakPos = breakPos
          pageBreaksRef.current = [
            ...pageBreaksRef.current,
            { pos: breakPos, height: breakHeight },
          ]
          refreshDecorations()
        }

        if (!viewIsAlive()) return
        const pagedBodyHeight = dom.scrollHeight
        const measuredPages = pageCountForBodyHeight(pagedBodyHeight, pageBodyHeight)
        report(measuredPages)
      })
    }

    const scheduleRecalc = () => {
      if (recalcTimerRef.current !== undefined) clearTimeout(recalcTimerRef.current)
      recalcTimerRef.current = setTimeout(() => {
        recalcTimerRef.current = undefined
        if (!viewIsAlive()) return
        recalc()
      }, PAGINATION_UPDATE_DELAY_MS)
    }

    const ro = new ResizeObserver(() => {
      if (!viewIsAlive()) return
      recalc()
    })
    ro.observe(dom)
    recalc()
    editor.on('update', scheduleRecalc)

    return () => {
      if (recalcTimerRef.current !== undefined) clearTimeout(recalcTimerRef.current)
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
      recalcTimerRef.current = undefined
      rafRef.current = undefined
      ro.disconnect()
      editor.off('update', scheduleRecalc)
      pageBreaksRef.current = []
      if (!viewIsAlive()) return
      view.setProps({ decorations: previousDecorations })
      refreshDecorations()
    }
  }, [editor, report])

  const stackHeight = pageCount * PAGE_HEIGHT_PX + Math.max(0, pageCount - 1) * GAP_PX
  const pageMetricStyle: PageMetricStyle = {
    '--doc-page-width': `${PAGE_WIDTH_PX}px`,
    '--doc-page-height': `${PAGE_HEIGHT_PX}px`,
    '--doc-page-gap': `${GAP_PX}px`,
  }

  return (
    <div className="doc-editor-canvas h-full min-h-0 w-full flex-1 overflow-auto overscroll-y-contain print:block print:!h-auto print:!overflow-visible print:!bg-white">
      <div className="doc-editor-inner pointer-events-auto mx-auto w-full max-w-full px-2 py-3 sm:px-3 sm:py-4 md:py-5">
        <div className="doc-page-frame relative mx-auto" style={pageMetricStyle}>
          <div className="doc-page-stack relative" style={{ minHeight: `${stackHeight}px` }}>
            {Array.from({ length: pageCount }, (_, index) => (
              <div
                key={index}
                className="doc-page-face pointer-events-none absolute left-0 top-0 rounded-sm border border-black/[0.04] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.06)] print:static print:h-auto print:shadow-none print:border-0 dark:border-border/20 dark:shadow-[0_0_0_0.5px_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.45)]"
                style={{ transform: `translateY(${index * PAGE_STRIDE_PX}px)` }}
              />
            ))}
            <div
              className="doc-paged-content doc-page-padding relative z-10 box-border"
              style={{ maxWidth: '100%', minHeight: `${stackHeight}px` }}
            >
              <EditorContent
                editor={editor}
                className="tiptap doc-editor-page"
                data-testid="editor-content"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
