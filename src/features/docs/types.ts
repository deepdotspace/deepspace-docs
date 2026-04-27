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

/** Prefill HTML for TipTap (setContent parses strings as HTML, not Markdown). */
export const TEMPLATES: DocTemplate[] = [
  {
    name: 'Meeting Notes',
    description: 'Agenda, discussion, decisions, and owned action items',
    icon: 'MN',
    content: `<h1>Meeting Notes</h1>
<p><strong>Project / initiative:</strong> (name)<br><strong>Date:</strong> (YYYY-MM-DD)<br><strong>Time:</strong> (timezone)<br><strong>Location / link:</strong></p>
<hr>
<h2>Purpose</h2>
<p>Why we met and what success looks like for this session.</p>
<h2>Attendees</h2>
<table>
<thead><tr><th><p>Name</p></th><th><p>Role</p></th><th><p>Present</p></th></tr></thead>
<tbody>
<tr><td><p></p></td><td><p></p></td><td><p>Y/N</p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p>Y/N</p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p>Y/N</p></td></tr>
</tbody>
</table>
<h2>Agenda &amp; timeboxes</h2>
<ol>
<li><p><strong>(0:00–0:05)</strong> Welcome &amp; objectives</p></li>
<li><p><strong>(0:05–0:25)</strong> Topic 1 — owner:</p></li>
<li><p><strong>(0:25–0:45)</strong> Topic 2 — owner:</p></li>
<li><p><strong>(0:45–0:55)</strong> Decisions &amp; actions</p></li>
<li><p><strong>(0:55–1:00)</strong> Parking lot / next steps</p></li>
</ol>
<h2>Discussion notes</h2>
<h3>Topic 1</h3>
<ul>
<li><p>Key points:</p></li>
<li><p>Questions raised:</p></li>
<li><p>Consensus / disagreement:</p></li>
</ul>
<h3>Topic 2</h3>
<ul>
<li><p>Key points:</p></li>
<li><p>Data or evidence cited:</p></li>
</ul>
<h2>Decisions made</h2>
<ul>
<li><p><strong>Decision:</strong> … &mdash; <strong>Rationale:</strong> …</p></li>
<li><p><strong>Decision:</strong> … &mdash; <strong>Rationale:</strong> …</p></li>
</ul>
<h2>Action items</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><p>(Owner) Deliver … by (date)</p></li>
<li data-type="taskItem" data-checked="false"><p>(Owner) Follow up with …</p></li>
<li data-type="taskItem" data-checked="false"><p>(Owner) Schedule follow-up meeting</p></li>
</ul>
<h2>Parking lot</h2>
<p>Topics to revisit later (capture briefly):</p>
<ul><li><p></p></li><li><p></p></li></ul>
<h2>Next meeting</h2>
<p><strong>Date / time:</strong> … &mdash; <strong>Prep:</strong> …</p>`,
  },
  {
    name: 'Project Brief',
    description: 'Goals, scope, timeline, stakeholders, and risks in one page',
    icon: 'PB',
    content: `<h1>Project Brief</h1>
<p><strong>Document owner:</strong> &nbsp; <strong>Version:</strong> 0.1 &nbsp; <strong>Last updated:</strong> (date)</p>
<p><strong>Status:</strong> Draft / Review / Approved</p>
<hr>
<h2>Executive summary</h2>
<p>Two or three sentences: what we are building or changing, for whom, and by when.</p>
<h2>Problem &amp; opportunity</h2>
<ul>
<li><p><strong>Problem:</strong> What is broken, slow, costly, or missing today?</p></li>
<li><p><strong>Impact:</strong> Who is affected and how severely?</p></li>
<li><p><strong>Why now:</strong> What makes this the right time?</p></li>
</ul>
<h2>Goals &amp; success metrics</h2>
<p>Goals should be measurable. Replace the examples below with yours.</p>
<ul>
<li><p><strong>Goal 1:</strong> (e.g. cut time-to-complete from X to Y by date)</p></li>
<li><p><strong>Goal 2:</strong> (e.g. reach N active users / week)</p></li>
<li><p><strong>Non-goals:</strong> Explicitly out of scope for this phase:</p></li>
</ul>
<table>
<thead><tr><th><p>Metric</p></th><th><p>Baseline</p></th><th><p>Target</p></th><th><p>How we measure</p></th></tr></thead>
<tbody>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody>
</table>
<h2>Scope</h2>
<h3>In scope</h3>
<ul><li><p></p></li><li><p></p></li></ul>
<h3>Out of scope</h3>
<ul><li><p></p></li><li><p></p></li></ul>
<h2>Milestones</h2>
<table>
<thead><tr><th><p>Milestone</p></th><th><p>Target date</p></th><th><p>Owner</p></th><th><p>Status</p></th></tr></thead>
<tbody>
<tr><td><p>Kickoff / brief approved</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Design or spec locked</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Launch / release</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>Retrospective</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody>
</table>
<h2>Stakeholders &amp; RACI</h2>
<table>
<thead><tr><th><p>Name</p></th><th><p>Role</p></th><th><p>R / A / C / I</p></th><th><p>Notes</p></th></tr></thead>
<tbody>
<tr><td><p></p></td><td><p>Executive sponsor</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p>Product / PM</p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p>Engineering lead</p></td><td><p></p></td><td><p></p></td></tr>
</tbody>
</table>
<h2>Risks &amp; mitigations</h2>
<table>
<thead><tr><th><p>Risk</p></th><th><p>Likelihood</p></th><th><p>Impact</p></th><th><p>Mitigation</p></th></tr></thead>
<tbody>
<tr><td><p></p></td><td><p>L/M/H</p></td><td><p>L/M/H</p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p>L/M/H</p></td><td><p>L/M/H</p></td><td><p></p></td></tr>
</tbody>
</table>
<h2>Dependencies &amp; assumptions</h2>
<ul>
<li><p><strong>Depends on:</strong> (teams, vendors, upstream launches)</p></li>
<li><p><strong>We assume:</strong> (budget, headcount, legal sign-off)</p></li>
</ul>
<h2>Open questions</h2>
<ul><li><p></p></li><li><p></p></li></ul>`,
  },
  {
    name: 'Weekly Update',
    description: 'Shipped work, metrics, blockers, and next week’s focus',
    icon: 'WU',
    content: `<h1>Weekly Update</h1>
<p><strong>Week of:</strong> (Mon–Sun dates) &nbsp; <strong>Team / pod:</strong> &nbsp; <strong>Author:</strong></p>
<hr>
<h2>TL;DR</h2>
<p>Three bullets your stakeholders could skim in 30 seconds:</p>
<ul>
<li><p></p></li>
<li><p></p></li>
<li><p></p></li>
</ul>
<h2>Shipped &amp; completed</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><p>Released / merged: (feature or fix &mdash; link)</p></li>
<li data-type="taskItem" data-checked="true"><p>Resolved incident / debt: …</p></li>
<li data-type="taskItem" data-checked="false"><p>(Move unchecked items to “In progress”)</p></li>
</ul>
<h2>In progress</h2>
<ul>
<li><p><strong>(Owner)</strong> … — ETA:</p></li>
<li><p><strong>(Owner)</strong> … — ETA:</p></li>
</ul>
<h2>Metrics snapshot</h2>
<table>
<thead><tr><th><p>Metric</p></th><th><p>This week</p></th><th><p>Last week</p></th><th><p>Notes</p></th></tr></thead>
<tbody>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody>
</table>
<h2>Blockers &amp; asks</h2>
<table>
<thead><tr><th><p>Item</p></th><th><p>Impact</p></th><th><p>Help needed from</p></th><th><p>Status</p></th></tr></thead>
<tbody>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p>No blockers</p></td></tr>
</tbody>
</table>
<h2>Risks / concerns</h2>
<ul><li><p></p></li><li><p></p></li></ul>
<h2>Focus next week</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><p>Priority 1:</p></li>
<li data-type="taskItem" data-checked="false"><p>Priority 2:</p></li>
<li data-type="taskItem" data-checked="false"><p>Priority 3:</p></li>
</ul>
<h2>Kudos</h2>
<p>Optional: thank someone who helped this week.</p>`,
  },
  {
    name: 'Decision Document',
    description: 'Context, options, chosen path, and consequences',
    icon: 'DD',
    content: `<h1>Decision: (short title)</h1>
<p><strong>Status:</strong> Proposed / Accepted / Superseded &nbsp; <strong>Date:</strong> &nbsp; <strong>Deciders:</strong> &nbsp; <strong>Consulted:</strong></p>
<hr>
<h2>Summary</h2>
<p>In one paragraph: what we decided and the main reason.</p>
<h2>Context</h2>
<ul>
<li><p><strong>Situation:</strong> What triggered this decision?</p></li>
<li><p><strong>Constraints:</strong> Time, budget, compliance, tech debt, staffing.</p></li>
<li><p><strong>Evidence:</strong> Links to docs, incidents, experiments, data.</p></li>
</ul>
<h2>Decision criteria</h2>
<p>How we judged options (weighted if helpful):</p>
<ol>
<li><p>Criterion A (e.g. reliability)</p></li>
<li><p>Criterion B (e.g. cost)</p></li>
<li><p>Criterion C (e.g. time to ship)</p></li>
</ol>
<h2>Options considered</h2>
<table>
<thead><tr><th><p></p></th><th><p>Option A</p></th><th><p>Option B</p></th><th><p>Option C</p></th></tr></thead>
<tbody>
<tr><td><p><strong>Description</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Pros</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Cons</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Est. effort</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p><strong>Risk profile</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody>
</table>
<h3>Option A (detail)</h3>
<p>When this option wins, implementation sketch, and main downside.</p>
<h3>Option B (detail)</h3>
<p>When this option wins, implementation sketch, and main downside.</p>
<h2>Decision</h2>
<p><strong>We will:</strong> (chosen option)</p>
<p><strong>Rationale:</strong> Tie back to criteria above.</p>
<h2>Consequences</h2>
<ul>
<li><p><strong>Immediate:</strong> What changes this week?</p></li>
<li><p><strong>Downstream:</strong> Teams or systems affected.</p></li>
<li><p><strong>Reversible?</strong> Yes / partially / no — how we would roll back.</p></li>
</ul>
<h2>Follow-up work</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><p>Communicate decision to …</p></li>
<li data-type="taskItem" data-checked="false"><p>Create tickets / update roadmap</p></li>
<li data-type="taskItem" data-checked="false"><p>Schedule checkpoint review</p></li>
</ul>
<h2>References</h2>
<ul><li><p></p></li><li><p></p></li></ul>`,
  },
]

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'lastEdited', label: 'Last edited' },
  { value: 'titleAZ', label: 'Title A–Z' },
  { value: 'titleZA', label: 'Title Z–A' },
  { value: 'created', label: 'Created (newest)' },
  { value: 'wordCount', label: 'Word count' },
]
