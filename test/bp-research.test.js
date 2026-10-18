import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateLegacyPCE } from '../src/risk.js'
import { defaultState, exportState } from '../src/storage.js'
import { BP_RESEARCH_RESULT_STATUS, BP_RESEARCH_SECONDS, makeBPResearchCapture, validateBPReference } from '../src/bp-research.js'

test('uses a 60-second research target with an explicit timestamp and no BP output', () => {
  const capture = makeBPResearchCapture({ capturedAt: '2026-10-17T12:34:56.000Z', source: 'camera' })
  assert.equal(BP_RESEARCH_SECONDS, 60)
  assert.equal(capture.valid, true)
  assert.equal(capture.value.durationSeconds, 60)
  assert.equal(capture.value.capturedAt, '2026-10-17T12:34:56.000Z')
  assert.equal(capture.value.resultStatus, BP_RESEARCH_RESULT_STATUS)
  assert.equal(capture.value.result, null)
  assert.equal('systolic' in capture.value, false)
  assert.equal('diastolic' in capture.value, false)
})

test('rejects incomplete or empty cuff reference fields', () => {
  assert.equal(validateBPReference({}).valid, false)
  assert.equal(validateBPReference({ measuredAt: '2026-10-17T12:34', source: '' }).reason, 'source')
  assert.equal(validateBPReference({ measuredAt: '2026-10-17T12:34', source: 'Home cuff', systolic: '', diastolic: '' }).valid, false)
  assert.equal(validateBPReference({ measuredAt: '2026-10-17T12:34', source: 'Home cuff', systolic: 120, diastolic: 80 }).valid, true)
})

test('keeps BP research metadata out of manual readings and ASCVD inputs', () => {
  const state = defaultState()
  const capture = makeBPResearchCapture({ capturedAt: '2026-10-17T12:34:56.000Z', source: 'camera' })
  state.bpResearchSessions = [{ id: 'research-1', profileId: 'owner', ...capture.value }]
  const inputs = { age: 55, totalCholesterol: 213, hdl: 50, systolic: 120, treated: 'no', smoker: 'no', diabetes: 'no', priorASCVD: 'no', population: 'white', sex: 'female' }
  const baseline = calculateLegacyPCE(inputs)
  const withResearchMetadata = calculateLegacyPCE({ ...inputs, bpResearchSessions: state.bpResearchSessions })
  assert.deepEqual(withResearchMetadata, baseline)
  const exported = JSON.parse(exportState(state))
  assert.deepEqual(exported.data.bpReadings, [])
  assert.equal(exported.data.bpResearch.sessions[0].resultStatus, 'unavailable')
  assert.equal(exported.data.riskInputs, undefined)
  assert.equal(exported.data.riskByProfile.owner.result, null)
  assert.equal(exported.data.riskByProfile.guest.result, null)
})
