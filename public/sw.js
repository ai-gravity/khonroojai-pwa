// Bump this name when the shell or update behavior changes so an existing
// client can discover a new worker instead of remaining on an old shell.
const CACHE = 'khonroojai-shell-v3'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).then(async (response) => {
      const copy = response.clone()
      try {
        const cache = await caches.open(CACHE)
        await cache.put(event.request, copy)
      } catch { /* a private or full cache must not block the network response */ }
      return response
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  )
})
