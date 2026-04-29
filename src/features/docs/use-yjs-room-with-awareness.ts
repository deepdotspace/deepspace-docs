/**
 * Matches {@link import('deepspace').useYjsRoom} (YjsRoom DO via /ws/yjs/:id) but wires
 * {@link Awareness} over the server's MSG_AWARENESS path. Published `useYjsRoom` builds may
 * omit awareness relay; collaborator cursors and presence need it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export interface UseYjsRoomWithAwarenessResult {
  doc: Y.Doc
  text: string
  setText: (value: string) => void
  synced: boolean
  canWrite: boolean
  awareness: Awareness
}

export function useYjsRoomWithAwareness(
  docId: string,
  fieldName: string,
): UseYjsRoomWithAwarenessResult {
  const [synced, setSynced] = useState(false)
  const [canWrite, setCanWrite] = useState(false)
  const [text, setTextState] = useState('')
  const [, setUpdateCount] = useState(0)

  const docRef = useRef<Y.Doc | null>(null)
  if (!docRef.current) docRef.current = new Y.Doc()
  const doc = docRef.current

  const awarenessRef = useRef<Awareness | null>(null)
  if (!awarenessRef.current) awarenessRef.current = new Awareness(doc)
  const awareness = awarenessRef.current

  const wsRef = useRef<WebSocket | null>(null)
  const isLocalRef = useRef(false)
  const applyingRemoteAwarenessRef = useRef(false)

  const yText = useMemo(() => doc.getText(fieldName), [doc, fieldName])

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
    let alive = true

    const connect = async (isReconnect: boolean) => {
      if (!alive) return

      if (!isReconnect) {
        doc.transact(() => {
          if (yText.length > 0) yText.delete(0, yText.length)
        })
        setTextState('')
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
        setSynced(false)
      }

      ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as { type?: string; canWrite?: boolean }
            if (msg.type === 'auth' && typeof msg.canWrite === 'boolean') setCanWrite(msg.canWrite)
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
              setSynced(true)
              break
            }
            case MSG_SYNC_STEP2: {
              Y.applyUpdate(doc, payload, 'server')
              setTextState(yText.toString())
              setSynced(true)
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
        setSynced(false)
        if (alive) reconnectTimer = setTimeout(() => void connect(true), 1000)
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
  }, [doc, docId, yText, awareness])

  useEffect(() => {
    const handler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'server') return
      const socket = wsRef.current
      if (!socket || socket.readyState !== WebSocket.OPEN) return
      const enc = createEncoder()
      writeVarUint(enc, MSG_SYNC)
      writeVarUint(enc, MSG_SYNC_UPDATE)
      writeVarUint8Array(enc, update)
      socket.send(toUint8Array(enc).buffer)
    }
    doc.on('update', handler)
    return () => {
      doc.off('update', handler)
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
      awareness.setLocalState(null)
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

  return { doc, text, setText, synced, canWrite, awareness }
}
