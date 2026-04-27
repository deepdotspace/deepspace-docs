/**
 * Local Tiptap editor module.
 *
 * Provides a Google-Docs style toolbar, find/replace, and export helpers
 * wired up to a Yjs-backed collaborative editor. Adapted from the
 * `@spaces/editor` package for use inside docs2.
 */

export { useDocEditor, type UseDocEditorOptions } from './useDocEditor'
export { default as EditorToolbar } from './EditorToolbar'
export { default as FindReplaceBar } from './FindReplaceBar'
export { exportDocument, exportAndDownload, type ExportFormat } from './export'
export { EditorContent } from '@tiptap/react'
export { countWordsInDocument } from './wordCount'
export {
  DocEditorSurface,
  PAGE_HEIGHT_PX,
  PAGE_WIDTH_PX,
  GAP_PX,
  TYPICAL_WORDS_PER_PAGE,
} from './DocEditorSurface'
