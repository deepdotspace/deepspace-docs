/**
 * Navigation — top nav bar with auth controls.
 */

import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, AuthOverlay, useUser, signOut } from 'deepspace'
import { APP_NAME, ROLE_CONFIG, type Role } from '../constants'
import { nav } from '../nav'

export default function Navigation() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const userRole = (user?.role ?? 'anonymous') as Role | 'anonymous'
  const roleConfig = ROLE_CONFIG[userRole as Role] ?? { title: 'Anonymous', badgeVariant: 'secondary' }

  useEffect(() => { setMobileMenuOpen(false) }, [location.pathname])

  const visibleNav = nav.filter((item) => {
    if (!item.roles) return true
    if (userRole === 'admin') return true
    return item.roles.includes(userRole as Role)
  })

  return (
    <>
      <nav
        data-testid="app-navigation"
        className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="text-base font-semibold text-foreground tracking-tight">
            {APP_NAME}
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {visibleNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path)
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span
              data-testid="nav-role-badge"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                roleConfig.badgeVariant === 'warning'
                  ? 'bg-warning/20 text-warning'
                  : roleConfig.badgeVariant === 'default'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {roleConfig.title}
            </span>

            {isSignedIn && user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-2.5 py-1 hover:bg-secondary transition-colors cursor-pointer"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground overflow-hidden">
                    {user.imageUrl ? (
                      <img src={user.imageUrl} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      user.name?.[0]?.toUpperCase() ?? '?'
                    )}
                  </div>
                  <span data-testid="nav-user-name" className="hidden text-sm text-muted-foreground sm:inline">
                    {user.name || user.email}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
                      <div className="px-3 py-2 border-b border-border">
                        <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut() }}
                        className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                data-testid="nav-sign-in-button"
                onClick={() => setShowAuthModal(true)}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Sign In
              </button>
            )}

            <button
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
            <div className="px-4 py-2">
              {visibleNav.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {showAuthModal && (
        <AuthOverlay onClose={() => setShowAuthModal(false)} />
      )}
    </>
  )
}
