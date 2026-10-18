import { DEFAULT_PROFILE_ID, DEFAULT_PROFILES, normalizeProfiles, normalizePulseSessions } from './history.js'

export const STORAGE_KEY = 'khonroojai-khonroojai-v1'

function normalizeProfileRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object')
    .map((record) => ({ ...record, profileId: String(record.profileId || DEFAULT_PROFILE_ID) }))
}

function normalizeRiskByProfile(raw, profiles, legacyInputs = null, legacyResult = null) {
  const saved = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(profiles.map((profile) => {
    const value = saved[profile.id]
    if (value && typeof value === 'object') return [profile.id, { inputs: value.inputs || null, result: value.result || null }]
    if (profile.id === DEFAULT_PROFILE_ID && (legacyInputs || legacyResult)) return [profile.id, { inputs: legacyInputs, result: legacyResult }]
    return [profile.id, { inputs: null, result: null }]
  }))
}

export const defaultState = () => ({
  language: 'en',
  view: 'upload',
  onboardingComplete: true,
  onboardingStep: 0,
  coachAnswers: { goal: '', barrier: '', support: '' },
  habit: null,
  habitDone: false,
  habitLog: [],
  profiles: DEFAULT_PROFILES.map((profile) => ({ ...profile })),
  activeProfileId: DEFAULT_PROFILE_ID,
  historyRange: '30',
  bpReadings: [],
  pulseSessions: [],
  bpResearchSessions: [],
  bpResearchReferences: [],
  riskByProfile: {
    owner: { inputs: null, result: null },
    guest: { inputs: null, result: null }
  },
  riskInputs: null,
  riskResult: null,
  reminder: { enabled: false, label: '', time: '' },
  toast: '',
  installDismissed: false,
  lastUpdated: new Date().toISOString()
})

export function loadState() {
  const fresh = defaultState()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return fresh
    const profiles = normalizeProfiles(saved.profiles)
    const activeProfileId = profiles.some((profile) => profile.id === saved.activeProfileId) ? String(saved.activeProfileId) : DEFAULT_PROFILE_ID
    // The live result is intentionally transient. A reload should reopen the
    // upload page and let the user choose History for saved observations.
    const savedView = ['upload', 'history'].includes(saved.view) ? saved.view : 'upload'
    return {
      ...fresh,
      ...saved,
      view: savedView,
      onboardingComplete: true,
      coachAnswers: { ...fresh.coachAnswers, ...(saved.coachAnswers || {}) },
      reminder: { ...fresh.reminder, ...(saved.reminder || {}) },
      profiles,
      activeProfileId,
      historyRange: ['7', '30', 'all'].includes(String(saved.historyRange)) ? String(saved.historyRange) : '30',
      bpReadings: normalizeProfileRecords(saved.bpReadings),
      pulseSessions: normalizePulseSessions(saved.pulseSessions),
      bpResearchSessions: normalizeProfileRecords(saved.bpResearchSessions),
      bpResearchReferences: normalizeProfileRecords(saved.bpResearchReferences),
      riskByProfile: normalizeRiskByProfile(saved.riskByProfile, profiles, saved.riskInputs || null, saved.riskResult || null),
      habitLog: Array.isArray(saved.habitLog) ? saved.habitLog : []
    }
  } catch {
    return fresh
  }
}

export function saveState(state) {
  const savedView = ['upload', 'history'].includes(state.view) ? state.view : 'upload'
  const snapshot = { ...state, view: savedView, toast: '', lastUpdated: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportState(state) {
  const payload = {
    app: 'KHONROOJAI',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    note: 'Local-first prototype export. Pulse sessions are observations from a prototype gate, not a diagnosis.',
    data: {
      habit: state.habit,
      habitLog: state.habitLog,
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
      bpReadings: state.bpReadings,
      pulseSessions: state.pulseSessions,
      bpResearch: {
        sessions: state.bpResearchSessions,
        cuffReferences: state.bpResearchReferences
      },
      riskByProfile: state.riskByProfile,
      coachAnswers: state.coachAnswers,
      reminder: state.reminder
    }
  }
  return JSON.stringify(payload, null, 2)
}
