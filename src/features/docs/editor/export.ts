/**
 * Document Export Utilities
 *
 * Provides export to HTML, Markdown, and plain text.
 * Uses turndown for HTML→Markdown conversion.
 */

import type { Editor } from '@tiptap/react'
import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

// Configure turndown for task lists
turndown.addRule('taskList', {
  filter: (node) =>
    node.nodeName === 'LI' && node.parentElement?.getAttribute('data-type') === 'taskList',
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute('data-checked') === 'true'
    return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`
  },
})

// Configure turndown for strikethrough
turndown.addRule('strikethrough', {
  filter: (node) => ['S', 'DEL', 'STRIKE'].includes(node.nodeName),
  replacement: (content) => `~~${content}~~`,
})

// Configure turndown for highlight
turndown.addRule('highlight', {
  filter: 'mark',
  replacement: (content) => `==${content}==`,
})

export type ExportFormat = 'html' | 'markdown' | 'text'

export function exportDocument(editor: Editor, format: ExportFormat): string {
  switch (format) {
    case 'html':
      return editor.getHTML()
    case 'markdown':
      return turndown.turndown(editor.getHTML())
    case 'text':
      return editor.getText()
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAndDownload(
  editor: Editor,
  format: ExportFormat,
  title: string,
): void {
  const content = exportDocument(editor, format)
  const ext = format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'txt'
  const mime =
    format === 'markdown'
      ? 'text/markdown'
      : format === 'html'
        ? 'text/html'
        : 'text/plain'
  const safeTitle = title.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'document'
  downloadFile(content, `${safeTitle}.${ext}`, mime)
}
