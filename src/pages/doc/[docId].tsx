/**
 * /doc/:docId — collaborative document editor route.
 *
 * Re-exports the route-level `ErrorBoundary` so Generouted wires it as the
 * route's `errorElement`. A ProseMirror `matchesNode` crash in the Tiptap
 * view (triggered by mid-session permission flips that rebuild the editor's
 * extension array) lands here instead of nuking the whole app.
 */

import DocumentEditorPage from '../../features/docs/DocumentEditorPage'

export { ErrorBoundary } from '../../features/docs/DocumentEditorPage'

export default function DocRoute() {
  return <DocumentEditorPage />
}
