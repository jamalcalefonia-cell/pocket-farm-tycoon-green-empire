/* Local-only game cache. Cache list is generated from the build, not external APIs. */
const CACHE = 'green-empire-b1e39d1f9e63'
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('./offline-assets.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('Missing offline asset list')
    const assets = await response.json()
    const cache = await caches.open(CACHE)
    await cache.addAll(assets)
    await self.skipWaiting()
  })())
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('green-empire-') && key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    const url = new URL(event.request.url)
    if (event.request.mode === 'navigate') {
      try { const response = await fetch(event.request); if (response.ok) return response } catch {}
      const cached = await caches.match(new URL('./index.html', self.location).href, { ignoreVary: true })
      if (cached) return cached
    }
    // Only public same-origin static files enter this cache; no login or private API data.
    // Module fetches send Origin while install-time addAll does not. Vite's Vary: Origin
    // would otherwise miss the exact same public asset during an offline reload.
    const cached = await caches.match(event.request, { ignoreVary: true })
    if (cached) return cached
    return fetch(event.request)
  })())
})
