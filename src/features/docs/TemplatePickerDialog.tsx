/**
 * Template gallery — preview locally, create a document only when the user confirms.
 */

import { useEffect, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui'
import { TemplatePreview } from './TemplatePreview'
import { TEMPLATES, type DocTemplate } from './types'

type TemplatePickerDialogProps = {
  open: boolean
  onClose: () => void
  onUseTemplate: (template: DocTemplate) => void | Promise<void>
}

export function TemplatePickerDialog({
  open,
  onClose,
  onUseTemplate,
}: TemplatePickerDialogProps) {
  const [selected, setSelected] = useState<DocTemplate>(TEMPLATES[0])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(TEMPLATES[0])
      setSubmitting(false)
    }
  }, [open])

  const handleUseTemplate = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onUseTemplate(selected)
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[min(680px,90vh)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-el-line bg-el-surface p-0 shadow-xl sm:max-w-5xl"
        data-testid="template-picker-dialog"
        onInteractOutside={(event) => {
          if (submitting) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault()
        }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {submitting ? (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-el-surface/95 backdrop-blur-[2px]"
            data-testid="template-creating-overlay"
          >
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-el-accent/30 border-t-el-accent" />
            <p className="mt-4 text-sm font-semibold text-el-text">Creating your document…</p>
            <p className="mt-1 text-[13px] text-el-muted">{selected.name}</p>
          </div>
        ) : null}

        <DialogHeader className="shrink-0 space-y-1 border-b border-el-line px-6 py-5 text-left">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-el-line bg-el-bg text-el-accent">
              <LayoutTemplate className="h-4 w-4" />
            </span>
            <DialogTitle className="text-xl font-semibold tracking-tight text-el-text">
              Templates
            </DialogTitle>
          </div>
          <DialogDescription className="text-[13px] text-el-muted">
            Preview a starter layout like your document cards. Nothing is created until you choose
            &ldquo;Use template&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-[min(480px,calc(92vh-11rem))] lg:flex-row">
          <div className="shrink-0 border-el-line lg:w-[min(400px,42%)] lg:border-r">
            <div className="grid grid-cols-2 gap-3 p-4">
              {TEMPLATES.map((template) => {
                const isSelected = selected.name === template.name
                return (
                  <button
                    key={template.name}
                    type="button"
                    disabled={submitting}
                    onClick={() => setSelected(template)}
                    aria-pressed={isSelected}
                    data-testid={`template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`group relative isolate overflow-hidden rounded-xl border p-2.5 text-left transition-all disabled:opacity-60 ${
                      isSelected
                        ? 'z-10 border-el-accent/50 bg-el-bg shadow-sm ring-1 ring-el-accent/25'
                        : 'z-0 border-el-line bg-el-surface hover:border-el-accent/35 hover:shadow-sm'
                    }`}
                  >
                    <TemplatePreview content={template.content} variant="compact" />
                    <div className="relative z-10 flex items-start gap-1.5">
                      <span className="mt-0.5 inline-flex shrink-0 rounded-md border border-el-line bg-el-bg px-1 py-0.5 font-mono text-[9px] font-semibold leading-none text-el-accent">
                        {template.icon}
                      </span>
                      <div className="min-w-0">
                        <h3
                          className={`truncate text-[12px] font-semibold leading-snug ${
                            isSelected ? 'text-el-accent' : 'text-el-text group-hover:text-el-accent'
                          }`}
                        >
                          {template.name}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-el-muted">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 lg:p-6">
            <div className="mb-4 min-w-0 shrink-0">
              <h2 className="truncate text-lg font-semibold text-el-text">{selected.name}</h2>
              <p className="mt-1 text-[13px] text-el-muted">{selected.description}</p>
            </div>
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden">
              <TemplatePreview
                key={selected.name}
                content={selected.content}
                variant="detail"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-el-line px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="text-el-muted hover:text-el-text"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleUseTemplate()}
            disabled={submitting}
            loading={submitting}
            data-testid="template-use-btn"
            className="h-9 rounded-lg bg-el-accent px-4 text-[12px] font-bold text-white shadow-sm hover:bg-el-accent hover:opacity-90"
          >
            Use template
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
