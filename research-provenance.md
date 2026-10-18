# Research provenance and adapter boundary

This file prevents research ideas from being mistaken for live clinical output.

## PPG age benchmark / future adapter

Source: [Misterbra/ppg-age-benchmark](https://github.com/Misterbra/ppg-age-benchmark), inspected read-only at commit `6132dd602f62579886a2224f17e93b6a08e014a0`. Its repository is MIT-licensed, but its README is a work-in-progress preprint benchmark. The described result is on 906 VitalDB subjects with 5-fold CV; the best reported 8.22-year MAE uses Pulse-PPG plus demographics and clinical inputs, not a 30-second phone-camera-only pipeline. It does not ship a fitted Ridge head/scaler or deployment API.

No third-party code was installed or executed, and no checkpoint, VitalDB segment, PulseDB dataset, or download script was run. The repository’s setup would download model weights and VitalDB data; that action would need separate permission and a permissions/licensing review. Its Pulse-PPG loader uses `weights_only=False` for a pickle checkpoint, so this app will not load it automatically. PaPaGei pretraining overlap with VitalDB also needs evaluation before any held-out generalization claim.

If a future research adapter is approved, it must accept an explicit contract: raw timestamped PPG samples in seconds; the model’s exact expected sampling/normalization; actual age/sex/BMI/height/weight and measured BP/lipids where required; provenance and consent; and a held-out evaluation plan. It must never fabricate missing demographics or BP, and it must stay outside live HR, SI, vascular-age, and risk results until validated.

## Stiffness Index

The app’s research-only sample follows the supplied reference and the [PubMed 12241535](https://pubmed.ncbi.nlm.nih.gov/12241535/) concept: height in metres divided by the time between an initial systolic peak and a later reflected/diastolic peak in the same pulse. The sample uses visible landmark timestamps and a synthetic waveform. It is not a live user result, not direct cfPWV, not an age conversion, and not an arterial health classification. The live path is explicitly unavailable because the current camera gate does not retain validated raw morphology landmarks.

## 2013 Pooled Cohort Equations

`src/risk.js` implements the coefficients and natural-log interactions from the official 2013 AHA/ACC Tables A/B. It requires age 40–79, a selected legacy coefficient population, total cholesterol 130–320 mg/dL, HDL 20–100 mg/dL, measured systolic BP 90–200 mmHg, BP treatment, diabetes, smoking, and prior ASCVD status. Prior ASCVD rejects primary-prevention interpretation. It does not map Thai nationality to White coefficients. The published 55-year-old fixture rounds to 2.1%, 3.0%, 5.3%, and 6.1% across the four listed race/sex equations. The UI labels this a legacy educational model and links to the current PREVENT-ASCVD resource without sending inputs to it.
