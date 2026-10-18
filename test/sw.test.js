import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const serviceWorkerSource = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8')

function createServiceWorkerHarness({ network = 'success' } = {}) {
  const handlers = new Map()
  const cacheStore = new Map()
  const events = { skipWaiting: 0, clientsClaim: 0 }
  const response = (body) => ({ body, clone() { return response(body) } })

  const keyFor = (request) => typeof request === 'string' ? request : request.url
  const cacheFor = (name) => {
    if (!cacheStore.has(name)) cacheStore.set(name, new Map())
    return cacheStore.get(name)
  }
  const cacheApi = (name) => {
    const entries = cacheFor(name)
    return {
      addAll: async (urls) => urls.forEach((url) => entries.set(url, response(`shell:${url}`))),
      put: async (request, value) => entries.set(keyFor(request), value),
      match: async (request) => entries.get(keyFor(request))
    }
  }
  const cachesApi = {
    open: async (name) => cacheApi(name),
    keys: async () => [...cacheStore.keys()],
    delete: async (name) => cacheStore.delete(name),
    match: async (request) => {
      for (const entries of cacheStore.values()) {
        const found = entries.get(keyFor(request))
        if (found) return found
      }
      return undefined
    }
  }
  const context = vm.createContext({
    caches: cachesApi,
    fetch: async () => network === 'success' ? response('network') : Promise.reject(new Error('offline')),
    self: {
      addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: () => { events.skipWaiting += 1 },
      clients: { claim: () => { events.clientsClaim += 1 } }
    }
  })
  vm.runInContext(serviceWorkerSource, context)

  const dispatch = async (type, event) => {
    const waits = []
    const enriched = { ...event, waitUntil: (promise) => waits.push(Promise.resolve(promise)) }
    const result = handlers.get(type)?.(enriched)
    await Promise.all(waits)
    return { result, event: enriched }
  }

  return { cacheStore, cachesApi, dispatch, events, response }
}

test('service worker installs the shell, removes old caches, and accepts update messages', async () => {
  const harness = createServiceWorkerHarness()
  harness.cacheStore.set('old-cache', new Map([['/old', harness.response('old')]]))
  await harness.dispatch('install', {})
  assert.ok(harness.cacheStore.get('khonroojai-shell-v3')?.has('/index.html'))
  assert.equal(harness.events.skipWaiting, 1)
  await harness.dispatch('activate', {})
  assert.equal(harness.cacheStore.has('old-cache'), false)
  assert.equal(harness.events.clientsClaim, 1)
  await harness.dispatch('message', { data: { type: 'SKIP_WAITING' } })
  assert.equal(harness.events.skipWaiting, 2)
})

test('service worker caches fresh GET responses and falls back to the shell offline', async () => {
  const online = createServiceWorkerHarness({ network: 'success' })
  await online.dispatch('install', {})
  const onlineFetch = { method: 'GET', url: '/assets/app.js' }
  const onlineEvent = { request: onlineFetch, respondWith: (promise) => { onlineEvent.responsePromise = promise } }
  await online.dispatch('fetch', onlineEvent)
  assert.equal((await onlineEvent.responsePromise).body, 'network')
  assert.equal(online.cacheStore.get('khonroojai-shell-v3').get('/assets/app.js').body, 'network')
})

test('service worker returns cached index for an offline GET and ignores non-GET requests', async () => {
  const offline = createServiceWorkerHarness({ network: 'offline' })
  await offline.dispatch('install', {})
  const offlineEvent = { request: { method: 'GET', url: '/offline-route' }, respondWith: (promise) => { offlineEvent.responsePromise = promise } }
  await offline.dispatch('fetch', offlineEvent)
  assert.equal((await offlineEvent.responsePromise).body, 'shell:/index.html')

  const postEvent = { request: { method: 'POST', url: '/submit' }, respondWith: () => { throw new Error('POST should not be intercepted') } }
  await offline.dispatch('fetch', postEvent)
  assert.equal(postEvent.responsePromise, undefined)
})
