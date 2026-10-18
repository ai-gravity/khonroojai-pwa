export const DEFAULT_PROFILE_ID = 'owner'
export const GUEST_PROFILE_ID = 'guest'
export const DEFAULT_PROFILES = [
  { id: DEFAULT_PROFILE_ID, label: 'This device' },
  { id: GUEST_PROFILE_ID, label: 'Guest demo · separate history' }
]
export const TREND_MIN_HEURISTIC_QUALITY = 48

export function normalizeProfiles(profiles) {
  const seen = new Set()
  const normalized = []
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const id = String(profile?.id || '').trim()
    const label = String(profile?.label || '').trim()
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    normalized.push({ id, label })
  }
  for (const fallback of DEFAULT_PROFILES) {
    if (!seen.has(fallback.id)) normalized.push({ ...fallback })
  }
  return normalized
}

export function normalizePulseSession(session, fallbackProfileId = DEFAULT_PROFILE_ID) {
  if (!session || typeof session !== 'object') return null
  const capturedAt = new Date(session.capturedAt || '')
  const measuredHr = Number(session.measuredHr ?? session.bpm)
  if (Number.isNaN(capturedAt.getTime()) || !Number.isFinite(measuredHr)) return null
  const source = String(session.acquisitionMethod || session.source || session.provenance || 'unknown')
  const profileId = String(session.profileId || fallbackProfileId)
  return {
    ...session,
    id: String(session.id || `legacy-${capturedAt.getTime()}-${measuredHr}`),
    profileId,
    capturedAt: capturedAt.toISOString(),
    measuredHr,
    bpm: measuredHr,
    durationSeconds: Number(session.durationSeconds) || 30,
    quality: Number.isFinite(Number(session.quality)) ? Number(session.quality) : 0,
    qualityType: 'heuristic',
    acquisitionMethod: source,
    provenance: String(session.provenance || source),
    isSample: session.isSample === true
  }
}

export function normalizePulseSessions(sessions, fallbackProfileId = DEFAULT_PROFILE_ID) {
  const seen = new Set()
  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => normalizePulseSession(session, fallbackProfileId))
    .filter((session) => {
      if (!session || seen.has(session.id)) return false
      seen.add(session.id)
      return true
    })
}

export function selectTrendSessions(sessions, { profileId = DEFAULT_PROFILE_ID, rangeDays = '30', now = new Date() } = {}) {
  const nowMs = new Date(now).getTime()
  const range = rangeDays === 'all' ? null : Number(rangeDays)
  const cutoff = range && Number.isFinite(range) ? nowMs - range * 24 * 60 * 60 * 1000 : -Infinity
  const unique = new Map()
  for (const session of normalizePulseSessions(sessions, profileId)) {
    const timestamp = new Date(session.capturedAt).getTime()
    if (session.profileId !== profileId || session.isSample || session.quality < TREND_MIN_HEURISTIC_QUALITY) continue
    if (!Number.isFinite(timestamp) || timestamp > nowMs || timestamp < cutoff) continue
    unique.set(session.id, session)
  }
  return [...unique.values()].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
}

export function historyChartPoints(sessions) {
  const ordered = Array.isArray(sessions) ? sessions : []
  if (!ordered.length) return []
  if (ordered.length === 1) return [{ session: ordered[0], x: 0.5, y: ordered[0].measuredHr }]
  return ordered.map((session, index) => ({
    session,
    x: index / (ordered.length - 1),
    y: session.measuredHr
  }))
}

export function removePulseSession(sessions, id, profileId = DEFAULT_PROFILE_ID) {
  const index = sessions.findIndex((session) => session?.id === id && (session.profileId || profileId) === profileId)
  if (index < 0) return { sessions: [...sessions], removed: null, index: -1 }
  const next = [...sessions]
  const [removed] = next.splice(index, 1)
  return { sessions: next, removed, index }
}
