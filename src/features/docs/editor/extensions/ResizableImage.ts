/**
 * Resizable Image Extension
 *
 * Extends the default tiptap Image node to support drag-to-resize handles.
 * Users can drag corners/edges to resize images. Width is stored as a node
 * attribute and persisted via Yjs.
 */

import Image from '@tiptap/extension-image'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

const resizableImagePluginKey = new PluginKey('resizableImage')

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width') || element.style.width || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {}
          return { width: attributes.width, style: `width: ${attributes.width}` }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []

    return [
      ...parentPlugins,
      new Plugin({
        key: resizableImagePluginKey,
        props: {
          handleDOMEvents: {
            mousedown(view: EditorView, event: MouseEvent) {
              const target = event.target as HTMLElement
              if (!target.classList.contains('image-resize-handle')) return false

              event.preventDefault()
              event.stopPropagation()

              const imgWrapper = target.closest('.resizable-image-wrapper') as HTMLElement
              if (!imgWrapper) return false

              const img = imgWrapper.querySelector('img') as HTMLImageElement
              if (!img) return false

              const startX = event.clientX
              const startWidth = img.getBoundingClientRect().width
              const direction = target.dataset.direction

              const onMouseMove = (e: MouseEvent) => {
                let diff = e.clientX - startX
                if (direction === 'left') diff = -diff
                const newWidth = Math.max(100, startWidth + diff)
                img.style.width = `${newWidth}px`
              }

              const onMouseUp = (e: MouseEvent) => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''

                const finalWidth = img.getBoundingClientRect().width
                // Find the node position and update the attribute
                const pos = view.posAtDOM(img, 0)
                if (pos != null) {
                  const tr = view.state.tr.setNodeMarkup(pos - 1, undefined, {
                    ...view.state.doc.nodeAt(pos - 1)?.attrs,
                    width: `${Math.round(finalWidth)}px`,
                  })
                  view.dispatch(tr)
                }
              }

              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
              document.addEventListener('mousemove', onMouseMove)
              document.addEventListener('mouseup', onMouseUp)

              return true
            },
          },
        },
      }),
    ]
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const wrapper = document.createElement('div')
      wrapper.classList.add('resizable-image-wrapper')
      wrapper.style.display = 'inline-block'
      wrapper.style.position = 'relative'
      wrapper.style.maxWidth = '100%'

      const img = document.createElement('img')
      const attrs = { ...HTMLAttributes, ...node.attrs }
      for (const [key, value] of Object.entries(attrs)) {
        if (value != null && key !== 'width') {
          img.setAttribute(key, String(value))
        }
      }
      if (node.attrs.width) {
        img.style.width = node.attrs.width
        wrapper.style.width = node.attrs.width
      }
      img.style.maxWidth = '100%'
      img.style.display = 'block'

      // Resize handles
      const createHandle = (direction: string) => {
        const handle = document.createElement('div')
        handle.classList.add('image-resize-handle')
        handle.dataset.direction = direction
        handle.style.position = 'absolute'
        handle.style.width = '8px'
        handle.style.height = '8px'
        handle.style.borderRadius = '50%'
        handle.style.backgroundColor = 'var(--color-primary, #3b82f6)'
        handle.style.border = '2px solid white'
        handle.style.cursor = 'col-resize'
        handle.style.opacity = '0'
        handle.style.transition = 'opacity 0.15s'

        if (direction === 'right') {
          handle.style.right = '-4px'
          handle.style.top = '50%'
          handle.style.transform = 'translateY(-50%)'
        } else {
          handle.style.left = '-4px'
          handle.style.top = '50%'
          handle.style.transform = 'translateY(-50%)'
        }
        return handle
      }

      const leftHandle = createHandle('left')
      const rightHandle = createHandle('right')
      wrapper.appendChild(img)
      wrapper.appendChild(leftHandle)
      wrapper.appendChild(rightHandle)

      // Show handles on hover
      wrapper.addEventListener('mouseenter', () => {
        leftHandle.style.opacity = '1'
        rightHandle.style.opacity = '1'
      })
      wrapper.addEventListener('mouseleave', () => {
        leftHandle.style.opacity = '0'
        rightHandle.style.opacity = '0'
      })

      return {
        dom: wrapper,
        contentDOM: undefined,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false
          const newAttrs = { ...HTMLAttributes, ...updatedNode.attrs }
          for (const [key, value] of Object.entries(newAttrs)) {
            if (value != null && key !== 'width') {
              img.setAttribute(key, String(value))
            }
          }
          if (updatedNode.attrs.width) {
            img.style.width = updatedNode.attrs.width
            wrapper.style.width = updatedNode.attrs.width
          }
          return true
        },
      }
    }
  },
})
