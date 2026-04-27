import { useLocation, useParams } from 'react-router-dom'
import DocumentEditorPage from '../../features/docs/DocumentEditorPage'
import DocumentListPage from '../../features/docs/DocumentListPage'

export default function BrowseUser() {
  const location = useLocation()
  const { userId, docId } = useParams<{ userId: string; docId?: string }>()
  const routeDocId = docId ?? location.pathname.match(/\/doc\/([^/]+)/)?.[1]
  if (routeDocId) return <DocumentEditorPage />

  return <DocumentListPage browseUserId={userId} />
}
