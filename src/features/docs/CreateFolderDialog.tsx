/**
 * Create-folder dialog
 *
 * Replaces `window.prompt('Folder name')` with an in-app modal that follows
 * the docs visual language: el-accent blue header icon, frosted Dialog
 * panel, primary blue Create button.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FolderPlus } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

export interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string) => void | Promise<void>
  /** Optional override; defaults to "New folder". */
  title?: string
  /** Optional override; defaults to a short helper line. */
  description?: string
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onCreate,
  title = 'New folder',
  description = 'Give your folder a name. You can rename it later.',
}: CreateFolderDialogProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setName('')
      setSubmitting(false)
      return
    }
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && !submitting

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate(trimmed)
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="create-folder-dialog"
        className="sm:max-w-[420px] gap-5 border-el-line bg-el-surface/95"
      >
        <DialogHeader className="items-start gap-3 sm:flex-row sm:items-center sm:space-y-0">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-el-accent/10 text-el-accent ring-1 ring-inset ring-el-accent/20"
          >
            <FolderPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-el-text">{title}</DialogTitle>
            <DialogDescription className="text-el-muted">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            data-testid="create-folder-input"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
            className="border-el-line bg-el-bg text-el-text placeholder:text-el-muted/70 focus-visible:ring-2 focus-visible:ring-el-accent/40 focus-visible:border-el-accent/60"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-el-muted hover:bg-el-bg hover:text-el-text"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              disabled={!canSubmit}
              data-testid="create-folder-submit"
              className="bg-el-accent text-white shadow-sm hover:bg-el-accent/90 focus-visible:ring-2 focus-visible:ring-el-accent/40"
            >
              Create folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
