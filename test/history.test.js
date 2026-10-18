import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultState, loadState, saveState } from '../src/storage.js'
import { historyChartPoints, removePulseSession, selectTrendSessions } from '../src/history.js'

function session(id, overrides = {}) {
  return { id, profileId: 'owner', capturedAt: '2026-10-17T12:00:00.000Z', measuredHr: 72, bpm: 72, durationSeconds: 30, quality: 90, source: 'camera', ...overrides }
}

test('filters trends by profile, time range, quality, sample provenance, and duplicate id', () => {
  const sessions = [
    session('good-1'),
    session('good-1', { measuredHr: 74 }),
    session('bad-quality', { quality: 47 }),
    session('sample', { isSample: true }),
    session('guest', { profileId: 'guest' }),
    session('old', { capturedAt: '2026-09-01T12:00:00.000Z' })
  ]
  const selected = selectTrendSessions(sessions, { profileId: 'owner', rangeDays: '30', now: '2026-10-17T13:00:00.000Z' })
  assert.deepEqual(selected.map((item) => item.id), ['good-1'])
})

test('supports empty, single-point, and multiple-point chart states', () => {
  assert.deepEqual(historyChartPoints([]), [])
  const one = session('one')
  assert.deepEqual(historyChartPoints([one]).map((point) => point.x), [0.5])
  const points = historyChartPoints([session('a'), session('b', { capturedAt: '2026-10-17T13:00:00.000Z', measuredHr: 76 })])
  assert.deepEqual(points.map((point) => point.x), [0, 1])
  assert.deepEqual(points.map((point) => point.y), [72, 76])
})

test('deletes one local observation and returns an undo payload without touching another profile', () => {
  const sessions = [session('first'), session('guest', { profileId: 'guest' })]
  const result = removePulseSession(sessions, 'first', 'owner')
  assert.equal(result.removed.id, 'first')
  assert.equal(result.index, 0)
  assert.deepEqual(result.sessions.map((item) => item.id), ['guest'])
  assert.equal(removePulseSession(result.sessions, 'missing', 'owner').removed, null)
})

test('persists multiple local sessions across reload with profile provenance', () => {
  const previous = globalThis.localStorage
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key)
  }
  try {
    const state = defaultState()
    state.activeProfileId = 'guest'
    state.pulseSessions = [session('one', { profileId: 'guest' }), session('two', { profileId: 'guest', measuredHr: 76 })]
    saveState(state)
    const reloaded = loadState()
    assert.equal(reloaded.activeProfileId, 'guest')
    assert.deepEqual(reloaded.pulseSessions.map((item) => item.id), ['one', 'two'])
    assert.ok(reloaded.pulseSessions.every((item) => item.profileId === 'guest'))
  } finally {
    globalThis.localStorage = previous
  }
})
