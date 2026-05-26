/**
 * Static template thumbnail / detail preview (local HTML only — not a live doc).
 */

import { EditorContent } from '@tiptap/react'
import { FileText } from 'lucide-react'
import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from './editor/DocEditorSurface'
import { useTemplatePreviewEditor } from './useTemplatePreviewEditor'

export type TemplatePreviewVariant = 'grid' | 'compact' | 'detail'

/** Scaled editor chrome — first page only, no pointer interaction. */
const PREVIEW_FRAME_CLASS =
  'pointer-events-none select-none [&_.ProseMirror]:pointer-events-none [&_.ProseMirror]:select-none'

type TemplatePreviewProps = {
  content: string
  variant?: TemplatePreviewVariant
  className?: string
}

function PreviewEditorLayer({ editor }: { editor: NonNullable<ReturnType<typeof useTemplatePreviewEditor>> }) {
  return (
    <div className={`etheris-preview-scroll h-full w-full overflow-hidden bg-el-surface ${PREVIEW_FRAME_CLASS}`}>
      <EditorContent editor={editor} />
    </div>
  )
}

export function TemplatePreview({
  content,
  variant = 'grid',
  className = '',
}: TemplatePreviewProps) {
  const editor = useTemplatePreviewEditor(content)

  if (variant === 'compact') {
    return (
      <div
        className={`relative mb-2 h-[4.5rem] w-full shrink-0 overflow-hidden rounded-md border border-black/[0.03] bg-el-bg shadow-sm dark:border-el-line ${PREVIEW_FRAME_CLASS} ${className}`}
        data-testid="template-preview-compact"
        aria-hidden
      >
        {editor ? (
          <div className={`absolute inset-0 origin-top-left scale-[0.18] [height:555.56%] [width:555.56%] ${PREVIEW_FRAME_CLASS}`}>
            <PreviewEditorLayer editor={editor} />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-el-muted">
            <FileText className="h-4 w-4 opacity-40" />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'detail') {
    /** One letter-size page, clipped — same proportions as library doc cards. */
    const detailScale = 280 / PAGE_WIDTH_PX
    return (
      <div
        className={`mx-auto w-full max-w-[280px] overflow-hidden rounded-lg border border-el-line bg-el-bg shadow-sm ${PREVIEW_FRAME_CLASS} ${className}`}
        style={{ aspectRatio: `${PAGE_WIDTH_PX} / ${PAGE_HEIGHT_PX}` }}
        data-testid="template-preview-detail"
      >
        <div
          className={`relative w-full overflow-hidden ${PREVIEW_FRAME_CLASS}`}
          style={{ aspectRatio: `${PAGE_WIDTH_PX} / ${PAGE_HEIGHT_PX}` }}
        >
          {editor ? (
            <div
              className={`absolute left-0 top-0 origin-top-left ${PREVIEW_FRAME_CLASS}`}
              style={{
                width: PAGE_WIDTH_PX,
                height: PAGE_HEIGHT_PX,
                transform: `scale(${detailScale})`,
                transformOrigin: 'top left',
              }}
            >
              <PreviewEditorLayer editor={editor} />
            </div>
          ) : (
            <div className="etheris-preview-skeleton absolute inset-0 rounded-md" aria-hidden />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative mb-3 aspect-[3/4] w-full overflow-hidden rounded-lg border border-black/[0.03] bg-el-bg shadow-sm dark:border-el-line ${PREVIEW_FRAME_CLASS} ${className}`}
      data-testid="template-preview-thumb"
      aria-hidden
    >
      {editor ? (
        <div className={`absolute inset-0 origin-top-left scale-[0.28] [height:357.14%] [width:357.14%] ${PREVIEW_FRAME_CLASS}`}>
          <PreviewEditorLayer editor={editor} />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-el-muted">
          <FileText className="h-5 w-5 opacity-40" />
        </div>
      )}
    </div>
  )
}
