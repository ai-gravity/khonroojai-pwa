import test from 'node:test'
import assert from 'node:assert/strict'
import { buildUploadedVideoResearchInput, isExperimentalAgeConfigured } from '../src/research/experimental-age/experimental-age.js'
import {
  adaptUploadedVideoResearch,
  UPLOADED_VIDEO_RESEARCH_PROFILE,
} from '../src/research/experimental-age/uploaded-video-research-adapter.mjs'
import { syntheticVideo } from '../src/research/experimental-age/synthetic-fixtures.mjs'

function decoderFrames(fixture) {
  return fixture.rgb.map((rgb, index) => ({
    red: rgb[0] * 255,
    green: rgb[1] * 255,
    blue: rgb[2] * 255,
    researchRgb: rgb.map((value) => value * 255),
    timeMs: fixture.timestamps[index] * 1000,
  }))
}

test('maps decoder RGB means to normalized research frames with actual timestamps and count', () => {
  const fixture = syntheticVideo({ jitter: true })
  const input = buildUploadedVideoResearchInput(decoderFrames(fixture), { consentConfirmed: true })
  assert.equal(input.decodedFrameCount, fixture.rgb.length)
  input.presentationTimestampsS.forEach((timestamp, index) => assert.ok(Math.abs(timestamp - fixture.timestamps[index]) < 1e-12))
  input.roiMeanRgbFrames[17].forEach((value, index) => assert.ok(Math.abs(value - fixture.rgb[17][index]) < 1e-12))
  assert.equal(input.inputGate, undefined, 'gate metadata belongs to the adapter result, not the caller record')
  assert.equal(input.acquisitionType, UPLOADED_VIDEO_RESEARCH_PROFILE.acquisitionType)
  assert.equal(input.pulsePolarity, 'lower_intensity_is_more_volume')
})

test('accepts the same decoded synthetic fixture only with the explicit research contract', () => {
  const fixture = syntheticVideo({ jitter: true })
  const input = buildUploadedVideoResearchInput(decoderFrames(fixture), { consentConfirmed: true, syntheticTestFixture: true })
  const result = adaptUploadedVideoResearch(input)
  assert.equal(result.valid, true)
  assert.equal(result.metadata.inputProvenance, 'user_uploaded_video_research')
  assert.equal(result.metadata.syntheticTestFixture, true)
  assert.equal(result.metadata.decodedFrameCount, fixture.rgb.length)
  assert.equal(result.metadata.presentationTimestampCount, fixture.timestamps.length)
  assert.equal(result.metadata.modelInputEligible, true)
  assert.equal(result.metadata.stiffnessIndexInputEligible, true)
  assert.deepEqual(result.metadata.configOverrideKeys, [])
})

test('rejects missing consent, null input, and caller threshold overrides', () => {
  const fixture = syntheticVideo({ jitter: true })
  const input = buildUploadedVideoResearchInput(decoderFrames(fixture), { consentConfirmed: false })
  assert.ok(adaptUploadedVideoResearch(input).reasonCodes.includes('consent_required'))
  assert.deepEqual(adaptUploadedVideoResearch(null).reasonCodes, ['research_video_request_object_required'])
  const overridden = adaptUploadedVideoResearch({ ...input, consentConfirmed: true, config: { minBeats: 1 } })
  assert.deepEqual(overridden.reasonCodes, ['research_video_config_override_rejected'])
})

test('keeps public builds model-disabled until the explicit local flag is set', () => {
  assert.equal(isExperimentalAgeConfigured(), false)
})
