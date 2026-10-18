import './styles.css'
import { analyzeSignal, clamp, makeSyntheticSamples, mean, SIGNAL_WARMUP_MS, standardDeviation, trimSignalWarmup } from './signal.js'
import { calculateStiffnessIndex, makeIllustrativeStiffnessWaveform } from './research.js'
import { calculateLegacyPCE } from './risk.js'
import { clearState, defaultState, exportState, loadState, saveState } from './storage.js'
import { validateVideoFile } from './video.js'
import { BP_RESEARCH_SECONDS, makeBPResearchCapture, validateBPReference } from './bp-research.js'
import { DEFAULT_PROFILE_ID, historyChartPoints, removePulseSession, selectTrendSessions } from './history.js'
import { analyzeExperimentalAge, hasUsableExperimentalAgeResult, isExperimentalAgeConfigured } from './research/experimental-age/experimental-age.js'
import { getVideoFrameStats } from './video-research.js'

const state = loadState()
const root = document.querySelector('#app')
const captureCanvas = document.createElement('canvas')
const captureContext = captureCanvas.getContext('2d', { willReadFrequently: true })
let pulse = freshPulse()
let toastTimer = null
let updateRegistration = null
let updateReady = false
let fileSelectionToken = 0
let selectedHistorySessionId = ''
let undoSession = null
let undoTimer = null
let experimentalAgeConsent = false

const BRAND = 'KHONROOJAI'
const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'local'
const todayISO = () => new Date().toISOString().slice(0, 10)
const nowLocal = () => new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const copy = {
  en: {
    today: 'Today', coach: 'Coach', records: 'Records', you: 'You',
    local: 'local on this device', language: 'ไทย',
    keep: 'Keep the next\nsmall promise.',
    intro: 'A calmer way to notice what happened, choose one doable action, and keep your health story yours.',
    pulseCta: 'Analyze a 30 sec fingertip video', sampleCta: 'Try the labelled sample session',
    bpResearchTitle: 'BP research capture', bpResearchIntro: 'A separate 60-second capture for future validation. It does not estimate BP, calculate a score, or diagnose.', bpResearchCta: 'Start 60 sec research capture', bpResearchTarget: '60-second target', bpResearchPrivacy: 'Frames stay in this browser session. Raw health video is not uploaded or stored.', bpResearchUnavailable: 'BP result unavailable', bpResearchUnavailableBody: 'No reviewed phone-to-BP model is integrated. This session records timing metadata only; no BP number is generated.', bpResearchSaved: 'Research capture saved locally. BP result remains unavailable.', bpResearchNoFake: 'No phone BP number is shown.', bpResearchCapture: 'Research capture', bpResearchReferences: 'Cuff references', bpReferenceIntro: 'Enter a real cuff reading taken near a capture. This is a manual reference label, not a phone estimate.', bpReferenceTime: 'Measurement time', bpReferenceSaved: 'Cuff reference saved locally', bpReferenceInvalid: 'Add measurement time, source, and plausible cuff values. Nothing was saved.', bpReferenceEmpty: 'No cuff references yet.',
    pulseSub: 'Record first: cover the active rear lens with your fingertip and illumination, then select the local video.',
    habitTitle: 'One small step', noHabit: 'Choose a modest action for today.',
    chooseHabit: 'Choose a habit', done: 'Done today', markDone: 'Mark as done', replan: 'Re-plan',
    recent: 'Your recent check-ins', noRecords: 'Nothing saved yet. A real reading only appears after a valid, user-entered or accepted session.',
    addBP: 'Add a BP reading', seeRecords: 'See records',
    cameraTitle: 'Record, then select your video', cameraIntro: 'Use the phone camera app first: cover the active rear lens with your fingertip and illumination. Then select that local video here.',
    privacyCamera: 'Frames are analysed in this browser session. No recording is uploaded by this prototype.',
    allowCamera: 'Allow camera & begin', cancel: 'Cancel', back: 'Back', continue: 'Continue', reviewChecklist: 'REVIEW CHECKLIST / OPEN',
    sampleTitle: 'Sample session', sampleIntro: 'This is a labelled illustration only. It is not a live reading, is not saved as your health measurement, and cannot tell you whether your arteries are healthy.',
    beginSample: 'Play sample', sampleTag: 'ILLUSTRATIVE ONLY',
    pulseResult: 'Observed pulse estimate', notDiagnosis: 'Not a diagnosis or validated medical measurement. Urgent symptoms need appropriate care regardless of this result.',
    retry: 'Try again', finish: 'Done',
    quality: 'heuristic signal quality', qualityNote: 'Heuristic signal quality after a short settling window — not accuracy, confidence, or a clinical health result.', cameraGuide: 'Cover the active rear camera lens with your fingertip', cameraExpected: 'Expected footage: a steady red/orange fingertip field, not the room.', cameraDark: 'A little more fingertip coverage or light may help.', cameraMotion: 'Hold still so the signal can settle.', cameraWait: 'Waiting for a fresh, usable frame…', cameraStale: 'The video stopped delivering fresh frames. Choose another file or record again.',
    insufficient: 'We could not get enough trustworthy signal. Nothing was saved.', captureFailedTitle: 'No usable pulse signal', captureFailureNotice: 'This is a recording-quality issue, not a health finding.', chooseAnotherVideo: 'Choose another video',
    unsupported: 'Live camera capture is not part of this demo path. Record a fingertip video, then select it here.', denied: 'Live camera capture is not part of this demo path. Record a fingertip video, then select it here.', videoFile: 'Select a local fingertip video', videoFileHelp: 'Choose a steady video of at least 30 seconds. The red/orange fingertip field should cover the active rear lens; processing stays in this browser and the raw file is not retained.', videoTooLarge: 'That file is too large for this prototype. Choose a video up to 80 MB.', videoType: 'Choose a supported video file (MP4, WebM, or a browser-decodable MOV).', videoDecode: 'This browser could not decode the selected video. Nothing was uploaded or saved.', videoShort: 'The video must be at least 30 seconds for this acquisition contract. Nothing was saved.', fileLive: 'LOCAL FILE / BROWSER ANALYSIS',
    noFinger: 'We cannot see a fingertip signal yet.',
    coachTitle: 'Make the next action fit real life', coachIntro: 'A bounded guide, not live AI. Choose the friction you actually expect; the plan stays on this device.',
    goalQ: 'What would feel useful this week?', barrierQ: 'What usually gets in the way?', supportQ: 'Who, if anyone, should know?',
    selectOne: 'Select one', habitOptions: ['5-minute walk after lunch', 'Pause for 1 minute before the next task', 'Set a quiet time to check a home BP cuff'],
    goals: ['Notice a pattern', 'Follow through on one small habit', 'Prepare a clearer conversation with a clinician'],
    barriers: ['Time disappears', 'I forget at the moment', 'I am unsure what to do next'],
    supports: ['Keep it private', 'A buddy can encourage me', 'I want a review note for a clinician'],
    savePlan: 'Save this plan', planSaved: 'Plan saved locally',
    missed: 'Missed is information, not failure.', replanBody: 'Shrink the action, move its cue, or choose again. A plan that fits is more useful than a perfect plan.',
    recordsTitle: 'Your record, with context', bpIntro: 'Enter a real reading only. Add where it came from so a later review has context.', historyTitle: 'Your pulse history', historyIntro: 'Only valid, non-sample observations from this local profile appear here. Trends do not prove healthier arteries.', historyRange: 'Time range', history7: '7 days', history30: '30 days', historyAll: 'All time', historyEmpty: 'No qualifying pulse observations in this range.', historySingle: 'One observation — add another later to see a line.', historyDetail: 'Observation detail', historyNoSelection: 'Select a point to inspect its provenance.', historyDelete: 'Delete observation', historyUndo: 'Undo', sessionDeleted: 'Observation deleted locally.', profileTitle: 'Local profile', profileIntro: 'Choose who is using this device before capturing. Guest demo has a separate local history; there is no account or cloud sync.', profileOwner: 'This device', profileGuest: 'Guest demo · separate history',
    riskInputs: 'Risk inputs / legacy educational only', riskTitle: 'Prepare a risk review', riskIntro: 'Enter only verified clinical values you actually know. This demo can show the explicitly named 2013 legacy educational model when complete; current guideline and Thai-calibrated models are not enabled.', riskDisabled: 'Nothing is inferred from video. BP, lipids, diabetes, smoking status, age, and population must be explicit inputs.', riskAge: 'Age', riskSex: 'Sex / model field', riskTC: 'Total cholesterol', riskHDL: 'HDL cholesterol', riskDiabetes: 'Diabetes diagnosis', riskSmoking: 'Current smoker', riskSave: 'Save inputs for review', riskMissing: 'Incomplete: add the required clinician-reviewed inputs before any model could run.', riskSaved: 'Risk inputs saved locally; calculation remains disabled.',
    date: 'Date & time', systolic: 'Systolic', diastolic: 'Diastolic', pulse: 'Pulse (optional)', source: 'Source', note: 'Note (optional)',
    sourceHome: 'Home cuff', sourceClinic: 'Clinic / care team', sourceOther: 'Other', saveReading: 'Save reading', exportReview: 'Export review summary',
    bpEmpty: 'No manual BP readings yet.', invalidBP: 'Please add a date, source, and plausible values. Systolic must be higher than diastolic.',
    youTitle: 'Your data stays close', youIntro: 'This prototype keeps personal health data in local browser storage by default. It has no account, no rankings, and no automatic external messages.',
    deleteData: 'Delete local data', exportData: 'Export my data', install: 'Install guidance', privacyTitle: 'Boundaries for tomorrow’s demo',
    privacyBullets: ['No vascular age, BP, SpO₂, disease risk, blockage, or medication advice is inferred from a phone camera.', 'A short PRV-like signal does not diagnose stress. Stable scores do not mean healthy arteries.', 'Family support is an explicit handoff, not delivery or cross-device sync.'],
    shareHabit: 'Preview habit share', shareTitle: 'Share only what you choose', shareIntro: 'Habit-only is the default. Review the text before handing it to another app. Cancel means nothing is sent.',
    shareButton: 'Share this habit card', close: 'Close', copied: 'Copied for you to paste', shareCancelled: 'Share cancelled — nothing was sent.',
    reminderTitle: 'Reminder, with honest limits', reminderBody: 'This demo can save a reminder preference and show an in-app prompt. Background delivery is not guaranteed by a browser; iPhone web push needs a Home Screen app plus a push service.',
    reminderEnable: 'Save reminder preference', reminderTime: 'Time', reminderLabel: 'Reminder label',
    updateReady: 'A new demo version is ready.', refresh: 'Refresh', offline: 'Offline shell ready',
    safety: 'Prototype • not emergency or diagnostic care', reviewPending: 'Guideline-informed draft • clinician review pending',
    installBody: 'For a stable demo, open this HTTPS site on your phone and use Add to Home Screen. Record the fingertip video in your phone camera app, then select it here.',
    installStep1: 'Open the HTTPS demo on your phone.', installStep2: 'Use your browser’s “Add to Home Screen”.', installStep3: 'Record the fingertip video, then select it in KHONROOJAI.',
    okay: 'Okay', yesDelete: 'Delete everything', keepData: 'Keep my data', deleteConfirm: 'Delete local habits, readings, and preferences from this browser? This cannot be undone.',
    exported: 'Review summary downloaded', reminderSaved: 'Reminder preference saved locally', habitSaved: 'Your small plan is saved locally',
    researchLab: 'Research lab: inspect a waveform', siTitle: 'Stiffness Index / research view', siIntro: 'An educational, separate waveform-inspection path. It is not a live health result.', siFormula: 'SI = height in metres ÷ ΔT in seconds', siLandmarks: 'Same-pulse landmarks', siSystolic: 'systolic peak', siReflected: 'later reflected / diastolic peak', siHeight: 'Illustrative height (m)', siDelta: 'ΔT between landmarks', siSampleOnly: 'SAMPLE ONLY / NOT SAVED', siUnavailable: 'Live SI unavailable', siUnavailableBody: 'The live camera flow does not keep validated raw landmarks for this research view. We will not guess a second peak, use the next heartbeat, or turn a short phone signal into an artery result.', siNotPWV: 'This experimental SI is not directly measured cfPWV, is not converted to age, and does not classify healthy or diseased arteries.', siShowSample: 'Show educational sample', siNoClaim: 'No live claim',
    unknown: 'Unknown', bpResearchVideoHelp: 'Record a steady 60-second fingertip video covering the active rear lens with illumination, then select it here. No BP number is estimated.', bpResearchVideoShort: 'The BP research video must be at least 60 seconds. Nothing was saved.', areasTitle: 'Seven areas / honest status', areasIntro: 'A compact map of what this prototype can and cannot claim today.', areaHR: 'HR', areaHRStatus: 'Working · local video gate', areaSI: 'Stiffness index', areaSIStatus: 'Sample only · live unavailable', areaAge: 'Vascular age', areaAgeStatus: 'Planned · unavailable', areaRhythm: 'Irregular rhythm', areaRhythmStatus: 'Not implemented', areaASCVD: 'ASCVD 10-year risk', areaASCVDStatus: 'Manual inputs · legacy educational', areaAdvice: 'Advice', areaAdviceStatus: 'Bounded local guide', areaTrend: 'User trend', areaTrendStatus: 'Working · local history'
  },
  th: {
    today: 'วันนี้', coach: 'โค้ช', records: 'บันทึก', you: 'ข้อมูลของคุณ',
    local: 'เก็บไว้ในเครื่องนี้', language: 'EN',
    keep: 'รักษา\nสัญญาเล็ก ๆ ถัดไป',
    intro: 'วิธีที่ใจเย็นขึ้นในการสังเกตสิ่งที่เกิดขึ้น เลือกการกระทำที่ทำได้จริง และเก็บเรื่องสุขภาพไว้กับคุณ',
    pulseCta: 'วิเคราะห์วิดีโอปลายนิ้ว 30 วินาที', sampleCta: 'ลองเซสชันตัวอย่างที่มีป้ายกำกับ',
    bpResearchTitle: 'การเก็บข้อมูลวิจัยความดัน', bpResearchIntro: 'การเก็บข้อมูลแยก 60 วินาทีเพื่อการตรวจสอบในอนาคต ไม่ประเมินความดัน ไม่คำนวณคะแนน และไม่วินิจฉัย', bpResearchCta: 'เริ่มเก็บข้อมูลวิจัย 60 วินาที', bpResearchTarget: 'เป้าหมาย 60 วินาที', bpResearchPrivacy: 'เฟรมอยู่ในเซสชันเบราว์เซอร์นี้ วิดีโอสุขภาพดิบจะไม่ถูกอัปโหลดหรือเก็บไว้', bpResearchUnavailable: 'ยังไม่มีผลความดัน', bpResearchUnavailableBody: 'ยังไม่มีโมเดลโทรศัพท์สู่ความดันที่ผ่านการทบทวน เซสชันนี้เก็บเฉพาะเวลาเพื่อการวิจัย ไม่สร้างค่าความดัน', bpResearchSaved: 'บันทึกเซสชันวิจัยไว้ในเครื่องแล้ว ผลความดันยังไม่มี', bpResearchNoFake: 'ไม่มีการแสดงค่าความดันจากโทรศัพท์', bpResearchCapture: 'เซสชันวิจัย', bpResearchReferences: 'ค่าอ้างอิงจากเครื่องวัด', bpReferenceIntro: 'กรอกค่าจริงจากเครื่องวัดที่วัดใกล้กับเซสชัน นี่คือค่าอ้างอิงที่กรอกเอง ไม่ใช่ค่าประเมินจากโทรศัพท์', bpReferenceTime: 'เวลาที่วัด', bpReferenceSaved: 'บันทึกค่าอ้างอิงไว้ในเครื่องแล้ว', bpReferenceInvalid: 'กรุณาเพิ่มเวลาที่วัด แหล่งที่มา และค่าจากเครื่องวัดที่สมเหตุสมผล ไม่มีการบันทึก', bpReferenceEmpty: 'ยังไม่มีค่าอ้างอิงจากเครื่องวัด',
    pulseSub: 'อัดวิดีโอก่อน: ใช้นิ้วปิดเลนส์กล้องหลังที่กำลังใช้งานพร้อมแสง แล้วเลือกวิดีโอในเครื่อง',
    habitTitle: 'ก้าวเล็ก ๆ หนึ่งก้าว', noHabit: 'เลือกการกระทำเล็ก ๆ สำหรับวันนี้',
    chooseHabit: 'เลือกนิสัย', done: 'ทำแล้ววันนี้', markDone: 'ทำเสร็จแล้ว', replan: 'วางแผนใหม่',
    recent: 'เช็กอินล่าสุด', noRecords: 'ยังไม่มีข้อมูลที่บันทึกไว้ การอ่านจริงจะปรากฏเมื่อมีสัญญาณที่ใช้ได้หรือคุณกรอกข้อมูลเอง',
    addBP: 'เพิ่มค่าความดัน', seeRecords: 'ดูบันทึก',
    cameraTitle: 'อัดวิดีโอ แล้วเลือกไฟล์', cameraIntro: 'ใช้แอปกล้องของโทรศัพท์ก่อน: ใช้นิ้วปิดเลนส์กล้องหลังที่กำลังใช้งานพร้อมแสง แล้วเลือกวิดีโอในเครื่องที่นี่',
    privacyCamera: 'วิเคราะห์เฟรมในเบราว์เซอร์นี้ ไม่อัปโหลดการบันทึกโดยต้นแบบนี้',
    allowCamera: 'อนุญาตกล้องและเริ่ม', cancel: 'ยกเลิก', back: 'กลับ', continue: 'ดำเนินการต่อ', reviewChecklist: 'รายการตรวจทาน / ยังเปิดอยู่',
    sampleTitle: 'เซสชันตัวอย่าง', sampleIntro: 'เป็นภาพประกอบที่มีป้ายกำกับเท่านั้น ไม่ใช่การอ่านสด ไม่บันทึกเป็นค่าของคุณ และบอกไม่ได้ว่าหลอดเลือดแข็งแรงหรือไม่',
    beginSample: 'เล่นตัวอย่าง', sampleTag: 'ภาพประกอบเท่านั้น',
    pulseResult: 'ค่าชีพจรที่สังเกตได้', notDiagnosis: 'ไม่ใช่การวินิจฉัยหรือการวัดทางการแพทย์ที่ผ่านการรับรอง หากมีอาการฉุกเฉินให้ไปพบการดูแลที่เหมาะสมโดยไม่ขึ้นกับผลนี้',
    retry: 'ลองอีกครั้ง', finish: 'เสร็จสิ้น', quality: 'คุณภาพสัญญาณเชิงประมาณ', qualityNote: 'เป็นตัวบ่งชี้คุณภาพสัญญาณแบบประมาณหลังช่วงให้สัญญาณนิ่งสั้น ๆ เท่านั้น ไม่ใช่ความแม่นยำ ความเชื่อมั่น หรือผลสุขภาพทางคลินิก', cameraGuide: 'วางปลายนิ้วบนกล้องหลัง', cameraDark: 'ลองปิดกล้องให้มิดขึ้นหรือเพิ่มแสง', cameraMotion: 'อยู่นิ่งเพื่อให้สัญญาณนิ่ง', cameraWait: 'กำลังรอเฟรมใหม่ที่ใช้ได้…', cameraStale: 'กล้องหยุดส่งเฟรมใหม่ โปรดเริ่มตรวจอีกครั้ง', insufficient: 'รับสัญญาณที่น่าเชื่อถือไม่พอ ไม่มีการบันทึกผล', unsupported: 'เบราว์เซอร์หรืออุปกรณ์นี้ไม่รองรับกล้องสำหรับการตรวจสด', denied: 'ไม่ได้รับอนุญาตกล้อง ลองใหม่ในตั้งค่าเบราว์เซอร์หรือใช้ตัวอย่างที่มีป้ายกำกับ', noFinger: 'ยังไม่เห็นสัญญาณจากปลายนิ้ว', videoFile: 'เลือกวิดีโอปลายนิ้ว', videoFileHelp: 'เลือกวิดีโออย่างน้อย 30 วินาที วิเคราะห์ในเบราว์เซอร์นี้และไม่อัปโหลดหรือเก็บไฟล์ไว้ตามค่าเริ่มต้น', videoTooLarge: 'ไฟล์ใหญ่เกินไปสำหรับต้นแบบนี้ เลือกไฟล์ไม่เกิน 80 MB', videoType: 'เลือกไฟล์วิดีโอที่รองรับ เช่น MP4 หรือ WebM', videoDecode: 'เบราว์เซอร์ถอดรหัสวิดีโอนี้ไม่ได้ ไม่มีการอัปโหลดหรือบันทึก', videoShort: 'วิดีโอต้องยาวอย่างน้อย 30 วินาทีตามสัญญาการเก็บข้อมูลนี้ ไม่มีการบันทึกผล', fileLive: 'ไฟล์ในเครื่อง / วิเคราะห์ในเบราว์เซอร์',
    coachTitle: 'ทำให้การกระทำถัดไปเข้ากับชีวิตจริง', coachIntro: 'คู่มือแบบมีขอบเขต ไม่ใช่ AI สด เลือกอุปสรรคจริง แผนจะอยู่ในเครื่องนี้', goalQ: 'สัปดาห์นี้อะไรจะมีประโยชน์?', barrierQ: 'อะไรทำให้ติดขัดบ่อย?', supportQ: 'ใครควรรู้บ้างไหม?', selectOne: 'เลือกหนึ่งข้อ', habitOptions: ['เดิน 5 นาทีหลังอาหารกลางวัน', 'หยุด 1 นาทีก่อนเริ่มงานถัดไป', 'กำหนดเวลาสงบ ๆ เพื่อตรวจความดันที่บ้าน'], goals: ['สังเกตรูปแบบของตัวเอง', 'ทำตามนิสัยเล็ก ๆ หนึ่งอย่าง', 'เตรียมบทสนทนากับบุคลากรสุขภาพให้ชัดขึ้น'], barriers: ['เวลาไม่พอ', 'ลืมตอนถึงเวลา', 'ไม่แน่ใจว่าควรทำอะไรต่อ'], supports: ['เก็บไว้เป็นส่วนตัว', 'ให้เพื่อนช่วยเตือนใจ', 'อยากได้โน้ตไว้ทบทวนกับบุคลากรสุขภาพ'], savePlan: 'บันทึกแผนนี้', planSaved: 'บันทึกแผนไว้ในเครื่องแล้ว', missed: 'พลาดคือข้อมูล ไม่ใช่ความล้มเหลว', replanBody: 'ลดขนาดการกระทำ เปลี่ยนตัวกระตุ้น หรือเลือกใหม่ แผนที่เข้ากับชีวิตมีประโยชน์กว่าแผนที่สมบูรณ์แบบ',
    recordsTitle: 'บันทึกของคุณพร้อมบริบท', bpIntro: 'กรอกค่าจริงเท่านั้น เพิ่มแหล่งที่มาเพื่อให้ทบทวนภายหลังได้อย่างมีบริบท', historyTitle: 'ประวัติชีพจรของคุณ', historyIntro: 'แสดงเฉพาะค่าที่ใช้ได้และไม่ใช่ตัวอย่างจากโปรไฟล์ในเครื่องนี้ แนวโน้มไม่ได้พิสูจน์ว่าหลอดเลือดดีขึ้น', historyRange: 'ช่วงเวลา', history7: '7 วัน', history30: '30 วัน', historyAll: 'ทั้งหมด', historyEmpty: 'ยังไม่มีค่าชีพจรที่เข้าเกณฑ์ในช่วงนี้', historySingle: 'มีหนึ่งค่า — เพิ่มภายหลังเพื่อเห็นเส้นแนวโน้ม', historyDetail: 'รายละเอียดการสังเกต', historyNoSelection: 'เลือกจุดเพื่อดูแหล่งที่มา', historyDelete: 'ลบค่าการสังเกต', historyUndo: 'เลิกทำ', sessionDeleted: 'ลบค่าการสังเกตจากเครื่องแล้ว', profileTitle: 'โปรไฟล์ในเครื่อง', profileIntro: 'เลือกผู้ใช้เครื่องนี้ก่อนเก็บข้อมูล Guest demo มีประวัติแยก ไม่มีบัญชีและไม่มีการซิงก์ขึ้นคลาวด์', profileOwner: 'เครื่องนี้', profileGuest: 'Guest demo · ประวัติแยก', riskInputs: 'ข้อมูลความเสี่ยง / โมเดลเพื่อการเรียนรู้เท่านั้น', riskTitle: 'เตรียมทบทวนความเสี่ยง', riskIntro: 'กรอกเฉพาะค่าทางคลินิกที่คุณรู้จริง เดโมนี้แสดงโมเดลการเรียนรู้ PCE ปี 2013 ที่ระบุชื่อไว้เมื่อข้อมูลครบ โมเดลตามแนวทางปัจจุบันและโมเดลที่ปรับกับไทยยังไม่เปิดใช้', riskDisabled: 'ไม่อนุมานจากวิดีโอ ความดัน ไขมัน เบาหวาน การสูบบุหรี่ อายุ และประชากรต้องเป็นข้อมูลที่กรอกเอง', riskAge: 'อายุ', riskSex: 'เพศ / ช่องข้อมูลของโมเดล', riskTC: 'คอเลสเตอรอลรวม', riskHDL: 'คอเลสเตอรอล HDL', riskDiabetes: 'ได้รับการวินิจฉัยเบาหวาน', riskSmoking: 'สูบบุหรี่อยู่', riskSave: 'บันทึกข้อมูลเพื่อทบทวน', riskMissing: 'ยังไม่ครบ: ต้องเพิ่มข้อมูลที่บุคลากรสุขภาพทบทวนก่อนจึงจะใช้โมเดลได้', riskSaved: 'บันทึกข้อมูลความเสี่ยงไว้ในเครื่องแล้ว แต่ยังปิดการคำนวณ', date: 'วันและเวลา', systolic: 'ตัวบน', diastolic: 'ตัวล่าง', pulse: 'ชีพจร (ไม่บังคับ)', source: 'แหล่งที่มา', note: 'หมายเหตุ (ไม่บังคับ)', sourceHome: 'เครื่องวัดที่บ้าน', sourceClinic: 'คลินิก / ทีมดูแล', sourceOther: 'อื่น ๆ', saveReading: 'บันทึกค่า', exportReview: 'ส่งออกสรุปเพื่อทบทวน', bpEmpty: 'ยังไม่มีค่าความดันที่กรอกเอง', invalidBP: 'กรุณาเพิ่มวันเวลา แหล่งที่มา และค่าที่สมเหตุสมผล ตัวบนต้องมากกว่าตัวล่าง',
    youTitle: 'ข้อมูลอยู่ใกล้ตัวคุณ', youIntro: 'ต้นแบบนี้เก็บข้อมูลสุขภาพไว้ในพื้นที่จัดเก็บของเบราว์เซอร์นี้เป็นค่าเริ่มต้น ไม่มีบัญชี ไม่มีอันดับ และไม่มีการส่งข้อความภายนอกอัตโนมัติ', deleteData: 'ลบข้อมูลในเครื่อง', exportData: 'ส่งออกข้อมูลของฉัน', install: 'วิธีติดตั้ง', privacyTitle: 'ขอบเขตสำหรับการสาธิตพรุ่งนี้', privacyBullets: ['ไม่อนุมานอายุหลอดเลือด ความดัน SpO₂ ความเสี่ยงโรค การอุดตัน หรือคำแนะนำเรื่องยา จากกล้องโทรศัพท์', 'สัญญาณสั้น ๆ ไม่วินิจฉัยความเครียด คะแนนคงที่ไม่ได้แปลว่าหลอดเลือดแข็งแรง', 'การสนับสนุนจากครอบครัวเป็นการส่งต่อที่ผู้ใช้เลือกเอง ไม่ใช่การส่งถึงหรือซิงก์ข้ามอุปกรณ์'], shareHabit: 'ดูตัวอย่างการแชร์นิสัย', shareTitle: 'แชร์เฉพาะสิ่งที่คุณเลือก', shareIntro: 'ค่าเริ่มต้นแชร์เฉพาะนิสัย ตรวจข้อความก่อนส่งไปแอปอื่น ยกเลิกคือไม่ส่งอะไร', shareButton: 'แชร์การ์ดนิสัยนี้', close: 'ปิด', copied: 'คัดลอกแล้ว ให้คุณนำไปวางเอง', shareCancelled: 'ยกเลิกการแชร์ — ไม่มีการส่งข้อมูล', reminderTitle: 'การเตือนพร้อมข้อจำกัดที่ตรงไปตรงมา', reminderBody: 'ต้นแบบนี้บันทึกความต้องการเตือนได้และแสดงเตือนในแอป การส่งเบื้องหลังไม่รับประกันโดยเบราว์เซอร์ เว็บบน iPhone ต้องเพิ่มไปหน้าจอโฮมและมีบริการ push', reminderEnable: 'บันทึกความต้องการเตือน', reminderTime: 'เวลา', reminderLabel: 'ชื่อการเตือน', updateReady: 'มีเวอร์ชันใหม่ของเดโม', refresh: 'รีเฟรช', offline: 'เชลล์ออฟไลน์พร้อมใช้', safety: 'ต้นแบบ • ไม่ใช่การดูแลฉุกเฉินหรือการวินิจฉัย', reviewPending: 'ร่างอิงแนวทาง • รอการทบทวนจากบุคลากรสุขภาพ', installBody: 'เพื่อสาธิตให้เสถียร เปิด HTTPS นี้บนโทรศัพท์แล้วเลือกเพิ่มไปหน้าจอโฮม จากนั้นอัดวิดีโอปลายนิ้วด้วยแอปกล้องแล้วเลือกไฟล์ใน KHONROOJAI', installStep1: 'เปิดเดโม HTTPS บนโทรศัพท์', installStep2: 'เลือก “เพิ่มไปหน้าจอโฮม” ในเบราว์เซอร์', installStep3: 'อัดวิดีโอปลายนิ้ว แล้วเลือกไฟล์ใน KHONROOJAI', okay: 'ตกลง', yesDelete: 'ลบทั้งหมด', keepData: 'เก็บข้อมูลไว้', deleteConfirm: 'ลบนิสัย ค่าความดัน และการตั้งค่าจากเบราว์เซอร์นี้ไหม? ย้อนกลับไม่ได้', exported: 'ดาวน์โหลดสรุปการทบทวนแล้ว', reminderSaved: 'บันทึกการตั้งค่าเตือนไว้ในเครื่องแล้ว', habitSaved: 'บันทึกแผนเล็ก ๆ ไว้ในเครื่องแล้ว', researchLab: 'ห้องวิจัย: ดูรูปคลื่น', siTitle: 'Stiffness Index / มุมมองวิจัย', siIntro: 'มุมมองเพื่อการเรียนรู้ แยกจากผลสุขภาพสด ไม่ใช่ผลของคุณ', siFormula: 'SI = ส่วนสูงเป็นเมตร ÷ ΔT เป็นวินาที', siLandmarks: 'จุดบนชีพจรเดียวกัน', siSystolic: 'ยอด systolic', siReflected: 'ยอดสะท้อน / diastolic ที่เกิดภายหลัง', siHeight: 'ส่วนสูงตัวอย่าง (ม.)', siDelta: 'ΔT ระหว่างจุด', siSampleOnly: 'ตัวอย่างเท่านั้น / ไม่บันทึก', siUnavailable: 'ยังใช้ SI สดไม่ได้', siUnavailableBody: 'ขั้นตอนกล้องสดไม่เก็บจุดยอดดิบที่ผ่านการตรวจสอบไว้สำหรับมุมมองวิจัยนี้ เราจะไม่เดายอดที่สอง ใช้หัวใจเต้นถัดไป หรือแปลงสัญญาณโทรศัพท์สั้น ๆ เป็นผลหลอดเลือด', siNotPWV: 'SI ทดลองนี้ไม่ใช่ cfPWV ที่วัดโดยตรง ไม่แปลงเป็นอายุ และไม่จัดกลุ่มว่าหลอดเลือดปกติหรือผิดปกติ', siShowSample: 'แสดงตัวอย่างเพื่อการเรียนรู้', siNoClaim: 'ไม่มีข้ออ้างจากข้อมูลสด', unknown: 'ไม่ทราบ'
  }
}

copy.th.captureFailedTitle = 'ยังไม่มีสัญญาณชีพจรที่ใช้ได้'
copy.th.captureFailureNotice = 'นี่คือปัญหาคุณภาพการบันทึก ไม่ใช่ข้อบ่งชี้เรื่องสุขภาพ'
copy.th.chooseAnotherVideo = 'เลือกวิดีโออื่น'
copy.th.cameraGuide = 'ใช้นิ้วปิดเลนส์กล้องหลังที่กำลังใช้งาน'
copy.th.cameraExpected = 'ภาพที่ควรเห็นคือปลายนิ้วโทนแดง/ส้ม ไม่ใช่ห้องหรือเก้าอี้'
copy.th.cameraStale = 'วิดีโอหยุดส่งเฟรมใหม่ เลือกไฟล์อื่นหรืออัดใหม่'
copy.th.noFinger = 'ยังไม่เห็นพื้นที่ปลายนิ้วโทนแดง/ส้ม'
copy.th.unsupported = 'เส้นทางกล้องสดไม่ได้เปิดในเดโมนี้ ให้อัดวิดีโอปลายนิ้วแล้วเลือกไฟล์ที่นี่'
copy.th.denied = copy.th.unsupported
copy.th.bpResearchVideoHelp = 'อัดวิดีโอปลายนิ้วนิ่ง ๆ 60 วินาที โดยปิดเลนส์กล้องหลังที่กำลังใช้พร้อมแสง แล้วเลือกไฟล์ที่นี่ ไม่มีการประเมินค่าความดัน'
copy.th.bpResearchVideoShort = 'วิดีโอวิจัยความดันต้องยาวอย่างน้อย 60 วินาที ไม่มีการบันทึกผล'
Object.assign(copy.en, {
  torchUnavailable: 'Torch controls are not part of this upload-first demo.',
  resultEmptyHint: 'Results appear after a qualifying analysis; nothing is waiting to be saved.',
  riskInvalid: 'Review the highlighted inputs. Nothing was saved as a numeric risk result.',
  resultHubTitle: 'Your local result map',
  resultHubIntro: 'One honest view of what this upload produced, what needs your input, and what is still unavailable.',
  resultAnalysisComplete: 'Analysis complete',
  resultViewDetails: 'View details',
  resultNext: 'Next',
  resultHubDone: 'Back to today',
  resultHubRetake: 'Choose another video',
  resultHRTitle: 'Heart rate',
  resultSITitle: 'Stiffness index',
  resultAgeTitle: 'Vascular age',
  resultRhythmTitle: 'Irregular rhythm',
  resultRiskTitle: '10-year risk',
  resultAdviceTitle: 'One small action',
  resultTrendTitle: 'User trend',
  resultBPTitle: 'Blood pressure',
  resultSampleMetric: 'Sample only',
  resultUnavailableMetric: 'Unavailable',
  resultNotImplementedMetric: 'Not implemented',
  resultInputMetric: 'Input needed',
  resultBPMetric: 'Result unavailable',
  resultActual: 'ACTUAL LOCAL OBSERVATION',
  resultManualActual: 'MANUAL INPUT / EDUCATIONAL',
  resultExperimental: 'EXPERIMENTAL / SAMPLE ONLY',
  resultUnavailable: 'UNAVAILABLE / NOT IMPLEMENTED',
  resultInputNeeded: 'INPUT NEEDED / SEPARATE',
  resultGuided: 'BOUNDED LOCAL GUIDE',
  resultHRBody: 'Observed from this local fingertip video after the 30-second acquisition gate. Heuristic quality is not accuracy or diagnosis.',
  resultSIBody: 'A labelled educational waveform only. Live SI is unavailable; no artery classification is made.',
  resultAgeBody: 'No vascular-age estimate is generated. Planned research remains isolated from your result.',
  resultRhythmBody: 'No irregular-rhythm classifier is implemented.',
  resultRiskBody: 'Enter explicit clinical inputs separately to review the legacy educational PCE path. Nothing came from video.',
  resultAdviceBody: 'Choose one modest action from the bounded local guide. No medication changes or diagnosis.',
  resultTrendBody: 'Accepted local HR observations only. Sample, weak-quality, duplicate, and future records are excluded.',
  resultBPBody: 'A separate 60-second research upload can store timing metadata only. BP result unavailable; no phone BP number is generated.',
  resultNoPrevious: 'No previous accepted observations yet.',
  resultPrevious: 'accepted local observations'
})
Object.assign(copy.th, {
  torchUnavailable: 'เดโมแบบอัปโหลดนี้ไม่มีปุ่มควบคุมไฟช่วยส่อง',
  resultEmptyHint: 'ผลจะแสดงหลังการวิเคราะห์ที่ผ่านเกณฑ์ ตอนนี้ยังไม่มีอะไรให้บันทึก',
  riskInvalid: 'ตรวจช่องข้อมูลที่ไฮไลต์อีกครั้ง ยังไม่ได้บันทึกเป็นผลความเสี่ยงตัวเลข',
  resultHubTitle: 'สรุปผลในเครื่องของคุณ',
  resultHubIntro: 'มุมมองเดียวที่บอกตามจริงว่าวิดีโอนี้ให้ข้อมูลอะไร ต้องกรอกอะไร และอะไรยังใช้ไม่ได้',
  resultAnalysisComplete: 'วิเคราะห์วิดีโอแล้ว',
  resultViewDetails: 'ดูรายละเอียด',
  resultNext: 'ถัดไป',
  resultHubDone: 'กลับไปวันนี้',
  resultHubRetake: 'เลือกวิดีโออื่น',
  resultHRTitle: 'ชีพจร',
  resultSITitle: 'ดัชนีความแข็งหลอดเลือด',
  resultAgeTitle: 'อายุหลอดเลือด',
  resultRhythmTitle: 'จังหวะผิดปกติ',
  resultRiskTitle: 'ความเสี่ยง 10 ปี',
  resultAdviceTitle: 'การกระทำเล็ก ๆ หนึ่งอย่าง',
  resultTrendTitle: 'แนวโน้มของคุณ',
  resultBPTitle: 'ความดันโลหิต',
  resultSampleMetric: 'ตัวอย่างเท่านั้น',
  resultUnavailableMetric: 'ยังไม่มี',
  resultNotImplementedMetric: 'ยังไม่ได้ทำ',
  resultInputMetric: 'ต้องมีข้อมูล',
  resultBPMetric: 'ยังไม่มีผล',
  resultActual: 'ค่าที่สังเกตได้จากวิดีโอในเครื่อง',
  resultManualActual: 'คำนวณจากข้อมูลกรอกเอง / เพื่อการเรียนรู้',
  resultExperimental: 'การทดลอง / ตัวอย่างเท่านั้น',
  resultUnavailable: 'ยังไม่มี / ยังไม่ทำ',
  resultInputNeeded: 'ต้องมีข้อมูลเพิ่ม / แยกต่างหาก',
  resultGuided: 'คู่มือในเครื่องแบบมีขอบเขต',
  resultHRBody: 'สังเกตจากวิดีโอปลายนิ้วในเครื่องนี้หลังผ่านเกณฑ์ 30 วินาที คุณภาพเชิงประมาณไม่ใช่ความแม่นยำหรือการวินิจฉัย',
  resultSIBody: 'รูปคลื่นเพื่อการเรียนรู้ที่มีป้ายกำกับเท่านั้น SI สดยังใช้ไม่ได้ และไม่มีการจัดกลุ่มหลอดเลือด',
  resultAgeBody: 'ไม่สร้างค่าประมาณอายุหลอดเลือด งานวิจัยที่วางแผนไว้แยกจากผลของคุณ',
  resultRhythmBody: 'ยังไม่มีโมเดลตรวจจังหวะผิดปกติ',
  resultRiskBody: 'กรอกข้อมูลทางคลินิกที่รู้จริงแยกต่างหากเพื่อทบทวนเส้นทาง PCE เพื่อการเรียนรู้ ค่านี้ไม่ได้มาจากวิดีโอ',
  resultAdviceBody: 'เลือกการกระทำเล็ก ๆ จากคู่มือในเครื่อง ไม่เปลี่ยนยาและไม่วินิจฉัย',
  resultTrendBody: 'เฉพาะค่าชีพจรในเครื่องที่ผ่านเกณฑ์ ตัวอย่าง ค่าคุณภาพต่ำ รหัสซ้ำ และอนาคตจะไม่เข้าแนวโน้ม',
  resultBPBody: 'อัปโหลดวิดีโอวิจัยแยก 60 วินาทีเพื่อเก็บเฉพาะข้อมูลเวลา ผลความดันยังไม่มี และไม่สร้างค่าจากโทรศัพท์',
  resultNoPrevious: 'ยังไม่มีค่าที่ผ่านเกณฑ์ก่อนหน้านี้',
  resultPrevious: 'ค่าที่ผ่านเกณฑ์ในเครื่อง',
  areasTitle: 'เจ็ดด้าน / สถานะตามจริง',
  areasIntro: 'แผนที่สั้น ๆ ว่าต้นแบบนี้อ้างอะไรได้และยังอ้างอะไรไม่ได้ในวันนี้',
  areaHR: 'ชีพจร',
  areaHRStatus: 'ทำงาน · ตรวจวิดีโอในเครื่อง',
  areaSI: 'ดัชนีความแข็งหลอดเลือด',
  areaSIStatus: 'ตัวอย่างเท่านั้น · ใช้สดไม่ได้',
  areaAge: 'อายุหลอดเลือด',
  areaAgeStatus: 'วางแผนไว้ · ยังไม่มี',
  areaRhythm: 'จังหวะผิดปกติ',
  areaRhythmStatus: 'ยังไม่ได้ทำ',
  areaASCVD: 'ความเสี่ยง ASCVD 10 ปี',
  areaASCVDStatus: 'กรอกเอง · เพื่อการเรียนรู้',
  areaAdvice: 'คำแนะนำ',
  areaAdviceStatus: 'คู่มือในเครื่องแบบมีขอบเขต',
  areaTrend: 'แนวโน้มของคุณ',
  areaTrendStatus: 'ทำงาน · ประวัติในเครื่อง'
})

Object.assign(copy.en, {
  upload: 'Upload', results: 'Results', history: 'History', context: 'Context',
  uploadTitle: 'Keep your next check-in local.', uploadIntro: 'Record a fingertip video in your phone camera app, then choose it here.', uploadGuide: 'Cover the active rear lens with your fingertip and illumination. Choose a steady video of at least 30 seconds.', uploadChoose: 'Choose fingertip video', uploadSample: 'Use labelled sample', uploadPrivacy: 'The file is analysed in this browser. This prototype does not upload or retain the raw video.', uploadSafety: 'Prototype · not emergency or diagnostic care',
  resultPageTitle: 'Results', resultPageIntro: 'One local observation, with limits made visible.', resultSaved: 'Saved locally', resultSave: 'Save result', resultSaveHint: 'Save this observation to include it in History.', resultLocal: 'LOCAL OBSERVATION', resultObserved: 'Observed locally', resultUnavailable: 'Unavailable', resultManual: 'Manual input only', resultSample: 'Sample only', resultDetails: 'View details', resultContext: 'Context & inputs', resultHistory: 'Open history', resultNoResult: 'No saved result yet.', resultHrBody: 'Observed from this local fingertip video after the acquisition and settling gates. It is not a diagnosis or validated medical measurement.', resultQualityBody: 'Heuristic signal quality only — not accuracy, confidence, or a clinical health result.', resultSiBody: 'No validated same-pulse landmarks are retained here, so no stiffness or artery result is generated.', resultAgeBody: 'Planned research feature. No vascular-age value is generated from this phone video.', resultRhythmBody: 'Not implemented. This prototype makes no irregular-rhythm conclusion.', resultRiskBody: 'Optional 2013 Pooled Cohort Equations comparison only. Review verified inputs; nothing is inferred from video.', resultAdviceBody: 'Choose one modest habit and an optional support preference in Context.', resultTrendBody: 'Saved local observations only. A trend does not prove healthier arteries.', resultBpBody: 'Enter a real cuff reading in Context. No phone BP value is estimated.', experimentalAgeConsentTitle: 'Experimental research preview', experimentalAgeConsent: 'I consent to an exploratory model-age computation from this uploaded video', experimentalAgeConsentBody: 'Local-only research path. It uses the fixed green channel and documented lower-intensity-is-more-volume assumption with actual decoded frame timestamps. It is not a vascular-age measurement and does not assess health, normality, risk, or artery status.', experimentalAgeTitle: 'Experimental model-age preview', experimentalAgeStatus: 'Research only', experimentalAgeLoading: 'Loading local research model…', experimentalAgeLabel: 'EXPERIMENTAL MODEL-AGE / ASSUMPTION-DEPENDENT', experimentalAgeUnit: 'model-age estimate', experimentalAgeBody: 'Computation-only output from a local research model. Not measured vascular age, not a diagnosis, not a normal/abnormal result, and not a treatment or risk recommendation.', experimentalAgeMeta: 'Decoded frames', experimentalAgeBlocked: 'The research model did not pass its input gate; no model-age value is shown.', contextTitle: 'Context & local controls', contextIntro: 'Choose the local profile and add only values you know. Nothing here is inferred from video.', contextProfile: 'Profile on this device', contextOwner: 'This device', contextGuest: 'Guest demo · separate history', contextBP: 'Manual BP reading', contextRisk: 'Risk inputs / legacy educational', contextRiskIntro: 'Optional comparison only. Enter real values with units; leave unknown values blank and the result stays unavailable.', contextSavedNote: 'Populated fields were already saved on this device. Blank fields are not assumed.', contextNoLab: 'I do not have lab values — keep risk unavailable', contextSource: 'Where this value came from', contextSourceHint: 'Use a real report or cuff reading; the video never fills these fields.', contextUnits: 'mg/dL for cholesterol · mmHg for cuff systolic BP · age 40–79 only', contextAge: 'Age (years)', contextSex: 'Sex field used by the legacy equation', contextTotalCholesterol: 'Total cholesterol (mg/dL)', contextHDL: 'HDL cholesterol (mg/dL)', contextSystolic: 'Cuff systolic BP (mmHg)', contextTreated: 'Taking BP medication', contextDiabetes: 'Diabetes diagnosis', contextSmoking: 'Current smoker', contextOptionalModel: 'Optional educational comparison', contextOptionalModelHint: '2013 Pooled Cohort Equations (legacy, US population). No Thai-calibrated or current-guideline model is enabled.', contextPopulation: 'Population equation (optional)', contextNoPopulation: 'Not selected — no numeric result', contextPrior: 'Known ASCVD (heart attack, stroke, or established disease)', contextUnknown: 'Unknown / not available', contextExport: 'Export local data', contextDelete: 'Delete local data', contextClose: 'Close', contextSave: 'Save', historyPageIntro: 'Saved local sessions with date and time. The graph is a record, not a clinical trend claim.', historyContext: 'Context & manual readings', historyNoSaved: 'No saved result yet. Save a result after a qualifying local video.'
})

Object.assign(copy.th, {
  upload: 'อัปโหลด', results: 'ผลล่าสุด', history: 'ประวัติ', context: 'บริบท',
  uploadTitle: 'เก็บการเช็กอินถัดไปไว้กับคุณ', uploadIntro: 'อัดวิดีโอปลายนิ้วด้วยแอปกล้อง แล้วเลือกไฟล์ที่นี่', uploadGuide: 'ใช้นิ้วปิดเลนส์กล้องหลังพร้อมแสง เลือกวิดีโอที่นิ่งอย่างน้อย 30 วินาที', uploadChoose: 'เลือกวิดีโอปลายนิ้ว', uploadSample: 'ใช้ตัวอย่างที่มีป้ายกำกับ', uploadPrivacy: 'วิเคราะห์ไฟล์ในเบราว์เซอร์นี้ ต้นแบบจะไม่อัปโหลดหรือเก็บวิดีโอดิบ', uploadSafety: 'ต้นแบบ • ไม่ใช่การดูแลฉุกเฉินหรือการวินิจฉัย',
  resultPageTitle: 'ผลล่าสุด', resultPageIntro: 'การสังเกตหนึ่งครั้ง พร้อมขอบเขตที่เห็นได้ชัด', resultSaved: 'บันทึกไว้ในเครื่องแล้ว', resultSave: 'บันทึกผล', resultSaveHint: 'บันทึกการสังเกตนี้เพื่อให้แสดงในประวัติ', resultLocal: 'การสังเกตในเครื่อง', resultObserved: 'สังเกตจากเครื่องนี้', resultUnavailable: 'ยังไม่มี', resultManual: 'กรอกเองเท่านั้น', resultSample: 'ตัวอย่างเท่านั้น', resultDetails: 'ดูรายละเอียด', resultContext: 'บริบทและข้อมูล', resultHistory: 'เปิดประวัติ', resultNoResult: 'ยังไม่มีผลที่บันทึกไว้', resultHrBody: 'สังเกตจากวิดีโอปลายนิ้วในเครื่องนี้หลังผ่านช่วงเก็บข้อมูลและช่วงให้สัญญาณนิ่ง ไม่ใช่การวินิจฉัยหรือการวัดที่ผ่านการรับรอง', resultQualityBody: 'คุณภาพสัญญาณเชิงประมาณเท่านั้น ไม่ใช่ความแม่นยำ ความเชื่อมั่น หรือผลสุขภาพทางคลินิก', resultSiBody: 'ไม่มีจุดอ้างอิงชีพจรเดียวกันที่ผ่านการตรวจสอบ จึงไม่สร้างผลความแข็งของหลอดเลือดหรือผลหลอดเลือด', resultAgeBody: 'เป็นฟีเจอร์วิจัยที่วางแผนไว้ ไม่สร้างค่าอายุหลอดเลือดจากวิดีโอโทรศัพท์นี้', resultRhythmBody: 'ยังไม่ได้ทำ ต้นแบบนี้ไม่สรุปจังหวะหัวใจผิดปกติ', resultRiskBody: 'เป็นการเปรียบเทียบ Pooled Cohort Equations ปี 2013 แบบเลือกได้เท่านั้น ทบทวนค่าที่รู้จริง ไม่มีข้อมูลใดมาจากวิดีโอ', resultAdviceBody: 'เลือกนิสัยเล็ก ๆ หนึ่งอย่างและการสนับสนุนที่ต้องการได้ในบริบท', resultTrendBody: 'เฉพาะการสังเกตที่บันทึกในเครื่อง แนวโน้มไม่ได้พิสูจน์ว่าหลอดเลือดดีขึ้น', resultBpBody: 'กรอกค่าจริงจากเครื่องวัดในบริบท ไม่มีการประเมินความดันจากโทรศัพท์', experimentalAgeConsentTitle: 'ตัวอย่างวิจัยเชิงทดลอง', experimentalAgeConsent: 'ยินยอมให้คำนวณค่า model-age เชิงสำรวจจากวิดีโอที่อัปโหลด', experimentalAgeConsentBody: 'เส้นทางวิจัยในเครื่องนี้ ใช้ช่องสีเขียวและสมมติฐาน lower-intensity-is-more-volume ที่กำหนดไว้ พร้อมเวลาเฟรมที่ถอดรหัสจริง ไม่ใช่การวัดอายุหลอดเลือด ไม่ประเมินสุขภาพ ความปกติ ความเสี่ยง หรือสถานะหลอดเลือด', experimentalAgeTitle: 'ตัวอย่าง model-age เชิงทดลอง', experimentalAgeStatus: 'เพื่อการวิจัยเท่านั้น', experimentalAgeLoading: 'กำลังโหลดโมเดลวิจัยในเครื่อง…', experimentalAgeLabel: 'โมเดล-อายุเชิงทดลอง / ขึ้นกับสมมติฐาน', experimentalAgeUnit: 'ค่าประมาณจากโมเดล', experimentalAgeBody: 'ผลคำนวณจากโมเดลวิจัยในเครื่องเท่านั้น ไม่ใช่อายุหลอดเลือดที่วัดได้ ไม่ใช่การวินิจฉัย ไม่ใช่ผลปกติ/ผิดปกติ และไม่ใช่คำแนะนำการรักษาหรือความเสี่ยง', experimentalAgeMeta: 'เฟรมที่ถอดรหัส', experimentalAgeBlocked: 'โมเดลวิจัยไม่ผ่านเกณฑ์ข้อมูล จึงไม่แสดงค่า model-age', contextTitle: 'บริบทและการควบคุมในเครื่อง', contextIntro: 'เลือกโปรไฟล์ในเครื่องและเพิ่มเฉพาะค่าที่รู้จริง ไม่มีการอนุมานจากวิดีโอ', contextProfile: 'โปรไฟล์ในเครื่องนี้', contextOwner: 'เครื่องนี้', contextGuest: 'เดโม Guest · ประวัติแยก', contextBP: 'ค่าความดันที่กรอกเอง', contextRisk: 'ข้อมูลความเสี่ยง / เพื่อการเรียนรู้', contextRiskIntro: 'เป็นการเปรียบเทียบเสริมเท่านั้น กรอกค่าจริงพร้อมหน่วย เว้นค่าที่ไม่รู้ไว้ ผลจะยังไม่พร้อมใช้งาน', contextSavedNote: 'ช่องที่มีค่าเป็นค่าที่บันทึกไว้ในเครื่องนี้แล้ว ช่องว่างจะไม่ถูกสมมติ', contextNoLab: 'ไม่มีค่าตรวจเลือด — ให้ผลความเสี่ยงยังไม่พร้อมใช้งาน', contextSource: 'ค่ามาจากที่ใด', contextSourceHint: 'ใช้รายงานจริงหรือค่าจากเครื่องวัด วิดีโอไม่เติมข้อมูลเหล่านี้', contextUnits: 'คอเลสเตอรอล mg/dL · ความดันตัวบนจากเครื่องวัด mmHg · อายุ 40–79 ปีเท่านั้น', contextAge: 'อายุ (ปี)', contextSex: 'ช่องเพศที่สมการเดิมใช้', contextTotalCholesterol: 'คอเลสเตอรอลรวม (mg/dL)', contextHDL: 'คอเลสเตอรอล HDL (mg/dL)', contextSystolic: 'ความดันตัวบนจากเครื่องวัด (mmHg)', contextTreated: 'รับประทานยาความดันอยู่', contextDiabetes: 'ได้รับการวินิจฉัยเบาหวาน', contextSmoking: 'สูบบุหรี่อยู่', contextOptionalModel: 'การเปรียบเทียบเพื่อการเรียนรู้ (เลือกได้)', contextOptionalModelHint: 'Pooled Cohort Equations ปี 2013 (โมเดลสหรัฐฯ แบบเดิม) ยังไม่มีโมเดลที่ปรับกับไทยหรือแนวทางปัจจุบัน', contextPopulation: 'สมการตามประชากร (เลือกได้)', contextNoPopulation: 'ยังไม่เลือก — จึงไม่มีค่าตัวเลข', contextPrior: 'มีโรคหลอดเลือดหัวใจและหลอดเลือดสมองที่ทราบ (กล้ามเนื้อหัวใจขาดเลือด โรคหลอดเลือดสมอง หรือโรคที่ยืนยันแล้ว)', contextUnknown: 'ไม่ทราบ / ไม่มีข้อมูล', contextExport: 'ส่งออกข้อมูลในเครื่อง', contextDelete: 'ลบข้อมูลในเครื่อง', contextClose: 'ปิด', contextSave: 'บันทึก', historyPageIntro: 'เซสชันในเครื่องพร้อมวันและเวลา กราฟเป็นบันทึก ไม่ใช่ข้อสรุปแนวโน้มทางคลินิก', historyContext: 'บริบทและค่าที่กรอกเอง', historyNoSaved: 'ยังไม่มีผลที่บันทึกไว้ บันทึกผลหลังวิดีโอผ่านเกณฑ์เพื่อแสดงในประวัติ'
})

function t(key) {
  return copy[state.language]?.[key] ?? copy.en[key] ?? key
}

function freshPulse() {
  return {
    mode: 'live', stage: 'intro', stream: null, track: null, starting: false, cancelToken: 0,
    startedAt: 0, lastFrameAt: 0, lastMediaTime: -1, samples: [], frameHandle: null, timerHandle: null,
    targetSeconds: 30, status: 'waiting', quality: 0, analysis: null, error: '', torch: false, torchAvailable: false, fileUrl: '', fileDuration: 0, fileName: '', fileLoadCancel: null, researchCapture: null, pendingSession: null, saved: false,
    researchConsent: false, decodedResearchFrames: [], decodedFrameCount: 0, experimentalAge: null, experimentalAgeToken: 0
  }
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]))
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString(state.language === 'th' ? 'th-TH' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(date = new Date()) {
  return date.toLocaleString(state.language === 'th' ? 'th-TH' : undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function localDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function setToast(message) {
  state.toast = message
  render()
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = ''; render() }, 3600)
}

function applyUpdate() {
  if (captureInProgress()) { updateReady = true; render(); return }
  const waiting = updateRegistration?.waiting
  if (!waiting || !navigator.serviceWorker) { window.location.reload(); return }
  const reload = () => window.location.reload()
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
  waiting.postMessage({ type: 'SKIP_WAITING' })
  window.setTimeout(reload, 1500)
}

function captureInProgress() {
  return ['pulse', 'bp-research'].includes(state.view) && pulse.stage === 'recording'
}

function invalidateFileSelection() {
  fileSelectionToken += 1
}

function clearExperimentalAgeResult() {
  pulse.experimentalAgeToken += 1
  pulse.experimentalAge = null
}

function renderToast() {
  if (updateReady && !captureInProgress()) return `<div class="toast update-toast" role="status"><span>${escapeHTML(t('updateReady'))}</span><button class="toast-action" data-action="refresh-update" type="button">${escapeHTML(t('refresh'))}</button></div>`
  if (undoSession) return `<div class="toast" role="status"><span>${escapeHTML(t('sessionDeleted'))}</span><button class="toast-action" data-action="undo-session" type="button">${escapeHTML(t('historyUndo'))}</button></div>`
  return state.toast ? `<div class="toast" role="status">${escapeHTML(state.toast)}</div>` : ''
}

function persist() {
  saveState(state)
}

function activeProfileId() {
  return state.activeProfileId || DEFAULT_PROFILE_ID
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === activeProfileId()) || state.profiles[0]
}

function activePulseSessions() {
  return state.pulseSessions.filter((session) => (session.profileId || DEFAULT_PROFILE_ID) === activeProfileId())
}

function activeBPReadings() {
  return state.bpReadings.filter((reading) => (reading.profileId || DEFAULT_PROFILE_ID) === activeProfileId())
}

function activeBPResearchSessions() {
  return state.bpResearchSessions.filter((session) => (session.profileId || DEFAULT_PROFILE_ID) === activeProfileId())
}

function activeBPResearchReferences() {
  return state.bpResearchReferences.filter((reference) => (reference.profileId || DEFAULT_PROFILE_ID) === activeProfileId())
}

function activeRiskState() {
  return state.riskByProfile?.[activeProfileId()] || { inputs: null, result: null }
}

function setUndoSession(removed, index) {
  undoSession = { removed, index }
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => { undoSession = null; render() }, 8000)
  render()
}

function deletePulseSession(id) {
  const result = removePulseSession(state.pulseSessions, id, activeProfileId())
  if (!result.removed) return
  state.pulseSessions = result.sessions
  if (selectedHistorySessionId === id) selectedHistorySessionId = ''
  persist()
  setUndoSession(result.removed, result.index)
}

function undoPulseSession() {
  if (!undoSession || state.pulseSessions.some((session) => session.id === undoSession.removed.id)) return
  state.pulseSessions.splice(Math.min(undoSession.index, state.pulseSessions.length), 0, undoSession.removed)
  undoSession = null
  clearTimeout(undoTimer)
  persist()
  render()
}

function nav() {
  return `<nav class="bottom-nav" aria-label="Primary navigation">
    ${navButton('upload', t('upload'))}
    ${navButton('results', t('results'))}
    ${navButton('history', t('history'))}
  </nav>`
}

function navButton(view, label) {
  return `<button class="nav-item ${state.view === view ? 'active' : ''}" data-action="nav" data-view="${view}" aria-current="${state.view === view ? 'page' : 'false'}"><strong>${label}</strong></button>`
}

function shell(content, { navVisible = true, kicker = '' } = {}) {
  const date = formatDate()
  return `<div class="app-shell">
    <header class="topbar">
      <button class="brand-mark" data-action="nav" data-view="upload" aria-label="Go to upload"><span>${BRAND.slice(0, 5)}</span><span>${BRAND.slice(5)}</span></button>
      <div class="topbar-tools"><span class="local-chip"><i></i>${t('local')}</span><button class="language-button" data-action="toggle-language">${t('language')}</button></div>
    </header>
    <main class="page" id="page" tabindex="-1">
      ${kicker ? `<p class="eyebrow">${escapeHTML(kicker)}</p>` : ''}
      ${content}
    </main>
    ${navVisible ? nav() : ''}
    ${renderToast()}
  </div>`
}

function renderOnboarding() {
  const step = state.onboardingStep
  if (step === 0) return `<section class="onboarding page-hero">
    <div class="hero-label"><span>TEAM 107</span><span>SIRIRAJ × MIT / 2026</span></div>
    <h1>${t('keep').replace('\n', '<br>')}</h1>
    <p class="lede">${t('intro')}</p>
    <div class="poster-mark" aria-hidden="true"><span>KHON</span><strong>ROOJAI</strong></div>
    <div class="button-stack"><button class="button primary" data-action="start-onboarding">Take a 30 sec setup</button><button class="button text-button" data-action="skip-onboarding">Skip for now</button></div>
    <p class="tiny-note">${t('safety')}<br>${t('reviewPending')}</p>
  </section>`
  const groups = [
    { key: 'goal', title: t('goalQ'), options: t('goals') },
    { key: 'barrier', title: t('barrierQ'), options: t('barriers') },
    { key: 'support', title: t('supportQ'), options: t('supports') }
  ]
  const group = groups[step - 1]
  return `<section class="onboarding compact-onboarding">
    <div class="step-top"><button class="back-link" data-action="onboarding-back">← ${t('back')}</button><span>0${step} / 03</span></div>
    <div class="progress-dots" aria-label="Onboarding step ${step} of 3">${groups.map((_, index) => `<i class="${index < step ? 'filled' : ''}"></i>`).join('')}</div>
    <p class="eyebrow">KHONROOJAI / SETUP</p><h1>${escapeHTML(group.title)}</h1>
    <div class="choice-list">${group.options.map((option) => `<button class="choice ${state.coachAnswers[group.key] === option ? 'selected' : ''}" aria-pressed="${state.coachAnswers[group.key] === option}" data-action="onboarding-choice" data-key="${group.key}" data-value="${escapeHTML(option)}"><span>${state.coachAnswers[group.key] === option ? '●' : '○'}</span>${escapeHTML(option)}</button>`).join('')}</div>
    <button class="button primary full" data-action="onboarding-next" ${state.coachAnswers[group.key] ? '' : 'disabled'}>${step === 3 ? t('savePlan') : t('continue')}</button>
  </section>`
}

function renderToday() {
  const habit = state.habit
  const recent = [...activeBPReadings()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]
  const pulseCount = activePulseSessions().filter((session) => !session.isSample).length
  const habitProgress = state.habitDone ? '100%' : '0%'
  return shell(`<section class="page-hero home-hero">
    <div class="hero-label"><span>${formatDate()}</span><span>01 / TODAY</span></div>
    <h1>${t('keep').replace('\n', '<br>')}</h1>
    <p class="lede">${t('intro')}</p>
    <div class="accent-word" aria-hidden="true">steady<span>.</span></div>
  </section>
  <section class="primary-actions">
    <article class="feature-card coral-card"><div class="card-index">A / LOCAL VIDEO</div><h2>${t('pulseCta')}</h2><p>${t('pulseSub')}</p><div class="button-row"><button class="button dark" data-action="open-upload">${t('pulseCta')}</button><button class="button outline-light" data-action="open-sample">${t('sampleCta')}</button></div></article>
    <article class="feature-card habit-card"><div class="card-index">B / HABIT</div><h2>${t('habitTitle')}</h2>${habit ? `<p class="habit-copy">${escapeHTML(habit)}</p><div class="habit-meter"><span style="width:${habitProgress}"></span></div><div class="button-row"><button class="button dark" data-action="toggle-habit">${state.habitDone ? t('done') : t('markDone')}</button><button class="button light-outline" data-action="replan">${t('replan')}</button></div>` : `<p>${t('noHabit')}</p><button class="button dark" data-action="nav" data-view="coach">${t('chooseHabit')} <span>↗</span></button>`}</article>
  </section>
  <section class="split-grid"><article class="mini-card"><div class="card-index">C / BP</div><h3>${recent ? `${recent.systolic}/${recent.diastolic}` : '— / —'}</h3><p>${recent ? `${escapeHTML(recent.source)} · ${formatDate(new Date(recent.capturedAt))}` : t('bpEmpty')}</p><button class="text-link" data-action="nav" data-view="records">${recent ? t('seeRecords') : t('addBP')} ↗</button></article><article class="mini-card"><div class="card-index">D / HISTORY</div><h3>${pulseCount ? `${pulseCount} check-in${pulseCount > 1 ? 's' : ''}` : '—'}</h3><p>${t('noRecords')}</p><button class="text-link" data-action="nav" data-view="records">${t('seeRecords')} ↗</button></article></section>
  <aside class="safety-strip"><strong>${t('safety')}</strong><span>${t('reviewPending')}</span></aside>`, { kicker: 'KHONROOJAI / THE SMALLER PLAN' })
}

function renderExperimentalAgeConsent() {
  if (!isExperimentalAgeConfigured()) return ''
  return `<details class="experimental-age-consent"><summary>${t('experimentalAgeConsentTitle')}</summary><p>${t('experimentalAgeConsentBody')}</p><label class="check-row"><input id="experimental-age-consent" type="checkbox" ${experimentalAgeConsent ? 'checked' : ''}><span>${t('experimentalAgeConsent')}</span></label></details>`
}

function renderUpload() {
  const savedCount = activePulseSessions().filter((session) => !session.isSample).length
  return shell(`<section class="upload-hero"><div class="hero-label"><span>${formatDate()}</span><span>${t('upload')}</span></div><h1>${t('uploadTitle')}</h1><p class="lede">${t('uploadIntro')}</p></section>
  <section class="upload-card"><div class="card-index">${t('upload')}</div><h2>${t('uploadChoose')}</h2><p>${t('uploadGuide')}</p><label class="file-picker upload-picker"><span>${t('uploadChoose')}</span><input id="video-file" type="file" accept="video/*,.mp4,.webm,.mov" /></label><p class="file-help">${t('uploadPrivacy')}</p>${renderExperimentalAgeConsent()}<button class="button text-button full" data-action="open-sample">${t('uploadSample')}</button></section>
  <section class="upload-footer"><div><span class="card-index">${t('local')}</span><p>${t('uploadSafety')}</p></div><button class="button light-outline" data-action="open-context">${t('context')}</button></section>${savedCount ? `<button class="history-teaser" data-action="nav" data-view="history"><span>${savedCount} ${t('history')}</span><strong>${t('resultHistory')} ↗</strong></button>` : ''}`, { kicker: 'KHONROOJAI' })
}

function renderHistoryPage() {
  const sessions = activePulseSessions().filter((session) => !session.isSample)
  return shell(`<section class="page-section-head"><div class="hero-label"><span>${t('history')}</span><span>${sessions.length} ${t('resultLocal')}</span></div><h1>${t('history')}</h1><p class="lede">${t('historyPageIntro')}</p></section>${renderHistoryPanel()}<button class="button light-outline full" data-action="open-context">${t('historyContext')}</button>`, { kicker: 'KHONROOJAI' })
}

function renderCoach() {
  const answer = state.coachAnswers
  return shell(`<section class="section-head"><div class="hero-label"><span>02 / COACH</span><span>${t('reviewPending')}</span></div><h1>${t('coachTitle')}</h1><p class="lede">${t('coachIntro')}</p></section>
  <section class="coach-block"><label>${t('goalQ')}</label><div class="chip-grid">${t('goals').map((item) => `<button class="chip ${answer.goal === item ? 'selected' : ''}" aria-pressed="${answer.goal === item}" data-action="coach-choice" data-key="goal" data-value="${escapeHTML(item)}">${escapeHTML(item)}</button>`).join('')}</div><label>${t('barrierQ')}</label><div class="chip-grid">${t('barriers').map((item) => `<button class="chip ${answer.barrier === item ? 'selected' : ''}" aria-pressed="${answer.barrier === item}" data-action="coach-choice" data-key="barrier" data-value="${escapeHTML(item)}">${escapeHTML(item)}</button>`).join('')}</div><label>${t('supportQ')}</label><div class="chip-grid">${t('supports').map((item) => `<button class="chip ${answer.support === item ? 'selected' : ''}" aria-pressed="${answer.support === item}" data-action="coach-choice" data-key="support" data-value="${escapeHTML(item)}">${escapeHTML(item)}</button>`).join('')}</div></section>
  <section class="habit-picker"><div class="card-index">ONE ACTION / THIS WEEK</div><h2>${t('chooseHabit')}</h2><div class="choice-list">${t('habitOptions').map((option) => `<button class="choice ${state.habit === option ? 'selected' : ''}" aria-pressed="${state.habit === option}" data-action="choose-habit" data-value="${escapeHTML(option)}"><span>${state.habit === option ? '●' : '○'}</span>${escapeHTML(option)}</button>`).join('')}</div><button class="button primary full" data-action="save-coach" ${state.habit ? '' : 'disabled'}>${state.habit ? t('savePlan') : t('chooseHabit')}</button><p class="tiny-note">${t('missed')} ${t('replanBody')}</p></section>
  <section class="support-card"><div><span class="card-index">OPTIONAL BUDDY</span><h3>${t('shareTitle')}</h3><p>${t('shareIntro')}</p></div><button class="button light-outline" data-action="share-preview">${t('shareHabit')}</button></section>`, { kicker: 'KHONROOJAI / CONTEXTUAL COACHING' })
}

function renderHistoryPanel() {
  const sessions = selectTrendSessions(state.pulseSessions, { profileId: activeProfileId(), rangeDays: state.historyRange })
  const selected = sessions.find((session) => session.id === selectedHistorySessionId)
  const rangeOptions = [['7', t('history7')], ['30', t('history30')], ['all', t('historyAll')]]
  return `<section class="history-card"><div class="list-heading"><div><div class="card-index">LOCAL / OBSERVATIONS</div><h2>${t('historyTitle')}</h2></div><label class="range-picker">${t('historyRange')}<select id="history-range">${rangeOptions.map(([value, label]) => `<option value="${value}" ${state.historyRange === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><p class="history-intro">${t('historyIntro')}</p><div class="history-chart-wrap"><canvas id="pulse-history-chart" width="720" height="250" aria-label="${escapeHTML(t('historyTitle'))}"></canvas>${sessions.length === 1 ? `<p class="microcopy">${t('historySingle')}</p>` : ''}</div>${sessions.length ? `<div class="history-session-list">${sessions.map((session) => `<button class="history-session ${selected?.id === session.id ? 'selected' : ''}" data-action="select-history-session" data-id="${escapeHTML(session.id)}"><span>${formatDate(new Date(session.capturedAt))}</span><strong>${escapeHTML(session.measuredHr)} bpm</strong><small>${escapeHTML(session.acquisitionMethod)} · ${escapeHTML(session.quality)}% heuristic</small></button>`).join('')}</div>` : `<p class="empty-state">${t('historyEmpty')}</p>`}${selected ? `<article class="history-detail"><div class="card-index">${t('historyDetail')}</div><h3>${escapeHTML(selected.measuredHr)} bpm</h3><p>${formatDateTime(new Date(selected.capturedAt))}</p><dl><div><dt>Source</dt><dd>${escapeHTML(selected.provenance)}</dd></div><div><dt>Duration</dt><dd>${escapeHTML(selected.durationSeconds)} sec</dd></div><div><dt>Quality</dt><dd>${escapeHTML(selected.quality)}% heuristic</dd></div></dl><button class="button outline full" data-action="delete-history-session" data-id="${escapeHTML(selected.id)}">${t('historyDelete')}</button></article>` : `<p class="history-no-selection">${t('historyNoSelection')}</p>`}</section>`
}

function renderProfilePicker() {
  return `<section class="profile-card"><div><div class="card-index">LOCAL / PROFILE</div><h2>${t('profileTitle')}</h2><p>${t('profileIntro')}</p></div><label>${t('profileTitle')}<select id="profile-select">${state.profiles.map((profile) => `<option value="${escapeHTML(profile.id)}" ${profile.id === activeProfileId() ? 'selected' : ''}>${escapeHTML(profile.id === DEFAULT_PROFILE_ID ? t('profileOwner') : profile.id === 'guest' ? t('profileGuest') : profile.label)}</option>`).join('')}</select></label></section>`
}

function renderAreaStatusCard() {
  const areas = [
    { name: t('areaHR'), status: t('areaHRStatus'), action: 'open-live' },
    { name: t('areaSI'), status: t('areaSIStatus'), action: 'research-lab' },
    { name: t('areaAge'), status: t('areaAgeStatus') },
    { name: t('areaRhythm'), status: t('areaRhythmStatus') },
    { name: t('areaASCVD'), status: t('areaASCVDStatus'), action: 'risk-view' },
    { name: t('areaAdvice'), status: t('areaAdviceStatus'), action: 'nav', view: 'coach' },
    { name: t('areaTrend'), status: t('areaTrendStatus'), action: 'nav', view: 'records' }
  ]
  return `<section class="area-status-card"><div class="card-index">PROTOTYPE MAP / NO OVERCLAIM</div><h2>${t('areasTitle')}</h2><p>${t('areasIntro')}</p><div class="area-status-grid">${areas.map((area) => area.action ? `<button class="area-status-item" data-action="${area.action}" ${area.view ? `data-view="${area.view}"` : ''}><strong>${escapeHTML(area.name)}</strong><span>${escapeHTML(area.status)}</span><b>↗</b></button>` : `<div class="area-status-item"><strong>${escapeHTML(area.name)}</strong><span>${escapeHTML(area.status)}</span></div>`).join('')}</div></section>`
}

function renderRecords() {
  const readings = [...activeBPReadings()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  return shell(`<section class="section-head"><div class="hero-label"><span>03 / RECORDS</span><span>${t('local')} · ${escapeHTML(activeProfile()?.label || '')}</span></div><h1>${t('recordsTitle')}</h1><p class="lede">${t('bpIntro')}</p></section>
  ${renderHistoryPanel()}<section class="form-card"><form id="bp-form"><div class="form-grid"><label>${t('date')}<input name="capturedAt" type="datetime-local" value="${localDateTimeValue()}" required></label><label>${t('source')}<select name="source" required><option value="">${t('selectOne')}</option><option>${t('sourceHome')}</option><option>${t('sourceClinic')}</option><option>${t('sourceOther')}</option></select></label><label>${t('systolic')}<input name="systolic" inputmode="numeric" type="number" min="40" max="300" placeholder="120" required></label><label>${t('diastolic')}<input name="diastolic" inputmode="numeric" type="number" min="20" max="200" placeholder="80" required></label><label>${t('pulse')}<input name="pulse" inputmode="numeric" type="number" min="20" max="250" placeholder="72"></label><label class="span-2">${t('note')}<input name="note" type="text" maxlength="120" placeholder="e.g. after sitting quietly"></label></div><button class="button primary full" type="submit">${t('saveReading')}</button></form></section>
  <section class="records-list"><div class="list-heading"><h2>${t('recent')}</h2><button class="text-link" data-action="export-review">${t('exportReview')} ↗</button></div>${readings.length ? readings.map(renderReading).join('') : `<p class="empty-state">${t('bpEmpty')}</p>`}</section><section class="risk-link-card"><div><div class="card-index">SEPARATE / CLINICAL INPUTS</div><h2>${t('riskInputs')}</h2><p>${t('riskDisabled')}</p></div><button class="button dark" data-action="risk-view">↗</button></section>`, { kicker: 'KHONROOJAI / MANUAL CONTEXT' })
}

function renderReading(reading) {
  return `<article class="record-row"><div><strong>${escapeHTML(reading.systolic)}/${escapeHTML(reading.diastolic)}</strong>${reading.pulse ? `<span>${escapeHTML(reading.pulse)} bpm</span>` : ''}</div><div><p>${escapeHTML(reading.source)}</p><small>${formatDate(new Date(reading.capturedAt))}${reading.note ? ` · ${escapeHTML(reading.note)}` : ''}</small></div></article>`
}

function renderRisk() {
  const riskState = activeRiskState()
  const saved = riskState.inputs || {}
  const result = riskState.result
  return shell(`<section class="section-head"><div class="hero-label"><span>SEPARATE / RISK</span><span>LEGACY EDUCATIONAL MODEL</span></div><h1>${t('riskTitle')}</h1><p class="lede">${t('riskIntro')}</p></section><section class="form-card"><form id="risk-form"><div class="risk-model-note"><strong>10-year ASCVD risk: 2013 Pooled Cohort Equations</strong><span>Legacy educational model only. Not current guideline-standard, not Thai-calibrated, and not a treatment recommendation.</span></div><div class="form-grid"><label>${t('riskAge')}<input name="age" type="number" min="40" max="79" value="${escapeHTML(saved.age || '')}" required></label><label>${t('riskSex')}<select name="sex" required><option value="">${t('selectOne')}</option><option value="female" ${saved.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${saved.sex === 'male' ? 'selected' : ''}>Male</option></select></label><label class="span-2">Coefficient population<select name="population" required><option value="">${t('selectOne')}</option><option value="white" ${saved.population === 'white' ? 'selected' : ''}>Non-Hispanic White equation (legacy)</option><option value="african-american" ${saved.population === 'african-american' ? 'selected' : ''}>African-American equation (legacy)</option></select></label><label>${t('riskTC')}<input name="totalCholesterol" type="number" min="130" max="320" value="${escapeHTML(saved.totalCholesterol || '')}" required></label><label>${t('riskHDL')}<input name="hdl" type="number" min="20" max="100" value="${escapeHTML(saved.hdl || '')}" required></label><label>${t('systolic')}<input name="systolic" type="number" min="90" max="200" value="${escapeHTML(saved.systolic || '')}" required></label><label>BP medication<select name="treated" required><option value="">${t('selectOne')}</option><option value="no" ${saved.treated === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.treated === 'yes' ? 'selected' : ''}>Yes</option></select></label><label>${t('riskDiabetes')}<select name="diabetes" required><option value="">${t('selectOne')}</option><option value="no" ${saved.diabetes === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.diabetes === 'yes' ? 'selected' : ''}>Yes</option></select></label><label>${t('riskSmoking')}<select name="smoker" required><option value="">${t('selectOne')}</option><option value="no" ${saved.smoker === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.smoker === 'yes' ? 'selected' : ''}>Yes</option></select></label><label class="span-2">Prior ASCVD (MI, stroke, or established disease)<select name="priorASCVD" required><option value="">${t('selectOne')}</option><option value="no" ${saved.priorASCVD === 'no' ? 'selected' : ''}>No — primary-prevention equation may apply</option><option value="yes" ${saved.priorASCVD === 'yes' ? 'selected' : ''}>Yes — do not calculate this primary-prevention estimate</option></select></label></div><button class="button primary full" type="submit">${t('riskSave')}</button></form></section>${result ? `<section class="risk-result ${result.valid ? 'valid' : 'invalid'}"><div class="card-index">${result.valid ? 'EDUCATIONAL ESTIMATE / 2013 PCE' : 'NO NUMERIC RESULT'}</div>${result.valid ? `<strong>${result.riskPercent.toFixed(1)}%</strong><p>Estimated 10-year hard ASCVD risk · ${escapeHTML(result.group)}</p>` : `<h2>${escapeHTML(result.message)}</h2>`}<small>${t('riskDisabled')} No BP, lipid, demographic, or other clinical value came from video. HR, SI, and vascular age are not inputs.</small></section>` : `<section class="risk-result invalid"><div class="card-index">NO NUMERIC RESULT</div><h2>${t('riskMissing')}</h2><small>${t('riskDisabled')}</small></section>`}<section class="risk-links"><p>Model source: <a href="https://www.heart.org/-/media/Data-Import/downloadables/0/D/A/2013-AHA-ACC-Cardiovascular-Risk-Guidelines-UCM_464291.pdf" target="_blank" rel="noreferrer">AHA/ACC 2013 Tables A/B ↗</a></p><p>Current context: <a href="https://professional.heart.org/en/guidelines-and-statements/prevent-calculator" target="_blank" rel="noreferrer">AHA PREVENT-ASCVD resource ↗</a></p><p>Thai CV Risk is a separate model and is not substituted here.</p></section>`, { kicker: 'KHONROOJAI / INPUTS STAY EXPLICIT' })
}

function renderYou() {
  return shell(`<section class="section-head"><div class="hero-label"><span>04 / YOU</span><span>${t('local')}</span></div><h1>${t('youTitle')}</h1><p class="lede">${t('youIntro')}</p></section>
  <section class="privacy-card"><div class="privacy-stamp">LOCAL<br>FIRST</div><div><h2>${t('privacyTitle')}</h2><ul>${t('privacyBullets').map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul></div></section>
  <section class="settings-list"><button class="setting-row" data-action="install-guide"><span><b>${t('install')}</b><small>${t('installBody')}</small></span><span>↗</span></button><button class="setting-row" data-action="reminder-guide"><span><b>${t('reminderTitle')}</b><small>${t('reminderBody')}</small></span><span>↗</span></button><button class="setting-row" data-action="export-data"><span><b>${t('exportData')}</b><small>JSON · ${t('local')}</small></span><span>↓</span></button><button class="setting-row danger" data-action="delete-data"><span><b>${t('deleteData')}</b><small>Remove this browser’s local copy</small></span><span>×</span></button></section>
  <section class="review-card"><div class="card-index">${t('reviewChecklist')}</div><p>Content is guideline-informed draft material for a prototype. Clinician review, user testing, smartphone validation, and organizer rule confirmation remain open.</p><button class="button dark full" data-action="research-lab">${t('researchLab')} ↗</button><a href="https://www.who.int/news-room/fact-sheets/detail/hypertension" target="_blank" rel="noreferrer">Reference: WHO hypertension overview ↗</a><a href="https://pubmed.ncbi.nlm.nih.gov/12241535/" target="_blank" rel="noreferrer">Research reference: Stiffness Index ↗</a><a href="https://seed.line.me/index_en.html" target="_blank" rel="noreferrer">Typeface source: LINE Seed ↗</a></section>`, { kicker: 'KHONROOJAI / TRUST & CONTROL' })
}

function renderResearch() {
  const sample = calculateStiffnessIndex({ heightMeters: 1.7, systolicMs: 420, reflectedMs: 600, repeatable: true })
  return shell(`<section class="research-head"><button class="back-link" data-action="nav" data-view="you">← ${t('back')}</button><span>RESEARCH / SEPARATE</span></section><section class="section-head"><div class="hero-label"><span>EXPERIMENTAL PATH</span><span>${t('siSampleOnly')}</span></div><h1>${t('siTitle')}</h1><p class="lede">${t('siIntro')}</p></section><section class="research-card"><div class="card-index">${t('siFormula')}</div><canvas id="research-waveform" width="720" height="250" aria-label="Illustrative waveform with two landmarks"></canvas><div class="landmark-list"><span><i class="dot systolic-dot"></i><b>${t('siSystolic')}</b><small>0.42 s</small></span><span><i class="dot reflected-dot"></i><b>${t('siReflected')}</b><small>0.60 s</small></span></div><div class="research-calculation"><div><small>${t('siHeight')}</small><strong>1.70 m</strong></div><div><small>${t('siDelta')}</small><strong>${sample.deltaSeconds.toFixed(2)} s</strong></div><div class="calc-result"><small>SI / ${t('siSampleOnly')}</small><strong>${sample.si.toFixed(2)} m/s</strong></div></div><p class="research-warning">${t('siNotPWV')}</p></section><section class="research-unavailable"><div class="card-index">LIVE / ${t('siNoClaim')}</div><h2>${t('siUnavailable')}</h2><p>${t('siUnavailableBody')}</p><button class="button outline full" data-action="research-sample">${t('siShowSample')}</button></section>`, { kicker: 'KHONROOJAI / EXPERIMENTAL RESEARCH' })
}

function renderBPResearchCard() {
  const sessions = [...activeBPResearchSessions()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  const references = [...activeBPResearchReferences()].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  return `<section class="bp-research-card"><div class="card-index">BP / RESEARCH ONLY</div><h2>${t('bpResearchTitle')}</h2><p>${t('bpResearchIntro')}</p><div class="research-callout"><strong>${t('bpResearchUnavailable')}</strong><span>${t('bpResearchNoFake')}</span></div><button class="button primary full" data-action="open-bp-research">${t('bpResearchCta')}</button><p class="file-help">${t('bpResearchPrivacy')}</p><div class="bp-research-history"><div class="list-heading"><h3>${t('bpResearchCapture')}</h3><span>${sessions.length}</span></div>${sessions.length ? sessions.map((session) => `<article class="bp-research-row"><strong>${t('bpResearchUnavailable')}</strong><span>${formatDateTime(new Date(session.capturedAt))} · ${session.durationSeconds} sec</span><small>${escapeHTML(session.source)} · local metadata only</small></article>`).join('') : `<p class="empty-state">${t('bpReferenceEmpty')}</p>`}</div><div class="bp-reference-block"><div class="list-heading"><div><h3>${t('bpResearchReferences')}</h3><p>${t('bpReferenceIntro')}</p></div></div><form id="bp-reference-form"><div class="form-grid"><label>${t('bpReferenceTime')}<input name="measuredAt" type="datetime-local" value="${localDateTimeValue()}" required></label><label>${t('source')}<select name="source" required><option value="">${t('selectOne')}</option><option>${t('sourceHome')}</option><option>${t('sourceClinic')}</option><option>${t('sourceOther')}</option></select></label><label>${t('systolic')}<input name="systolic" inputmode="numeric" type="number" min="40" max="300" placeholder="120" required></label><label>${t('diastolic')}<input name="diastolic" inputmode="numeric" type="number" min="20" max="200" placeholder="80" required></label><label>${t('pulse')}<input name="pulse" inputmode="numeric" type="number" min="20" max="250" placeholder="72"></label><label class="span-2">${t('note')}<input name="note" type="text" maxlength="120" placeholder="e.g. after sitting quietly"></label></div><button class="button outline full" type="submit">${t('saveReading')}</button></form>${references.length ? `<div class="bp-reference-list">${references.map((reference) => `<article class="bp-reference-row"><strong>${escapeHTML(reference.systolic)}/${escapeHTML(reference.diastolic)}${reference.pulse ? ` · ${escapeHTML(reference.pulse)} bpm` : ''}</strong><span>${formatDateTime(new Date(reference.measuredAt))}</span><small>${escapeHTML(reference.source)}${reference.note ? ` · ${escapeHTML(reference.note)}` : ''} · manual reference</small></article>`).join('')}</div>` : `<p class="empty-state">${t('bpReferenceEmpty')}</p>`}</div></section>`
}

function renderBPResearchCapture() {
  if (pulse.stage === 'result') return renderBPResearchResult()
  if (pulse.stage === 'recording') return shell(`<section class="pulse-head"><button class="back-link" data-action="cancel-bp-research">← ${t('back')}</button><span>BP RESEARCH / CAPTURE</span></section>${renderRecording()}`, { navVisible: false })
  if (pulse.stage === 'error') return renderBPResearchError()
  return shell(`<section class="pulse-head"><button class="back-link" data-action="cancel-bp-research">← ${t('back')}</button><span>BP RESEARCH / SEPARATE</span></section><section class="pulse-intro bp-research-intro"><div class="pulse-orb" aria-hidden="true"><span></span></div><p class="eyebrow">EXPERIMENTAL / NO BP RESULT</p><h1>${t('bpResearchTitle')}</h1><p class="lede">${t('bpResearchIntro')}</p><div class="info-pair"><strong>${BP_RESEARCH_SECONDS}s</strong><span>${t('bpResearchVideoHelp')}</span></div><label class="file-picker"><span>${t('videoFile')}</span><input id="bp-research-file" type="file" accept="video/*,.mp4,.webm,.mov" /></label><p class="file-help">${t('bpResearchVideoHelp')}</p><button class="button text-button full" data-action="cancel-bp-research">${t('cancel')}</button></section>`, { navVisible: false })
}

function renderBPResearchError() {
  const message = pulse.error === 'file-too-large' ? t('videoTooLarge') : pulse.error === 'file-type' ? t('videoType') : pulse.error === 'file-decode' ? t('videoDecode') : pulse.error === 'file-short' ? t('bpResearchVideoShort') : t('bpResearchUnavailableBody')
  return shell(`<section class="pulse-head"><button class="back-link" data-action="cancel-bp-research">← ${t('back')}</button><span>BP RESEARCH / NO SAVE</span></section><section class="pulse-error"><div class="error-number">!</div><p class="eyebrow">BP RESEARCH / NO SAVE</p><h1>${escapeHTML(t('captureFailedTitle'))}</h1><p class="lede">${escapeHTML(message)}</p><p class="error-notice">${t('bpResearchNoFake')}</p><button class="button primary full" data-action="retry-bp-research">${t('chooseAnotherVideo')}</button><button class="button text-button full" data-action="cancel-bp-research">${t('finish')}</button></section>`, { navVisible: false })
}

function renderBPResearchResult() {
  const capture = pulse.researchCapture
  return shell(`<section class="result-head"><button class="back-link" data-action="cancel-bp-research">← ${t('back')}</button><span>BP RESEARCH / SAVED</span></section><section class="result-card bp-research-result"><div class="card-index">CAPTURED / NO BP OUTPUT</div><div class="bp-unavailable-mark">—</div><h1>${t('bpResearchUnavailable')}</h1><p>${t('bpResearchUnavailableBody')}</p><div class="result-meta"><span>${t('bpResearchTarget')}</span><strong>${capture?.durationSeconds || BP_RESEARCH_SECONDS} sec</strong></div><div class="result-meta"><span>${t('date')}</span><strong>${capture ? escapeHTML(formatDateTime(new Date(capture.capturedAt))) : '—'}</strong></div><p class="quality-note">${t('bpResearchNoFake')}</p></section><div class="result-actions"><button class="button primary full" data-action="retry-bp-research">${t('retry')}</button><button class="button outline full" data-action="cancel-bp-research">${t('finish')}</button></div>`, { navVisible: false })
}

function renderPulse() {
  const isSample = pulse.mode === 'sample'
  const stage = pulse.stage
  if (stage === 'result') return renderPulseResult(isSample)
  return shell(`<section class="pulse-head"><button class="back-link" data-action="cancel-pulse">← ${t('back')}</button><span>${isSample ? t('sampleTag') : 'LOCAL VIDEO / NO CAMERA'}</span></section>
  ${stage === 'intro' ? `<section class="pulse-intro"><div class="pulse-orb" aria-hidden="true"><span></span></div><p class="eyebrow">${isSample ? 'SAMPLE / LABELLED' : 'LOCAL VIDEO / NO PERMISSION'}</p><h1>${isSample ? t('sampleTitle') : t('cameraTitle')}</h1><p class="lede">${isSample ? t('sampleIntro') : t('cameraIntro')}</p><div class="info-pair"><strong>${isSample ? '01' : '30s'}</strong><span>${isSample ? t('sampleTag') : t('videoFileHelp')}</span></div>${isSample ? `<button class="button primary full" data-action="play-sample">${t('beginSample')}</button>` : `<label class="file-picker"><span>${t('videoFile')}</span><input id="video-file" type="file" accept="video/*,.mp4,.webm,.mov" /></label><p class="file-help">${t('cameraExpected')}</p>`}<button class="button text-button full" data-action="cancel-pulse">${t('cancel')}</button></section>` : stage === 'recording' ? renderRecording() : renderPulseError()}`, { navVisible: false })
}

function renderRecording() {
  const targetSeconds = pulse.targetSeconds || (pulse.mode === 'sample' ? 3 : 30)
  const elapsed = pulse.startedAt ? Math.min(targetSeconds, (performance.now() - pulse.startedAt) / 1000) : 0
  const progress = `${Math.round((elapsed / targetSeconds) * 100)}%`
  if (pulse.mode === 'sample') return `<section class="recording-panel"><div class="sample-stage"><div class="sample-stage-label">DEMO SIGNAL / LABELLED</div><div class="sample-pulse-dot"></div><canvas id="waveform" width="640" height="180" aria-label="Illustrative sample waveform"></canvas><p>This animation is synthetic and separate from live camera capture.</p></div><div class="recording-status"><div class="status-line"><span>Illustrative sample</span><strong id="signal-quality">${pulse.quality}%</strong></div><div class="progress-track"><span id="pulse-progress" style="width:${progress}"></span></div><p class="microcopy">${t('sampleTag')} · ${Math.floor(elapsed)} / 03 sec</p></div><button class="button outline full" data-action="cancel-pulse">${t('cancel')}</button></section>`
  if (pulse.mode === 'bp-research-file') return `<section class="recording-panel bp-research-recording"><div class="camera-frame file-frame"><video id="pulse-video" autoplay muted playsinline controls></video><span class="camera-live">● BP RESEARCH / LOCAL FILE</span></div><div class="recording-status"><div class="status-line"><span id="signal-status">${t('cameraWait')}</span><strong id="signal-quality" aria-label="${t('quality')}">${pulse.quality}%</strong></div><div class="progress-track"><span id="pulse-progress" style="width:${progress}"></span></div><canvas id="waveform" width="640" height="180" aria-label="BP research video waveform"></canvas><p class="quality-note">${t('qualityNote')}</p><p class="microcopy">${escapeHTML(pulse.fileName)} · ${BP_RESEARCH_SECONDS}s target · browser-only processing · raw video is not saved</p></div><button class="button outline full" data-action="cancel-bp-research">${t('cancel')}</button></section>`
  if (pulse.mode === 'bp-research') return `<section class="recording-panel bp-research-recording"><div class="camera-frame"><video id="pulse-video" autoplay muted playsinline></video><div class="camera-target"><span>FINGER</span></div><span class="camera-live">● RESEARCH / LOCAL</span>${pulse.torchAvailable ? `<button class="torch-button ${pulse.torch ? 'on' : ''}" data-action="toggle-torch">${pulse.torch ? 'Torch on' : 'Torch off'}</button>` : ''}</div><div class="recording-status"><div class="status-line"><span id="signal-status">${t('cameraGuide')}</span><strong id="signal-quality" aria-label="${t('quality')}">${pulse.quality}%</strong></div><div class="progress-track"><span id="pulse-progress" style="width:${progress}"></span></div><canvas id="waveform" width="640" height="180" aria-label="Research capture waveform"></canvas><p class="quality-note">${t('qualityNote')}</p><p class="microcopy">${t('bpResearchTarget')} · ${Math.floor(elapsed)} / ${targetSeconds} sec · raw video is not saved</p></div><button class="button outline full" data-action="cancel-bp-research">${t('cancel')}</button></section>`
  if (pulse.mode === 'file') return `<section class="recording-panel"><div class="camera-frame file-frame"><video id="pulse-video" autoplay muted playsinline controls></video><span class="camera-live">● ${t('fileLive')}</span></div><div class="recording-status"><div class="status-line"><span id="signal-status">${t('cameraWait')}</span><strong id="signal-quality" aria-label="${t('quality')}">${pulse.quality}%</strong></div><div class="progress-track"><span id="pulse-progress" style="width:${progress}"></span></div><canvas id="waveform" width="640" height="180" aria-label="Local video pulse waveform"></canvas><p class="quality-note">${t('qualityNote')}</p><p class="microcopy">${escapeHTML(pulse.fileName)} · 30s target · browser-only processing · raw video is not saved</p></div><button class="button outline full" data-action="cancel-pulse">${t('cancel')}</button></section>`
  return `<section class="recording-panel"><div class="camera-frame"><video id="pulse-video" autoplay muted playsinline></video><div class="camera-target"><span>FINGER</span></div><span class="camera-live">● LIVE</span>${pulse.torchAvailable ? `<button class="torch-button ${pulse.torch ? 'on' : ''}" data-action="toggle-torch">${pulse.torch ? 'Torch on' : 'Torch off'}</button>` : ''}</div><div class="recording-status"><div class="status-line"><span id="signal-status">${t(pulse.status === 'dark' ? 'cameraDark' : pulse.status === 'motion' ? 'cameraMotion' : pulse.status === 'stale' ? 'cameraStale' : 'cameraGuide')}</span><strong id="signal-quality" aria-label="${t('quality')}">${pulse.quality}%</strong></div><div class="progress-track"><span id="pulse-progress" style="width:${progress}"></span></div><canvas id="waveform" width="640" height="180" aria-label="Live pulse waveform"></canvas><p class="quality-note">${t('qualityNote')}</p><p class="microcopy">${t('cameraWait')} · ${Math.floor(elapsed)} / 30 sec</p></div><button class="button outline full" data-action="cancel-pulse">${t('cancel')}</button></section>`
}

function renderPulseError() {
  const message = pulse.error === 'file-too-large' ? t('videoTooLarge') : pulse.error === 'file-type' ? t('videoType') : pulse.error === 'file-decode' ? t('videoDecode') : pulse.error === 'file-short' ? t('videoShort') : pulse.error === 'stale' ? t('cameraStale') : t('insufficient')
  return `<section class="pulse-error"><div class="error-number">!</div><p class="eyebrow">LOCAL VIDEO / NO SAVE</p><h1>${escapeHTML(t('captureFailedTitle'))}</h1><p class="lede">${escapeHTML(message)}</p><p class="error-notice">${t('captureFailureNotice')}</p><button class="button primary full" data-action="retry-pulse">${t('chooseAnotherVideo')}</button><button class="button text-button full" data-action="cancel-pulse">${t('finish')}</button></section>`
}

function renderPulseResult(isSample) {
  const bpm = isSample ? 72 : pulse.analysis?.bpm || '—'
  const quality = isSample ? 'illustrative' : `${pulse.analysis?.quality || 0}%`
  return shell(`<section class="result-head"><button class="back-link" data-action="cancel-pulse">← ${t('back')}</button><span>${isSample ? t('sampleTag') : 'LIVE / RESULT'}</span></section><section class="result-card ${isSample ? 'sample-result' : ''}"><div class="card-index">${isSample ? 'SAMPLE / NOT SAVED' : 'OBSERVATION / NOT DIAGNOSIS'}</div><div class="bpm-value">${bpm}<small>${isSample ? 'bpm' : 'bpm'}</small></div><h1>${t('pulseResult')}</h1><p>${isSample ? t('sampleIntro') : t('notDiagnosis')}</p><div class="result-meta"><span>${t('quality')}</span><strong>${quality}</strong></div><p class="quality-note">${t('qualityNote')}</p><canvas id="result-waveform" width="640" height="190"></canvas></section><div class="result-actions"><button class="button primary full" data-action="retry-pulse">${t('retry')}</button><button class="button outline full" data-action="cancel-pulse">${t('finish')}</button></div>`, { navVisible: false })
}

function renderExperimentalAgeCard(result) {
  if (!isExperimentalAgeConfigured() || !result) return ''
  if (result.status === 'loading') {
    return `<details class="result-hub-card experimental-age-card" open><summary><strong>${t('experimentalAgeTitle')}</strong><em>${t('experimentalAgeStatus')}</em><b>…</b></summary><div class="result-hub-detail"><p>${t('experimentalAgeLoading')}</p><p class="quality-note">${t('experimentalAgeBody')}</p></div></details>`
  }
  if (!hasUsableExperimentalAgeResult(result)) {
    return `<details class="result-hub-card experimental-age-card"><summary><strong>${t('experimentalAgeTitle')}</strong><em>${t('resultUnavailable')}</em><b>—</b></summary><div class="result-hub-detail"><p>${t('experimentalAgeBlocked')}</p><p class="quality-note">${t('experimentalAgeBody')}</p></div></details>`
  }
  const metadata = result.metadata || {}
  const frames = Number.isInteger(metadata.decodedFrameCount) ? metadata.decodedFrameCount : '—'
  const duration = Number.isFinite(metadata.durationSeconds) ? `${metadata.durationSeconds.toFixed(1)}s` : '—'
  return `<details class="result-hub-card experimental-age-card" open><summary><strong>${t('experimentalAgeTitle')}</strong><em>${t('experimentalAgeStatus')}</em><b>${Number(result.value).toFixed(1)}</b></summary><div class="result-hub-detail"><div class="experimental-age-label">${t('experimentalAgeLabel')}</div><div class="experimental-age-value">${Number(result.value).toFixed(1)} <small>${t('experimentalAgeUnit')}</small></div><p>${t('experimentalAgeBody')}</p><dl class="experimental-age-meta"><div><dt>${t('experimentalAgeMeta')}</dt><dd>${frames}</dd></div><div><dt>Decoded span</dt><dd>${duration}</dd></div><div><dt>Input</dt><dd>green channel · fixed polarity</dd></div></dl></div></details>`
}

function renderResultsHub() {
  const analysis = pulse.analysis
  if (!analysis) return shell(`<section class="results-head"><div class="hero-label"><span>${t('results')}</span><span>${t('resultUnavailable')}</span></div><h1>${t('resultPageTitle')}</h1><p class="lede">${t('resultNoResult')}</p><section class="result-empty-card"><strong>${t('resultNoResult')}</strong><p>${t('resultEmptyHint')}</p><button class="button primary full" data-action="nav" data-view="upload">${t('upload')}</button></section></section>`, { navVisible: true })
  const risk = activeRiskState().result
  const sessions = activePulseSessions().filter((session) => !session.isSample)
  const habit = state.habit || t('chooseHabit')
  const bpm = analysis?.bpm || '—'
  const quality = analysis?.quality ? `${analysis.quality}%` : '—'
  const card = ({ title, status, metric = '', body, action = '', open = false, tone = '' }) => `<details class="result-hub-card ${tone}" ${open ? 'open' : ''}><summary><strong>${title}</strong><em>${status}</em>${metric ? `<b>${metric}</b>` : ''}</summary><div class="result-hub-detail"><p>${body}</p>${action}</div></details>`
  const saveAction = pulse.saved ? `<span class="saved-result-label">${t('resultSaved')}</span>` : `<button class="button primary full" data-action="save-result">${t('resultSave')}</button><p class="result-save-hint">${t('resultSaveHint')}</p>`
  return shell(`<section class="results-head"><div class="hero-label"><span>${t('results')}</span><span>${t('resultLocal')}</span></div><h1>${t('resultPageTitle')}</h1><p class="lede">${t('resultPageIntro')}</p></section><section class="result-summary result-summary-new"><div class="result-summary-wave"><canvas id="result-summary-waveform" width="560" height="130" aria-label="${t('resultHrBody')}"></canvas><span>${t('quality')} · ${quality}</span></div><div class="result-summary-bpm"><strong>${bpm}</strong><span>bpm</span></div><div class="result-summary-actions"><button class="button light-outline" data-action="show-results-details">${t('resultDetails')}</button><button class="button light-outline" data-action="open-context">${t('resultContext')}</button></div></section><section class="result-save-card">${saveAction}</section><section class="results-details" id="result-details"><section class="results-grid">
    ${card({ title: t('resultHRTitle'), status: t('resultObserved'), metric: analysis?.bpm ? `${analysis.bpm} bpm` : '—', body: t('resultHrBody'), open: true, tone: 'result-actual' })}
    ${renderExperimentalAgeCard(pulse.experimentalAge)}
    ${card({ title: t('resultSITitle'), status: t('resultUnavailable'), metric: '—', body: t('resultSiBody') })}
    ${card({ title: t('resultAgeTitle'), status: t('resultUnavailable'), metric: '—', body: t('resultAgeBody') })}
    ${card({ title: t('resultRhythmTitle'), status: t('resultUnavailable'), metric: '—', body: t('resultRhythmBody') })}
    ${card({ title: t('resultRiskTitle'), status: t('resultManual'), metric: risk?.valid ? `${risk.riskPercent.toFixed(1)}%` : '—', body: t('resultRiskBody'), action: `<button class="button light-outline full" data-action="open-context">${t('resultContext')} ↗</button>` })}
    ${card({ title: t('resultAdviceTitle'), status: t('resultManual'), metric: escapeHTML(habit), body: t('resultAdviceBody'), action: `<button class="button light-outline full" data-action="open-context">${t('resultContext')} ↗</button>` })}
    ${card({ title: t('resultTrendTitle'), status: t('resultObserved'), metric: `${sessions.length}`, body: t('resultTrendBody'), action: `<button class="button light-outline full" data-action="nav" data-view="history">${t('resultHistory')} ↗</button>`, open: true, tone: 'result-actual' })}
    ${card({ title: t('resultBPTitle'), status: t('resultManual'), metric: '—', body: t('resultBpBody'), action: `<button class="button light-outline full" data-action="open-context">${t('resultContext')} ↗</button>` })}
  </section></section><p class="result-safety-note">${t('notDiagnosis')}</p><div class="result-actions"><button class="button outline full" data-action="retry-pulse">${t('retry')}</button><button class="button text-button full" data-action="nav" data-view="upload">${t('upload')}</button></div>`, { navVisible: true })
}

function renderContextModal() {
  const riskState = activeRiskState()
  const saved = riskState.inputs || {}
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal context-modal" role="dialog" aria-modal="true" aria-labelledby="context-title" data-stop-click><button class="modal-close" data-action="close-modal" aria-label="${t('contextClose')}">×</button><p class="eyebrow">${t('local')}</p><h2 id="context-title">${t('contextTitle')}</h2><p>${t('contextIntro')}</p><label>${t('contextProfile')}<select id="profile-select">${state.profiles.map((profile) => `<option value="${escapeHTML(profile.id)}" ${profile.id === activeProfileId() ? 'selected' : ''}>${escapeHTML(profile.id === DEFAULT_PROFILE_ID ? t('contextOwner') : profile.id === 'guest' ? t('contextGuest') : profile.label)}</option>`).join('')}</select></label><section class="context-section"><h3>${t('contextBP')}</h3><form id="bp-form"><div class="form-grid"><label>${t('date')}<input name="capturedAt" type="datetime-local" value="${localDateTimeValue()}" required></label><label>${t('source')}<select name="source" required><option value="">${t('selectOne')}</option><option>${t('sourceHome')}</option><option>${t('sourceClinic')}</option><option>${t('sourceOther')}</option></select></label><label>${t('systolic')}<input name="systolic" inputmode="numeric" type="number" min="40" max="300" placeholder="120" required></label><label>${t('diastolic')}<input name="diastolic" inputmode="numeric" type="number" min="20" max="200" placeholder="80" required></label><label>${t('pulse')}<input name="pulse" inputmode="numeric" type="number" min="20" max="250" placeholder="72"></label><label class="span-2">${t('note')}<input name="note" type="text" maxlength="120"></label></div><button class="button primary full" type="submit">${t('contextSave')}</button></form></section><section class="context-section"><h3>${t('contextRisk')}</h3><form id="risk-form"><div class="form-grid"><label>${t('riskAge')}<input name="age" type="number" min="40" max="79" value="${escapeHTML(saved.age || '')}" required></label><label>${t('riskSex')}<select name="sex" required><option value="">${t('selectOne')}</option><option value="female" ${saved.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${saved.sex === 'male' ? 'selected' : ''}>Male</option></select></label><label>${t('riskTC')}<input name="totalCholesterol" type="number" min="130" max="320" value="${escapeHTML(saved.totalCholesterol || '')}" required></label><label>${t('riskHDL')}<input name="hdl" type="number" min="20" max="100" value="${escapeHTML(saved.hdl || '')}" required></label><label>${t('systolic')}<input name="systolic" type="number" min="90" max="200" value="${escapeHTML(saved.systolic || '')}" required></label><label>${t('riskDiabetes')}<select name="diabetes" required><option value="">${t('selectOne')}</option><option value="no" ${saved.diabetes === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.diabetes === 'yes' ? 'selected' : ''}>Yes</option></select></label><label>${t('riskSmoking')}<select name="smoker" required><option value="">${t('selectOne')}</option><option value="no" ${saved.smoker === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.smoker === 'yes' ? 'selected' : ''}>Yes</option></select></label><label>BP medication<select name="treated" required><option value="">${t('selectOne')}</option><option value="no" ${saved.treated === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.treated === 'yes' ? 'selected' : ''}>Yes</option></select></label><label class="span-2">Coefficient population<select name="population" required><option value="">${t('selectOne')}</option><option value="white" ${saved.population === 'white' ? 'selected' : ''}>Non-Hispanic White equation (legacy)</option><option value="african-american" ${saved.population === 'african-american' ? 'selected' : ''}>African-American equation (legacy)</option></select></label><label class="span-2">Prior ASCVD<select name="priorASCVD" required><option value="">${t('selectOne')}</option><option value="no" ${saved.priorASCVD === 'no' ? 'selected' : ''}>No</option><option value="yes" ${saved.priorASCVD === 'yes' ? 'selected' : ''}>Yes</option></select></label></div><button class="button outline full" type="submit">${t('contextSave')}</button></form></section><section class="context-section"><h3>${t('habitTitle')}</h3><div class="context-habits">${t('habitOptions').map((option) => `<button class="chip ${state.habit === option ? 'selected' : ''}" data-action="choose-habit" data-value="${escapeHTML(option)}">${escapeHTML(option)}</button>`).join('')}</div></section><div class="context-actions"><button class="button light-outline" data-action="export-data">${t('contextExport')}</button><button class="button danger-button" data-action="delete-data">${t('contextDelete')}</button></div><button class="button text-button full" data-action="close-modal">${t('contextClose')}</button></section></div>`
}

function renderContextModalAccessible() {
  const riskState = activeRiskState()
  const saved = riskState.inputs || {}
  const value = (key) => escapeHTML(saved[key] || '')
  const selected = (key, option) => saved[key] === option ? 'selected' : ''
  const riskNumber = (name, label, min, max) => `<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" value="${value(name)}" placeholder="${escapeHTML(t('contextUnknown'))}"></label>`
  const riskSelect = (name, label, options, span = false) => `<label class="${span ? 'span-2' : ''}">${label}<select name="${name}">${options.map(([option, text]) => `<option value="${option}" ${selected(name, option)}>${text}</option>`).join('')}</select></label>`
  const profileOptions = state.profiles.map((profile) => `<option value="${escapeHTML(profile.id)}" ${profile.id === activeProfileId() ? 'selected' : ''}>${escapeHTML(profile.id === DEFAULT_PROFILE_ID ? t('contextOwner') : profile.id === 'guest' ? t('contextGuest') : profile.label)}</option>`).join('')
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal context-modal" role="dialog" aria-modal="true" aria-labelledby="context-title" data-stop-click><button class="modal-close" data-action="close-modal" aria-label="${t('contextClose')}">×</button><p class="eyebrow">${t('local')}</p><h2 id="context-title">${t('contextTitle')}</h2><p>${t('contextIntro')}</p><label>${t('contextProfile')}<select id="profile-select">${profileOptions}</select></label><section class="context-section"><h3>${t('contextBP')}</h3><p class="context-source-note">${t('contextSourceHint')}</p><form id="bp-form"><div class="form-grid"><label>${t('date')}<input name="capturedAt" type="datetime-local" value="${localDateTimeValue()}" required></label><label>${t('source')}<select name="source" required><option value="">${t('selectOne')}</option><option>${t('sourceHome')}</option><option>${t('sourceClinic')}</option><option>${t('sourceOther')}</option></select></label><label>${t('systolic')} (mmHg)<input name="systolic" inputmode="numeric" type="number" min="40" max="300" placeholder="${t('contextUnknown')}" required></label><label>${t('diastolic')} (mmHg)<input name="diastolic" inputmode="numeric" type="number" min="20" max="200" placeholder="${t('contextUnknown')}" required></label><label>${t('pulse')} (bpm)<input name="pulse" inputmode="numeric" type="number" min="20" max="250" placeholder="${t('contextUnknown')}"></label><label class="span-2">${t('note')}<input name="note" type="text" maxlength="120"></label></div><button class="button primary full" type="submit">${t('contextSave')}</button></form></section><section class="context-section"><h3>${t('contextRisk')}</h3><p class="context-hint">${t('contextRiskIntro')}</p><p class="context-source-note">${t('contextSavedNote')}</p><p class="context-units">${t('contextUnits')}</p><label class="check-row"><input name="risk-no-lab" type="checkbox" data-risk-no-lab ${saved.noLab === 'yes' ? 'checked' : ''}><span>${t('contextNoLab')}</span></label><form id="risk-form"><div class="form-grid">${riskNumber('age', t('contextAge'), 40, 79)}${riskSelect('sex', t('contextSex'), [['', t('contextUnknown')], ['female', 'Female'], ['male', 'Male']])}${riskNumber('totalCholesterol', t('contextTotalCholesterol'), 130, 320)}${riskNumber('hdl', t('contextHDL'), 20, 100)}${riskNumber('systolic', t('contextSystolic'), 90, 200)}${riskSelect('treated', t('contextTreated'), [['', t('contextUnknown')], ['no', 'No'], ['yes', 'Yes']])}${riskSelect('diabetes', t('contextDiabetes'), [['', t('contextUnknown')], ['no', 'No'], ['yes', 'Yes']])}${riskSelect('smoker', t('contextSmoking'), [['', t('contextUnknown')], ['no', 'No'], ['yes', 'Yes']])}${riskSelect('priorASCVD', t('contextPrior'), [['', t('contextUnknown')], ['no', 'No'], ['yes', 'Yes']], true)}</div><details class="optional-model"><summary>${t('contextOptionalModel')}</summary><p>${t('contextOptionalModelHint')}</p>${riskSelect('population', t('contextPopulation'), [['', t('contextNoPopulation')], ['white', 'Non-Hispanic White equation (legacy)'], ['african-american', 'African-American equation (legacy)']], true)}</details><input type="hidden" name="noLab" value="${saved.noLab === 'yes' ? 'yes' : ''}"><button class="button outline full" type="submit">${t('contextSave')}</button></form></section><section class="context-section"><h3>${t('habitTitle')}</h3><div class="context-habits">${t('habitOptions').map((option) => `<button class="chip ${state.habit === option ? 'selected' : ''}" data-action="choose-habit" data-value="${escapeHTML(option)}">${escapeHTML(option)}</button>`).join('')}</div></section><div class="context-actions"><button class="button light-outline" data-action="export-data">${t('contextExport')}</button><button class="button danger-button" data-action="delete-data">${t('contextDelete')}</button></div><button class="button text-button full" data-action="close-modal">${t('contextClose')}</button></section></div>`
}

function renderModal(type) {
  if (type === 'context') return renderContextModalAccessible()
  if (type === 'share') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" data-stop-click><button class="modal-close" data-action="close-modal" aria-label="${t('close')}">×</button><p class="eyebrow">OPTIONAL / EXPLICIT HANDOFF</p><h2 id="share-title">${t('shareTitle')}</h2><p>${t('shareIntro')}</p><div class="share-preview"><small>KHONROOJAI / HABIT CARD</small><strong>${escapeHTML(state.habit || t('noHabit'))}</strong><span>${state.habitDone ? t('done') : 'Today · not marked yet'}</span></div><button class="button primary full" data-action="share-confirm">${t('shareButton')}</button><button class="button text-button full" data-action="close-modal">${t('cancel')}</button></section></div>`
  if (type === 'delete') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" data-stop-click><p class="eyebrow">LOCAL DATA / REMOVE</p><h2>${t('deleteData')}</h2><p>${t('deleteConfirm')}</p><div class="button-row"><button class="button danger-button" data-action="confirm-delete">${t('yesDelete')}</button><button class="button outline" data-action="close-modal">${t('keepData')}</button></div></section></div>`
  if (type === 'install') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" data-stop-click><p class="eyebrow">PWA / INSTALL</p><h2>${t('install')}</h2><p>${t('installBody')}</p><div class="install-steps"><span>01 <b>${t('installStep1')}</b></span><span>02 <b>${t('installStep2')}</b></span><span>03 <b>${t('installStep3')}</b></span></div><button class="button primary full" data-action="close-modal">${t('okay')}</button></section></div>`
  if (type === 'reminder') return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" data-stop-click><p class="eyebrow">OPTIONAL / LOCAL PREFERENCE</p><h2>${t('reminderTitle')}</h2><p>${t('reminderBody')}</p><form id="reminder-form"><label>${t('reminderLabel')}<input name="label" value="${escapeHTML(state.reminder.label || state.habit || '')}" maxlength="80" placeholder="Small step"></label><label>${t('reminderTime')}<input name="time" type="time" value="${escapeHTML(state.reminder.time || '18:00')}" required></label><button class="button primary full" type="submit">${t('reminderEnable')}</button></form><button class="button text-button full" data-action="close-modal">${t('cancel')}</button></section></div>`
  return ''
}

let modalType = ''

function render() {
  if (state.view === 'upload') root.innerHTML = renderUpload()
  else if (state.view === 'history') root.innerHTML = renderHistoryPage()
  else if (state.view === 'bp-research') root.innerHTML = renderBPResearchCapture()
  else if (state.view === 'results') { root.innerHTML = renderResultsHub(); window.scrollTo(0, 0) }
  else if (state.view === 'pulse' || state.view === 'sample') root.innerHTML = renderPulse()
  if (modalType) root.insertAdjacentHTML('beforeend', renderModal(modalType))
  if (['pulse', 'bp-research'].includes(state.view) && pulse.stage === 'recording') {
    drawWaveform(document.querySelector('#waveform'), pulse.samples)
  }
  if (state.view === 'pulse' && pulse.stage === 'result') drawWaveform(document.querySelector('#result-waveform'), pulse.samples)
  if (state.view === 'results') drawWaveform(document.querySelector('#result-summary-waveform'), pulse.samples)
  if (state.view === 'history') drawHistoryChart(document.querySelector('#pulse-history-chart'))
  renderFormErrors()
  document.documentElement.lang = state.language === 'th' ? 'th' : 'en'
}

function drawResearchWaveform(canvas) {
  if (!canvas) return
  const context = canvas.getContext('2d'); const width = canvas.width; const height = canvas.height
  const points = makeIllustrativeStiffnessWaveform(); const values = points.map((point) => point.value)
  const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(max - min, .1)
  context.clearRect(0, 0, width, height); context.fillStyle = '#fffdf9'; context.fillRect(0, 0, width, height)
  context.strokeStyle = '#deded8'; context.lineWidth = 1
  for (let row = 1; row < 4; row += 1) { const y = height * row / 4; context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke() }
  context.strokeStyle = '#ff4f2f'; context.lineWidth = 4; context.lineJoin = 'round'; context.beginPath()
  points.forEach((point, index) => { const x = point.timeMs / 1800 * width; const y = height - 22 - ((point.value - min) / range) * (height - 44); if (!index) context.moveTo(x, y); else context.lineTo(x, y) }); context.stroke()
  const landmarks = [{ time: 420, color: '#191919' }, { time: 600, color: '#78a400' }]
  landmarks.forEach((landmark) => { const x = landmark.time / 1800 * width; context.strokeStyle = landmark.color; context.setLineDash([7, 7]); context.lineWidth = 2; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); context.setLineDash([]); context.fillStyle = landmark.color; context.beginPath(); context.arc(x, height * .22, 7, 0, Math.PI * 2); context.fill() })
}

function drawHistoryChart(canvas) {
  if (!canvas) return
  const context = canvas.getContext('2d'); const width = canvas.width; const height = canvas.height
  const sessions = selectTrendSessions(state.pulseSessions, { profileId: activeProfileId(), rangeDays: state.historyRange })
  const points = historyChartPoints(sessions)
  context.clearRect(0, 0, width, height); context.fillStyle = '#fffdf9'; context.fillRect(0, 0, width, height)
  if (!points.length) return
  const values = points.map((point) => point.y); const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(max - min, 8)
  const low = min - range * .18; const high = max + range * .18; const plotLeft = 34; const plotRight = width - 20; const plotTop = 20; const plotBottom = height - 34
  context.strokeStyle = '#deded8'; context.lineWidth = 1
  for (let row = 0; row <= 3; row += 1) { const y = plotTop + ((plotBottom - plotTop) * row / 3); context.beginPath(); context.moveTo(plotLeft, y); context.lineTo(plotRight, y); context.stroke() }
  context.fillStyle = '#687078'; context.font = '11px LineSeedEN, sans-serif'; context.fillText(`${Math.round(high)} bpm`, 4, plotTop + 4); context.fillText(`${Math.round(low)} bpm`, 4, plotBottom)
  context.strokeStyle = '#ff4f2f'; context.lineWidth = 3; context.lineJoin = 'round'; context.beginPath()
  points.forEach((point, index) => { const x = plotLeft + point.x * (plotRight - plotLeft); const y = plotBottom - ((point.y - low) / (high - low)) * (plotBottom - plotTop); if (!index) context.moveTo(x, y); else context.lineTo(x, y) });
  if (points.length > 1) context.stroke()
  points.forEach((point) => { const x = plotLeft + point.x * (plotRight - plotLeft); const y = plotBottom - ((point.y - low) / (high - low)) * (plotBottom - plotTop); context.fillStyle = '#ff4f2f'; context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill() })
  context.fillStyle = '#687078'; context.font = '10px LineSeedEN, sans-serif'; context.fillText(formatDate(new Date(points[0].session.capturedAt)), plotLeft, height - 10); if (points.length > 1) context.fillText(formatDate(new Date(points[points.length - 1].session.capturedAt)), plotRight - 80, height - 10)
}

function setView(view) {
  if (!['upload', 'results', 'history', 'pulse', 'sample', 'bp-research'].includes(view)) return
  if (!['pulse', 'bp-research'].includes(view)) invalidateFileSelection()
  if (!['pulse', 'bp-research'].includes(view) && pulse.stream) stopCamera()
  state.view = view
  persist()
  render()
  document.querySelector('#page')?.focus({ preventScroll: true })
}

function drawWaveform(canvas, samples) {
  if (!canvas) return
  const context = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#fbfbf8'
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#deded8'
  context.lineWidth = 1
  for (let line = 1; line < 4; line += 1) {
    const y = (height / 4) * line
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke()
  }
  if (!samples.length) return
  const values = samples.map((sample) => sample.red).filter(Number.isFinite)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(0.1, max - min)
  const timestamps = samples.map((sample) => sample.timeMs).filter(Number.isFinite)
  const firstTimestamp = timestamps[0]
  const lastTimestamp = timestamps[timestamps.length - 1]
  const durationMs = Number.isFinite(firstTimestamp) && Number.isFinite(lastTimestamp) ? lastTimestamp - firstTimestamp : 0
  const warmupRatio = durationMs > SIGNAL_WARMUP_MS * 2 ? Math.min(1, SIGNAL_WARMUP_MS / durationMs) : 0
  if (warmupRatio > 0) {
    const warmupWidth = width * warmupRatio
    context.fillStyle = 'rgba(225, 220, 210, 0.62)'
    context.fillRect(0, 0, warmupWidth, height)
    context.strokeStyle = '#a9a39a'
    context.lineWidth = 1
    context.setLineDash([5, 5])
    context.beginPath(); context.moveTo(warmupWidth, 0); context.lineTo(warmupWidth, height); context.stroke()
    context.setLineDash([])
    context.fillStyle = '#687078'
    context.font = '11px LineSeedEN, sans-serif'
    context.fillText('settle', 8, 16)
  }
  context.strokeStyle = '#ff4f2f'
  context.lineWidth = 4
  context.lineJoin = 'round'
  context.beginPath()
  values.forEach((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width
    const y = height - 18 - ((value - min) / range) * (height - 36)
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
}

function updateRecordingUI() {
  if (!['pulse', 'bp-research'].includes(state.view) || pulse.stage !== 'recording') return
  const targetSeconds = pulse.targetSeconds || 30
  const elapsed = pulse.startedAt ? Math.min(targetSeconds, (performance.now() - pulse.startedAt) / 1000) : 0
  const progress = document.querySelector('#pulse-progress')
  const quality = document.querySelector('#signal-quality')
  const status = document.querySelector('#signal-status')
  const micro = document.querySelector('.microcopy')
  if (progress) progress.style.width = `${Math.round((elapsed / 30) * 100)}%`
  if (quality) quality.textContent = `${pulse.quality}%`
  if (status) status.textContent = t(pulse.status === 'dark' ? 'cameraDark' : pulse.status === 'motion' ? 'cameraMotion' : pulse.status === 'stale' ? 'cameraStale' : pulse.status === 'no-finger' ? 'noFinger' : 'cameraGuide')
  if (micro) micro.textContent = `${t('cameraWait')} · ${Math.floor(elapsed)} / ${targetSeconds} sec`
}

function getFrameStats(video) {
  return getVideoFrameStats(video, captureCanvas, captureContext)
}

function requestNextFrame(video, token) {
  if (token !== pulse.cancelToken || pulse.stage !== 'recording') return
  const callback = (now, metadata) => {
    if (token !== pulse.cancelToken || pulse.stage !== 'recording') return
    const mediaTime = Number.isFinite(metadata?.mediaTime) ? metadata.mediaTime : video.currentTime
    const frameAt = performance.now()
    if (!Number.isFinite(mediaTime) || mediaTime === pulse.lastMediaTime) {
      if (frameAt - pulse.lastFrameAt > 1800) { pulse.status = 'stale'; updateRecordingUI() }
    } else {
      pulse.lastMediaTime = mediaTime
      pulse.lastFrameAt = frameAt
      const stats = getFrameStats(video)
      const previous = pulse.samples[pulse.samples.length - 1]
      const motionDelta = previous ? Math.abs(stats.red - previous.red) + Math.abs(stats.green - previous.green) + Math.abs(stats.blue - previous.blue) : 0
      const valid = stats.valid && motionDelta < 52
      const status = stats.dark ? 'dark' : stats.clipped ? 'motion' : motionDelta >= 52 ? 'motion' : stats.redDominant ? 'ready' : 'no-finger'
      pulse.status = status
      const decodedFrame = { ...stats, timeMs: mediaTime * 1000, valid }
      pulse.decodedResearchFrames.push(decodedFrame)
      pulse.decodedFrameCount += 1
      pulse.samples.push(decodedFrame)
      pulse.samples = pulse.samples.slice(-900)
      const settledSamples = trimSignalWarmup(pulse.samples)
      const usable = settledSamples.filter((sample) => sample.valid)
      pulse.quality = Math.round(clamp((usable.length / Math.max(1, settledSamples.length)) * 100, 0, 100))
      drawWaveform(document.querySelector('#waveform'), pulse.samples)
      updateRecordingUI()
    }
    const elapsed = pulse.startedAt ? (performance.now() - pulse.startedAt) / 1000 : 0
    if (['file', 'bp-research-file'].includes(pulse.mode) && (video.ended || (pulse.fileDuration && video.currentTime >= Math.min(pulse.fileDuration, pulse.targetSeconds || 30)))) { finishLiveCapture(); return }
    if (elapsed >= (pulse.targetSeconds || 30)) { finishLiveCapture(); return }
    requestNextFrame(video, token)
  }
  if (typeof video.requestVideoFrameCallback === 'function') pulse.frameHandle = video.requestVideoFrameCallback(callback)
  else pulse.frameHandle = window.setTimeout(() => callback(performance.now(), { mediaTime: video.currentTime }), 100)
}

async function beginLive() {
  if (pulse.starting || pulse.stream) return
  pulse.starting = true
  pulse.error = ''
  pulse.stage = 'recording'
  const token = ++pulse.cancelToken
  render()
  if (!navigator.mediaDevices?.getUserMedia) {
    pulse.starting = false; pulse.stage = 'error'; pulse.error = 'unsupported'; render(); return
  }
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } })
  } catch (error) {
    if (token !== pulse.cancelToken) return
    pulse.starting = false; pulse.stage = 'error'; pulse.error = error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'denied' : 'unsupported'; render(); return
  }
  if (token !== pulse.cancelToken || !['pulse', 'bp-research'].includes(state.view)) {
    stream.getTracks().forEach((track) => track.stop())
    return
  }
  pulse.stream = stream
  pulse.track = stream.getVideoTracks()[0] || null
  const capabilities = pulse.track?.getCapabilities?.() || {}
  pulse.torchAvailable = Boolean(capabilities.torch)
  pulse.starting = false
  pulse.startedAt = performance.now()
  pulse.lastFrameAt = performance.now()
  pulse.lastMediaTime = -1
  render()
  const video = document.querySelector('#pulse-video')
  if (!video) { stopCamera(); pulse.stage = 'error'; pulse.error = 'unsupported'; render(); return }
  video.srcObject = stream
  try { await video.play() } catch { /* autoplay is muted and user initiated; some browsers resolve later */ }
  requestNextFrame(video, token)
}

async function beginFileAnalysis(file, selectionToken) {
  if (selectionToken !== fileSelectionToken) return
  if (pulse.starting || pulse.stream) return
  stopCamera()
  const captureMode = pulse.mode === 'bp-research-file' ? 'bp-research-file' : 'file'
  const targetSeconds = captureMode === 'bp-research-file' ? BP_RESEARCH_SECONDS : 30
  pulse = freshPulse()
  pulse.mode = captureMode
  pulse.targetSeconds = targetSeconds
  pulse.researchConsent = experimentalAgeConsent && isExperimentalAgeConfigured()
  // The top-level Upload card owns a file input too. Move into the decoder
  // view before querying #pulse-video so that entry point is functional.
  if (state.view === 'upload') state.view = 'pulse'
  pulse.stage = 'recording'
  pulse.starting = true
  const token = ++pulse.cancelToken
  const validation = validateVideoFile(file)
  if (!validation.valid) { pulse.starting = false; pulse.stage = 'error'; pulse.error = validation.reason; render(); return }
  pulse.fileName = file.name || 'local video'
  pulse.fileUrl = URL.createObjectURL(file)
  render()
  const video = document.querySelector('#pulse-video')
  if (!video) { stopCamera(); pulse.stage = 'error'; pulse.error = 'file-decode'; render(); return }
  const loaded = await new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
      video.removeEventListener('abort', onAbort)
      if (pulse.fileLoadCancel === finish) pulse.fileLoadCancel = null
      resolve(value)
    }
    const onLoaded = () => finish(true)
    const onError = () => finish(false)
    const onAbort = () => finish(false)
    pulse.fileLoadCancel = () => finish(false)
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.addEventListener('abort', onAbort, { once: true })
    video.src = pulse.fileUrl
    video.load()
  })
  if (token !== pulse.cancelToken || selectionToken !== fileSelectionToken) return
  if (!loaded || !Number.isFinite(video.duration)) { stopCamera(); pulse.starting = false; pulse.stage = 'error'; pulse.error = 'file-decode'; render(); return }
  if (video.duration < targetSeconds) { stopCamera(); pulse.starting = false; pulse.stage = 'error'; pulse.error = 'file-short'; render(); return }
  pulse.fileDuration = video.duration
  pulse.starting = false
  pulse.startedAt = performance.now()
  pulse.lastFrameAt = performance.now()
  pulse.lastMediaTime = -1
  video.addEventListener('ended', () => { if (token === pulse.cancelToken && pulse.stage === 'recording') finishLiveCapture() }, { once: true })
  try { await video.play() } catch { stopCamera(); pulse.stage = 'error'; pulse.error = 'file-decode'; render(); return }
  requestNextFrame(video, token)
}

function finishBPResearchCapture() {
  const capture = makeBPResearchCapture({ capturedAt: new Date().toISOString(), durationSeconds: BP_RESEARCH_SECONDS, source: pulse.mode === 'bp-research-file' ? 'local-video' : 'camera' })
  stopCamera()
  if (!capture.valid) { pulse.stage = 'error'; pulse.error = 'insufficient'; render(); return }
  const session = { id: uid(), profileId: activeProfileId(), ...capture.value }
  state.bpResearchSessions.unshift(session)
  persist()
  pulse.researchCapture = session
  pulse.stage = 'result'
  render()
}

function startExperimentalAgeAnalysis() {
  if (!isExperimentalAgeConfigured() || pulse.mode !== 'file' || pulse.researchConsent !== true) return
  const pulseRef = pulse
  const token = ++pulse.experimentalAgeToken
  pulse.experimentalAge = { status: 'loading', experimental: true }
  render()
  void analyzeExperimentalAge({
    frames: pulseRef.decodedResearchFrames,
    consentConfirmed: true,
    syntheticTestFixture: false,
  }).then((result) => {
    if (pulse !== pulseRef || pulseRef.experimentalAgeToken !== token) return
    pulseRef.experimentalAge = result
    render()
  }).catch((error) => {
    if (pulse !== pulseRef || pulseRef.experimentalAgeToken !== token) return
    pulseRef.experimentalAge = {
      status: 'abstained',
      experimental: true,
      value: null,
      reasonCodes: ['research_model_failed'],
      metadata: { error: error instanceof Error ? error.message : String(error) },
    }
    render()
  })
}

function stopCamera() {
  pulse.cancelToken += 1
  if (pulse.frameHandle && typeof window.cancelVideoFrameCallback === 'function') window.cancelVideoFrameCallback(pulse.frameHandle)
  if (pulse.frameHandle && typeof pulse.frameHandle === 'number') window.clearTimeout(pulse.frameHandle)
  if (pulse.timerHandle) window.clearInterval(pulse.timerHandle)
  pulse.fileLoadCancel?.()
  pulse.fileLoadCancel = null
  const video = document.querySelector('#pulse-video')
  if (video) { video.pause(); video.srcObject = null; video.removeAttribute('src'); video.load() }
  pulse.stream?.getTracks?.().forEach((track) => track.stop())
  if (pulse.fileUrl) URL.revokeObjectURL(pulse.fileUrl)
  pulse.stream = null; pulse.track = null; pulse.frameHandle = null; pulse.timerHandle = null
  pulse.fileUrl = ''
}

function finishLiveCapture() {
  if (['bp-research', 'bp-research-file'].includes(pulse.mode)) { finishBPResearchCapture(); return }
  const captureSource = pulse.mode === 'file' ? 'local-video' : 'camera'
  stopCamera()
  clearExperimentalAgeResult()
  pulse.analysis = analyzeSignal(pulse.samples)
  if (!pulse.analysis.valid) { pulse.stage = 'error'; pulse.error = 'insufficient'; render(); return }
  pulse.pendingSession = { id: uid(), profileId: activeProfileId(), capturedAt: new Date().toISOString(), durationSeconds: 30, measuredHr: pulse.analysis.bpm, bpm: pulse.analysis.bpm, quality: pulse.analysis.quality, qualityType: 'heuristic', isSample: false, source: captureSource, acquisitionMethod: captureSource, provenance: captureSource, note: 'Prototype signal gate; not diagnostic.' }
  pulse.saved = false
  pulse.stage = 'result'
  state.view = 'results'
  render()
  startExperimentalAgeAnalysis()
}

function saveCurrentResult() {
  if (pulse.saved || !pulse.pendingSession) return
  state.pulseSessions.unshift(pulse.pendingSession)
  pulse.saved = true
  persist()
  setToast(t('resultSaved'))
}

function playSample() {
  if (pulse.stage !== 'intro') return
  pulse.stage = 'recording'
  pulse.startedAt = performance.now()
  pulse.samples = []
  render()
  const samples = makeSyntheticSamples({ bpm: 72, seconds: 3.2, fps: 30, noise: 0.12 })
  let index = 0
  pulse.timerHandle = window.setInterval(() => {
    if (index >= samples.length) {
      window.clearInterval(pulse.timerHandle)
      pulse.timerHandle = null
      pulse.stage = 'result'
      pulse.analysis = { valid: true, bpm: 72, quality: 96 }
      render()
      return
    }
    pulse.samples.push(samples[index])
    index += 1
    pulse.quality = 96
    drawWaveform(document.querySelector('#waveform'), pulse.samples)
    updateRecordingUI()
  }, 34)
}

function cancelPulse() {
  const returnView = ['bp-research', 'bp-research-file'].includes(pulse.mode) ? 'upload' : 'upload'
  invalidateFileSelection()
  stopCamera()
  if (pulse.timerHandle) window.clearInterval(pulse.timerHandle)
  pulse = freshPulse()
  experimentalAgeConsent = false
  state.view = returnView
  persist()
  render()
}

function toggleHabit() {
  if (!state.habit) return
  state.habitDone = !state.habitDone
  state.habitLog.unshift({ date: todayISO(), habit: state.habit, done: state.habitDone })
  persist(); setToast(state.habitDone ? t('done') : t('replan'))
}

function saveCoach() {
  if (!state.habit) return
  persist(); setToast(t('habitSaved')); state.view = 'upload'; render()
}

function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
}

async function shareHabit() {
  const text = `KHONROOJAI habit card\n${state.habit || t('noHabit')}\n${state.habitDone ? t('done') : 'Today · not marked yet'}\n\nShared by my choice. This hand-off does not create an account or sync health data.`
  try {
    if (navigator.share) { await navigator.share({ title: 'KHONROOJAI habit card', text }); setToast('Shared through your chosen app') }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setToast(t('copied')) }
    else { downloadFile('khonroojai-habit-card.txt', text); setToast(t('exported')) }
    modalType = ''; render()
  } catch (error) {
    if (error?.name === 'AbortError') setToast(t('shareCancelled'))
    else setToast(t('shareCancelled'))
  }
}

function showFormError(form, message) {
  if (!form || !message) return
  let error = form.querySelector('[data-form-error]')
  if (!error) {
    error = document.createElement('p')
    error.dataset.formError = 'true'
    error.className = 'form-error'
    error.setAttribute('role', 'alert')
    form.insertBefore(error, form.firstChild)
  }
  error.textContent = message
}

function renderFormErrors() {
  const errors = state.formErrors || {}
  if (errors.bp) showFormError(document.querySelector('#bp-form'), errors.bp)
  if (errors.risk) showFormError(document.querySelector('#risk-form'), errors.risk)
}

function submitBP(form) {
  const data = new FormData(form)
  const capturedValue = String(data.get('capturedAt') || '')
  const capturedDate = new Date(capturedValue)
  const source = String(data.get('source') || '')
  const systolic = Number(data.get('systolic')); const diastolic = Number(data.get('diastolic')); const pulseValue = Number(data.get('pulse'))
  if (!source || Number.isNaN(capturedDate.getTime()) || systolic < 40 || systolic > 300 || diastolic < 20 || diastolic > 200 || systolic <= diastolic || (data.get('pulse') && (pulseValue < 20 || pulseValue > 250))) {
    state.formErrors = { ...(state.formErrors || {}), bp: t('invalidBP') }
    showFormError(form, t('invalidBP'))
    setToast(t('invalidBP'))
    return
  }
  const capturedAt = capturedDate.toISOString()
  state.bpReadings.unshift({ id: uid(), profileId: activeProfileId(), capturedAt, source, systolic, diastolic, pulse: data.get('pulse') ? pulseValue : null, note: String(data.get('note') || '') })
  state.formErrors = { ...(state.formErrors || {}), bp: '' }
  modalType = ''
  persist(); setToast(t('exported').replace('downloaded', 'saved'))
}

function submitBPReference(form) {
  const input = Object.fromEntries(new FormData(form).entries())
  const validation = validateBPReference(input)
  if (!validation.valid) { setToast(t('bpReferenceInvalid')); return }
  state.bpResearchReferences.unshift({ id: uid(), profileId: activeProfileId(), ...validation.value })
  persist()
  setToast(t('bpReferenceSaved'))
  render()
}

function submitRisk(form) {
  const data = new FormData(form)
  const inputs = Object.fromEntries(data.entries())
  const requiredFields = ['age', 'sex', 'totalCholesterol', 'hdl', 'systolic', 'treated', 'diabetes', 'smoker', 'priorASCVD', 'population']
  const incomplete = inputs.noLab === 'yes' || requiredFields.some((field) => !inputs[field] || inputs[field] === 'unknown')
  const result = incomplete ? { valid: false, reason: inputs.noLab === 'yes' ? 'no-lab' : 'incomplete-inputs' } : calculateLegacyPCE({ ...inputs, age: Number(inputs.age), totalCholesterol: Number(inputs.totalCholesterol), hdl: Number(inputs.hdl), systolic: Number(inputs.systolic) })
  const message = result.reason === 'prior-ascvd' ? 'Known ASCVD is selected; this primary-prevention equation is not applicable.' : result.reason === 'out-of-range' ? 'One or more values are outside the verified equation bounds.' : 'No numeric result: add verified values and choose the optional educational equation, or leave it unavailable.'
  state.riskByProfile = state.riskByProfile || {}
  state.riskByProfile[activeProfileId()] = { inputs, result: result.valid ? result : { valid: false, reason: result.reason, message } }
  if (!result.valid) {
    state.formErrors = { ...(state.formErrors || {}), risk: message || t('riskInvalid') }
    showFormError(form, message || t('riskInvalid'))
    persist(); setToast(message || t('riskInvalid'))
    return
  }
  state.formErrors = { ...(state.formErrors || {}), risk: '' }
  modalType = ''
  persist(); setToast(`${result.riskPercent.toFixed(1)}% · legacy educational estimate`)
}

function exportReview() {
  const readings = activeBPReadings()
  const references = activeBPResearchReferences()
  const lines = [`KHONROOJAI REVIEW SUMMARY`, `Profile: ${activeProfile()?.label || activeProfileId()}`, `Exported: ${nowLocal()}`, ``, `This is a prototype record, not a diagnostic report.`, ``, `HABIT`, state.habit || 'Not chosen', `Status: ${state.habitDone ? 'done today' : 'not marked today'}`, ``, `MANUAL BP READINGS`]
  if (!readings.length) lines.push('None entered')
  readings.forEach((reading) => lines.push(`${formatDate(new Date(reading.capturedAt))} · ${reading.systolic}/${reading.diastolic}${reading.pulse ? ` · ${reading.pulse} bpm` : ''} · ${reading.source}${reading.note ? ` · ${reading.note}` : ''}`))
  lines.push('', 'BP RESEARCH CUFF REFERENCES')
  if (!references.length) lines.push('None entered')
  references.forEach((reference) => lines.push(`${formatDate(new Date(reference.measuredAt))} · ${reference.systolic}/${reference.diastolic}${reference.pulse ? ` · ${reference.pulse} bpm` : ''} · ${reference.source}${reference.note ? ` · ${reference.note}` : ''} · manual reference`))
  lines.push('', 'REVIEW NOTE', 'Urgent symptoms need appropriate care regardless of any prototype result. No vascular age, disease risk, or medication advice is inferred.')
  downloadFile('khonroojai-review-summary.txt', lines.join('\n'))
  setToast(t('exported'))
}

function exportAll() {
  downloadFile('khonroojai-data.json', exportState(state), 'application/json;charset=utf-8')
  setToast(t('exported'))
}

function submitReminder(form) {
  const data = new FormData(form)
  state.reminder = { enabled: true, label: String(data.get('label') || t('habitTitle')), time: String(data.get('time') || '18:00') }
  persist(); modalType = ''; render(); setToast(t('reminderSaved'))
}

function finishOnboarding() {
  state.onboardingComplete = true
  state.onboardingStep = 0
  state.view = 'upload'
  persist(); render()
}

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]')
  const stopRegion = event.target.closest('[data-stop-click]')
  if (stopRegion && (!target || !target.closest('[data-stop-click]'))) { event.stopPropagation(); return }
  if (!target) return
  if (target.dataset.stopClick !== undefined) { event.stopPropagation(); return }
  const action = target.dataset.action
  if (action === 'nav') { setView(target.dataset.view); return }
  if (action === 'toggle-language') { state.language = state.language === 'en' ? 'th' : 'en'; persist(); render(); return }
  if (action === 'skip-onboarding') { finishOnboarding(); return }
  if (action === 'start-onboarding') { state.onboardingStep = 1; render(); return }
  if (action === 'onboarding-choice') { state.coachAnswers[target.dataset.key] = target.dataset.value; render(); return }
  if (action === 'onboarding-next') { if (state.onboardingStep < 3) state.onboardingStep += 1; else { state.habit = t('habitOptions')[0]; finishOnboarding(); return } render(); return }
  if (action === 'onboarding-back') { if (state.onboardingStep > 1) state.onboardingStep -= 1; else { state.onboardingStep = 0; } render(); return }
  if (action === 'open-live' || action === 'open-upload') { pulse = freshPulse(); pulse.mode = 'file'; state.view = 'pulse'; render(); return }
  if (action === 'open-sample') { pulse = freshPulse(); pulse.mode = 'sample'; state.view = 'pulse'; render(); return }
  if (action === 'open-bp-research') { pulse = freshPulse(); pulse.mode = 'bp-research-file'; pulse.targetSeconds = BP_RESEARCH_SECONDS; state.view = 'bp-research'; render(); return }
  if (action === 'refresh-update') { if (captureInProgress()) return; updateReady = false; applyUpdate(); return }
  if (action === 'start-camera' || action === 'start-bp-research') { pulse = freshPulse(); pulse.mode = action === 'start-bp-research' ? 'bp-research-file' : 'file'; pulse.targetSeconds = action === 'start-bp-research' ? BP_RESEARCH_SECONDS : 30; state.view = action === 'start-bp-research' ? 'bp-research' : 'pulse'; render(); return }
  if (action === 'play-sample') { playSample(); return }
  if (action === 'cancel-bp-research') { cancelPulse(); return }
  if (action === 'retry-bp-research') { invalidateFileSelection(); stopCamera(); pulse = freshPulse(); pulse.mode = 'bp-research-file'; pulse.targetSeconds = BP_RESEARCH_SECONDS; state.view = 'bp-research'; render(); return }
  if (action === 'cancel-pulse' || action === 'finish') { cancelPulse(); return }
  if (action === 'show-results-details') { document.querySelector('#result-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
  if (action === 'save-result') { saveCurrentResult(); return }
  if (action === 'open-context') { state.formErrors = {}; modalType = 'context'; render(); return }
  if (action === 'retry-pulse') { invalidateFileSelection(); stopCamera(); pulse = freshPulse(); pulse.mode = target.closest('.sample-result') ? 'sample' : 'file'; state.view = 'pulse'; render(); return }
  if (action === 'toggle-torch') { setToast(t('torchUnavailable')); return }
  if (action === 'coach-choice') { state.coachAnswers[target.dataset.key] = target.dataset.value; persist(); render(); return }
  if (action === 'choose-habit') { state.habit = target.dataset.value; state.habitDone = false; persist(); render(); return }
  if (action === 'save-coach') { saveCoach(); return }
  if (action === 'toggle-habit') { toggleHabit(); return }
  if (action === 'replan') { state.habitDone = false; modalType = 'context'; persist(); render(); return }
  if (action === 'share-preview') { modalType = 'share'; render(); return }
  if (action === 'share-confirm') { await shareHabit(); return }
  if (action === 'close-modal') { state.formErrors = {}; modalType = ''; render(); return }
  if (action === 'delete-data') { modalType = 'delete'; render(); return }
  if (action === 'confirm-delete') { clearState(); clearTimeout(undoTimer); undoTimer = null; undoSession = null; selectedHistorySessionId = ''; Object.assign(state, defaultState(), { onboardingComplete: true }); modalType = ''; render(); setToast('Local data deleted'); return }
  if (action === 'export-data') { exportAll(); return }
  if (action === 'export-review') { exportReview(); return }
  if (action === 'install-guide') { modalType = 'install'; render(); return }
  if (action === 'reminder-guide') { modalType = 'reminder'; render(); return }
  if (action === 'select-history-session') { selectedHistorySessionId = target.dataset.id || ''; render(); return }
  if (action === 'delete-history-session') { deletePulseSession(target.dataset.id); return }
  if (action === 'undo-session') { undoPulseSession(); return }
  if (action === 'research-lab' || action === 'research-sample' || action === 'risk-view') { state.formErrors = {}; modalType = 'context'; render(); return }
})

document.addEventListener('invalid', (event) => {
  const form = event.target.closest?.('form')
  if (!form || !['bp-form', 'risk-form'].includes(form.id)) return
  const key = form.id === 'bp-form' ? 'bp' : 'risk'
  const message = t(form.id === 'bp-form' ? 'invalidBP' : 'riskInvalid')
  state.formErrors = { ...(state.formErrors || {}), [key]: message }
  showFormError(form, message)
}, true)

document.addEventListener('submit', (event) => {
  if (event.target.id === 'bp-form') { event.preventDefault(); submitBP(event.target) }
  if (event.target.id === 'bp-reference-form') { event.preventDefault(); submitBPReference(event.target) }
  if (event.target.id === 'risk-form') { event.preventDefault(); submitRisk(event.target) }
  if (event.target.id === 'reminder-form') { event.preventDefault(); submitReminder(event.target) }
})

document.addEventListener('change', (event) => {
  if (event.target.id === 'experimental-age-consent') {
    experimentalAgeConsent = event.target.checked === true
  }
  if (['video-file', 'bp-research-file'].includes(event.target.id) && event.target.files?.[0]) {
    const selectionToken = ++fileSelectionToken
    void beginFileAnalysis(event.target.files[0], selectionToken)
  }
  if (event.target.id === 'profile-select') {
    const profile = state.profiles.find((item) => item.id === event.target.value)
    if (profile) { state.activeProfileId = profile.id; selectedHistorySessionId = ''; persist(); render() }
  }
  if (event.target.matches('[data-risk-no-lab]')) {
    const hidden = document.querySelector('#risk-form input[name="noLab"]')
    if (hidden) hidden.value = event.target.checked ? 'yes' : ''
  }
  if (event.target.id === 'history-range') {
    state.historyRange = ['7', '30', 'all'].includes(event.target.value) ? event.target.value : '30'
    selectedHistorySessionId = ''
    persist(); render()
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['pulse', 'bp-research'].includes(state.view) && pulse.stream) {
    stopCamera(); pulse.stage = 'error'; pulse.error = 'stale'; render()
  }
})

window.addEventListener('beforeunload', () => stopCamera())
window.addEventListener('pagehide', () => stopCamera())

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    updateRegistration = await navigator.serviceWorker.register('/sw.js')
    updateRegistration.addEventListener('updatefound', () => {
      const worker = updateRegistration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) { updateReady = true; render() }
      })
    })
    // Check once on startup as well as periodically, so a tab that stays open
    // after a deployment can discover the new worker promptly.
    void updateRegistration.update()
    window.setInterval(() => updateRegistration?.update?.(), 10 * 60 * 1000)
  } catch { /* offline or file preview; the app remains usable */ }
}

render()
registerServiceWorker()
