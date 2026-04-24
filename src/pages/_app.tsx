/**
 * App — global providers + shell.
 *
 * Generouted renders this around all routes.
 *
 * We mount two RecordRoom scopes:
 *   - app:docs2           (app-private: users, settings, documents metadata)
 *   - workspace:default   (shared across apps: content_shares, teams, etc.)
 *
 * `useQuery('documents')` resolves to the app scope, while
 * `useQuery('content_shares')` resolves to the workspace scope —
 * ScopeRegistry does the routing automatically.
 */

import { Suspense, useEffect, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuth } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { getGlobalDOSchemas } from 'deepspace/worker'
import { ToastProvider } from '../components/ui'
import { APP_NAME, SCOPE_ID } from '../constants'
import { schemas } from '../schemas'

const WORKSPACE_SHARED_SCOPE = {
  roomId: 'workspace:default',
  schemas: getGlobalDOSchemas('workspace'),
}

const THEME_KEY = 'docs2-theme'

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

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope
        roomId={SCOPE_ID}
        schemas={schemas}
        appId={APP_NAME}
        sharedScopes={[WORKSPACE_SHARED_SCOPE]}
      >
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
