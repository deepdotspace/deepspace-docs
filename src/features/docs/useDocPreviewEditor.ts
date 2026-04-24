/**
 * Read-only Tiptap instance for document list thumbnails.
 * Mirrors the main editor schema (Yjs fragment + tables, tasks, etc.) without
 * caret, slash commands, or find/replace.
 */

import { useMemo } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { ResizableImage } from './editor/extensions/ResizableImage'
import Typography from '@tiptap/extension-typography'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import type * as Y from 'yjs'

export interface UseDocPreviewEditorOptions {
  doc: Y.Doc
}

export function useDocPreviewEditor({ doc }: UseDocPreviewEditorOptions): Editor | null {
  const fragment = useMemo(() => doc.getXmlFragment('default'), [doc])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        undoRedo: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      Collaboration.configure({ fragment }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      ResizableImage,
      Typography,
    ],
    [fragment],
  )

  return useEditor(
    {
      editable: false,
      immediatelyRender: false,
      extensions,
      editorProps: {
        attributes: {
          class: 'tiptap doc-preview-tiptap',
        },
      },
    },
    [extensions],
  )
}
