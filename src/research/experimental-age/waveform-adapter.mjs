/**
 * Explicit experimental timestamped RGB/scalar-to-beat adapter.
 *
 * This is an original browser port of the isolated Python experiment. It is
 * not a reproduction of undocumented UK Biobank/PulseTrace processing and it
 * does not claim that phone video matches the model's training distribution.
 * Keep this module separate from any real camera capture code until the
 * acquisition and polarity conventions have been validated.
 */

export const MODEL_INPUT_SHAPE = [1, 1, 100];

export const DEFAULT_ADAPTER_CONFIG = Object.freeze({
  outputSamples: 100,
  rgbChannel: 1,
  pulsePolarity: null,
  inputProvenance: null,
  minOriginalFrameRateHz: 10.0,
  minOriginalSamplesPerBeat: 12.0,
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

const VALID_POLARITIES = new Set([
  "lower_intensity_is_more_volume",
  "higher_intensity_is_more_volume",
]);

export const SYNTHETIC_INPUT_PROVENANCE = "synthetic_fixture";
export const SYNTHETIC_INPUT_GATE = "synthetic_only";
export const RESEARCH_VIDEO_INPUT_PROVENANCE = "user_uploaded_video_research";
export const RESEARCH_VIDEO_INPUT_GATE = "user_uploaded_video_research";
export const RESEARCH_VIDEO_PROFILE_ID = "uploaded_fingertip_roi_mean_rgb_v1";
export const RESEARCH_VIDEO_PROCESSING_VERSION = "uploaded-video-fingertip-v1";

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerAtLeast(value, minimum) {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= minimum;
}

function configWithDefaults(config = {}, inputGate = SYNTHETIC_INPUT_GATE) {
  const input = config && typeof config === "object" ? config : {};
  const hasExplicitPolarity = Object.prototype.hasOwnProperty.call(input, "pulsePolarity");
  const pulsePolarity = hasExplicitPolarity ? input.pulsePolarity : null;
  return {
    ...DEFAULT_ADAPTER_CONFIG,
    ...input,
    pulsePolarity,
    inputGate,
    pulsePolarityDeclared: hasExplicitPolarity && VALID_POLARITIES.has(pulsePolarity),
  };
}

function assumptions(config) {
  const polarityAssumption = config.pulsePolarityDeclared
    ? `Pulse polarity was explicitly supplied as ${JSON.stringify(config.pulsePolarity)}; polarity is not inferred.`
    : "Pulse polarity must be explicitly supplied as a supported value; omitted or unsupported polarity causes abstention.";
  return [
    "RGB uses the green channel as an experimental pulse proxy.",
    polarityAssumption,
    config.inputGate === SYNTHETIC_INPUT_GATE && config.inputProvenance === SYNTHETIC_INPUT_PROVENANCE
      ? "Input provenance is explicitly synthetic_fixture; human/camera input is gated off until acquisition review."
      : config.inputGate === RESEARCH_VIDEO_INPUT_GATE && config.inputProvenance === RESEARCH_VIDEO_INPUT_PROVENANCE
        ? "Input provenance is explicitly user_uploaded_video_research; the separate consented research-video contract supplied this record."
        : "Input provenance or adapter gate is not an approved contract; the adapter abstains before processing.",
    `Original sampling must be at least ${isFiniteNumber(config.minOriginalFrameRateHz) ? config.minOriginalFrameRateHz.toFixed(2) : "invalid"} Hz and ${isFiniteNumber(config.minOriginalSamplesPerBeat) ? config.minOriginalSamplesPerBeat.toFixed(2) : "invalid"} samples per accepted beat; 100-point resampling does not create information.`,
    `Timestamp gaps larger than ${isFiniteNumber(config.maxGapFactor) ? config.maxGapFactor : "invalid"} median frame intervals cause abstention.`,
    `Beat timing is accepted only for ${isFiniteNumber(config.minIbiS) ? config.minIbiS.toFixed(2) : "invalid"}-${isFiniteNumber(config.maxIbiS) ? config.maxIbiS.toFixed(2) : "invalid"} second intervals with CV <= ${isFiniteNumber(config.maxIbiCv) ? config.maxIbiCv.toFixed(2) : "invalid"}.`,
    `Each beat is foot-to-foot resampled to ${config.outputSamples} points; the representative is the pointwise median.`,
    `Model-input eligibility requires accepted peak phase fractions within ${isFiniteNumber(config.modelPeakPhaseMinFraction) ? config.modelPeakPhaseMinFraction.toFixed(2) : "invalid"}-${isFiniteNumber(config.modelPeakPhaseMaxFraction) ? config.modelPeakPhaseMaxFraction.toFixed(2) : "invalid"} with spread <= ${isFiniteNumber(config.modelPeakPhaseMaxSpreadFraction) ? config.modelPeakPhaseMaxSpreadFraction.toFixed(2) : "invalid"}; this is an alignment-stability gate, not a physiological threshold.`,
    `Moving-average detrending (${isFiniteNumber(config.detrendWindowS) ? config.detrendWindowS.toFixed(2) : "invalid"} s) and smoothing (${isFiniteNumber(config.smoothWindowS) ? config.smoothWindowS.toFixed(2) : "invalid"} s) are experimental choices.`,
    "The representative grid is endpoint-inclusive: duration / 99 seconds between 100 samples; this is not a claim to reproduce UK Biobank period / 100 spacing.",
    "No filter or camera preprocessing is claimed to match the upstream training pipeline.",
  ];
}

function configValidationErrors(config) {
  const errors = [];
  if (!config.pulsePolarityDeclared) errors.push("pulse_polarity_required");
  if (config.inputGate === SYNTHETIC_INPUT_GATE) {
    if (config.inputProvenance !== SYNTHETIC_INPUT_PROVENANCE) errors.push("synthetic_only_gate");
  } else if (config.inputGate === RESEARCH_VIDEO_INPUT_GATE) {
    if (config.inputProvenance !== RESEARCH_VIDEO_INPUT_PROVENANCE) errors.push("research_video_provenance_required");
    if (config.researchContractValidated !== true) errors.push("research_video_contract_required");
  } else {
    errors.push("input_gate_invalid");
  }
  if (config.outputSamples !== 100) errors.push("output_samples_must_be_100");
  if (!isIntegerAtLeast(config.rgbChannel, 0) || config.rgbChannel > 2) errors.push("rgb_channel_invalid");
  if (!isFiniteNumber(config.minOriginalFrameRateHz) || config.minOriginalFrameRateHz <= 0) {
    errors.push("min_original_frame_rate_invalid");
  }
  if (!isFiniteNumber(config.minOriginalSamplesPerBeat) || config.minOriginalSamplesPerBeat < 3) {
    errors.push("min_original_samples_per_beat_invalid");
  }
  if (!isFiniteNumber(config.minDurationS) || config.minDurationS < 0) errors.push("min_duration_invalid");
  if (!isIntegerAtLeast(config.minBeats, 2)) errors.push("min_beats_invalid");
  if (!isFiniteNumber(config.minIbiS) || config.minIbiS <= 0) errors.push("min_ibi_invalid");
  if (!isFiniteNumber(config.maxIbiS) || config.maxIbiS <= config.minIbiS) errors.push("max_ibi_invalid");
  if (!isFiniteNumber(config.maxIbiCv) || config.maxIbiCv < 0 || config.maxIbiCv > 1) errors.push("max_ibi_cv_invalid");
  if (!isFiniteNumber(config.maxGapFactor) || config.maxGapFactor < 1) errors.push("max_gap_factor_invalid");
  if (!isFiniteNumber(config.saturationFractionLimit) || config.saturationFractionLimit < 0 || config.saturationFractionLimit > 1) {
    errors.push("saturation_fraction_limit_invalid");
  }
  if (!isFiniteNumber(config.saturationTolerance) || config.saturationTolerance < 0 || config.saturationTolerance > 0.5) {
    errors.push("saturation_tolerance_invalid");
  }
  if (!isFiniteNumber(config.detrendWindowS) || config.detrendWindowS <= 0) errors.push("detrend_window_invalid");
  if (!isFiniteNumber(config.smoothWindowS) || config.smoothWindowS <= 0) errors.push("smooth_window_invalid");
  if (!isFiniteNumber(config.minBeatRangeFraction) || config.minBeatRangeFraction <= 0) {
    errors.push("min_beat_range_fraction_invalid");
  }
  if (!isFiniteNumber(config.modelPeakPhaseMinFraction) || config.modelPeakPhaseMinFraction < 0 || config.modelPeakPhaseMinFraction > 1) {
    errors.push("model_peak_phase_min_invalid");
  }
  if (!isFiniteNumber(config.modelPeakPhaseMaxFraction)
    || config.modelPeakPhaseMaxFraction <= config.modelPeakPhaseMinFraction
    || config.modelPeakPhaseMaxFraction > 1) {
    errors.push("model_peak_phase_max_invalid");
  }
  if (!isFiniteNumber(config.modelPeakPhaseMaxSpreadFraction)
    || config.modelPeakPhaseMaxSpreadFraction < 0
    || config.modelPeakPhaseMaxSpreadFraction > 1) {
    errors.push("model_peak_phase_spread_invalid");
  }
  return errors;
}

function result(valid, waveform, reasonCodes, metadata, config) {
  return {
    valid,
    waveform,
    reasonCodes,
    metadata: {
      ...metadata,
      pulsePolarity: config.pulsePolarity,
      pulsePolarityDeclared: config.pulsePolarityDeclared === true,
      pulsePolaritySource: config.pulsePolarityDeclared ? "caller_config" : "missing_or_unsupported",
      inputProvenance: config.inputProvenance,
      inputGate: config.inputGate,
      outputSamples: config.outputSamples,
      assumptions: assumptions(config),
    },
  };
}

export function resultToJSON(adapterResult) {
  return {
    valid: adapterResult.valid,
    reasonCodes: [...adapterResult.reasonCodes],
    metadata: adapterResult.metadata,
    waveform: adapterResult.waveform ? Array.from(adapterResult.waveform) : null,
  };
}

function numericArray(input) {
  if (Array.isArray(input)) {
    return input.every((value) => typeof value === "number") ? input.slice() : null;
  }
  if (ArrayBuffer.isView(input) && typeof input[Symbol.iterator] === "function") {
    const values = Array.from(input);
    return values.every((value) => typeof value === "number") ? values : null;
  }
  return null;
}

function normalizeSeries(input) {
  const values = numericArray(input);
  if (!values || values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const isUint8 = input instanceof Uint8Array || input instanceof Uint8ClampedArray;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const looksLike8BitArray = maxValue > 1.0 && maxValue <= 255.0 && values.every(Number.isInteger);
  if (isUint8 || looksLike8BitArray) {
    if (values.some((value) => value < 0 || value > 255)) return null;
    return values.map((value) => value / 255.0);
  }
  if (minValue < -1e-6 || maxValue > 1.0 + 1e-6) return null;
  return values.map((value) => Math.min(1.0, Math.max(0.0, value)));
}

function normalizeRgbFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) return null;
  const rows = frames.map((row) => numericArray(row));
  if (rows.some((row) => !row || row.length !== 3)) return null;
  const flat = rows.flat();
  if (flat.some((value) => !Number.isFinite(value))) return null;
  const isUint8Rows = frames.some((row) => row instanceof Uint8Array || row instanceof Uint8ClampedArray);
  const minValue = Math.min(...flat);
  const maxValue = Math.max(...flat);
  const looksLike8BitRows = maxValue > 1.0 && maxValue <= 255.0 && flat.every(Number.isInteger);
  if (isUint8Rows || looksLike8BitRows) {
    if (flat.some((value) => value < 0 || value > 255)) return null;
    return rows.map((row) => row.map((value) => value / 255.0));
  }
  if (minValue < -1e-6 || maxValue > 1.0 + 1e-6) return null;
  return rows.map((row) => row.map((value) => Math.min(1.0, Math.max(0.0, value))));
}

function median(values) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2.0;
}

function percentile(values, fraction) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function movingAverage(values, window) {
  if (window <= 1) return [...values];
  const oddWindow = window % 2 === 0 ? window + 1 : window;
  const half = Math.floor(oddWindow / 2);
  const padded = [];
  for (let i = 0; i < half; i += 1) padded.push(values[0]);
  padded.push(...values);
  for (let i = 0; i < half; i += 1) padded.push(values[values.length - 1]);
  const output = new Array(values.length);
  let sum = 0.0;
  for (let i = 0; i < oddWindow; i += 1) sum += padded[i];
  output[0] = sum / oddWindow;
  for (let i = 1; i < values.length; i += 1) {
    sum += padded[i + oddWindow - 1] - padded[i - 1];
    output[i] = sum / oddWindow;
  }
  return output;
}

function validateTimestamps(timestamps, sampleCount, config) {
  const times = numericArray(timestamps);
  if (!times) return { times: null, reasons: ["timestamps_not_numeric"], metadata: {} };
  if (times.length !== sampleCount || times.length < 3) {
    return { times: null, reasons: ["timestamps_shape_mismatch"], metadata: {} };
  }
  if (times.some((value) => !Number.isFinite(value))) {
    return { times: null, reasons: ["timestamps_nonfinite_or_too_short"], metadata: {} };
  }
  const diffs = times.slice(1).map((value, index) => value - times[index]);
  if (diffs.some((value) => value <= 0.0)) {
    return { times: null, reasons: ["timestamps_not_strictly_increasing"], metadata: {} };
  }
  const medianDt = median(diffs);
  const maxGap = Math.max(...diffs);
  const duration = times[times.length - 1] - times[0];
  const metadata = {
    durationS: duration,
    medianFrameIntervalS: medianDt,
    maxFrameGapS: maxGap,
    frameRateHzMedian: 1.0 / medianDt,
  };
  const reasons = [];
  if (duration < config.minDurationS) reasons.push("recording_too_short");
  if (maxGap > config.maxGapFactor * medianDt) reasons.push("timestamp_gap");
  if (reasons.length) return { times: null, reasons, metadata };
  return { times, reasons: [], metadata };
}

function signalQuality(values, config) {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0.0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0.0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const saturationFraction = values.filter(
    (value) => value <= config.saturationTolerance || value >= 1.0 - config.saturationTolerance,
  ).length / values.length;
  const reasons = [];
  if (values.some((value) => !Number.isFinite(value))) reasons.push("signal_nonfinite");
  if (maxValue - minValue <= 1e-4 || standardDeviation <= 1e-5) reasons.push("signal_flat");
  if (saturationFraction > config.saturationFractionLimit) reasons.push("signal_saturated");
  return {
    reasons,
    metadata: {
      valueMin: minValue,
      valueMax: maxValue,
      valueStd: standardDeviation,
      saturationFraction,
    },
  };
}

function interpolate(x, y, newX) {
  const output = new Array(newX.length);
  let index = 0;
  for (let i = 0; i < newX.length; i += 1) {
    const value = newX[i];
    while (index < x.length - 2 && x[index + 1] < value) index += 1;
    if (value <= x[0]) {
      output[i] = y[0];
    } else if (value >= x[x.length - 1]) {
      output[i] = y[y.length - 1];
    } else {
      const fraction = (value - x[index]) / (x[index + 1] - x[index]);
      output[i] = y[index] + fraction * (y[index + 1] - y[index]);
    }
  }
  return output;
}

function findPeaks(signal, dt, config) {
  const amplitude = percentile(signal, 0.95) - percentile(signal, 0.05);
  if (amplitude <= 1e-8) return { peaks: [], amplitude };
  const threshold = median(signal) + 0.20 * amplitude;
  const candidates = [];
  for (let index = 1; index < signal.length - 1; index += 1) {
    if (signal[index] > signal[index - 1] && signal[index] >= signal[index + 1] && signal[index] >= threshold) {
      candidates.push(index);
    }
  }
  candidates.sort((a, b) => signal[b] - signal[a]);
  const minDistance = Math.max(1, Math.round(config.minIbiS / dt));
  const selected = [];
  for (const index of candidates) {
    if (selected.every((kept) => Math.abs(index - kept) >= minDistance)) selected.push(index);
  }
  selected.sort((a, b) => a - b);
  return { peaks: selected, amplitude };
}

function footIndices(signal, peaks, medianIbiSamples) {
  const feet = [];
  const lookback = Math.max(2, Math.round(0.70 * medianIbiSamples));
  const guard = Math.max(1, Math.round(0.12 * medianIbiSamples));
  for (let peakIndex = 0; peakIndex < peaks.length; peakIndex += 1) {
    const peak = peaks[peakIndex];
    const left = peakIndex === 0
      ? Math.max(0, peak - lookback)
      : peaks[peakIndex - 1] + guard;
    const right = peakIndex === 0
      ? Math.max(left + 1, peak - guard)
      : peak - guard;
    if (right <= left) return { feet: null, failureIndex: peakIndex, failureReason: "foot_interval_too_short" };
    let minimumIndex = left;
    for (let index = left + 1; index < right; index += 1) {
      if (signal[index] < signal[minimumIndex]) minimumIndex = index;
    }
    if (feet.length && minimumIndex <= feet[feet.length - 1]) {
      return { feet: null, failureIndex: peakIndex, failureReason: "foot_indices_not_increasing" };
    }
    feet.push(minimumIndex);
  }
  return { feet, failureIndex: null, failureReason: null };
}

function pointwiseMedian(rows) {
  const output = new Array(rows[0].length);
  for (let column = 0; column < output.length; column += 1) {
    output[column] = median(rows.map((row) => row[column]));
  }
  return output;
}

function adaptSignal(values, timestamps, sourceKind, config) {
  const timeResult = validateTimestamps(timestamps, values.length, config);
  if (!timeResult.times) {
    return result(false, null, timeResult.reasons, timeResult.metadata, config);
  }
  const originalMetadata = {
    ...timeResult.metadata,
    sourceKind,
    originalSampleCount: values.length,
  };
  if (timeResult.metadata.frameRateHzMedian < config.minOriginalFrameRateHz) {
    return result(
      false,
      null,
      ["original_sampling_resolution_insufficient"],
      originalMetadata,
      config,
    );
  }
  const quality = signalQuality(values, config);
  if (quality.reasons.length) {
    return result(
      false,
      null,
      quality.reasons,
      { ...originalMetadata, ...quality.metadata },
      config,
    );
  }

  const pulse = config.pulsePolarity === "higher_intensity_is_more_volume"
    ? [...values]
    : values.map((value) => -value);
  const dt = median(timeResult.times.slice(1).map((value, index) => value - timeResult.times[index]));
  const sampleCount = Math.floor((timeResult.times.at(-1) - timeResult.times[0] + 0.5 * dt) / dt) + 1;
  const uniformTimes = Array.from({ length: sampleCount }, (_, index) => timeResult.times[0] + index * dt);
  const uniform = interpolate(timeResult.times, pulse, uniformTimes);
  const detrendWindow = Math.max(1, Math.round(config.detrendWindowS / dt));
  const smoothWindow = Math.max(1, Math.round(config.smoothWindowS / dt));
  const baseline = movingAverage(uniform, detrendWindow);
  const centered = uniform.map((value, index) => value - baseline[index]);
  const processed = movingAverage(centered, smoothWindow);

  const peakResult = findPeaks(processed, dt, config);
  const metadata = {
    ...originalMetadata,
    ...quality.metadata,
    uniformSampleCount: uniform.length,
    peakIndices: peakResult.peaks,
    detectedPeakCount: peakResult.peaks.length,
    processedSignalAmplitude: peakResult.amplitude,
  };
  if (peakResult.peaks.length < config.minBeats + 1) {
    return result(false, null, ["too_few_clear_beats"], metadata, config);
  }

  const ibiSamples = peakResult.peaks.slice(1).map((value, index) => value - peakResult.peaks[index]);
  const ibiS = ibiSamples.map((value) => value * dt);
  const medianIbiS = median(ibiS);
  const ibiMean = ibiS.reduce((sum, value) => sum + value, 0.0) / ibiS.length;
  const ibiVariance = ibiS.reduce((sum, value) => sum + (value - ibiMean) ** 2, 0.0) / ibiS.length;
  const ibiCv = Math.sqrt(ibiVariance) / Math.max(medianIbiS, 1e-8);
  Object.assign(metadata, {
    medianIbiS,
    ibiCv,
    ibiSMin: Math.min(...ibiS),
    ibiSMax: Math.max(...ibiS),
    originalSamplesPerBeat: medianIbiS / dt,
  });
  if (metadata.originalSamplesPerBeat < config.minOriginalSamplesPerBeat) {
    return result(false, null, ["insufficient_original_beat_support"], metadata, config);
  }
  if (ibiS.some((value) => value < config.minIbiS || value > config.maxIbiS) || ibiCv > config.maxIbiCv) {
    return result(false, null, ["ambiguous_or_irregular_beats"], metadata, config);
  }

  const footResult = footIndices(processed, peakResult.peaks, median(ibiSamples));
  const feet = footResult.feet;
  if (!feet || feet.length !== peakResult.peaks.length) {
    return result(
      false,
      null,
      ["beat_alignment_invalid"],
      { ...metadata, alignmentFailureIndex: footResult.failureIndex, alignmentFailureReason: footResult.failureReason },
      config,
    );
  }
  const beatRows = [];
  const beatDurations = [];
  const acceptedPeakPhaseFractions = [];
  for (let index = 0; index < feet.length - 1; index += 1) {
    const start = feet[index];
    const end = feet[index + 1];
    if (end <= start + 2) continue;
    const duration = uniformTimes[end] - uniformTimes[start];
    if (duration < 0.75 * medianIbiS || duration > 1.25 * medianIbiS) continue;
    const phaseTimes = Array.from(
      { length: config.outputSamples },
      (_, sample) => uniformTimes[start] + (uniformTimes[end] - uniformTimes[start]) * sample / (config.outputSamples - 1),
    );
    const beat = interpolate(uniformTimes.slice(start, end + 1), processed.slice(start, end + 1), phaseTimes);
    const beatRange = Math.max(...beat) - Math.min(...beat);
    if (beatRange < config.minBeatRangeFraction * Math.max(peakResult.amplitude, 1e-8)) continue;
    beatRows.push(beat);
    beatDurations.push(duration);
    acceptedPeakPhaseFractions.push((peakResult.peaks[index] - start) / (end - start));
  }
  Object.assign(metadata, {
    footIndices: feet,
    acceptedBeatCount: beatRows.length,
    acceptedBeatDurationsS: beatDurations,
    acceptedPeakPhaseFractions,
    beatDurationSMedian: beatDurations.length ? median(beatDurations) : null,
    beatAlignmentMethod: "preceding-local-trough-between-adjacent-peaks",
  });
  if (beatRows.length < config.minBeats) {
    return result(false, null, ["insufficient_quality_beats"], metadata, config);
  }

  const primaryPeakPhaseFractionMin = Math.min(...acceptedPeakPhaseFractions);
  const primaryPeakPhaseFractionMax = Math.max(...acceptedPeakPhaseFractions);
  const primaryPeakPhaseFractionSpread = primaryPeakPhaseFractionMax - primaryPeakPhaseFractionMin;
  const modelInputEligibilityReasonCodes = [];
  if (
    primaryPeakPhaseFractionMin < config.modelPeakPhaseMinFraction
    || primaryPeakPhaseFractionMax > config.modelPeakPhaseMaxFraction
  ) {
    modelInputEligibilityReasonCodes.push("primary_peak_alignment_unstable");
  }
  if (primaryPeakPhaseFractionSpread > config.modelPeakPhaseMaxSpreadFraction) {
    modelInputEligibilityReasonCodes.push("primary_peak_phase_inconsistent");
  }
  Object.assign(metadata, {
    primaryPeakPhaseFractionMin,
    primaryPeakPhaseFractionMax,
    primaryPeakPhaseFractionSpread,
    modelInputEligible: modelInputEligibilityReasonCodes.length === 0,
    modelInputEligibilityReasonCodes,
  });

  const representative = pointwiseMedian(beatRows);
  const mean = representative.reduce((sum, value) => sum + value, 0.0) / representative.length;
  const variance = representative.reduce((sum, value) => sum + (value - mean) ** 2, 0.0) / representative.length;
  const standardDeviation = Math.sqrt(variance);
  if (representative.some((value) => !Number.isFinite(value)) || standardDeviation <= 1e-8) {
    return result(false, null, ["representative_beat_invalid"], metadata, config);
  }
  const normalized = new Float32Array(representative.map((value) => (value - mean) / standardDeviation));
  Object.assign(metadata, {
    representativeMeanBeforeZscore: mean,
    representativeStdBeforeZscore: standardDeviation,
    normalizedShape: [...MODEL_INPUT_SHAPE],
    normalizedDtype: "float32",
    beatFootAlignment: "preceding-foot-to-preceding-foot cycles",
    representativeBeatDurationS: median(beatDurations),
    representativeSampleTimesS: Array.from(
      { length: config.outputSamples },
      (_, index) => median(beatDurations) * index / (config.outputSamples - 1),
    ),
    representativeSampleIntervalS: median(beatDurations) / (config.outputSamples - 1),
    representativeGridConvention: "period_over_99_endpoint_inclusive",
    representativeTimingSource: "timestamp-derived median accepted foot-to-foot duration",
  });
  return result(true, normalized, [], metadata, config);
}

function adaptRgbFramesInternal(frames, timestamps, configInput, inputGate) {
  const config = configWithDefaults(configInput, inputGate);
  const configErrors = configValidationErrors(config);
  if (configErrors.length) {
    return result(false, null, ["adapter_config_invalid"], { configValidationErrors: configErrors }, config);
  }
  if (
    !Array.isArray(frames)
    || frames.length === 0
    || frames.some((row) => {
      if (!Array.isArray(row) && !ArrayBuffer.isView(row)) return true;
      const numericRow = numericArray(row);
      return !numericRow || numericRow.length !== 3;
    })
  ) {
    return result(false, null, ["rgb_shape_mismatch"], {}, config);
  }
  if (![0, 1, 2].includes(config.rgbChannel)) {
    return result(false, null, ["rgb_channel_invalid"], {}, config);
  }
  const normalized = normalizeRgbFrames(frames);
  if (!normalized) return result(false, null, ["rgb_nonfinite_or_out_of_range"], {}, config);
  const channel = normalized.map((row) => row[config.rgbChannel]);
  return adaptSignal(channel, timestamps, "rgb_green_proxy", config);
}

export function adaptRgbFrames(frames, timestamps, configInput = {}) {
  return adaptRgbFramesInternal(frames, timestamps, configInput, SYNTHETIC_INPUT_GATE);
}

export function adaptResearchRgbFrames(frames, timestamps, configInput = {}) {
  return adaptRgbFramesInternal(
    frames,
    timestamps,
    { ...configInput, researchContractValidated: true },
    RESEARCH_VIDEO_INPUT_GATE,
  );
}

export function adaptScalarIntensity(intensity, timestamps, configInput = {}) {
  const config = configWithDefaults(configInput);
  const configErrors = configValidationErrors(config);
  if (configErrors.length) {
    return result(false, null, ["adapter_config_invalid"], { configValidationErrors: configErrors }, config);
  }
  const rawValues = numericArray(intensity);
  if (!rawValues) return result(false, null, ["scalar_shape_mismatch"], {}, config);
  const normalized = normalizeSeries(intensity);
  if (!normalized) return result(false, null, ["scalar_nonfinite_or_out_of_range"], {}, config);
  return adaptSignal(normalized, timestamps, "scalar_intensity", config);
}
