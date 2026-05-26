/**
 * Collaboration caret extension with layout-safe remote cursor rendering.
 *
 * Upstream y-tiptap createDecorations always adds Decoration.inline(from, to)
 * even when anchor === head (collapsed cursor). That zero-width inline span
 * plus widget side:10 forces a new line in the text flow — remote users see
 * a blank gap "like Enter" wherever someone clicks. We skip collapsed inline
 * decorations and use side:0 on the caret widget.
 */

import { Extension } from '@tiptap/core'
import type { DecorationAttrs } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Plugin, type EditorState } from '@tiptap/pm/state'
import type { Awareness } from 'deepspace'
import * as Y from 'yjs'
import { resolveCollaborationUser } from '../collaboration-user'
import {
  absolutePositionToRelativePosition,
  defaultAwarenessStateFilter,
  relativePositionToAbsolutePosition,
  setMeta,
  yCursorPluginKey,
  ySyncPluginKey,
} from '@tiptap/y-tiptap'

type CollaborationCaretStorage = {
  users: { clientId: number; [key: string]: unknown }[]
}

export interface CollaborationCaretOptions {
  provider: { awareness: Awareness }
  user: Record<string, unknown>
  render: (user: Record<string, unknown>) => HTMLElement
  selectionRender: (user: Record<string, unknown>) => DecorationAttrs
  onUpdate?: (users: { clientId: number; [key: string]: unknown }[]) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collaborationCaret: {
      updateUser: (attributes: Record<string, unknown>) => ReturnType
      user: (attributes: Record<string, unknown>) => ReturnType
    }
  }

  interface Storage {
    collaborationCaret: CollaborationCaretStorage
  }
}

const defaultOnUpdate = () => undefined

function awarenessStatesToArray(states: Map<number, Record<string, unknown>>) {
  return Array.from(states.entries()).map(([clientId, value]) => ({
    clientId,
    ...(typeof value.user === 'object' && value.user != null ? value.user : {}),
  }))
}

function createCollaborationDecorations(
  state: EditorState,
  awareness: Awareness,
  awarenessFilter: typeof defaultAwarenessStateFilter,
  createCursor: (user: Record<string, unknown>, clientId: number) => HTMLElement,
  createSelection: (user: Record<string, unknown>, clientId: number) => DecorationAttrs,
) {
  const ystate = ySyncPluginKey.getState(state)
  if (ystate == null || ystate.doc == null || ystate.binding == null) {
    return DecorationSet.create(state.doc, [])
  }

  const y = ystate.doc
  if (
    ystate.snapshot != null ||
    ystate.prevSnapshot != null ||
    ystate.binding.mapping.size === 0
  ) {
    return DecorationSet.create(state.doc, [])
  }

  const decorations: Decoration[] = []

  awareness.getStates().forEach((aw: Record<string, unknown>, clientId: number) => {
    if (!awarenessFilter(y.clientID, clientId, aw)) return

    const cursor = aw.cursor as { anchor?: unknown; head?: unknown } | undefined
    if (cursor == null) return

    const user = resolveCollaborationUser(aw, clientId)

    let anchor = relativePositionToAbsolutePosition(
      y,
      ystate.type,
      Y.createRelativePositionFromJSON(cursor.anchor as Y.RelativePosition),
      ystate.binding.mapping,
    )
    let head = relativePositionToAbsolutePosition(
      y,
      ystate.type,
      Y.createRelativePositionFromJSON(cursor.head as Y.RelativePosition),
      ystate.binding.mapping,
    )

    if (anchor === null || head === null) return

    const maxsize = Math.max(state.doc.content.size - 1, 0)
    anchor = Math.min(anchor, maxsize)
    head = Math.min(head, maxsize)

    decorations.push(
      Decoration.widget(head, () => createCursor(user, clientId), {
        key: `collab-caret-${clientId}`,
        side: 0,
      }),
    )

    if (anchor !== head) {
      const from = Math.min(anchor, head)
      const to = Math.max(anchor, head)
      decorations.push(
        Decoration.inline(from, to, createSelection(user, clientId), {
          inclusiveEnd: true,
          inclusiveStart: false,
        }),
      )
    }
  })

  return DecorationSet.create(state.doc, decorations)
}

function yCursorPluginFixed(
  awareness: Awareness,
  {
    awarenessStateFilter = defaultAwarenessStateFilter,
    cursorBuilder,
    selectionBuilder,
  }: {
    awarenessStateFilter?: typeof defaultAwarenessStateFilter
    cursorBuilder: (user: Record<string, unknown>, clientId: number) => HTMLElement
    selectionBuilder: (user: Record<string, unknown>, clientId: number) => DecorationAttrs
  },
) {
  return new Plugin({
    key: yCursorPluginKey,
    state: {
      init(_, state) {
        return createCollaborationDecorations(
          state,
          awareness,
          awarenessStateFilter,
          cursorBuilder,
          selectionBuilder,
        )
      },
      apply(tr, prevState, _oldState, newState) {
        const ystate = ySyncPluginKey.getState(newState)
        const yCursorState = tr.getMeta(yCursorPluginKey)
        if (
          (ystate && ystate.isChangeOrigin) ||
          (yCursorState && yCursorState.awarenessUpdated)
        ) {
          return createCollaborationDecorations(
            newState,
            awareness,
            awarenessStateFilter,
            cursorBuilder,
            selectionBuilder,
          )
        }
        return prevState.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state) {
        return yCursorPluginKey.getState(state)
      },
    },
    view(view) {
      const awarenessListener = () => {
        if ((view as { docView?: unknown }).docView) {
          setMeta(view, yCursorPluginKey, { awarenessUpdated: true })
        }
      }

      const updateCursorInfo = () => {
        const ystate = ySyncPluginKey.getState(view.state)
        if (!ystate?.binding) return

        const current = awareness.getLocalState() || {}
        if (view.hasFocus()) {
          const selection = view.state.selection
          const anchor = absolutePositionToRelativePosition(
            selection.anchor,
            ystate.type,
            ystate.binding.mapping,
          )
          const head = absolutePositionToRelativePosition(
            selection.head,
            ystate.type,
            ystate.binding.mapping,
          )
          const currentCursor = current.cursor as
            | { anchor: Y.RelativePosition; head: Y.RelativePosition }
            | undefined
          if (
            currentCursor == null ||
            !Y.compareRelativePositions(
              Y.createRelativePositionFromJSON(currentCursor.anchor),
              anchor,
            ) ||
            !Y.compareRelativePositions(
              Y.createRelativePositionFromJSON(currentCursor.head),
              head,
            )
          ) {
            awareness.setLocalStateField('cursor', { anchor, head })
          }
        } else if (
          current.cursor != null &&
          relativePositionToAbsolutePosition(
            ystate.doc,
            ystate.type,
            Y.createRelativePositionFromJSON(
              (current.cursor as { anchor: Y.RelativePosition }).anchor,
            ),
            ystate.binding.mapping,
          ) !== null
        ) {
          awareness.setLocalStateField('cursor', null)
        }
      }

      awareness.on('change', awarenessListener)
      view.dom.addEventListener('focusin', updateCursorInfo)
      view.dom.addEventListener('focusout', updateCursorInfo)

      return {
        update: updateCursorInfo,
        destroy() {
          view.dom.removeEventListener('focusin', updateCursorInfo)
          view.dom.removeEventListener('focusout', updateCursorInfo)
          awareness.off('change', awarenessListener)
          awareness.setLocalStateField('cursor', null)
        },
      }
    },
  })
}

export const CollaborationCaret = Extension.create<
  CollaborationCaretOptions,
  CollaborationCaretStorage
>({
  name: 'collaborationCaret',
  priority: 999,

  addOptions() {
    return {
      provider: null!,
      user: { name: null, color: null },
      render: () => document.createElement('span'),
      selectionRender: () => ({ class: 'ProseMirror-yjs-selection' }),
      onUpdate: defaultOnUpdate,
    }
  },

  onCreate() {
    if (!this.options.provider) {
      throw new Error('The "provider" option is required for the CollaborationCaret extension')
    }
  },

  addStorage() {
    return { users: [] }
  },

  addCommands() {
    return {
      updateUser:
        (attributes) =>
        () => {
          this.options.provider.awareness.setLocalStateField('user', attributes)
          return true
        },
      user:
        (attributes) =>
        ({ editor }) =>
          editor.commands.updateUser(attributes),
    }
  },

  addProseMirrorPlugins() {
    const awareness = this.options.provider.awareness
    awareness.setLocalStateField('user', this.options.user)
    this.storage.users = awarenessStatesToArray(awareness.states)

    awareness.on('update', () => {
      this.storage.users = awarenessStatesToArray(awareness.states)
      this.options.onUpdate?.(this.storage.users)
    })

    return [
      yCursorPluginFixed(awareness, {
        cursorBuilder: (user) => this.options.render(user),
        selectionBuilder: (user) => this.options.selectionRender(user),
      }),
    ]
  },
})
