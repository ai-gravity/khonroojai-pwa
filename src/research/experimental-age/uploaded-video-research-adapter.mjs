/**
 * Separate, consented uploaded-video research adapter contract.
 *
 * This module accepts decoded fingertip-ROI mean RGB frames, not a video file
 * parser and not a clinical pipeline. It never infers polarity from waveform
 * shape or relabels a human clip as synthetic. The current test harness uses
 * synthetic frames with syntheticTestFixture: true while preserving the
 * honest user_uploaded_video_research provenance.
 */

import {
  RESEARCH_VIDEO_INPUT_GATE,
  RESEARCH_VIDEO_INPUT_PROVENANCE,
  RESEARCH_VIDEO_PROCESSING_VERSION,
  RESEARCH_VIDEO_PROFILE_ID,
  adaptResearchRgbFrames,
} from "./waveform-adapter.mjs";

export const UPLOADED_VIDEO_RESEARCH_PROFILE = Object.freeze({
  profileId: RESEARCH_VIDEO_PROFILE_ID,
  processingVersion: RESEARCH_VIDEO_PROCESSING_VERSION,
  acquisitionType: "uploaded_video_fingertip",
  roiDefinitionId: "fingertip_roi_mean_rgb_v1",
  frameRepresentation: "one_caller_supplied_roi_mean_rgb_triplet_per_decoded_frame",
  timestampSource: "decoded_presentation_timestamps_seconds",
  channelName: "green",
  rgbChannel: 1,
  pulsePolarity: "lower_intensity_is_more_volume",
  polaritySource: "fixed_acquisition_profile_not_inferred",
  minOriginalFrameRateHz: 10.0,
  minOriginalSamplesPerBeat: 12.0,
});

// These are processing gates, not caller-tunable quality preferences. Keep
// them explicit and frozen so the same processingVersion cannot silently
// accept a different model-input boundary.
export const UPLOADED_VIDEO_RESEARCH_GATE_CONFIG = Object.freeze({
  outputSamples: 100,
  rgbChannel: UPLOADED_VIDEO_RESEARCH_PROFILE.rgbChannel,
  pulsePolarity: UPLOADED_VIDEO_RESEARCH_PROFILE.pulsePolarity,
  inputProvenance: RESEARCH_VIDEO_INPUT_PROVENANCE,
  minOriginalFrameRateHz: UPLOADED_VIDEO_RESEARCH_PROFILE.minOriginalFrameRateHz,
  minOriginalSamplesPerBeat: UPLOADED_VIDEO_RESEARCH_PROFILE.minOriginalSamplesPerBeat,
  minDurationS: 4.0,
  minBeats: 4,
  minIbiS: 0.35,
  maxIbiS: 1.5,
  maxIbiCv: 0.20,
  maxGapFactor: 2.5,
  saturationFractionLimit: 0.03,
  saturationTolerance: 1e-4,
  detrendWindowS: 1.5,
  smoothWindowS: 0.08,
  minBeatRangeFraction: 0.40,
  modelPeakPhaseMinFraction: 0.15,
  modelPeakPhaseMaxFraction: 0.45,
  modelPeakPhaseMaxSpreadFraction: 0.15,
});

function isIntegerAtLeast(value, minimum) {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum;
}

function valueCount(value) {
  if (Array.isArray(value)) return value.length;
  if (ArrayBuffer.isView(value)) return value.length;
  return null;
}

function unique(values) {
  return [...new Set(values)];
}

function contractMetadata({
  acquisitionType,
  consentConfirmed,
  decodedFrameCount,
  presentationTimestampsS,
  processingVersion,
  roiDefinitionId,
  pulsePolarity,
  syntheticTestFixture,
  configOverrideKeys = [],
}) {
  const decodedTimestamps = valueCount(presentationTimestampsS) === null
    ? null
    : Array.from(presentationTimestampsS);
  return {
    sourceKind: "uploaded_video_research_fingertip_roi",
    inputProvenance: RESEARCH_VIDEO_INPUT_PROVENANCE,
    inputGate: RESEARCH_VIDEO_INPUT_GATE,
    consentConfirmed: consentConfirmed === true,
    syntheticTestFixture: syntheticTestFixture === true,
    acquisitionType: acquisitionType ?? null,
    acquisitionProfileId: UPLOADED_VIDEO_RESEARCH_PROFILE.profileId,
    acquisitionProfileVersion: UPLOADED_VIDEO_RESEARCH_PROFILE.processingVersion,
    processingVersion: processingVersion ?? null,
    roiDefinitionId: roiDefinitionId ?? null,
    channelName: UPLOADED_VIDEO_RESEARCH_PROFILE.channelName,
    rgbChannel: UPLOADED_VIDEO_RESEARCH_PROFILE.rgbChannel,
    pulsePolarity: pulsePolarity ?? null,
    pulsePolaritySource: UPLOADED_VIDEO_RESEARCH_PROFILE.polaritySource,
    timestampSource: UPLOADED_VIDEO_RESEARCH_PROFILE.timestampSource,
    processingGateConfigId: `${UPLOADED_VIDEO_RESEARCH_PROFILE.processingVersion}-frozen-gates`,
    configOverrideKeys: [...configOverrideKeys],
    presentationTimestampsS: decodedTimestamps,
    decodedFrameCount: Number.isInteger(decodedFrameCount) ? decodedFrameCount : null,
    presentationTimestampCount: valueCount(presentationTimestampsS),
  };
}

function configOverrideKeys(config) {
  if (config === undefined) return [];
  if (config === null || typeof config !== "object" || Array.isArray(config)) return null;
  return Reflect.ownKeys(config).map((key) => (typeof key === "symbol" ? key.toString() : key));
}

function contractFailure(reasonCodes, metadata) {
  return {
    valid: false,
    waveform: null,
    reasonCodes,
    metadata: {
      ...metadata,
      modelInputEligible: false,
      modelInputEligibilityReasonCodes: [...reasonCodes],
      stiffnessIndexInputEligible: false,
      stiffnessIndexEligibilityReasonCodes: [...reasonCodes],
    },
  };
}

function validateContract({
  roiMeanRgbFrames,
  presentationTimestampsS,
  decodedFrameCount,
  acquisitionType,
  roiDefinitionId,
  channelName,
  pulsePolarity,
  processingVersion,
  consentConfirmed,
  syntheticTestFixture,
}) {
  const reasons = [];
  if (consentConfirmed !== true) reasons.push("consent_required");
  if (acquisitionType !== UPLOADED_VIDEO_RESEARCH_PROFILE.acquisitionType) {
    reasons.push("unsupported_acquisition_type");
  }
  if (roiDefinitionId !== UPLOADED_VIDEO_RESEARCH_PROFILE.roiDefinitionId) {
    reasons.push("roi_profile_mismatch");
  }
  if (channelName !== UPLOADED_VIDEO_RESEARCH_PROFILE.channelName) {
    reasons.push("channel_profile_mismatch");
  }
  if (pulsePolarity !== UPLOADED_VIDEO_RESEARCH_PROFILE.pulsePolarity) {
    reasons.push("polarity_profile_mismatch");
  }
  if (processingVersion !== UPLOADED_VIDEO_RESEARCH_PROFILE.processingVersion) {
    reasons.push("processing_version_mismatch");
  }
  if (!isIntegerAtLeast(decodedFrameCount, 3)) {
    reasons.push("decoded_frame_count_required");
  }
  const frameCount = valueCount(roiMeanRgbFrames);
  const timestampCount = valueCount(presentationTimestampsS);
  if (frameCount === null || timestampCount === null) {
    reasons.push("decoded_frames_or_timestamps_required");
  } else {
    if (frameCount !== decodedFrameCount) reasons.push("decoded_frame_count_mismatch");
    if (timestampCount !== decodedFrameCount) reasons.push("presentation_timestamp_count_mismatch");
  }
  if (typeof syntheticTestFixture !== "boolean") reasons.push("test_fixture_flag_required");
  return unique(reasons);
}

/**
 * Adapt a caller-decoded uploaded-video research record.
 *
 * `roiMeanRgbFrames` must contain one [R,G,B] mean for the documented
 * fingertip ROI per decoded frame. This function requires explicit consent,
 * profile fields, processing version, frame count, and presentation times.
 * The optional `config` object must be empty: v1 processing gates are frozen
 * in `UPLOADED_VIDEO_RESEARCH_GATE_CONFIG` and cannot be caller-overridden.
 * It returns a research provenance even when syntheticTestFixture is true.
 */
export function adaptUploadedVideoResearch(request = {}) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    return contractFailure(
      ["research_video_request_object_required"],
      contractMetadata({}),
    );
  }
  const {
    roiMeanRgbFrames,
    presentationTimestampsS,
    decodedFrameCount,
    acquisitionType,
    roiDefinitionId,
    channelName,
    pulsePolarity,
    processingVersion,
    consentConfirmed,
    syntheticTestFixture = false,
    config = {},
  } = request;
  const overrideKeys = configOverrideKeys(config);
  const metadata = contractMetadata({
    acquisitionType,
    consentConfirmed,
    decodedFrameCount,
    presentationTimestampsS,
    processingVersion,
    roiDefinitionId,
    pulsePolarity,
    syntheticTestFixture,
    configOverrideKeys: overrideKeys ?? [],
  });
  const configReasons = overrideKeys === null
    ? ["research_video_config_object_required"]
    : overrideKeys.length
      ? ["research_video_config_override_rejected"]
      : [];
  const contractReasons = validateContract({
    roiMeanRgbFrames,
    presentationTimestampsS,
    decodedFrameCount,
    acquisitionType,
    roiDefinitionId,
    channelName,
    pulsePolarity,
    processingVersion,
    consentConfirmed,
    syntheticTestFixture,
  });
  const allReasons = unique([...contractReasons, ...configReasons]);
  if (allReasons.length) return contractFailure(allReasons, metadata);

  const adapterResult = adaptResearchRgbFrames(
    roiMeanRgbFrames,
    presentationTimestampsS,
    UPLOADED_VIDEO_RESEARCH_GATE_CONFIG,
  );
  const adapterEligibilityReasons = Array.isArray(adapterResult.metadata?.modelInputEligibilityReasonCodes)
    ? adapterResult.metadata.modelInputEligibilityReasonCodes
    : [];
  const qualityReasons = adapterResult.valid ? [] : adapterResult.reasonCodes;
  const modelInputEligibilityReasonCodes = unique([...adapterEligibilityReasons, ...qualityReasons]);
  const stiffnessIndexEligibilityReasonCodes = unique([...qualityReasons]);
  return {
    ...adapterResult,
    metadata: {
      ...adapterResult.metadata,
      ...metadata,
      modelInputEligible: adapterResult.valid && adapterResult.metadata.modelInputEligible === true,
      modelInputEligibilityReasonCodes,
      stiffnessIndexInputEligible: adapterResult.valid,
      stiffnessIndexEligibilityReasonCodes,
    },
  };
}

