/**
 * Read-only Tiptap preview for template HTML — no Yjs, no network.
 */

import { useMemo } from 'react'
import { useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
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

export function useTemplatePreviewEditor(html: string): Editor | null {
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
    [],
  )

  return useEditor(
    {
      editable: false,
      immediatelyRender: false,
      extensions,
      content: html,
      editorProps: {
        attributes: {
          class: 'tiptap doc-preview-tiptap',
        },
      },
    },
    [html, extensions],
  )
}
