/**
 * Tiptap editor initialization hook.
 *
 * Uses @tiptap/extension-collaboration (Yjs sync + undo/redo). When an
 * awareness instance is provided we also enable CollaborationCaret so
 * remote cursors render; otherwise we skip the caret extension.
 */

import { useMemo, useEffect, useRef } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-text-style/font-family'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { ResizableImage } from './extensions/ResizableImage'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { SearchReplace } from './extensions/SearchReplace'
import { SlashCommands } from './extensions/SlashCommands'
import type * as Y from 'yjs'

type CollaborationUser = {
  name?: string | null
  color?: string | null
}

export interface UseDocEditorOptions {
  doc: Y.Doc
  /** Optional Yjs awareness instance. When provided, remote cursors render. */
  awareness?: { awareness?: unknown } | any
  userName: string
  userColor: string
  synced: boolean
  canWrite: boolean
}

function renderCollaborationCaret(user: CollaborationUser): HTMLElement {
  const color = user.color || '#94a3b8'
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.style.setProperty('--collaboration-caret-color', color)
  cursor.setAttribute('aria-hidden', 'true')

  const label = document.createElement('span')
  label.classList.add('collaboration-carets__label')
  label.style.backgroundColor = color
  label.textContent = user.name || 'Collaborator'
  cursor.appendChild(label)

  return cursor
}

function renderCollaborationSelection(user: CollaborationUser) {
  const color = user.color || '#94a3b8'
  return {
    class: 'ProseMirror-yjs-selection collaboration-carets__selection',
    style: `background-color: ${color}33`,
  }
}

function stripCollaborationArtifactsFromHTML(html: string): string {
  if (typeof document === 'undefined') return html

  const container = document.createElement('div')
  container.innerHTML = html

  container
    .querySelectorAll('.collaboration-carets__caret, .collaboration-carets__label')
    .forEach((node) => node.remove())

  container
    .querySelectorAll('.ProseMirror-yjs-selection, .collaboration-carets__selection')
    .forEach((node) => {
      node.replaceWith(...Array.from(node.childNodes))
    })

  return container.innerHTML
}

export function useDocEditor({
  doc,
  awareness,
  userName,
  userColor,
  synced,
  canWrite,
}: UseDocEditorOptions): Editor | null {
  const fragment = useMemo(() => doc.getXmlFragment('default'), [doc])

  // CollaborationCaret expects a provider object with `{ awareness }`.
  const provider = useMemo(() => (awareness ? { awareness } : null), [awareness])

  const extensions = useMemo(() => {
    const exts: any[] = [
      StarterKit.configure({
        undoRedo: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Collaboration.configure({ fragment }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      ResizableImage,
      Placeholder.configure({
        placeholder: 'Start typing or press / for commands...',
      }),
      Typography,
      SearchReplace,
      SlashCommands,
    ]

    if (provider) {
      exts.push(
        CollaborationCaret.configure({
          provider,
          user: { name: userName, color: userColor },
          render: renderCollaborationCaret,
          selectionRender: renderCollaborationSelection,
        }),
      )
    }

    return exts
  }, [fragment, provider, userName, userColor])

  const editor = useEditor(
    {
      editable: synced && canWrite,
      immediatelyRender: false,
      extensions,
      editorProps: {
        transformPastedHTML: stripCollaborationArtifactsFromHTML,
      },
    },
    [extensions],
  )

  const prevEditable = useRef(false)
  useEffect(() => {
    const editable = synced && canWrite
    if (editor && editable !== prevEditable.current) {
      prevEditable.current = editable
      editor.setEditable(editable)
    }
  }, [editor, synced, canWrite])

  return editor
}
