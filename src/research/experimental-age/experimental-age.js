import {
  adaptUploadedVideoResearch,
  UPLOADED_VIDEO_RESEARCH_PROFILE,
} from './uploaded-video-research-adapter.mjs'
import {
  createExperimentalOnnxSession,
  MODEL_PROVENANCE,
  predictExperimentalEstimate,
} from './onnx-wrapper.mjs'

const buildFlag = typeof import.meta.env?.VITE_ENABLE_EXPERIMENTAL_AGE === 'string'
  ? import.meta.env.VITE_ENABLE_EXPERIMENTAL_AGE
  : ''

export const EXPERIMENTAL_AGE_CONFIG = Object.freeze({
  enabled: buildFlag === 'true',
  modelUrl: '/research/age/vascular_age.onnx',
  externalDataPath: 'vascular_age.onnx.data',
  // Vite cannot import a public-directory .mjs asset during dev. The test
  // asset copy is source-served locally; production keeps the same-origin
  // public asset path and remains opt-in behind the build flag.
  wasmPaths: import.meta.env?.DEV === true ? '/test/assets/' : '/research/age/',
})

export const EXPERIMENTAL_AGE_PROVENANCE = Object.freeze({
  inputGate: 'user_uploaded_video_research',
  inputProvenance: 'user_uploaded_video_research',
  profileId: UPLOADED_VIDEO_RESEARCH_PROFILE.profileId,
  processingVersion: UPLOADED_VIDEO_RESEARCH_PROFILE.processingVersion,
  roiDefinitionId: UPLOADED_VIDEO_RESEARCH_PROFILE.roiDefinitionId,
  rgbChannel: UPLOADED_VIDEO_RESEARCH_PROFILE.rgbChannel,
  pulsePolarity: UPLOADED_VIDEO_RESEARCH_PROFILE.pulsePolarity,
  timestampSource: UPLOADED_VIDEO_RESEARCH_PROFILE.timestampSource,
})

let sessionPromise = null

export function isExperimentalAgeConfigured() {
  return EXPERIMENTAL_AGE_CONFIG.enabled
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Convert the existing decoder's full-frame means into the adapter's fixed
 * research record. The decoder already supplies presentation timestamps; no
 * wall-clock timing or nominal FPS is introduced here.
 */
export function buildUploadedVideoResearchInput(frames, {
  consentConfirmed = false,
  syntheticTestFixture = false,
} = {}) {
  const sourceFrames = Array.isArray(frames) ? frames : []
  const roiMeanRgbFrames = sourceFrames.map((frame) => {
    const rgb = Array.isArray(frame?.researchRgb) ? frame.researchRgb : [frame?.red, frame?.green, frame?.blue]
    return rgb.map((value) => Number(value) / 255)
  })
  const presentationTimestampsS = sourceFrames.map((frame) => Number(frame?.timeMs) / 1000)
  return {
    roiMeanRgbFrames,
    presentationTimestampsS,
    decodedFrameCount: sourceFrames.length,
    acquisitionType: UPLOADED_VIDEO_RESEARCH_PROFILE.acquisitionType,
    roiDefinitionId: UPLOADED_VIDEO_RESEARCH_PROFILE.roiDefinitionId,
    channelName: UPLOADED_VIDEO_RESEARCH_PROFILE.channelName,
    pulsePolarity: UPLOADED_VIDEO_RESEARCH_PROFILE.pulsePolarity,
    processingVersion: UPLOADED_VIDEO_RESEARCH_PROFILE.processingVersion,
    consentConfirmed: consentConfirmed === true,
    syntheticTestFixture: syntheticTestFixture === true,
  }
}

function disabledResult() {
  return {
    status: 'disabled',
    experimental: true,
    label: MODEL_PROVENANCE.outputLabel,
    value: null,
    reasonCodes: ['experimental_age_disabled'],
    metadata: {},
    provenance: MODEL_PROVENANCE,
  }
}

async function loadSession() {
  if (!sessionPromise) {
    sessionPromise = import('./ort.wasm.bundle.min.mjs')
      .then((ortModule) => createExperimentalOnnxSession({
        modelUrl: EXPERIMENTAL_AGE_CONFIG.modelUrl,
        externalDataPath: EXPERIMENTAL_AGE_CONFIG.externalDataPath,
        wasmPaths: EXPERIMENTAL_AGE_CONFIG.wasmPaths,
        ortModule,
      }))
      .catch((error) => {
        sessionPromise = null
        throw error
      })
  }
  return sessionPromise
}

export function resetExperimentalAgeSession() {
  sessionPromise = null
}

/**
 * Run the model only after the versioned uploaded-video contract and its
 * separate model-input eligibility gate pass. The returned number is a
 * computation-only research output, never a vascular-age measurement.
 */
export async function analyzeExperimentalAge({
  frames,
  consentConfirmed,
  syntheticTestFixture = false,
} = {}) {
  if (!isExperimentalAgeConfigured()) return disabledResult()

  const input = buildUploadedVideoResearchInput(frames, {
    consentConfirmed,
    syntheticTestFixture,
  })
  const adapterResult = adaptUploadedVideoResearch(input)
  const adapterMetadata = adapterResult.metadata ?? {}
  if (!adapterResult.valid || adapterMetadata.modelInputEligible !== true) {
    return {
      status: 'abstained',
      experimental: true,
      label: MODEL_PROVENANCE.outputLabel,
      value: null,
      reasonCodes: adapterResult.reasonCodes?.length
        ? adapterResult.reasonCodes
        : (adapterMetadata.modelInputEligibilityReasonCodes || ['model_input_quality_gate']),
      metadata: {
        adapter: adapterMetadata,
        modelInputEligible: adapterMetadata.modelInputEligible === true,
      },
      provenance: MODEL_PROVENANCE,
    }
  }

  try {
    const model = await predictExperimentalEstimate(await loadSession(), adapterResult)
    return {
      ...model,
      metadata: {
        ...model.metadata,
        adapter: adapterMetadata,
        decodedFrameCount: input.decodedFrameCount,
        presentationTimestampCount: input.presentationTimestampsS.length,
        durationSeconds: input.presentationTimestampsS.length > 1
          ? input.presentationTimestampsS.at(-1) - input.presentationTimestampsS[0]
          : null,
      },
      provenance: MODEL_PROVENANCE,
    }
  } catch (error) {
    return {
      status: 'abstained',
      experimental: true,
      label: MODEL_PROVENANCE.outputLabel,
      value: null,
      reasonCodes: ['onnx_runtime_unavailable'],
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        decodedFrameCount: input.decodedFrameCount,
      },
      provenance: MODEL_PROVENANCE,
    }
  }
}

export function hasUsableExperimentalAgeResult(result) {
  return result?.status === 'ok' && finite(result.value)
}
