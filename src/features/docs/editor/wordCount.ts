import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

/**
 * Word count for the ProseMirror document (full doc root).
 * Uses the same split-on-space word splitting as Tiptap's classic character-count extension.
 * Read from the live `editor.state.doc` so counts stay correct with Yjs/Collaboration; the
 * CharacterCount extension’s storage is unreliable with that stack.
 */
export function countWordsInDocument(doc: ProseMirrorNode): number {
  const text = doc.textBetween(0, doc.content.size, ' ', ' ')
  return text.split(' ').filter((word) => word !== '').length
}
