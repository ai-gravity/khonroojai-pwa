# Experimental uploaded-video model-age path

This folder contains the source-only, opt-in research integration for an
uploaded-video adapter. The public source snapshot does not include model
weights or the browser WASM binaries required to execute them.

The PWA passes one normalized `[R, G, B]` mean from the fixed central 80% ROI
per decoded video frame, using the fixed green channel (`rgbChannel: 1`), the
documented polarity assumption `lower_intensity_is_more_volume`, and the
browser's decoded presentation timestamps and frame count. The adapter is
called with its frozen defaults;
the UI cannot override thresholds or preprocessing configuration.

The path is gated by all of:

- a local build flag (`VITE_ENABLE_EXPERIMENTAL_AGE=true`) after the separate
  model setup in [RESEARCH-MODEL-SETUP.md](../../../RESEARCH-MODEL-SETUP.md);
- an explicit per-session research-consent checkbox;
- `user_uploaded_video_research` provenance and the versioned acquisition
  profile; and
- the adapter's independent model-input eligibility gate.

The numeric output is labeled an experimental model-age estimate, not a
vascular-age measurement. It does not infer health, normality, disease risk,
artery status, age gap, or trend. The model and ONNX Runtime Web WASM assets
are intentionally absent from this public snapshot.

Source model metadata, hashes, and the rights boundary are documented in
[RESEARCH-MODEL-SETUP.md](../../../RESEARCH-MODEL-SETUP.md). This path is not
enabled in the public build and must not be used with patient or human
recordings without a separate authorization and validation review.
