export function calculateStiffnessIndex({ heightMeters, systolicMs, reflectedMs, repeatable = true } = {}) {
  const height = Number(heightMeters)
  const first = Number(systolicMs)
  const second = Number(reflectedMs)
  const deltaMs = second - first
  if (!repeatable || !Number.isFinite(height) || height <= 0 || height > 2.7 || !Number.isFinite(first) || !Number.isFinite(second) || deltaMs < 80 || deltaMs > 1200) {
    return { valid: false, reason: 'ambiguous-or-out-of-range' }
  }
  return { valid: true, heightMeters: height, deltaMs, deltaSeconds: deltaMs / 1000, si: height / (deltaMs / 1000) }
}

export function makeIllustrativeStiffnessWaveform() {
  const points = []
  const total = 360
  for (let index = 0; index < total; index += 1) {
    const timeMs = index * 5
    const first = Math.exp(-((timeMs - 420) ** 2) / (2 * 24 ** 2)) * 1.05
    const reflected = Math.exp(-((timeMs - 600) ** 2) / (2 * 35 ** 2)) * 0.48
    const next = Math.exp(-((timeMs - 1320) ** 2) / (2 * 24 ** 2)) * 1.05
    const value = 0.1 + first + reflected + next + Math.sin(index / 14) * 0.01
    points.push({ timeMs, value })
  }
  return points
}
