import test from 'node:test'
import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzeSignal, makeSyntheticSamples } from '../src/signal.js'
import { calculateStiffnessIndex } from '../src/research.js'
import { calculateLegacyPCE } from '../src/risk.js'
import { validateVideoFile, MAX_VIDEO_BYTES, MIN_VIDEO_SECONDS } from '../src/video.js'

test('accepts a synthetic, regular sample only as a signal-gate fixture', () => {
  const result = analyzeSignal(makeSyntheticSamples({ bpm: 72, seconds: 30, fps: 30, noise: 0.12 }))
  assert.equal(result.valid, true)
  assert.ok(result.bpm >= 68 && result.bpm <= 76)
  assert.ok(result.quality >= 48)
})

test('ignores a two-second settling transient when gating the later signal', () => {
  const regular = makeSyntheticSamples({ bpm: 72, seconds: 30, fps: 30, noise: 0.12 })
  const transient = Array.from({ length: 60 }, (_, index) => ({ timeMs: index * (1000 / 30), red: 80 + index * 2, valid: true }))
  const shifted = regular.map((sample) => ({ ...sample, timeMs: sample.timeMs + 2000 }))
  const result = analyzeSignal([...transient, ...shifted])
  assert.equal(result.valid, true)
  assert.ok(result.bpm >= 68 && result.bpm <= 76)
  assert.equal(result.warmupMs, 2000)
})

test('rejects a short capture before a pulse estimate can be returned', () => {
  const result = analyzeSignal(makeSyntheticSamples({ bpm: 72, seconds: 3, fps: 30, noise: 0.1 }))
  assert.equal(result.valid, false)
})

test('rejects a stationary object with no pulsatile variation', () => {
  const samples = Array.from({ length: 300 }, (_, index) => ({ timeMs: index * 100, red: 122, valid: true }))
  const result = analyzeSignal(samples)
  assert.equal(result.valid, false)
})

test('rejects samples flagged as unusable by the camera gate', () => {
  const samples = makeSyntheticSamples({ bpm: 72, seconds: 30, fps: 30, noise: 0.1 }).map((sample) => ({ ...sample, valid: false }))
  const result = analyzeSignal(samples)
  assert.equal(result.valid, false)
})

test('calculates only an explicitly repeatable same-pulse research SI pair', () => {
  const result = calculateStiffnessIndex({ heightMeters: 1.7, systolicMs: 420, reflectedMs: 600, repeatable: true })
  assert.equal(result.valid, true)
  assert.equal(result.deltaMs, 180)
  assert.equal(Number(result.si.toFixed(2)), 9.44)
})

test('rejects an ambiguous or next-beat SI landmark', () => {
  assert.equal(calculateStiffnessIndex({ heightMeters: 1.7, systolicMs: 420, reflectedMs: 1320, repeatable: false }).valid, false)
  assert.equal(calculateStiffnessIndex({ heightMeters: 1.7, systolicMs: 420, reflectedMs: 600, repeatable: false }).valid, false)
})

test('matches the published 2013 PCE fixture within rounding', () => {
  const profile = { age: 55, totalCholesterol: 213, hdl: 50, systolic: 120, treated: 'no', smoker: 'no', diabetes: 'no', priorASCVD: 'no' }
  const expected = { 'white-female': 2.1, 'african-american-female': 3.0, 'white-male': 5.3, 'african-american-male': 6.1 }
  for (const [key, expectedRisk] of Object.entries(expected)) {
    const [population, sex] = key === 'white-female' ? ['white', 'female'] : key === 'african-american-female' ? ['african-american', 'female'] : key === 'white-male' ? ['white', 'male'] : ['african-american', 'male']
    const result = calculateLegacyPCE({ ...profile, population, sex })
    assert.equal(result.valid, true)
    assert.ok(Math.abs(result.riskPercent - expectedRisk) < 0.15)
  }
})

test('requires complete bounded primary-prevention inputs and treated branch', () => {
  assert.equal(calculateLegacyPCE({ age: 55 }).valid, false)
  assert.equal(calculateLegacyPCE({ age: 39, totalCholesterol: 213, hdl: 50, systolic: 120, population: 'white', sex: 'female', treated: 'no', smoker: 'no', diabetes: 'no', priorASCVD: 'no' }).reason, 'out-of-range')
  const treated = calculateLegacyPCE({ age: 55, totalCholesterol: 213, hdl: 50, systolic: 120, population: 'white', sex: 'female', treated: 'yes', smoker: 'no', diabetes: 'no', priorASCVD: 'no' })
  assert.equal(treated.valid, true)
  assert.notEqual(treated.riskPercent, 2.052229820249485)
  assert.equal(calculateLegacyPCE({ age: 55, totalCholesterol: 213, hdl: 50, systolic: 120, population: 'white', sex: 'female', treated: 'no', smoker: 'no', diabetes: 'no', priorASCVD: 'yes' }).reason, 'prior-ascvd')
})

test('accepts supported local video metadata and rejects oversize or unsupported files', () => {
  assert.equal(validateVideoFile({ name: 'finger.mp4', type: 'video/mp4', size: 1024 }).valid, true)
  assert.equal(validateVideoFile({ name: 'finger.mov', type: '', size: 1024 }).valid, true)
  assert.equal(validateVideoFile({ name: 'finger.txt', type: 'text/plain', size: 1024 }).reason, 'file-type')
  assert.equal(validateVideoFile({ name: 'finger.mp4', type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }).reason, 'file-too-large')
})

test('keeps the local-video acquisition contract at 30 seconds', () => {
  assert.equal(MIN_VIDEO_SECONDS, 30)
  const shortFixture = statSync(fileURLToPath(new URL('./fixtures/synthetic-fingertip.mp4', import.meta.url)))
  const fullFixture = statSync(fileURLToPath(new URL('./fixtures/synthetic-fingertip-30s.mp4', import.meta.url)))
  assert.ok(shortFixture.size > 1000)
  assert.ok(fullFixture.size > shortFixture.size)
})

test('ships participant-free synthetic MP4 fixtures for browser decoder QA', () => {
  const fixturePath = fileURLToPath(new URL('./fixtures/synthetic-fingertip.mp4', import.meta.url))
  const fixture = statSync(fixturePath)
  assert.ok(fixture.size > 1000)
  assert.equal(validateVideoFile({ name: 'synthetic-fingertip.mp4', type: 'video/mp4', size: fixture.size }).valid, true)
  const fullFixturePath = fileURLToPath(new URL('./fixtures/synthetic-fingertip-30s.mp4', import.meta.url))
  const fullFixture = statSync(fullFixturePath)
  assert.equal(validateVideoFile({ name: 'synthetic-fingertip-30s.mp4', type: 'video/mp4', size: fullFixture.size }).valid, true)
})
