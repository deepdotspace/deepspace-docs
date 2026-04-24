/**
 * Rich Text Toolbar — Google Docs-style fixed toolbar.
 *
 * Grouped sections:
 * [Undo|Redo] | [Paragraph/H1-H3] | [B|I|U|S] |
 * [Color|Highlight] | [Align] | [Lists] |
 * [Link|Image|Table|HR] | [Sub|Sup|Code|CodeBlock] | [Clear]
 */

import { useCallback, useState } from 'react'
import type { Editor } from '@tiptap/react'
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
} from 'lucide-react'

interface EditorToolbarProps {
  editor: Editor
  disabled?: boolean
  onAddComment?: () => void
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
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Gray', value: '#6b7280' },
]

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fbbf24' },
  { label: 'Green', value: '#86efac' },
  { label: 'Blue', value: '#93c5fd' },
  { label: 'Purple', value: '#c4b5fd' },
  { label: 'Pink', value: '#f9a8d4' },
  { label: 'Orange', value: '#fdba74' },
  { label: 'Red', value: '#fca5a5' },
  { label: 'Gray', value: '#d1d5db' },
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
            <div className="grid grid-cols-3 gap-1" style={{ width: '120px' }}>
              {colors.map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  data-testid={`color-${type}-${label.toLowerCase()}`}
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
                  className={`w-8 h-8 rounded border transition-colors ${
                    currentColor === value
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-foreground/30'
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
// Font Size Dropdown
// ---------------------------------------------------------------------------

const FONT_SIZES = [
  { label: 'Small', value: '13px' },
  { label: 'Normal', value: '' },
  { label: 'Large', value: '18px' },
  { label: 'Huge', value: '24px' },
]

function FontSizeDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const currentSize = editor.getAttributes('textStyle').fontSize ?? ''
  const currentLabel = FONT_SIZES.find((s) => s.value === currentSize)?.label ?? 'Normal'

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="toolbar-font-size"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[60px]"
      >
        {currentLabel}
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
            {FONT_SIZES.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                data-testid={`toolbar-fontsize-${label.toLowerCase()}`}
                onClick={() => {
                  if (!value) {
                    editor.chain().focus().unsetFontSize().run()
                  } else {
                    editor.chain().focus().setFontSize(value).run()
                  }
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${
                  currentLabel === label ? 'text-primary font-medium' : 'text-popover-foreground'
                }`}
                style={{ fontSize: value || undefined }}
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

export default function EditorToolbar({ editor, disabled = false, onAddComment }: EditorToolbarProps) {
  const iconSize = 'w-4 h-4'

  return (
    <div
      data-testid="editor-toolbar"
      className={`flex items-center flex-wrap gap-0.5 px-3 py-1.5 border-b border-border bg-card sticky top-0 z-30 ${
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

      {/* Font Size Dropdown */}
      <FontSizeDropdown editor={editor} />

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

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        testId="toolbar-align-left"
        title="Align Left"
      >
        <AlignLeft className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        testId="toolbar-align-center"
        title="Align Center"
      >
        <AlignCenter className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        testId="toolbar-align-right"
        title="Align Right"
      >
        <AlignRight className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        testId="toolbar-align-justify"
        title="Justify"
      >
        <AlignJustify className={iconSize} />
      </ToolbarButton>

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

      {/* Indent / Outdent */}
      <ToolbarButton
        onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
        disabled={!editor.can().sinkListItem('listItem')}
        testId="toolbar-indent"
        title="Indent (Tab)"
      >
        <Indent className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().liftListItem('listItem').run()}
        disabled={!editor.can().liftListItem('listItem')}
        testId="toolbar-outdent"
        title="Outdent (Shift+Tab)"
      >
        <Outdent className={iconSize} />
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
