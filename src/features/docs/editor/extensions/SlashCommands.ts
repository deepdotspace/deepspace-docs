/**
 * Slash Commands Extension
 *
 * Type "/" at the start of an empty paragraph to open a floating
 * command menu. Filter commands by typing. Commands insert new blocks.
 *
 * Uses tiptap's Suggestion utility under the hood.
 */

import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: { chain: () => any }) => void
}

const slashCommandItems: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list with bullets',
    icon: '•',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list with numbers',
    icon: '1.',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: '☐',
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Blockquote',
    description: 'Indented quote block',
    icon: '"',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Code Block',
    description: 'Monospace code block',
    icon: '<>',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    description: 'Insert a 3×3 table',
    icon: '⊞',
    command: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Horizontal Rule',
    description: 'Visual divider line',
    icon: '—',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Image',
    description: 'Insert image by URL',
    icon: '🖼',
    command: (editor) => {
      const url = window.prompt('Image URL:')
      if (url) editor.chain().focus().setImage({ src: url }).run()
    },
  },
]

export const slashSuggestionPluginKey = new PluginKey('slashCommands')

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        pluginKey: slashSuggestionPluginKey,
        items: ({ query }: { query: string }) => {
          return slashCommandItems.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any
          range: { from: number; to: number }
          props: SlashCommandItem
        }) => {
          // Delete the "/" trigger text
          editor.chain().focus().deleteRange(range).run()
          // Execute the command
          props.command(editor)
        },
        render: () => {
          let popup: HTMLDivElement | null = null
          let selectedIndex = 0
          let items: SlashCommandItem[] = []
          let commandFn: ((props: { editor: any; range: any; props: SlashCommandItem }) => void) | null = null
          let currentEditor: any = null
          let currentRange: any = null

          const updateSelection = () => {
            if (!popup) return
            const buttons = popup.querySelectorAll('button')
            buttons.forEach((btn, i) => {
              btn.classList.toggle('bg-muted', i === selectedIndex)
            })
          }

          return {
            onStart: (props: any) => {
              items = props.items
              commandFn = props.command
              currentEditor = props.editor
              currentRange = props.range
              selectedIndex = 0

              popup = document.createElement('div')
              popup.classList.add('slash-command-menu')
              popup.setAttribute('data-testid', 'slash-command-menu')
              popup.style.cssText = `
                position: absolute;
                z-index: 50;
                background: var(--color-popover, #fff);
                border: 1px solid var(--color-border, #e5e7eb);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 4px;
                min-width: 220px;
                max-height: 300px;
                overflow-y: auto;
              `

              renderItems()
              document.body.appendChild(popup)
              positionPopup(props)
            },

            onUpdate: (props: any) => {
              items = props.items
              currentRange = props.range
              selectedIndex = 0
              if (popup) {
                renderItems()
                positionPopup(props)
              }
            },

            onKeyDown: (props: any) => {
              const { event } = props
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % items.length
                updateSelection()
                return true
              }
              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + items.length) % items.length
                updateSelection()
                return true
              }
              if (event.key === 'Enter') {
                const item = items[selectedIndex]
                if (item && commandFn) {
                  commandFn({ editor: currentEditor, range: currentRange, props: item })
                }
                return true
              }
              if (event.key === 'Escape') {
                popup?.remove()
                popup = null
                return true
              }
              return false
            },

            onExit: () => {
              popup?.remove()
              popup = null
            },
          }

          function renderItems() {
            if (!popup) return
            popup.innerHTML = ''

            if (items.length === 0) {
              const empty = document.createElement('div')
              empty.style.cssText = 'padding: 8px 12px; color: var(--color-content-muted, #9ca3af); font-size: 13px;'
              empty.textContent = 'No commands found'
              popup.appendChild(empty)
              return
            }

            items.forEach((item, i) => {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.setAttribute('data-testid', `slash-cmd-${item.title.toLowerCase().replace(/\s+/g, '-')}`)
              btn.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                padding: 6px 10px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 4px;
                text-align: left;
                font-size: 13px;
                color: var(--color-foreground, #111);
                transition: background 0.1s;
              `
              if (i === selectedIndex) {
                btn.style.background = 'var(--color-muted, #f3f4f6)'
              }

              const iconSpan = document.createElement('span')
              iconSpan.style.cssText = `
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                background: var(--color-surface-overlay, #f9fafb);
                font-size: 12px;
                font-weight: 600;
                flex-shrink: 0;
              `
              iconSpan.textContent = item.icon

              const textDiv = document.createElement('div')
              const titleSpan = document.createElement('div')
              titleSpan.style.cssText = 'font-weight: 500;'
              titleSpan.textContent = item.title
              const descSpan = document.createElement('div')
              descSpan.style.cssText = 'font-size: 11px; color: var(--color-content-muted, #9ca3af);'
              descSpan.textContent = item.description
              textDiv.appendChild(titleSpan)
              textDiv.appendChild(descSpan)

              btn.appendChild(iconSpan)
              btn.appendChild(textDiv)

              btn.addEventListener('mouseenter', () => {
                selectedIndex = i
                updateSelection()
              })
              btn.addEventListener('click', () => {
                if (commandFn) {
                  commandFn({ editor: currentEditor, range: currentRange, props: item })
                }
              })

              popup!.appendChild(btn)
            })
          }

          function positionPopup(props: any) {
            if (!popup) return
            const { clientRect } = props
            if (!clientRect) return
            const rect = clientRect()
            if (!rect) return
            popup.style.top = `${rect.bottom + window.scrollY + 4}px`
            popup.style.left = `${rect.left + window.scrollX}px`
          }
        },
      } satisfies Partial<SuggestionOptions>,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
