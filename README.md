# DeepSpace Docs

A collaborative document editor — write together in real time, with live
cursors, folders, and email invites. Built on the
[DeepSpace SDK](https://deep.space).

**Live app:** https://docs.app.space

## What it does

- Rich-text documents you edit together — everyone's changes merge live, with
  each collaborator's cursor and selection visible in their own color
- Folders for organizing documents, plus a browse view across your workspace
- Share a document by email: invitees get collaborator access the moment they
  sign in, whether or not they had an account when you invited them

## How it's built

The editor is Tiptap with the Collaboration and CollaborationCaret
extensions, backed by a per-document DeepSpace `YjsRoom` Durable Object — a
CRDT, so simultaneous edits merge without conflicts and cursors ride the Yjs
awareness channel. Document metadata, folders, and invites are record
collections with per-role permissions, kept in sync through the SDK's live
queries. Email invites are resolved by a server action that turns pending
invites into real collaborator grants on the caller's verified email.

## Run your own

Deploy your own copy in three commands:

```sh
npm install
npx deepspace login     # one-time, opens a browser tab
npx deepspace deploy    # -> <name>.app.space
```

Auth, the database, real-time sync, and hosting all come from DeepSpace, so
there is nothing else to configure. Your subdomain is the `name` field in
`wrangler.toml`; change it for your own deployment.

Or build something new: apps like this are made by handing a prompt to a
coding agent — start at [deep.space/get-started](https://deep.space/get-started),
or scaffold from scratch: `npm create deepspace@latest my-app`.

---
*DeepSpace Docs was built end-to-end by an AI agent on the DeepSpace SDK.
DeepSpace is laying the foundation for rebuilding the Internet in an AI-native
way — [deep.space](https://deep.space) · [docs](https://docs.deep.space).*
