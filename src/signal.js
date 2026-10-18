export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function mean(values) {
  const usable = values.filter(Number.isFinite)
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0
}

export function standardDeviation(values) {
  const usable = values.filter(Number.isFinite)
  if (usable.length < 2) return 0
  const average = mean(usable)
  return Math.sqrt(mean(usable.map((value) => (value - average) ** 2)))
}

// The first frames can include finger placement, exposure, and autofocus
// settling. This is a capture-quality guard, not a physiological correction.
export const SIGNAL_WARMUP_MS = 2000

export function trimSignalWarmup(samples, warmupMs = SIGNAL_WARMUP_MS) {
  const firstTimestamp = samples.find((sample) => Number.isFinite(sample?.timeMs))?.timeMs
  if (!Number.isFinite(firstTimestamp)) return []
  return samples.filter((sample) => Number.isFinite(sample?.timeMs) && sample.timeMs >= firstTimestamp + warmupMs)
}

function movingAverage(values, radius = 2) {
  return values.map((_, index) => {
    const from = Math.max(0, index - radius)
    const to = Math.min(values.length, index + radius + 1)
    return mean(values.slice(from, to))
  })
}

function localPeaks(values, times) {
  const baseline = movingAverage(values, 10)
  const residuals = values.map((value, index) => value - baseline[index])
  const spread = standardDeviation(residuals)
  const threshold = Math.max(spread * 0.52, 0.35)
  const candidates = []

  for (let index = 2; index < residuals.length - 2; index += 1) {
    const value = residuals[index]
    if (value <= threshold) continue
    if (value < residuals[index - 1] || value < residuals[index + 1]) continue
    candidates.push(index)
  }

  const selected = []
  for (const index of candidates) {
    const time = times[index]
    const previousTime = selected.length ? times[selected[selected.length - 1]] : -Infinity
    if (time - previousTime < 360) {
      if (residuals[index] > residuals[selected[selected.length - 1]]) selected[selected.length - 1] = index
      continue
    }
    selected.push(index)
  }
  return selected
}

/**
 * Analyze red-channel samples from fresh video frames. `timeMs` is intentionally
 * supplied by the media frame timestamp rather than a display refresh clock.
 * This is a demo-quality signal gate, never a medical measurement algorithm.
 */
export function analyzeSignal(samples) {
  const settledSamples = trimSignalWarmup(samples)
  const usable = settledSamples.filter((sample) => sample?.valid && Number.isFinite(sample.red))
  const durationMs = samples.length > 1 ? samples[samples.length - 1].timeMs - samples[0].timeMs : 0
  const usableRatio = settledSamples.length ? usable.length / settledSamples.length : 0

  if (usable.length < 36 || durationMs < 6000) {
    return { valid: false, reason: 'short-or-insufficient', quality: Math.round(usableRatio * 100), peaks: 0, warmupMs: SIGNAL_WARMUP_MS }
  }

  const values = usable.map((sample) => sample.red)
  const times = usable.map((sample) => sample.timeMs)
  const peaks = localPeaks(values, times)
  const intervals = peaks.slice(1).map((index, offset) => times[index] - times[peaks[offset]])
    .filter((interval) => interval >= 400 && interval <= 1500)
  const medianInterval = median(intervals)
  const bpm = medianInterval ? 60000 / medianInterval : 0
  const intervalMean = mean(intervals)
  const intervalSpread = standardDeviation(intervals)
  const rhythmScore = intervalMean ? clamp(1 - intervalSpread / intervalMean, 0, 1) : 0
  const amplitude = Math.max(...values) - Math.min(...values)
  const amplitudeScore = clamp((amplitude - 0.8) / 7, 0, 1)
  const quality = clamp((usableRatio * 0.4) + (rhythmScore * 0.35) + (amplitudeScore * 0.25), 0, 1)
  const valid = peaks.length >= 4 && intervals.length >= 3 && bpm >= 40 && bpm <= 180 && quality >= 0.48

  return {
    valid,
    reason: valid ? 'enough-signal' : 'unstable-signal',
    bpm: Math.round(bpm),
    quality: Math.round(quality * 100),
    peaks: peaks.length,
    usableRatio: Math.round(usableRatio * 100),
    durationMs,
    intervals,
    warmupMs: SIGNAL_WARMUP_MS
  }
}

export function makeSyntheticSamples({ bpm = 72, seconds = 30, fps = 30, noise = 0.18 } = {}) {
  const samples = []
  const total = Math.round(seconds * fps)
  const beatPeriod = 60000 / bpm
  for (let index = 0; index < total; index += 1) {
    const timeMs = (index / fps) * 1000
    const phase = (timeMs % beatPeriod) / beatPeriod
    const pulse = Math.max(0, Math.sin(phase * Math.PI * 2)) ** 4
    const drift = Math.sin(timeMs / 18000) * 0.24
    const randomish = Math.sin(index * 7.31) * noise
    samples.push({ timeMs, red: 8 + pulse * 5 + drift + randomish, valid: true })
  }
  return samples
}
