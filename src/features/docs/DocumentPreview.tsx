/**
 * Lazy-mounted Yjs + read-only Tiptap preview for document list cards.
 * Renders the top of the document (first "page") inside a clipped frame.
 */

import { useEffect, useRef, useState } from 'react'
import { useYjsRoom } from 'deepspace'
import { EditorContent } from '@tiptap/react'
import { FileText } from 'lucide-react'
import { useDocPreviewEditor } from './useDocPreviewEditor'

function useLazyMountInView<T extends Element>(rootMargin = '120px') {
  const ref = useRef<T | null>(null)
  const [shouldMount, setShouldMount] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || shouldMount) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShouldMount(true)
          obs.disconnect()
        }
      },
      { rootMargin, threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [shouldMount, rootMargin])

  return { ref, shouldMount }
}

function DocPreviewEditor({ docId }: { docId: string }) {
  const { doc, synced } = useYjsRoom(docId, 'content')
  const editor = useDocPreviewEditor({ doc })

  if (editor) {
    return (
      <div className="etheris-preview-scroll h-full w-full overflow-hidden bg-el-surface">
        <EditorContent editor={editor} />
      </div>
    )
  }
  if (!synced) {
    return <div className="etheris-preview-skeleton h-full w-full rounded-md" aria-hidden />
  }
  // Synced, TipTap still mounting (immediatelyRender: false) — static, no second pulse.
  return <div className="h-full w-full rounded-md bg-el-bg" aria-hidden />
}

export type DocumentPreviewVariant = 'grid' | 'list'

export function DocumentPreview({
  docId,
  variant = 'grid',
  canPreview = false,
}: {
  docId: string
  variant?: DocumentPreviewVariant
  canPreview?: boolean
}) {
  const { ref, shouldMount } = useLazyMountInView<HTMLDivElement>()

  if (variant === 'list') {
    return (
      <div
        ref={ref}
        className="relative flex h-12 w-10 flex-shrink-0 overflow-hidden rounded border border-el-line bg-el-bg shadow-sm"
        data-testid={`doc-preview-${docId}`}
      >
        {shouldMount && canPreview ? (
          // Slightly lower scale than 0.11/909% so a bit more of the line width is visible; avoids clipping the end of e.g. "2026".
          <div className="absolute inset-0 origin-top-left scale-[0.10] [width:1000%] [height:1000%]">
            <DocPreviewEditor docId={docId} />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-el-muted">
            <FileText className="h-3.5 w-3.5 opacity-50" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="relative mb-4 aspect-[3/4] w-full overflow-hidden rounded-lg border border-black/[0.03] bg-el-bg shadow-sm dark:border-el-line"
      data-testid={`doc-preview-${docId}`}
    >
      {shouldMount && canPreview ? (
        <div className="absolute inset-0 origin-top-left scale-[0.28] [width:357.14%] [height:357.14%]">
          <DocPreviewEditor docId={docId} />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-3/4 w-3/4 rounded-md bg-el-bg" />
        </div>
      )}
    </div>
  )
}
