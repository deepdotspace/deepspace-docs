/**
 * Regression tests for the `/api/files/*` proxy.
 *
 * Two pre-existing defects are asserted here.
 *
 * 1. Spoofable identity. The proxy forwarded the caller's headers verbatim and
 *    only *added* `x-user-id` when a JWT verified. An unauthenticated caller
 *    could therefore send `x-user-id: <victim>` with `?scope=self` and the
 *    platform resolved the victim's prefix — read, list, upload and delete as
 *    that user, since the platform's mutation gate trusts the same header.
 *
 * 2. `scope=app` reaching `scope=self` objects. The platform resolves scope
 *    'app' to `apps/<resourceId>/` and scope 'self' to a strict descendant of
 *    it, and admits keys with `key.startsWith(prefix)` — so `?scope=app` while
 *    naming another user's key passes, and `?scope=app&prefix=users/` lists
 *    everybody's keys. A verified JWT does not close this one.
 *
 * These run in plain vitest against `app.fetch()` with a stubbed
 * PLATFORM_WORKER binding and a real ES256 keypair — no dev server, no
 * workerd. What that buys is the real Hono routing, the real JWT verification
 * and the real header rewriting; what it does not cover is the platform
 * worker's own prefix enforcement, which lives outside this repo.
 *
 * The keypair and the tokens are minted with WebCrypto rather than a JWT
 * library: this app installs with pnpm, so no transitive `jose` is hoisted
 * where the test could import it, and a security regression test should not
 * be the reason a dependency gets added.
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { fileKeyFromPath, reachesUserNamespace } from './file-proxy-scope.js'
import app from '../../worker.js'
import type { Env } from '../../worker.js'

const ISSUER = 'https://auth.deep.space'
const SELF_KEY = 'apps/res_abc/users/user_real/notes.pdf'
const VICTIM_KEY = 'apps/res_abc/users/user_victim/notes.pdf'
const APP_KEY = 'apps/res_abc/1750000000000-k3j4h5g6f-shared.pdf'

// ── Minimal ES256 JWT minting (WebCrypto) ───────────────────────────────────

const ES256 = { name: 'ECDSA', namedCurve: 'P-256' } as const

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function publicKeyPem(key: CryptoKey): Promise<string> {
  const der = new Uint8Array(await crypto.subtle.exportKey('spki', key))
  let binary = ''
  for (const byte of der) binary += String.fromCharCode(byte)
  const body = btoa(binary).replace(/(.{64})/g, '$1\n')
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`
}

/** Sign an ES256 JWT. WebCrypto's ECDSA signature is already the raw r||s JWS wants. */
async function signJwt(privateKey: CryptoKey, subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)))
  const signingInput = `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode({
    sub: subject,
    iss: ISSUER,
    iat: now,
    exp: now + 3600,
  })}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

// ── The guard, in isolation ─────────────────────────────────────────────────

function reaches(path: string): boolean {
  const url = new URL(path, 'https://docs.deep.space')
  return reachesUserNamespace(url.pathname, url.searchParams)
}

describe('reachesUserNamespace', () => {
  it('refuses a scope=app request that names another user key', () => {
    // The platform's app-scope guard is `key.startsWith('apps/<id>/')` and user
    // keys are strict descendants of that prefix, so this one request shape is
    // the whole reason the rule exists.
    expect(reaches(`/api/files/${VICTIM_KEY}?scope=app`)).toBe(true)
  })

  it('refuses a scope=app listing that reaches into the user namespace', () => {
    expect(reaches('/api/files/?scope=app&prefix=users/')).toBe(true)
    expect(reaches('/api/files?scope=app&prefix=users/user_victim/')).toBe(true)
  })

  it('refuses a scope=app upload anchored at a user key', () => {
    // `?key=` is what anchors an upload or a multipart part, so it can walk
    // into the namespace exactly like the path can.
    expect(reaches('/api/files/upload?scope=app&key=users/user_victim/x.pdf')).toBe(true)
    expect(reaches('/api/files/multipart?scope=app&key=users/user_victim/x.pdf')).toBe(true)
  })

  it('refuses a user-namespaced key hidden behind percent-encoding', () => {
    // Both spellings survive URL parsing untouched and only become the `users`
    // segment once decoded — which is why the check decodes first, the same
    // way the platform decodes the path it receives.
    expect(reaches('/api/files/apps/res_abc/%75sers/user_victim/x.pdf?scope=app')).toBe(true)
    expect(reaches('/api/files/apps/res_abc/%2Fusers%2Fuser_victim/x.pdf?scope=app')).toBe(true)
  })

  it('refuses dot segments in a raw, unparsed path', () => {
    // WHATWG URL parsing collapses `..` / `.` / `%2e%2e` out of `pathname`
    // before a real request reaches this, and the platform's sanitizeSubpath
    // rejects them again. Asserted directly rather than through `new URL`,
    // which would normalize the input away.
    const q = new URLSearchParams('scope=app')
    expect(reachesUserNamespace('/api/files/apps/res_abc/x/../users/v/p.pdf', q)).toBe(true)
    expect(reachesUserNamespace('/api/files/apps/res_abc/./x.pdf', q)).toBe(true)
  })

  it('refuses a path it cannot decode rather than forwarding it blind', () => {
    expect(reaches('/api/files/%E0%A4%A?scope=app')).toBe(true)
  })

  it('leaves scope=self alone — that prefix is already per-user', () => {
    expect(reaches(`/api/files/${SELF_KEY}?scope=self`)).toBe(false)
    expect(reaches(`/api/files/${VICTIM_KEY}?scope=self`)).toBe(false)
    expect(reaches(`/api/files/${SELF_KEY}`)).toBe(false)
    expect(reaches('/api/files/?prefix=users/')).toBe(false)
  })

  it('leaves an ordinary app-scope key alone', () => {
    expect(reaches(`/api/files/${APP_KEY}?scope=app`)).toBe(false)
    expect(reaches('/api/files/?scope=app')).toBe(false)
  })

  it('decodes the key the same way the platform does', () => {
    expect(fileKeyFromPath('/api/files/apps/res_abc/my%20doc.pdf')).toBe('apps/res_abc/my doc.pdf')
    expect(fileKeyFromPath('/api/files')).toBe('')
    expect(fileKeyFromPath('/api/records/x')).toBe(null)
    expect(fileKeyFromPath('/api/files/%E0%A4%A')).toBe(null)
  })
})

// ── The route, end to end ───────────────────────────────────────────────────

describe('/api/files/* proxy', () => {
  let env: Env
  let forwarded: Request[]
  let token: string
  let forgedToken: string

  beforeAll(async () => {
    const pair = (await crypto.subtle.generateKey(ES256, true, ['sign', 'verify'])) as CryptoKeyPair
    const impostor = (await crypto.subtle.generateKey(ES256, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair

    token = await signJwt(pair.privateKey, 'user_real')
    // Correctly formed, correctly issued, signed by the wrong key.
    forgedToken = await signJwt(impostor.privateKey, 'user_victim')

    forwarded = []
    env = {
      APP_IDENTITY_TOKEN: 'identity-token',
      DEEPSPACE_APP_ID: 'app_01TEST',
      AUTH_JWT_PUBLIC_KEY: await publicKeyPem(pair.publicKey),
      AUTH_JWT_ISSUER: ISSUER,
      PLATFORM_WORKER: {
        fetch: async (req: Request) => {
          forwarded.push(req)
          return new Response('file-bytes', {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          })
        },
      },
    } as unknown as Env
  })

  const call = (path: string, init?: RequestInit) => {
    forwarded = []
    return app.fetch(new Request(`https://docs.deep.space${path}`, init), env)
  }

  const authed = (path: string, init: RequestInit = {}) =>
    call(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    })

  // ── Defect 1: spoofable identity ──────────────────────────────────────────

  it('refuses an anonymous caller who supplies x-user-id, and forwards nothing', async () => {
    const res = await call(`/api/files/${VICTIM_KEY}?scope=self`, {
      headers: { 'x-user-id': 'user_victim' },
    })
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  it.each(['GET', 'POST', 'DELETE'])(
    'refuses a spoofed %s — read, write and delete all needed the same gate',
    async (method) => {
      const path =
        method === 'POST' ? '/api/files/upload?scope=self' : `/api/files/${VICTIM_KEY}?scope=self`
      const res = await call(path, { method, headers: { 'x-user-id': 'user_victim' } })
      expect(res.status).toBe(401)
      expect(forwarded).toHaveLength(0)
    },
  )

  it('strips an inbound x-user-id even when the caller is authenticated', async () => {
    await authed(`/api/files/${SELF_KEY}?scope=self`, { headers: { 'x-user-id': 'user_victim' } })
    expect(forwarded).toHaveLength(1)
    expect(forwarded[0].headers.get('x-user-id')).toBe('user_real')
  })

  it('treats an invalid JWT as anonymous, never as its claimed subject', async () => {
    const res = await call(`/api/files/${VICTIM_KEY}?scope=self`, {
      headers: { Authorization: `Bearer ${forgedToken}`, 'x-user-id': 'user_victim' },
    })
    expect(res.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  it('sends the app identity and the JWT subject upstream on a legitimate read', async () => {
    const res = await authed(`/api/files/${SELF_KEY}?scope=self`)
    expect(res.status).toBe(200)
    expect(forwarded).toHaveLength(1)
    expect(new URL(forwarded[0].url).pathname).toBe(`/internal/files/${SELF_KEY}`)
    expect(forwarded[0].headers.get('x-user-id')).toBe('user_real')
    expect(forwarded[0].headers.get('x-app-identity-token')).toBe('identity-token')
    expect(forwarded[0].headers.get('x-app-id')).toBe('app_01TEST')
  })

  // ── Defect 2: scope=app reaching scope=self objects ───────────────────────

  it('refuses an authenticated read of another user key claiming scope=app', async () => {
    const res = await authed(`/api/files/${VICTIM_KEY}?scope=app`)
    expect(res.status).toBe(403)
    expect(forwarded).toHaveLength(0)
  })

  it('refuses an authenticated scope=app listing of the user namespace', async () => {
    const res = await authed('/api/files/?scope=app&prefix=users/')
    expect(res.status).toBe(403)
    expect(forwarded).toHaveLength(0)
  })

  it.each([
    ['upload', '/api/files/upload?scope=app&key=users/user_victim/x.pdf', 'POST'],
    ['delete', `/api/files/${VICTIM_KEY}?scope=app`, 'DELETE'],
  ])('refuses an authenticated scope=app %s aimed at a user key', async (_l, path, method) => {
    const res = await authed(path, { method })
    expect(res.status).toBe(403)
    expect(forwarded).toHaveLength(0)
  })

  it("still forwards an authenticated scope=self read of the caller's own file", async () => {
    // The guard must not touch the scope an app would actually use.
    expect((await authed(`/api/files/${SELF_KEY}?scope=self`)).status).toBe(200)
    expect(forwarded).toHaveLength(1)
  })
})
