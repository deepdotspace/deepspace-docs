/**
 * Rich Text Toolbar — Google Docs-style fixed toolbar.
 *
 * Grouped sections:
 * [Undo|Redo] | [Paragraph/H1-H3] | [B|I|U|S] |
 * [Color|Highlight] | [Align] | [Lists] |
 * [Link|Image|Table|HR] | [Sub|Sup|Code|CodeBlock] | [Clear]
 */

import { useCallback, useEffect, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Palette,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Link as LinkIcon,
  ImageIcon,
  Table as TableIcon,
  Minus,
  Subscript,
  Superscript,
  Code,
  Code2,
  RemoveFormatting,
  Quote,
  Indent,
  Outdent,
  MessageSquarePlus,
  Plus,
} from 'lucide-react'

import { PAGE_ZOOM_PRESETS, normalizeCanvasZoom } from './pageZoomPresets'

export interface EditorToolbarProps {
  editor: Editor
  disabled?: boolean
  onAddComment?: () => void
  /** Page canvas zoom (editor area only); discrete presets in toolbar. */
  canvasZoom?: number
  onCanvasZoomChange?: (zoom: number) => void
}

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  testId,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  testId: string
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-primary/20 text-primary'
          : disabled
            ? 'text-muted-foreground/40 cursor-not-allowed'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-6 bg-border mx-1 self-center" />
}

// ---------------------------------------------------------------------------
// Heading Dropdown
// ---------------------------------------------------------------------------

function HeadingDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)

  const current = editor.isActive('heading', { level: 1 })
    ? 'H1'
    : editor.isActive('heading', { level: 2 })
      ? 'H2'
      : editor.isActive('heading', { level: 3 })
        ? 'H3'
        : 'Text'

  const items = [
    { label: 'Text', action: () => editor.chain().focus().setParagraph().run() },
    { label: 'H1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'H2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'H3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="toolbar-heading-dropdown"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[60px]"
      >
        {current}
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
            {items.map(({ label, action }) => (
              <button
                key={label}
                type="button"
                data-testid={`toolbar-heading-${label.toLowerCase()}`}
                onClick={() => {
                  action()
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                  current === label ? 'text-primary font-medium' : 'text-popover-foreground'
                }`}
              >
                {label === 'H1' ? (
                  <span className="text-lg font-bold">Heading 1</span>
                ) : label === 'H2' ? (
                  <span className="text-base font-semibold">Heading 2</span>
                ) : label === 'H3' ? (
                  <span className="text-sm font-semibold">Heading 3</span>
                ) : (
                  <span>Normal text</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page zoom (canvas)
// ---------------------------------------------------------------------------

function PageZoomDropdown({
  canvasZoom,
  onCanvasZoomChange,
}: {
  canvasZoom: number
  onCanvasZoomChange: (z: number) => void
}) {
  const [open, setOpen] = useState(false)
  const normalized = normalizeCanvasZoom(canvasZoom)
  const label =
    PAGE_ZOOM_PRESETS.find((p) => Math.abs(p.value - normalized) < 0.001)?.label ??
    `${Math.round(canvasZoom * 100)}%`

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="toolbar-page-zoom"
        title="Page zoom"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[3.25rem] tabular-nums"
      >
        {label}
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[5.5rem]">
            {PAGE_ZOOM_PRESETS.map(({ label: lb, value }) => {
              const selected = Math.abs(value - normalized) < 0.001
              return (
                <button
                  key={value}
                  type="button"
                  data-testid={`toolbar-page-zoom-${Math.round(value * 100)}`}
                  onClick={() => {
                    onCanvasZoomChange(value)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors tabular-nums ${
                    selected ? 'text-primary font-medium' : 'text-popover-foreground'
                  }`}
                >
                  {lb}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Font family
// ---------------------------------------------------------------------------

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: 'Courier New, Courier, monospace' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif' },
  { label: 'Palatino', value: 'Palatino Linotype, Palatino, serif' },
  { label: 'Garamond', value: 'Garamond, Baskerville, serif' },
  { label: 'Lucida Sans', value: 'Lucida Sans Unicode, Lucida Grande, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'System UI', value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
]

function FontFamilyDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const current = useEditorState({
    editor,
    selector: (snap) =>
      (snap.editor.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
  })

  const currentLabel =
    FONT_OPTIONS.find((f) => f.value === current)?.label ??
    (current ? (current.split(',')[0]?.trim() ?? 'Font') : 'Font')

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="toolbar-font-family"
        title="Font"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors max-w-[7.5rem] min-w-[4rem]"
      >
        <span className="truncate">{currentLabel}</span>
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[11rem] max-h-[min(280px,50vh)] overflow-y-auto">
            {FONT_OPTIONS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                data-testid={`toolbar-font-${label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => {
                  if (!value) editor.chain().focus().unsetFontFamily().run()
                  else editor.chain().focus().setFontFamily(value).run()
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                  current === value ? 'text-primary font-medium' : 'text-popover-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Align & indent (single dropdown)
// ---------------------------------------------------------------------------

function AlignIndentDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)

  const { align, canIndent, canOutdent } = useEditorState({
    editor,
    selector: (snap) => {
      const ed = snap.editor
      const a: 'left' | 'center' | 'right' | 'justify' = ed.isActive({ textAlign: 'center' })
        ? 'center'
        : ed.isActive({ textAlign: 'right' })
          ? 'right'
          : ed.isActive({ textAlign: 'justify' })
            ? 'justify'
            : 'left'
      return {
        align: a,
        canIndent: ed.can().sinkListItem('listItem'),
        canOutdent: ed.can().liftListItem('listItem'),
      }
    },
  })

  const ActiveAlignIcon =
    align === 'center'
      ? AlignCenter
      : align === 'right'
        ? AlignRight
        : align === 'justify'
          ? AlignJustify
          : AlignLeft

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="toolbar-align-indent-menu"
        title="Alignment & indent"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <ActiveAlignIcon className="w-4 h-4" />
        <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[11rem]">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Alignment
            </div>
            {(
              [
                { id: 'left' as const, label: 'Align left', Icon: AlignLeft },
                { id: 'center' as const, label: 'Align center', Icon: AlignCenter },
                { id: 'right' as const, label: 'Align right', Icon: AlignRight },
                { id: 'justify' as const, label: 'Justify', Icon: AlignJustify },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                data-testid={`toolbar-align-${id}`}
                onClick={() => {
                  editor.chain().focus().setTextAlign(id).run()
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                  align === id ? 'text-primary font-medium' : 'text-popover-foreground'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-80" />
                {label}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Indentation
            </div>
            <button
              type="button"
              data-testid="toolbar-indent"
              disabled={!canIndent}
              onClick={() => {
                editor.chain().focus().sinkListItem('listItem').run()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Indent className="w-4 h-4 shrink-0 opacity-80" />
              Increase indent
            </button>
            <button
              type="button"
              data-testid="toolbar-outdent"
              disabled={!canOutdent}
              onClick={() => {
                editor.chain().focus().liftListItem('listItem').run()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Outdent className="w-4 h-4 shrink-0 opacity-80" />
              Decrease indent
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Link Dialog
// ---------------------------------------------------------------------------

function LinkButton({ editor }: { editor: Editor }) {
  const [showInput, setShowInput] = useState(false)
  const [url, setUrl] = useState('')

  const handleSubmit = useCallback(() => {
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      const href = url.match(/^https?:\/\//) ? url : `https://${url}`
      editor.chain().focus().setLink({ href }).run()
    }
    setUrl('')
    setShowInput(false)
  }, [editor, url])

  if (showInput) {
    return (
      <div className="relative">
        <div className="fixed inset-0 z-40" onClick={() => setShowInput(false)} />
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="https://..."
            className="bg-background border border-input rounded px-2 py-1 text-sm text-foreground w-56 outline-none focus:border-primary"
            autoFocus
            data-testid="toolbar-link-input"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-hover transition-colors"
            data-testid="toolbar-link-confirm"
          >
            OK
          </button>
        </div>
      </div>
    )
  }

  return (
    <ToolbarButton
      onClick={() => {
        const existing = editor.getAttributes('link').href ?? ''
        setUrl(existing)
        setShowInput(true)
      }}
      active={editor.isActive('link')}
      testId="toolbar-link"
      title="Link (Cmd+K)"
    >
      <LinkIcon className="w-4 h-4" />
    </ToolbarButton>
  )
}

// ---------------------------------------------------------------------------
// Image Dialog
// ---------------------------------------------------------------------------

function ImageButton({ editor }: { editor: Editor }) {
  const [showInput, setShowInput] = useState(false)
  const [url, setUrl] = useState('')

  const handleSubmit = useCallback(() => {
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
    setUrl('')
    setShowInput(false)
  }, [editor, url])

  if (showInput) {
    return (
      <div className="relative">
        <div className="fixed inset-0 z-40" onClick={() => setShowInput(false)} />
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Image URL..."
            className="bg-background border border-input rounded px-2 py-1 text-sm text-foreground w-56 outline-none focus:border-primary"
            autoFocus
            data-testid="toolbar-image-input"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-hover transition-colors"
            data-testid="toolbar-image-confirm"
          >
            OK
          </button>
        </div>
      </div>
    )
  }

  return (
    <ToolbarButton
      onClick={() => setShowInput(true)}
      testId="toolbar-image"
      title="Image"
    >
      <ImageIcon className="w-4 h-4" />
    </ToolbarButton>
  )
}

// ---------------------------------------------------------------------------
// Color Picker
// ---------------------------------------------------------------------------

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Black', value: '#000000' },
  { label: 'Dark gray', value: '#374151' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Light gray', value: '#9ca3af' },
  { label: 'White', value: '#ffffff' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Fuchsia', value: '#d946ef' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Brown', value: '#92400e' },
]

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Amber', value: '#fde68a' },
  { label: 'Orange', value: '#fdba74' },
  { label: 'Peach', value: '#ffedd5' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Rose', value: '#fecdd3' },
  { label: 'Red', value: '#fecaca' },
  { label: 'Mint', value: '#d1fae5' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Lime', value: '#d9f99d' },
  { label: 'Teal', value: '#99f6e4' },
  { label: 'Cyan', value: '#a5f3fc' },
  { label: 'Sky', value: '#bae6fd' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Indigo', value: '#c7d2fe' },
  { label: 'Violet', value: '#ddd6fe' },
  { label: 'Purple', value: '#e9d5ff' },
  { label: 'Gray', value: '#e5e7eb' },
  { label: 'Dark gray', value: '#d1d5db' },
]

function ColorPickerButton({
  editor,
  type,
}: {
  editor: Editor
  type: 'text' | 'highlight'
}) {
  const [open, setOpen] = useState(false)
  const colors = type === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS
  const Icon = type === 'text' ? Palette : Highlighter
  const isActive =
    type === 'text'
      ? !!editor.getAttributes('textStyle').color
      : editor.isActive('highlight')
  const currentColor =
    type === 'text'
      ? editor.getAttributes('textStyle').color ?? ''
      : (editor.getAttributes('highlight').color as string) ?? ''

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid={type === 'text' ? 'toolbar-color' : 'toolbar-highlight'}
        title={type === 'text' ? 'Text Color' : 'Highlight'}
        className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${
          isActive
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <Icon className="w-4 h-4" />
        <div
          className="w-4 h-1 rounded-sm"
          style={{ backgroundColor: currentColor || (type === 'text' ? '#6b7280' : '#fbbf24') }}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-6 gap-1.5 w-[188px]">
              {colors.map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  data-testid={`color-${type}-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    if (type === 'text') {
                      if (!value) {
                        editor.chain().focus().unsetColor().run()
                      } else {
                        editor.chain().focus().setColor(value).run()
                      }
                    } else {
                      if (!value) {
                        editor.chain().focus().unsetHighlight().run()
                      } else {
                        editor.chain().focus().toggleHighlight({ color: value }).run()
                      }
                    }
                    setOpen(false)
                  }}
                  className={`h-7 w-7 rounded border transition-colors ${
                    currentColor === value
                      ? 'border-primary ring-1 ring-primary'
                      : value === '#ffffff' || value === ''
                        ? 'border-border hover:border-foreground/40'
                        : 'border-border/60 hover:border-foreground/30'
                  }`}
                  style={{
                    backgroundColor: value || (type === 'text' ? 'var(--color-foreground)' : 'transparent'),
                  }}
                >
                  {!value && type === 'highlight' && (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Font Size Dropdown (numeric pt scale, Google Docs–style)
// ---------------------------------------------------------------------------

/** Matches `.tiptap.doc-editor-page { font-size: 11pt }` — used when no inline size is set. */
const DEFAULT_BODY_FONT_PT = 11

/** Common preset sizes (pt), similar to Google Docs. */
const FONT_SIZE_PT_PRESETS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
] as const

/** Convert stored CSS font-size (e.g. from Tiptap textStyle) to pt for display / menu match. */
function fontSizeCssToPt(css: string | undefined | null): number | null {
  if (css == null || !String(css).trim()) return null
  const s = String(css).trim().toLowerCase()
  const m = s.match(/^([\d.]+)\s*(pt|px)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (Number.isNaN(n)) return null
  const unit = m[2] ?? 'pt'
  if (unit === 'pt') return n
  if (unit === 'px') return (n * 72) / 96
  return null
}

const FONT_SIZE_PT_MIN = 8
const FONT_SIZE_PT_MAX = 96

function FontSizeControl({ editor }: { editor: Editor }) {
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const fontSizeRaw = useEditorState({
    editor,
    selector: (snap) => (snap.editor.getAttributes('textStyle').fontSize as string | undefined) ?? '',
  })
  const explicitPt = fontSizeCssToPt(fontSizeRaw)
  const displayPt =
    explicitPt != null ? Math.round(explicitPt) : DEFAULT_BODY_FONT_PT
  const isInherit = explicitPt == null

  useEffect(() => {
    setDraft(String(displayPt))
  }, [displayPt])

  const applyPt = (pt: number) => {
    const cl = Math.max(FONT_SIZE_PT_MIN, Math.min(FONT_SIZE_PT_MAX, Math.round(pt)))
    editor.chain().focus().setFontSize(`${cl}pt`).run()
  }

  const commitDraft = () => {
    const n = Number.parseInt(draft, 10)
    if (!Number.isFinite(n)) {
      setDraft(String(displayPt))
      return
    }
    applyPt(n)
  }

  return (
    <div className="relative flex items-center">
      <div
        className="flex items-center rounded-md border border-border/80 bg-muted/15 pr-0.5"
        title={
          isInherit
            ? `Inherits paragraph size (body default ${DEFAULT_BODY_FONT_PT} pt)`
            : 'Font size (pt)'
        }
      >
        <button
          type="button"
          data-testid="toolbar-fontsize-minus"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          disabled={displayPt <= FONT_SIZE_PT_MIN}
          onClick={() => applyPt(displayPt - 1)}
          aria-label="Decrease font size"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          data-testid="toolbar-font-size-input"
          className="h-7 w-9 border-0 bg-transparent px-0.5 text-center text-sm tabular-nums text-foreground outline-none focus:ring-0"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitDraft()
            }
          }}
          aria-label="Font size in points"
        />
        <button
          type="button"
          data-testid="toolbar-fontsize-plus"
          className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          disabled={displayPt >= FONT_SIZE_PT_MAX}
          onClick={() => applyPt(displayPt + 1)}
          aria-label="Increase font size"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-testid="toolbar-font-size"
          className="flex h-7 w-6 shrink-0 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setPresetsOpen(!presetsOpen)}
          aria-label="Font size presets"
        >
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>
      </div>
      {presetsOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPresetsOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-[min(320px,70vh)] min-w-[7rem] overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg">
            {FONT_SIZE_PT_PRESETS.map((pt) => {
              const selected =
                !isInherit && explicitPt != null && Math.round(explicitPt) === pt
              return (
                <button
                  key={pt}
                  type="button"
                  data-testid={`toolbar-fontsize-${pt}`}
                  onClick={() => {
                    editor.chain().focus().setFontSize(`${pt}pt`).run()
                    setPresetsOpen(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-muted ${
                    selected ? 'font-medium text-primary' : 'text-popover-foreground'
                  }`}
                >
                  {pt}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table Context Menu (shown when cursor is inside a table)
// ---------------------------------------------------------------------------

function TableContextMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)

  if (!editor.isActive('table')) return null

  const actions = [
    { label: 'Add Row Above', action: () => editor.chain().focus().addRowBefore().run(), testId: 'table-add-row-above' },
    { label: 'Add Row Below', action: () => editor.chain().focus().addRowAfter().run(), testId: 'table-add-row-below' },
    { label: 'Add Column Left', action: () => editor.chain().focus().addColumnBefore().run(), testId: 'table-add-col-left' },
    { label: 'Add Column Right', action: () => editor.chain().focus().addColumnAfter().run(), testId: 'table-add-col-right' },
    { divider: true } as const,
    { label: 'Delete Row', action: () => editor.chain().focus().deleteRow().run(), testId: 'table-delete-row', destructive: true },
    { label: 'Delete Column', action: () => editor.chain().focus().deleteColumn().run(), testId: 'table-delete-col', destructive: true },
    { label: 'Delete Table', action: () => editor.chain().focus().deleteTable().run(), testId: 'table-delete-table', destructive: true },
    { divider: true } as const,
    { label: 'Merge Cells', action: () => editor.chain().focus().mergeCells().run(), testId: 'table-merge-cells' },
    { label: 'Split Cell', action: () => editor.chain().focus().splitCell().run(), testId: 'table-split-cell' },
    { label: 'Toggle Header Row', action: () => editor.chain().focus().toggleHeaderRow().run(), testId: 'table-toggle-header' },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        data-testid="toolbar-table-menu"
        title="Table options"
        className="p-1.5 rounded transition-colors text-primary bg-primary/10 hover:bg-primary/20"
      >
        <TableIcon className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
            {actions.map((item, i) =>
              'divider' in item ? (
                <div key={i} className="h-px bg-border my-1" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  data-testid={item.testId}
                  onClick={() => {
                    item.action()
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                    'destructive' in item && item.destructive
                      ? 'text-destructive hover:bg-destructive/10'
                      : 'text-popover-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Toolbar
// ---------------------------------------------------------------------------

export default function EditorToolbar({
  editor,
  disabled = false,
  onAddComment,
  canvasZoom = 1,
  onCanvasZoomChange,
}: EditorToolbarProps) {
  const iconSize = 'w-4 h-4'

  return (
    <div
      data-testid="editor-toolbar"
      className={`flex items-center flex-wrap gap-0.5 px-3 py-1.5 border-b border-border bg-card sticky top-0 z-20 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        testId="toolbar-undo"
        title="Undo (Cmd+Z)"
      >
        <Undo2 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        testId="toolbar-redo"
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 className={iconSize} />
      </ToolbarButton>

      <Divider />

      {/* Heading Dropdown */}
      <HeadingDropdown editor={editor} />

      <FontFamilyDropdown editor={editor} />

      {onCanvasZoomChange && (
        <PageZoomDropdown canvasZoom={canvasZoom} onCanvasZoomChange={onCanvasZoomChange} />
      )}

      <FontSizeControl editor={editor} />

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        testId="toolbar-bold"
        title="Bold (Cmd+B)"
      >
        <Bold className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        testId="toolbar-italic"
        title="Italic (Cmd+I)"
      >
        <Italic className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        testId="toolbar-underline"
        title="Underline (Cmd+U)"
      >
        <UnderlineIcon className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        testId="toolbar-strike"
        title="Strikethrough"
      >
        <Strikethrough className={iconSize} />
      </ToolbarButton>

      <Divider />

      {/* Color / Highlight / Comment */}
      <ColorPickerButton editor={editor} type="text" />
      <ColorPickerButton editor={editor} type="highlight" />
      {onAddComment && (
        <ToolbarButton
          onClick={onAddComment}
          disabled={editor.state.selection.empty}
          active={editor.isActive('comment')}
          testId="toolbar-comment"
          title="Add Comment (Cmd+Shift+M)"
        >
          <MessageSquarePlus className={iconSize} />
        </ToolbarButton>
      )}

      <Divider />

      <AlignIndentDropdown editor={editor} />

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        testId="toolbar-bullet-list"
        title="Bullet List"
      >
        <List className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        testId="toolbar-ordered-list"
        title="Numbered List"
      >
        <ListOrdered className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        testId="toolbar-task-list"
        title="Task List"
      >
        <ListChecks className={iconSize} />
      </ToolbarButton>

      <Divider />

      {/* Blockquote */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        testId="toolbar-blockquote"
        title="Blockquote"
      >
        <Quote className={iconSize} />
      </ToolbarButton>

      <Divider />

      {/* Insert */}
      <LinkButton editor={editor} />
      <ImageButton editor={editor} />
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        testId="toolbar-table"
        title="Insert Table"
      >
        <TableIcon className={iconSize} />
      </ToolbarButton>
      <TableContextMenu editor={editor} />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        testId="toolbar-hr"
        title="Horizontal Rule"
      >
        <Minus className={iconSize} />
      </ToolbarButton>

      <Divider />

      {/* Misc formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive('subscript')}
        testId="toolbar-subscript"
        title="Subscript"
      >
        <Subscript className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive('superscript')}
        testId="toolbar-superscript"
        title="Superscript"
      >
        <Superscript className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        testId="toolbar-code"
        title="Inline Code"
      >
        <Code className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        testId="toolbar-code-block"
        title="Code Block"
      >
        <Code2 className={iconSize} />
      </ToolbarButton>

      <Divider />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        testId="toolbar-clear"
        title="Clear Formatting"
      >
        <RemoveFormatting className={iconSize} />
      </ToolbarButton>
    </div>
  )
}
