import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from './utils'
import { Input } from './Input'

interface SearchInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'role'> {
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, value, onKeyDown, ...props }, ref) => {
    return (
      <div className="relative w-full min-w-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={ref}
          type="text"
          role="searchbox"
          autoComplete="off"
          enterKeyHint="search"
          className={cn('pl-9 pr-9', className)}
          value={value}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value && onClear) {
              e.preventDefault()
              onClear()
            }
            onKeyDown?.(e)
          }}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
