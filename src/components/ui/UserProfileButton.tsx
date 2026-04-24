import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from './Avatar'
import { cn } from './utils'

export interface UserProfileButtonProps
  extends Omit<React.ComponentProps<'button'>, 'children' | 'type'> {
  /** Display name; falls back to `email` */
  name: string
  email?: string
  imageUrl?: string | null
  type?: 'button' | 'submit' | 'reset'
  /** Extra classes for the name label (e.g. `hidden sm:inline` to hide on small screens). */
  nameClassName?: string
  /** @default 9 — Tailwind h-* / w-* for the avatar. */
  avatarSizeClassName?: string
  showName?: boolean
}

export function UserProfileButton({
  name,
  email,
  imageUrl,
  className,
  nameClassName,
  avatarSizeClassName = 'h-7 w-7',
  showName = true,
  type = 'button',
  ...props
}: UserProfileButtonProps) {
  const display = (name || email || '?').trim()
  const initial = display[0]?.toUpperCase() ?? '?'

  return (
    <button
      type={type}
      className={cn(
        'flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-left transition-colors hover:bg-secondary',
        className
      )}
      {...props}
    >
      <Avatar className={cn('shrink-0', avatarSizeClassName)}>
        {imageUrl ? <AvatarImage src={imageUrl} alt="" referrerPolicy="no-referrer" className="object-cover" /> : null}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      {showName && (
        <span
          className={cn('min-w-0 truncate text-sm text-muted-foreground', nameClassName)}
          data-testid="nav-user-name"
        >
          {display}
        </span>
      )}
    </button>
  )
}
