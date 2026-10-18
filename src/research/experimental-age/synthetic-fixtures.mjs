/**
 * Synthetic-only fixtures. This file must never become a camera or patient
 * data import path. The phase-shift checkpoints were regenerated after the
 * bounded adjacent-peak foot-alignment fix; this file does not claim Python
 * parity for that changed alignment policy.
 */

function f32(value) {
  return Math.fround(value);
}

function pulseShape(phase, reflected = true) {
  const primary = Math.exp(-0.5 * ((phase - 0.22) / 0.055) ** 2);
  const secondary = reflected
    ? 0.34 * Math.exp(-0.5 * ((phase - 0.62) / 0.09) ** 2)
    : 0.0;
  return primary + secondary;
}

export function syntheticVideo({
  durationS = 10.0,
  fps = 30.0,
  periodS = 1.0,
  phaseOffset = 0.0,
  reflected = true,
  polarityReversed = false,
  jitter = false,
} = {}) {
  const count = Math.floor(durationS * fps);
  const baseTimes = Array.from({ length: count }, (_, index) => index / fps);
  let timestamps = baseTimes;
  if (jitter) {
    const jitterValues = baseTimes.map((_, index) => 0.003 * Math.sin(index * 0.73));
    const candidate = baseTimes.map((value, index) => value + jitterValues[index] + index * 1e-6);
    timestamps = [];
    let runningMax = -Infinity;
    for (let index = 0; index < candidate.length; index += 1) {
      runningMax = Math.max(runningMax, candidate[index]);
      timestamps.push(index === 0 ? 0.0 : runningMax);
    }
  }
  const rawPulse = timestamps.map((time) => pulseShape(((time / periodS) + phaseOffset) % 1.0, reflected));
  const maxPulse = Math.max(...rawPulse);
  const pulse = rawPulse.map((value) => value / Math.max(maxPulse, 1e-8));
  let green = pulse.map((value) => 0.62 - 0.16 * value);
  if (polarityReversed) green = green.map((value) => 1.0 - value);
  const drift = timestamps.map((time) => 0.015 * Math.sin((2.0 * Math.PI * time) / 7.0));
  const red = drift.map((value) => f32(Math.min(1.0, Math.max(0.0, 0.72 + value))));
  const blue = drift.map((value) => f32(Math.min(1.0, Math.max(0.0, 0.58 + 0.5 * value))));
  green = green.map(f32);
  const rgb = green.map((value, index) => [red[index], value, blue[index]]);
  return {
    timestamps,
    rgb,
    green,
  };
}

export function irregularVideo() {
  const fps = 30.0;
  const durationS = 10.0;
  const count = Math.floor(durationS * fps);
  const timestamps = Array.from({ length: count }, (_, index) => index / fps);
  const peakTimes = [0.7, 1.7, 2.2, 3.8, 4.5, 6.4, 7.0, 8.8];
  const pulse = timestamps.map((time) => peakTimes.reduce(
    (sum, peak) => sum + Math.exp(-0.5 * ((time - peak) / 0.055) ** 2),
    0.0,
  ));
  const maxPulse = Math.max(...pulse);
  const green = pulse.map((value) => f32(0.62 - 0.16 * (value / Math.max(maxPulse, 1e-8))));
  const rgb = green.map((value) => [f32(0.72), value, f32(0.58)]);
  return { timestamps, rgb };
}

function quantize8Bit(rgb) {
  return rgb.map((row) => row.map((value) => Math.round(Math.min(1.0, Math.max(0.0, value)) * 255.0)));
}

const EXPECTED = {
  rgb_baseline_jittered_timestamps: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 9,
    detectedPeakCount: 11,
    ibiCv: 0.19,
    modelInputEligible: true,
    checkpoints: [-1.0062892437, 1.3091957569, -0.5528872013, 0.2442515343, -1.0071831942],
    pythonModelScalar: 43.3409233093,
  },
  rgb_uint8_quantized: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 9,
    detectedPeakCount: 11,
    ibiCv: 0.1791647287,
    checkpoints: [-1.0168401003, 1.2964168787, -0.5459772348, 0.2401315570, -1.0173231363],
    pythonModelScalar: 43.3404655457,
  },
  scalar_baseline: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 9,
    detectedPeakCount: 11,
    ibiCv: 0.19,
    checkpoints: [-1.0062892437, 1.3091957569, -0.5528872013, 0.2442515343, -1.0071831942],
    pythonModelScalar: 43.3409233093,
  },
  phase_shift_0_17_cycles: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 7,
    detectedPeakCount: 11,
    ibiCv: 0.1791647287,
    checkpoints: [-1.0057470798, 1.4096987247, -0.5523118377, 0.2269327343, -1.0056846142],
    pythonModelScalar: null,
  },
  polarity_omitted_abstains: { valid: false, reasonCodes: ["adapter_config_invalid"] },
  polarity_reversed_declared_convention: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 9,
    detectedPeakCount: 11,
    ibiCv: 0.19,
    checkpoints: [-1.0062892437, 1.3091958761, -0.5528873205, 0.2442515045, -1.0071831942],
    pythonModelScalar: 43.3409271240,
  },
  missing_reflected_wave: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 8,
    detectedPeakCount: 10,
    ibiCv: 0.0104756560,
    modelInputEligible: false,
    checkpoints: [-0.6477489471, -0.4457634687, 2.6247887611, -0.5308781266, -0.6478232145],
    pythonModelScalar: 62.7289428711,
  },
  flat_signal: { valid: false, reasonCodes: ["signal_flat"] },
  saturated_green_channel: { valid: false, reasonCodes: ["signal_flat", "signal_saturated"] },
  timestamp_gap: { valid: false, reasonCodes: ["timestamp_gap"] },
  ambiguous_irregular_beats: { valid: false, reasonCodes: ["ambiguous_or_irregular_beats"] },
  nonfinite_scalar: { valid: false, reasonCodes: ["scalar_nonfinite_or_out_of_range"] },
  malformed_rgb_shape: { valid: false, reasonCodes: ["rgb_shape_mismatch"] },
  pure_sinusoid_stable_timing: {
    valid: true,
    reasonCodes: [],
    acceptedBeatCount: 8,
    detectedPeakCount: 10,
    ibiCv: 0.0,
    modelInputEligible: false,
    checkpoints: [-1.3907483816, 0.1831378341, 1.4095418453, -0.1995392442, -1.3907483816],
  },
};

export function makeSyntheticCases() {
  const base = syntheticVideo({ jitter: true });
  const phaseShift = syntheticVideo({ phaseOffset: 0.17, jitter: true });
  const reversed = syntheticVideo({ polarityReversed: true, jitter: true });
  const missingReflected = syntheticVideo({ reflected: false, jitter: true });
  const flatRgb = base.rgb.map(() => [0.72, 0.62, 0.58]);
  const saturatedRgb = base.rgb.map((row) => [row[0], 1.0, row[2]]);
  const gapTimestamps = base.timestamps.map((value, index) => (index >= base.timestamps.length / 2 ? value + 0.5 : value));
  const irregular = irregularVideo();
  const nonfiniteScalar = [...base.green];
  nonfiniteScalar[Math.floor(nonfiniteScalar.length / 3)] = NaN;
  const pureSineTimestamps = Array.from({ length: 300 }, (_, index) => index / 30.0);
  const pureSineScalar = pureSineTimestamps.map((time) => 0.5 + 0.2 * Math.sin(2.0 * Math.PI * time));
  const lowSampling = syntheticVideo({ fps: 3.0, jitter: false });
  const supportLimited = syntheticVideo({ fps: 15.0, jitter: false });
  const negative8Bit = base.rgb.map(() => [-5, 128, 220]);
  const numericStringScalar = base.green.map((value) => value.toFixed(6));

  return [
    { label: "rgb_baseline_jittered_timestamps", kind: "rgb", frames: base.rgb, timestamps: base.timestamps, expected: EXPECTED.rgb_baseline_jittered_timestamps },
    { label: "rgb_uint8_quantized", kind: "rgb", frames: quantize8Bit(base.rgb), timestamps: base.timestamps, expected: EXPECTED.rgb_uint8_quantized },
    { label: "scalar_baseline", kind: "scalar", intensity: base.green, timestamps: base.timestamps, expected: EXPECTED.scalar_baseline },
    { label: "phase_shift_0_17_cycles", kind: "rgb", frames: phaseShift.rgb, timestamps: phaseShift.timestamps, expected: EXPECTED.phase_shift_0_17_cycles },
    { label: "polarity_omitted_abstains", kind: "rgb", frames: reversed.rgb, timestamps: reversed.timestamps, config: null, expected: EXPECTED.polarity_omitted_abstains },
    {
      label: "polarity_reversed_declared_convention",
      kind: "rgb",
      frames: reversed.rgb,
      timestamps: reversed.timestamps,
      config: { pulsePolarity: "higher_intensity_is_more_volume" },
      expected: EXPECTED.polarity_reversed_declared_convention,
    },
    { label: "missing_reflected_wave", kind: "rgb", frames: missingReflected.rgb, timestamps: missingReflected.timestamps, expected: EXPECTED.missing_reflected_wave },
    { label: "flat_signal", kind: "rgb", frames: flatRgb, timestamps: base.timestamps, expected: EXPECTED.flat_signal },
    { label: "saturated_green_channel", kind: "rgb", frames: saturatedRgb, timestamps: base.timestamps, expected: EXPECTED.saturated_green_channel },
    { label: "timestamp_gap", kind: "rgb", frames: base.rgb, timestamps: gapTimestamps, expected: EXPECTED.timestamp_gap },
    { label: "ambiguous_irregular_beats", kind: "rgb", frames: irregular.rgb, timestamps: irregular.timestamps, expected: EXPECTED.ambiguous_irregular_beats },
    { label: "nonfinite_scalar", kind: "scalar", intensity: nonfiniteScalar, timestamps: base.timestamps, expected: EXPECTED.nonfinite_scalar },
    { label: "malformed_rgb_shape", kind: "rgb", frames: base.rgb.map((row) => row.slice(0, 2)), timestamps: base.timestamps, expected: EXPECTED.malformed_rgb_shape },
    {
      label: "negative_8bit_like_rgb",
      kind: "rgb",
      frames: negative8Bit,
      timestamps: base.timestamps,
      expected: { valid: false, reasonCodes: ["rgb_nonfinite_or_out_of_range"] },
    },
    {
      label: "numeric_string_scalar",
      kind: "scalar",
      intensity: numericStringScalar,
      timestamps: base.timestamps,
      expected: { valid: false, reasonCodes: ["scalar_shape_mismatch"] },
    },
    {
      label: "original_sampling_resolution_3fps",
      kind: "rgb",
      frames: lowSampling.rgb,
      timestamps: lowSampling.timestamps,
      expected: { valid: false, reasonCodes: ["original_sampling_resolution_insufficient"] },
    },
    {
      label: "insufficient_original_beat_support",
      kind: "rgb",
      frames: supportLimited.rgb,
      timestamps: supportLimited.timestamps,
      config: { minOriginalSamplesPerBeat: 16.0 },
      expected: { valid: false, reasonCodes: ["insufficient_original_beat_support"] },
    },
    {
      label: "pure_sinusoid_stable_timing",
      kind: "scalar",
      intensity: pureSineScalar,
      timestamps: pureSineTimestamps,
      config: { pulsePolarity: "higher_intensity_is_more_volume" },
      expected: EXPECTED.pure_sinusoid_stable_timing,
    },
    {
      label: "missing_polarity_config",
      kind: "rgb",
      frames: base.rgb,
      timestamps: base.timestamps,
      config: { pulsePolarity: undefined },
      expected: { valid: false, reasonCodes: ["adapter_config_invalid"] },
    },
    {
      label: "missing_synthetic_provenance_config",
      kind: "rgb",
      frames: base.rgb,
      timestamps: base.timestamps,
      config: { inputProvenance: undefined },
      expected: { valid: false, reasonCodes: ["adapter_config_invalid"] },
    },
    {
      label: "malformed_config_threshold_type",
      kind: "rgb",
      frames: base.rgb,
      timestamps: base.timestamps,
      config: { minOriginalFrameRateHz: "30" },
      expected: { valid: false, reasonCodes: ["adapter_config_invalid"] },
    },
  ];
}

export { EXPECTED };
