# KHONROOJAI PWA

Team 107’s mobile-first, local-first prototype for the Siriraj × MIT cardiovascular hackathon. The visual direction uses the supplied editorial reference as a style cue: pale paper, oversized geometric type, compact all-caps metadata, and orange-red emphasis. The reference’s fictitious company, dates, and contacts are not reused.

## Run it

```bash
npm install
npm test
npm run build
npm run dev
```

The release demo is upload-first. Record a steady fingertip video in the phone camera app first: cover the active rear lens with your fingertip and illumination so the footage is a red/orange fingertip field, not the room. Then choose the local video in KHONROOJAI. The primary navigation does not request camera permission or expose torch controls; the older live-camera source remains in `src/main.js` for a later repair pass and is not a release path. A result is never synthesized: the app needs a decodable video, original media timestamps, enough duration, a usable fingertip colour signal, and repeatable pulse landmarks. If a device or browser cannot provide a usable file, use the explicitly labelled sample session. Participant-free synthetic MP4 fixtures are included at `test/fixtures/synthetic-fingertip.mp4` (short negative case) and `test/fixtures/synthetic-fingertip-30s.mp4` (30-second decoder case) for browser QA only.

## Published demo

Cloudflare Pages production deployment (verified 2026-10-17, app commit `12e8c61`, deployment `d1072beb`): https://khonroojai-pwa.pages.dev/  The immutable URL for this release is https://d1072beb.khonroojai-pwa.pages.dev/. The prior deployment `055dd62a` was also verified before the final upload-spacing fix.

The Cloudflare deployment is separate from this source snapshot. `npm run deploy` requires your own authenticated Cloudflare account and Pages project; it was not run from this public-source staging copy. No participant recordings, patient records, or personal health data are part of the build.

## Public source boundary

This source snapshot is the reviewed demo app, not a dump of the private working
history. It intentionally omits local-only QA reports and the experimental model
weight binaries whose redistribution rights were not verified. The default
`npm test` and `npm run build` paths do not require those files. The opt-in
research adapter remains disabled unless a separately authorized local setup is
completed; see [RESEARCH-MODEL-SETUP.md](./RESEARCH-MODEL-SETUP.md).

## Demo flow

1. Start on Upload / อัปโหลด; choose a local fingertip video or the explicitly labelled sample.
2. After a qualifying local video, Results / ผลล่าสุด opens automatically. Review the observed pulse, unavailable metrics, safety note, and compact detail cards; save the observation explicitly if it should appear in History.
3. Use Context / บริบท from Upload or Results for a local profile, one modest habit, real manual BP readings, export/delete, and optional legacy educational risk inputs. Blank or unknown clinical values remain unavailable; nothing is inferred from the video.
4. Use History / ประวัติ for dated saved sessions and the local trend graph. Samples and weak heuristic signals are excluded from the trend, and owner/guest demo profiles remain separate.
5. On unsupported hardware, use the labelled sample. It is illustrative only and is not saved as a personal measurement. Family support remains an explicit, previewed habit-only handoff with no delivery or cross-device sync claim.

## Separate research modules

- `PPG → HR`: the upload-first file gate exposes an observed pulse estimate only after sufficient signal. The live-camera implementation is retained as unreleased source for later repair; it is not part of the demo path and the result is not diagnostic.
- `Pulse history`: accepted local HR sessions retain a unique ID, timestamp, acquisition method, duration, measured HR, heuristic quality, and provenance. History is profile-scoped and local; samples, future estimates, duplicate IDs, future timestamps, and weak-quality sessions are excluded from the trend.
- `BP research capture`: a separate 60-second, timestamped camera research capture is available for future validation. It has no BP estimator, stores no raw video, and returns `BP result unavailable`. Manual cuff references are entered separately with measurement time and source.
- `Stiffness Index`: a sample-only waveform inspection view shows `SI = height (m) / ΔT (s)` between two explicit same-pulse landmarks. Live SI is unavailable until repeatable landmark detection is validated. It is not directly measured cfPWV, is not converted to age, and does not classify arteries.
- `10-year ASCVD risk`: an explicitly named, legacy educational implementation of the 2013 Pooled Cohort Equations. It requires actual entered inputs, population selection, bounds, and no prior ASCVD. It never derives BP/lipids/clinical facts from video and gives no treatment recommendation. It is not the current PREVENT-ASCVD guideline standard and is not Thai-calibrated.
- `Prospective vascular age`: unavailable. No age estimate is synthesized or displayed.
- `Results boundary`: the three-page release keeps HR as the only locally observed video metric. Stiffness index, vascular age, irregular rhythm, ASCVD risk, advice, trend, and BP are shown only as unavailable, manual-input, bounded local, or history context in detail cards; these are not seven validated measurements.

## Privacy and safety boundary

Health data is stored in this browser’s local storage by default. There is no account, analytics, public ranking, automatic messaging, or server model call in this prototype. Web Share is an explicit user-triggered handoff with a preview; it does not create a family account, deliver a message, or synchronize data. Browser notifications are not promised as background delivery.

This is a prototype, not emergency or diagnostic care. Urgent symptoms need appropriate care regardless of a pulse result. No vascular age, SpO₂, disease risk, artery blockage, medication change, or stress diagnosis is inferred from a short phone signal.

## Evidence and provenance

- Reference images: the supplied editorial references are kept local and are not included in this public source snapshot.
- Typeface: official LINE Seed source and license details in [FONT_LICENSE.md](./FONT_LICENSE.md).
- Stiffness Index reference: [PubMed 12241535](https://pubmed.ncbi.nlm.nih.gov/12241535/). The screenshot’s ECG+PPG pulse-arrival example is not repeated as direct PWV.
- 2013 PCE coefficients: [AHA/ACC guideline PDF, Tables A/B pages 37–39](https://www.heart.org/-/media/Data-Import/downloadables/0/D/A/2013-AHA-ACC-Cardiovascular-Risk-Guidelines-UCM_464291.pdf). Current context is the official [PREVENT-ASCVD resource](https://professional.heart.org/en/guidelines-and-statements/prevent-calculator); its terms are not accepted or embedded here.
- Smartphone camera interfaces: [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/), [W3C Web Share](https://www.w3.org/TR/web-share/), and [WebKit Web Push for iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Age research boundary: `Misterbra/ppg-age-benchmark` was inspected read-only at commit `6132dd602f62579886a2224f17e93b6a08e014a0`. Its README describes 906 VitalDB subjects and a best 8.22-year result using Pulse-PPG plus demographics; it is not phone validation. No repository code, model checkpoint, VitalDB segment, or PulseDB download was run. See [research-provenance.md](./research-provenance.md).

## QA

Run `npm test` and `npm run build` for the checked-in automated contract. Physical
iOS/Android recording, installed offline reopen, and device-specific decoder
checks remain outside this source snapshot and are not implied; the release
path is local-video selection.
