/**
 * Matches {@link import('deepspace').useYjsRoom} (YjsRoom DO via /ws/yjs/:id) but wires
 * {@link Awareness} over the server's MSG_AWARENESS path. Published `useYjsRoom` builds may
 * omit awareness relay; collaborator avatars/presence otherwise never populate.
 *
 * Key differences from a vanilla useYjsRoom:
 *   - Tracks `writeAuthResolved` so the editor UI can avoid rendering the
 *     "view-only" placeholder for one frame before the server's `auth`
 *     message lands. Without it, owners see a "view only" flash on first
 *     mount of every doc.
 *   - Recreates the Y.Doc + Awareness on `docId` change so Tiptap binds to
 *     a fresh fragment (no leaking content between docs).
 *   - Coalesces local Yjs updates into one MSG_SYNC_UPDATE per ~16ms via
 *     Y.mergeUpdates — keeps WS frames bounded under heavy typing.
 *   - When the connection closes before any sync handshake we treat it as
 *     a permission denial and surface a hard error after 3 retries instead
 *     of the default infinite reconnect loop.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import {
  Awareness,
  createDecoder,
  createEncoder,
  encodeAwarenessMessage,
  getAuthToken,
  handleAwarenessMessage,
  MSG_AWARENESS,
  MSG_SYNC,
  MSG_SYNC_STEP1,
  MSG_SYNC_STEP2,
  MSG_SYNC_UPDATE,
  readVarUint,
  readVarUint8Array,
  toUint8Array,
  writeVarUint,
  writeVarUint8Array,
} from 'deepspace'

const UPDATE_BATCH_DELAY_MS = 16

export interface UseYjsRoomWithAwarenessResult {
  doc: Y.Doc
  text: string
  setText: (value: string) => void
  synced: boolean
  /** From the server's WebSocket `{ type:'auth', canWrite }`; false until confirmed. */
  canWrite: boolean
  /** Becomes true after the auth message is parsed (eliminates the transient false flash). */
  writeAuthResolved: boolean
  /** Set after 3 failed sync handshakes (typically a permission denial). Null while healthy. */
  error: string | null
  awareness: Awareness
}

export function useYjsRoomWithAwareness(
  docId: string,
  fieldName: string,
  enabled = true,
): UseYjsRoomWithAwarenessResult {
  const [syncedDocId, setSyncedDocId] = useState<string | null>(null)
  const [canWrite, setCanWrite] = useState(false)
  const [writeAuthResolved, setWriteAuthResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [text, setTextState] = useState('')
  const [, setUpdateCount] = useState(0)
  const synced = enabled && syncedDocId === docId

  /**
   * Recreate the Y.Doc + Awareness when docId flips. Sharing one doc across
   * route changes leaks the previous document's fragment into the new editor
   * (and pollutes awareness with stale carets).
   */
  const { doc, awareness } = useMemo(() => {
    const nextDoc = new Y.Doc()
    return { doc: nextDoc, awareness: new Awareness(nextDoc) }
  }, [docId])

  const wsRef = useRef<WebSocket | null>(null)
  const isLocalRef = useRef(false)
  const applyingRemoteAwarenessRef = useRef(false)
  const pendingUpdatesRef = useRef<Uint8Array[]>([])
  const updateBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const yText = useMemo(() => doc.getText(fieldName), [doc, fieldName])

  useEffect(() => {
    return () => {
      try {
        awareness.setLocalState(null)
      } catch {
        /* ignore */
      }
      doc.destroy()
    }
  }, [awareness, doc])

  useLayoutEffect(() => {
    setSyncedDocId(null)
    setCanWrite(false)
    setWriteAuthResolved(false)
    setError(null)
    setTextState('')
  }, [docId])

  useEffect(() => {
    const observer = () => {
      if (isLocalRef.current) return
      setTextState(yText.toString())
    }
    yText.observe(observer)
    return () => yText.unobserve(observer)
  }, [yText])

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let denyCount = 0
    let alive = true

    if (!enabled) {
      doc.transact(() => {
        if (yText.length > 0) yText.delete(0, yText.length)
      })
      setTextState('')
      setSyncedDocId(null)
      setCanWrite(false)
      setWriteAuthResolved(false)
      setError(null)
      try {
        awareness.setLocalState(null)
      } catch {
        /* ignore */
      }
      return () => {
        alive = false
      }
    }

    const connect = async (isReconnect: boolean) => {
      if (!alive) return
      let didSync = false

      if (!isReconnect) {
        doc.transact(() => {
          if (yText.length > 0) yText.delete(0, yText.length)
        })
        setTextState('')
        setError(null)
        try {
          awareness.setLocalState(null)
        } catch {
          /* ignore */
        }
      }

      const token = await getAuthToken()
      if (!alive) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const baseUrl = `${protocol}//${window.location.host}`
      const url = new URL(`/ws/yjs/${encodeURIComponent(docId)}`, baseUrl)
      if (token) url.searchParams.set('token', token)
      ws = new WebSocket(url.toString())
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        setSyncedDocId(null)
        setError(null)
      }

      ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as { type?: string; canWrite?: boolean }
            if (msg.type === 'auth') {
              setWriteAuthResolved(true)
              if (typeof msg.canWrite === 'boolean') setCanWrite(msg.canWrite)
            }
          } catch {
            /* ignore */
          }
          return
        }

        const data = new Uint8Array(event.data)
        const decoder = createDecoder(data)
        const messageType = readVarUint(decoder)

        if (messageType === MSG_SYNC) {
          const syncType = readVarUint(decoder)
          const payload = readVarUint8Array(decoder)
          switch (syncType) {
            case MSG_SYNC_STEP1: {
              const diff = Y.encodeStateAsUpdate(doc, payload)
              const enc = createEncoder()
              writeVarUint(enc, MSG_SYNC)
              writeVarUint(enc, MSG_SYNC_STEP2)
              writeVarUint8Array(enc, diff)
              ws?.send(toUint8Array(enc).buffer)
              didSync = true
              setSyncedDocId(docId)
              break
            }
            case MSG_SYNC_STEP2: {
              Y.applyUpdate(doc, payload, 'server')
              setTextState(yText.toString())
              didSync = true
              setSyncedDocId(docId)
              break
            }
            case MSG_SYNC_UPDATE: {
              Y.applyUpdate(doc, payload, 'server')
              setTextState(yText.toString())
              setUpdateCount((c) => c + 1)
              break
            }
          }
        } else if (messageType === MSG_AWARENESS) {
          applyingRemoteAwarenessRef.current = true
          try {
            handleAwarenessMessage(awareness, data)
          } catch {
            /* ignore malformed */
          } finally {
            applyingRemoteAwarenessRef.current = false
          }
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        setSyncedDocId(null)
        if (!alive || !enabled) return
        if (!didSync) {
          denyCount += 1
          if (denyCount < 3) {
            reconnectTimer = setTimeout(() => void connect(true), 250)
            return
          }
          setError('Unable to connect to this document.')
          return
        }
        denyCount = 0
        reconnectTimer = setTimeout(() => void connect(true), 1000)
      }

      ws.onerror = () => ws?.close()
    }

    void connect(false)

    return () => {
      alive = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null
        ws.onmessage = null
        ws.onerror = null
        ws.close()
      }
      wsRef.current = null
    }
  }, [doc, docId, yText, awareness, enabled])

  useEffect(() => {
    /**
     * Tiptap fires a Yjs `update` for every keystroke. Sending each as its
     * own WS frame floods the socket and visibly drops typing latency under
     * load. Coalesce into a single MSG_SYNC_UPDATE per ~16 ms via
     * Y.mergeUpdates — same behaviour Tiptap collab examples ship with.
     */
    const flushPendingUpdates = () => {
      updateBatchTimerRef.current = null
      const updates = pendingUpdatesRef.current
      pendingUpdatesRef.current = []
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN || updates.length === 0) return

      const enc = createEncoder()
      writeVarUint(enc, MSG_SYNC)
      writeVarUint(enc, MSG_SYNC_UPDATE)
      writeVarUint8Array(enc, updates.length === 1 ? updates[0] : Y.mergeUpdates(updates))
      socket.send(toUint8Array(enc).buffer)
    }

    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'server') return
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      pendingUpdatesRef.current.push(update)
      if (!updateBatchTimerRef.current) {
        updateBatchTimerRef.current = setTimeout(flushPendingUpdates, UPDATE_BATCH_DELAY_MS)
      }
    }
    doc.on('update', handler)
    return () => {
      doc.off('update', handler)
      if (updateBatchTimerRef.current) {
        clearTimeout(updateBatchTimerRef.current)
        flushPendingUpdates()
      }
      pendingUpdatesRef.current = []
    }
  }, [doc])

  useEffect(() => {
    const handleAwarenessUpdate = ({
      added,
      updated,
      removed,
    }: {
      added: number[]
      updated: number[]
      removed: number[]
    }) => {
      if (applyingRemoteAwarenessRef.current) return
      const changedClients = [...added, ...updated, ...removed]
      if (changedClients.length === 0) return
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      socket.send(encodeAwarenessMessage(awareness, changedClients).buffer)
    }

    awareness.on('update', handleAwarenessUpdate)
    return () => {
      awareness.off('update', handleAwarenessUpdate)
      try {
        awareness.setLocalState(null)
      } catch {
        /* ignore */
      }
    }
  }, [awareness])

  const setText = useCallback(
    (value: string) => {
      setTextState(value)
      if (!canWrite) return
      isLocalRef.current = true
      doc.transact(() => {
        yText.delete(0, yText.length)
        yText.insert(0, value)
      })
      isLocalRef.current = false
    },
    [doc, yText, canWrite],
  )

  return { doc, text, setText, synced, canWrite, writeAuthResolved, error, awareness }
}
