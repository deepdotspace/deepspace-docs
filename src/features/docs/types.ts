export interface DocumentFields {
  title: string
  ownerId: string
  visibility: 'private' | 'public'
  /** Owning folder record id, or empty / omitted when uncategorized. */
  folderId?: string
}

export interface DocFolderFields {
  name: string
  ownerId: string
}

/** Sidebar scope for filtering the library. */
export type LibraryNavSelection =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'uncategorized' }
  | { kind: 'folder'; folderId: string }

export interface ContentShareFields {
  ContentType: string
  ContentId: string
  OwnerId: string
  OwnerName: string
  Title: string
  ShareType: string
  ShareTarget: string
  Permission: string
  SharedAt: string
  SharedBy: string
  SourceApp: string
  WordCount: number
  LastEditedAt: string
}

export type SortOption = 'lastEdited' | 'titleAZ' | 'titleZA' | 'created' | 'wordCount'
export type ViewMode = 'grid' | 'list'

export interface DocTemplate {
  name: string
  description: string
  icon: string
  content: string
}

export const TEMPLATES: DocTemplate[] = [
  {
    name: 'Meeting Notes',
    description: 'Structure for capturing meeting discussions',
    icon: 'MN',
    content: '# Meeting Notes\n\n## Date\n\n## Attendees\n- \n\n## Agenda\n1. \n\n## Discussion\n\n## Action Items\n- [ ] \n\n## Next Steps\n',
  },
  {
    name: 'Project Brief',
    description: 'Outline a new project with goals and scope',
    icon: 'PB',
    content: '# Project Brief\n\n## Overview\nBrief description of the project.\n\n## Goals\n- \n\n## Scope\n\n## Timeline\n| Milestone | Date | Status |\n| --- | --- | --- |\n|  |  |  |\n\n## Stakeholders\n\n## Risks\n',
  },
  {
    name: 'Weekly Update',
    description: 'Summarize progress and blockers',
    icon: 'WU',
    content: '# Weekly Update\n\n## Highlights\n- \n\n## Completed This Week\n- [x] \n\n## In Progress\n- [ ] \n\n## Blockers\n\n## Next Week\n- \n',
  },
  {
    name: 'Decision Document',
    description: 'Record a decision with context and options',
    icon: 'DD',
    content: '# Decision: [Title]\n\n## Context\nWhat is the background?\n\n## Options Considered\n\n### Option A\nDescription, pros, cons.\n\n### Option B\nDescription, pros, cons.\n\n## Decision\nWhich option was chosen and why.\n\n## Consequences\nWhat changes as a result.\n',
  },
]

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'lastEdited', label: 'Last edited' },
  { value: 'titleAZ', label: 'Title A–Z' },
  { value: 'titleZA', label: 'Title Z–A' },
  { value: 'created', label: 'Created (newest)' },
  { value: 'wordCount', label: 'Word count' },
]
