/**
 * Scope guard for the `/api/files/*` proxy.
 *
 * This app does not use scoped R2 storage at all: nothing in src/ calls
 * `useR2Files`, uploads a file, or renders a stored file URL — the only
 * `<img>` sources are the auth provider's avatar URLs, which are not ours. The
 * proxy is scaffold chrome. It therefore requires a verified JWT on every
 * method, and this module closes the one hole a JWT does not.
 *
 * The platform resolves a scope into an R2 prefix like this:
 *
 *   scope 'app'  ->  `apps/<resourceId>/`
 *   scope 'self' ->  `apps/<resourceId>/users/<userId>/`
 *
 * and its guard is `key.startsWith(prefix)`. Every user's private files are
 * strict DESCENDANTS of the app prefix, so a request that says `?scope=app`
 * while naming somebody else's key satisfies that check — one signed-in user
 * could read, overwrite or delete another user's files, and
 * `?scope=app&prefix=users/` would list every user's keys. Verifying the JWT
 * does not help: the hole is in the prefix arithmetic, not in the identity.
 *
 * So for scope 'app' — and only for scope 'app', scope 'self' is already
 * namespaced per user — refuse any request that names the `users` namespace.
 * A key can enter that namespace through three inputs, all covered here:
 *
 *   - the path, on a download or a delete;
 *   - `?key=`, which anchors an upload or a multipart part;
 *   - `?prefix=`, which selects what the list route enumerates.
 *
 * The path is decoded before the test, because an encoded slash (`%2Fusers%2F`)
 * or an encoded letter (`%75sers`) survives URL parsing intact and only becomes
 * a `users` path segment once decoded — which is exactly what the platform does
 * to it downstream. The query values arrive already decoded by URLSearchParams,
 * the same single decode the platform applies to them.
 *
 * Dot segments are refused too. That one is belt-and-braces rather than
 * load-bearing: WHATWG URL parsing collapses `..`, `.` and their encoded
 * spellings out of `url.pathname` before this sees them, and the platform's
 * own `sanitizeSubpath` rejects them again. It costs one comparison and keeps
 * the function honest if it is ever handed a raw, unparsed path.
 */

const FILES_MOUNT = '/api/files'

/** The per-user namespace the platform nests under the app prefix. */
const USER_NAMESPACE_SEGMENT = 'users'

/**
 * The R2 key a `/api/files/...` URL names, or `null` when the path is not on
 * this mount or cannot be decoded. `''` is the mount root — the list route.
 *
 * Mirrors the platform's own decoding (`decodeURIComponent` of the path minus
 * the mount) so this sees the same string the prefix guard downstream will see.
 */
export function fileKeyFromPath(pathname: string): string | null {
  if (pathname !== FILES_MOUNT && !pathname.startsWith(`${FILES_MOUNT}/`)) return null
  try {
    return decodeURIComponent(pathname.slice(FILES_MOUNT.length).replace(/^\//, ''))
  } catch {
    return null
  }
}

/** True when any segment of `value` is the user namespace or a dot segment. */
function namesUserNamespace(value: string): boolean {
  return value.split('/').some((s) => s === USER_NAMESPACE_SEGMENT || s === '.' || s === '..')
}

/**
 * True when a `scope=app` request reaches into the per-user namespace, i.e.
 * at somebody's scope 'self' objects. Such a request must be refused; the
 * platform's `key.startsWith(prefix)` check will not refuse it.
 */
export function reachesUserNamespace(pathname: string, params: URLSearchParams): boolean {
  if (params.get('scope') !== 'app') return false

  const key = fileKeyFromPath(pathname)
  // `null` means the path is off this mount or does not decode. The route only
  // ever hands this a mount path, so in practice it means undecodable — refuse
  // rather than forward a string this guard could not read.
  if (key === null) return true

  return [key, params.get('key') ?? '', params.get('prefix') ?? ''].some(namesUserNamespace)
}
