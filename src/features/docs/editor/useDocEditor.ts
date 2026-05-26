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
import { CollaborationCaret } from './extensions/CollaborationCaret'
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
import {
  collaborationColorFor,
  collaborationDisplayName,
  type CollaborationUser,
} from './collaboration-user'
import type { Awareness } from 'deepspace'
import type * as Y from 'yjs'

export interface UseDocEditorOptions {
  doc: Y.Doc
  /** Yjs awareness instance shared with the WS hook (or null while not connected). */
  awareness: Awareness | null
  userName: string
  userColor: string
  userId?: string | null
  userEmail?: string | null
  synced: boolean
  canWrite: boolean
}

function renderCollaborationCaret(user: CollaborationUser): HTMLElement {
  const color = collaborationColorFor(user)
  const cursor = document.createElement('span')
  cursor.classList.add('collaboration-carets__caret')
  cursor.style.setProperty('--collaboration-caret-color', color)
  cursor.setAttribute('aria-hidden', 'true')

  const label = document.createElement('span')
  label.classList.add('collaboration-carets__label')
  label.style.backgroundColor = `color-mix(in srgb, ${color} 16%, #ffffff)`
  label.style.color = color
  label.textContent = collaborationDisplayName(user)

  cursor.appendChild(label)

  return cursor
}

function renderCollaborationSelection(user: CollaborationUser) {
  const color = collaborationColorFor(user)
  return {
    class: 'ProseMirror-yjs-selection collaboration-carets__selection',
    style: `background-color: color-mix(in srgb, ${color} 20%, transparent)`,
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
  userId,
  userEmail,
  synced,
  canWrite,
}: UseDocEditorOptions): Editor | null {
  const fragment = useMemo(() => doc.getXmlFragment('default'), [doc])

  /** CollaborationCaret expects a provider-shaped `{ awareness }` object. */
  const provider = useMemo(() => (awareness ? { awareness } : null), [awareness])

  const collaborationUser = useMemo(
    () => ({
      name: userName,
      color: userColor,
      userId: userId ?? null,
      email: userEmail ?? null,
    }),
    [userName, userColor, userId, userEmail],
  )

  const extensions = useMemo(() => {
    const exts: unknown[] = [
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
          user: collaborationUser,
          render: renderCollaborationCaret,
          selectionRender: renderCollaborationSelection,
        }),
      )
    }

    return exts
  }, [fragment, provider, collaborationUser])

  const editor = useEditor(
    {
      editable: synced && canWrite,
      immediatelyRender: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extensions: extensions as any,
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

  /** Keep awareness user (name + color) in sync after auth resolves or profile changes. */
  useEffect(() => {
    if (!editor || !synced || !provider) return
    editor.commands.updateUser(collaborationUser)
  }, [editor, synced, provider, collaborationUser])

  return editor
}
