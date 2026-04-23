/**
 * Modal / ConfirmModal — backward-compatible wrappers around Dialog primitives.
 *
 * New code should use Dialog directly. These wrappers exist so existing
 * widget code (`<Modal open={...}>`) keeps working without changes.
 */

import React, { ReactNode, JSX } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader as DHeader,
  DialogTitle as DTitle,
  DialogDescription as DDescription,
  DialogFooter as DFooter,
} from './Dialog'
import { Button } from './Button'
import { cn } from './utils'

// ============================================================================
// Modal - Accessible modal dialog (wraps Radix Dialog)
// ============================================================================

interface ModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({
  open,
  onClose,
  children,
  size = 'md',
  className,
}: ModalProps): JSX.Element {
  const sizes = {
    sm: 'max-w-[calc(100vw-2rem)] sm:max-w-sm',
    md: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
    lg: 'max-w-[calc(100vw-2rem)] sm:max-w-2xl',
    xl: 'max-w-[calc(100vw-2rem)] sm:max-w-4xl',
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className={cn(sizes[size], 'flex flex-col max-h-[85vh]', className)}>
        {children}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Modal.Header
// ============================================================================

interface ModalHeaderProps {
  children: ReactNode
  onClose?: () => void
  className?: string
}

function ModalHeader({ children, className = '' }: ModalHeaderProps): JSX.Element {
  return (
    <DHeader className={className}>
      {children}
    </DHeader>
  )
}

// ============================================================================
// Modal.Title
// ============================================================================

interface ModalTitleProps {
  children: ReactNode
  className?: string
}

function ModalTitle({ children, className = '' }: ModalTitleProps): JSX.Element {
  return (
    <DTitle className={className}>
      {children}
    </DTitle>
  )
}

// ============================================================================
// Modal.Description
// ============================================================================

interface ModalDescriptionProps {
  children: ReactNode
  className?: string
}

function ModalDescription({ children, className = '' }: ModalDescriptionProps): JSX.Element {
  return (
    <DDescription className={className}>
      {children}
    </DDescription>
  )
}

// ============================================================================
// Modal.Body - Scrollable content area
// ============================================================================

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

function ModalBody({ children, className = '' }: ModalBodyProps): JSX.Element {
  return (
    <div className={cn('flex-1 overflow-y-auto py-4', className)}>
      {children}
    </div>
  )
}

// ============================================================================
// Modal.Footer - Action buttons area
// ============================================================================

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

function ModalFooter({ children, className = '' }: ModalFooterProps): JSX.Element {
  return (
    <DFooter className={className}>
      {children}
    </DFooter>
  )
}

// ============================================================================
// ConfirmModal - Pre-built confirmation dialog
// ============================================================================

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  loading = false,
}: ConfirmModalProps): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <Modal.Header>
        <Modal.Title>{title}</Modal.Title>
        {description && <Modal.Description>{description}</Modal.Description>}
      </Modal.Header>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

// ============================================================================
// Attach sub-components
// ============================================================================

Modal.Header = ModalHeader
Modal.Title = ModalTitle
Modal.Description = ModalDescription
Modal.Body = ModalBody
Modal.Footer = ModalFooter

export default Modal
