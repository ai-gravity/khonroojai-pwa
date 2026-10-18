export const BP_RESEARCH_SECONDS = 60
export const BP_RESEARCH_RESULT_STATUS = 'unavailable'

export function validateBPResearchCapture({ capturedAt, durationSeconds, source } = {}) {
  const timestamp = new Date(capturedAt || '')
  if (Number.isNaN(timestamp.getTime())) return { valid: false, reason: 'capture-time' }
  if (Number(durationSeconds) !== BP_RESEARCH_SECONDS) return { valid: false, reason: 'duration' }
  if (!String(source || '').trim()) return { valid: false, reason: 'source' }
  return {
    valid: true,
    capturedAt: timestamp.toISOString(),
    durationSeconds: BP_RESEARCH_SECONDS,
    source: String(source).trim()
  }
}

export function makeBPResearchCapture({ capturedAt = new Date().toISOString(), source = 'camera', durationSeconds = BP_RESEARCH_SECONDS } = {}) {
  const validation = validateBPResearchCapture({ capturedAt, durationSeconds, source })
  if (!validation.valid) return validation
  return {
    valid: true,
    value: {
      capturedAt: validation.capturedAt,
      durationSeconds: validation.durationSeconds,
      source: validation.source,
      resultStatus: BP_RESEARCH_RESULT_STATUS,
      result: null
    }
  }
}

export function validateBPReference(input = {}) {
  const measuredAt = new Date(String(input.measuredAt || ''))
  const source = String(input.source || '').trim()
  const systolic = Number(input.systolic)
  const diastolic = Number(input.diastolic)
  const pulseValue = String(input.pulse ?? '').trim()
  const pulse = pulseValue ? Number(pulseValue) : null
  if (Number.isNaN(measuredAt.getTime())) return { valid: false, reason: 'measurement-time' }
  if (!source) return { valid: false, reason: 'source' }
  if (!Number.isFinite(systolic) || systolic < 40 || systolic > 300) return { valid: false, reason: 'systolic' }
  if (!Number.isFinite(diastolic) || diastolic < 20 || diastolic > 200 || systolic <= diastolic) return { valid: false, reason: 'diastolic' }
  if (pulseValue && (!Number.isFinite(pulse) || pulse < 20 || pulse > 250)) return { valid: false, reason: 'pulse' }
  return {
    valid: true,
    value: {
      measuredAt: measuredAt.toISOString(),
      source,
      systolic,
      diastolic,
      pulse,
      note: String(input.note || '').trim().slice(0, 120)
    }
  }
}
