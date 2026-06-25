/**
 * App — global providers + shell.
 *
 * Generouted renders this around all routes.
 *
 * Single RecordRoom scope: `app:docs`. Documents, folders, and access
 * control all live here — no cross-app `workspace:default` shared scope.
 */

import { Suspense, useEffect, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { ToastProvider } from '../components/ui'
import { APP_NAME, SCOPE_ID } from '../constants'
import { schemas } from '../schemas'
import { useClaimInvites } from '../features/docs/use-claim-invites'

const THEME_KEY = 'docs-theme'

export default function App() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    try {
      localStorage.setItem(THEME_KEY, 'light')
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <ToastProvider>
      <DeepSpaceAuthProvider>
        <AuthGate>
          <div
            data-testid="app-layout"
            className="flex h-screen flex-col bg-background overflow-hidden"
          >
            <main className="flex-1 overflow-y-auto min-h-0">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </AuthGate>
      </DeepSpaceAuthProvider>
    </ToastProvider>
  )
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth()
  // Resolve any pending email invites into real collaborator access on sign-in.
  useClaimInvites()

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope roomId={SCOPE_ID} schemas={schemas} appId={APP_NAME}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
