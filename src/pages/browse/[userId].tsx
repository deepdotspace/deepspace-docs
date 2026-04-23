import { useParams } from 'react-router-dom'
import DocumentListPage from '../../features/docs/DocumentListPage'

export default function BrowseUser() {
  const { userId } = useParams<{ userId: string }>()
  return <DocumentListPage browseUserId={userId} />
}
