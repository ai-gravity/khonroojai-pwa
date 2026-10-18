# Optional experimental model setup

The public source snapshot intentionally does **not** redistribute the
experimental ONNX model or its external data file. The model card reports MIT
metadata, but no separate repository `LICENSE` file was present at the pinned
revision; redistribution rights therefore remain unresolved for this project.

The default demo and its normal checks do not need these files:

```bash
npm install
npm test
npm run build
```

Only after the organizer's rules, model rights, and the intended test scope are
confirmed may a maintainer provision the exact pinned artifacts locally from
the model source:

- Source: https://huggingface.co/Ngks03/PPG-VascularAge
- Pinned revision: `611d2e206c5f4838f443f0891e40445a4985ea3e`
- `public/research/age/vascular_age.onnx` SHA-256:
  `6f4b466be523ea5e94c917b3d328dded5a6ea7a7519d2aad645a35b673e94e07`
- `public/research/age/vascular_age.onnx.data` SHA-256:
  `f0c414c0ef49f06bc9055799dbe046be3db2d4077fee443efa44784b06de8db0`

The authorized local setup must also provide the matching ONNX Runtime Web WASM
assets described by the research adapter documentation. Then, and only for
synthetic QA or an explicitly approved research run, a maintainer may use
`VITE_ENABLE_EXPERIMENTAL_AGE=true npm run build`.

This computation is not a validated vascular-age measurement, diagnosis,
normality result, risk estimate, or treatment recommendation. Do not upload
patient recordings, add credentials, or commit the model files to this public
repository.
