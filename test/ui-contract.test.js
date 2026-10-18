import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8')
const storage = readFileSync(fileURLToPath(new URL('../src/storage.js', import.meta.url)), 'utf8')

test('keeps the demo navigation to Upload, Results, and History', () => {
  assert.match(source, /navButton\('upload', t\('upload'\)\)/)
  assert.match(source, /navButton\('results', t\('results'\)\)/)
  assert.match(source, /navButton\('history', t\('history'\)\)/)
  assert.doesNotMatch(source, /navButton\('today'/)
  assert.doesNotMatch(source, /navButton\('coach'/)
  assert.doesNotMatch(source, /navButton\('records'/)
  assert.doesNotMatch(source, /navButton\('you'/)
})

test('keeps live results transient until the user explicitly saves them', () => {
  assert.match(source, /pulse\.pendingSession = \{/)
  assert.match(source, /data-action="save-result"/)
  assert.match(source, /function saveCurrentResult\(\)/)
  assert.doesNotMatch(source, /state\.pulseSessions\.unshift\(\{ id: uid\(\), profileId: activeProfileId\(\), capturedAt: new Date\(\)\.toISOString\(\), durationSeconds: 30/)
})

test('does not reopen a transient Results view after reload', () => {
  assert.match(storage, /\['upload', 'history'\]\.includes\(saved\.view\)/)
  assert.match(storage, /\['upload', 'history'\]\.includes\(state\.view\)/)
})

test('keeps risk inputs explicit and unavailable when unknown', () => {
  assert.match(source, /data-risk-no-lab/)
  assert.match(source, /contextOptionalModel/)
  assert.match(source, /inputs\.noLab === 'yes'/)
  assert.match(source, /requiredFields\.some\(\(field\) => !inputs\[field\]/)
})
