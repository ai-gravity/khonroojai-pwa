import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('keeps empty Results copy distinct from the save action', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(source, /resultEmptyHint:/)
  assert.match(source, /result-empty-card[^`]*t\('resultEmptyHint'\)/)
  assert.doesNotMatch(source, /result-empty-card[^`]*t\('resultSaveHint'\)/)
})

test('does not draw a duplicate tiny empty History message inside the chart', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(source, /if \(!points\.length\) return/)
  assert.doesNotMatch(source, /if \(!points\.length\) \{[^}]*fillText\(t\('historyEmpty'\)/s)
})

test('keeps invalid BP and risk forms open with an inline alert path', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(source, /function showFormError\(/)
  assert.match(source, /document\.addEventListener\('invalid'/)
  assert.match(source, /state\.formErrors = \{ \...\(state\.formErrors \|\| \{\}\), bp:/)
  assert.match(source, /state\.formErrors = \{ \...\(state\.formErrors \|\| \{\}\), risk:/)
  assert.match(source, /if \(!result\.valid\) \{[\s\S]*showFormError\(form, message/s)
  assert.match(styles, /\.form-error\{/) 
})

test('routes the top-level Upload file picker into the decoder view', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(source, /if \(state\.view === 'upload'\) state\.view = 'pulse'/)
  assert.match(source, /document\.querySelector\('#pulse-video'\)/)
})
