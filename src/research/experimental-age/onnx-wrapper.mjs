/**
 * Client-only ONNX Runtime Web wrapper for the pinned experimental model.
 *
 * The model and its external weight file must be served as local/same-origin
 * static assets. No health-data API or credential path is used here.
 */

import {
  MODEL_INPUT_SHAPE,
  RESEARCH_VIDEO_INPUT_GATE,
  RESEARCH_VIDEO_INPUT_PROVENANCE,
  RESEARCH_VIDEO_PROCESSING_VERSION,
  RESEARCH_VIDEO_PROFILE_ID,
  SYNTHETIC_INPUT_GATE,
  SYNTHETIC_INPUT_PROVENANCE,
} from "./waveform-adapter.mjs";

export const MODEL_PROVENANCE = Object.freeze({
  modelId: "Ngks03/PPG-VascularAge",
  sourceUrl: "https://huggingface.co/Ngks03/PPG-VascularAge",
  pinnedRevision: "611d2e206c5f4838f443f0891e40445a4985ea3e",
  reportedLicense: "MIT",
  licenseNote: "MIT is reported in model-card/API metadata; no separate LICENSE file was present in the pinned repository.",
  onnxArtifact: "vascular_age.onnx",
  onnxSha256: "6f4b466be523ea5e94c917b3d328dded5a6ea7a7519d2aad645a35b673e94e07",
  externalDataArtifact: "vascular_age.onnx.data",
  externalDataSha256: "f0c414c0ef49f06bc9055799dbe046be3db2d4077fee443efa44784b06de8db0",
  modelInput: "averaged single-beat waveform, z-score normalized, [batch,1,100]",
  outputLabel: "experimental AI-PPG model estimate (not validated vascular age)",
});

function flattenWaveform(input) {
  if (input instanceof Float32Array || input instanceof Float64Array) return Array.from(input);
  if (ArrayBuffer.isView(input)) return Array.from(input, Number);
  if (!Array.isArray(input)) return null;
  if (input.length === 100 && input.every((value) => typeof value === "number")) return input.map(Number);
  if (
    input.length === 1
    && Array.isArray(input[0])
    && input[0].length === 1
    && Array.isArray(input[0][0])
    && input[0][0].length === 100
  ) {
    return input[0][0].map(Number);
  }
  return null;
}

export function prepareModelInput(input) {
  let cameFromAdapterResult = false;
  if (input && typeof input === "object" && "valid" in input && "waveform" in input) {
    cameFromAdapterResult = true;
    if (!input.valid || !input.waveform) {
      const upstreamReasons = Array.isArray(input.reasonCodes) ? input.reasonCodes : [];
      return {
        valid: false,
        data: null,
        reasonCodes: ["upstream_adapter_abstained", ...upstreamReasons],
        metadata: { upstreamReasonCodes: upstreamReasons },
      };
    }
    const adapterMetadata = input.metadata ?? {};
    const syntheticContract = adapterMetadata.inputGate === SYNTHETIC_INPUT_GATE
      && adapterMetadata.inputProvenance === SYNTHETIC_INPUT_PROVENANCE;
    const researchContract = adapterMetadata.inputGate === RESEARCH_VIDEO_INPUT_GATE
      && adapterMetadata.inputProvenance === RESEARCH_VIDEO_INPUT_PROVENANCE;
    if (!syntheticContract && !researchContract) {
      return {
        valid: false,
        data: null,
        reasonCodes: ["input_provenance_gate"],
        metadata: {
          inputGate: adapterMetadata.inputGate ?? null,
          inputProvenance: adapterMetadata.inputProvenance ?? null,
        },
      };
    }
    if (researchContract && (
      adapterMetadata.consentConfirmed !== true
      || adapterMetadata.acquisitionProfileId !== RESEARCH_VIDEO_PROFILE_ID
      || adapterMetadata.processingVersion !== RESEARCH_VIDEO_PROCESSING_VERSION
    )) {
      return {
        valid: false,
        data: null,
        reasonCodes: ["research_video_contract_required"],
        metadata: {
          consentConfirmed: adapterMetadata.consentConfirmed ?? false,
          acquisitionProfileId: adapterMetadata.acquisitionProfileId ?? null,
          processingVersion: adapterMetadata.processingVersion ?? null,
        },
      };
    }
    if (adapterMetadata.modelInputEligible !== true) {
      const eligibilityReasons = Array.isArray(adapterMetadata.modelInputEligibilityReasonCodes)
        ? adapterMetadata.modelInputEligibilityReasonCodes
        : ["model_input_quality_gate"];
      return {
        valid: false,
        data: null,
        reasonCodes: ["model_input_quality_gate", ...eligibilityReasons],
        metadata: {
          modelInputEligible: false,
          modelInputEligibilityReasonCodes: eligibilityReasons,
          primaryPeakPhaseFractionMin: adapterMetadata.primaryPeakPhaseFractionMin ?? null,
          primaryPeakPhaseFractionMax: adapterMetadata.primaryPeakPhaseFractionMax ?? null,
        },
      };
    }
    input = input.waveform;
  }
  const values = flattenWaveform(input);
  if (!values || values.length !== 100) {
    return { valid: false, data: null, reasonCodes: ["waveform_shape_mismatch"], metadata: {} };
  }
  if (values.some((value) => !Number.isFinite(value))) {
    return { valid: false, data: null, reasonCodes: ["waveform_nonfinite"], metadata: {} };
  }
  const mean = values.reduce((sum, value) => sum + value, 0.0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0.0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  if (maxValue - minValue <= 1e-8 || standardDeviation <= 1e-8) {
    return {
      valid: false,
      data: null,
      reasonCodes: ["waveform_constant"],
      metadata: { mean, standardDeviation },
    };
  }
  if (!cameFromAdapterResult) {
    return {
      valid: false,
      data: null,
      reasonCodes: ["adapter_metadata_required"],
      metadata: { sourceShape: [...MODEL_INPUT_SHAPE] },
    };
  }
  const normalized = new Float32Array(values.map((value) => (value - mean) / standardDeviation));
  return {
    valid: true,
    data: normalized,
    reasonCodes: [],
    metadata: {
      sourceShape: [...MODEL_INPUT_SHAPE],
      normalizedShape: [...MODEL_INPUT_SHAPE],
      inputMeanBeforeZscore: mean,
      inputStdBeforeZscore: standardDeviation,
      inputMin: minValue,
      inputMax: maxValue,
    },
  };
}

function assertLocalModelUrl(modelUrl) {
  if (typeof window === "undefined" || typeof window.location === "undefined") return;
  const resolved = new URL(modelUrl, window.location.href);
  if (resolved.origin !== window.location.origin) {
    throw new Error("model_url_must_be_same_origin");
  }
}

export async function createExperimentalOnnxSession({
  modelUrl = "./vascular_age.onnx",
  externalData,
  externalDataPath = "vascular_age.onnx.data",
  wasmPaths,
  ortModule,
  sessionOptions = {},
} = {}) {
  assertLocalModelUrl(modelUrl);
  const ort = ortModule ?? await import("./ort.wasm.bundle.min.mjs");
  if (wasmPaths !== undefined) ort.env.wasm.wasmPaths = wasmPaths;
  let resolvedExternalData = externalData;
  if (resolvedExternalData === undefined && typeof window !== "undefined" && typeof window.location !== "undefined") {
    const modelAbsoluteUrl = new URL(modelUrl, window.location.href);
    resolvedExternalData = [{
      path: externalDataPath,
      data: new URL(externalDataPath, modelAbsoluteUrl).href,
    }];
  }
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
    ...(resolvedExternalData === undefined ? {} : { externalData: resolvedExternalData }),
    ...sessionOptions,
  });
  return {
    ort,
    session,
    modelUrl,
    externalDataPath: resolvedExternalData ? externalDataPath : null,
    inputName: session.inputNames?.[0] ?? "ppg",
    outputName: session.outputNames?.[0] ?? "vascular_age",
    provenance: MODEL_PROVENANCE,
  };
}

export async function predictExperimentalEstimate(
  sessionHandle,
  input,
  { inputName, outputName } = {},
) {
  const prepared = prepareModelInput(input);
  if (!prepared.valid) {
    return {
      status: "abstained",
      experimental: true,
      label: MODEL_PROVENANCE.outputLabel,
      value: null,
      reasonCodes: prepared.reasonCodes,
      metadata: prepared.metadata,
      provenance: MODEL_PROVENANCE,
    };
  }
  if (!sessionHandle?.session || !sessionHandle?.ort?.Tensor) {
    return {
      status: "abstained",
      experimental: true,
      label: MODEL_PROVENANCE.outputLabel,
      value: null,
      reasonCodes: ["onnx_runtime_unavailable"],
      metadata: prepared.metadata,
      provenance: MODEL_PROVENANCE,
    };
  }
  const resolvedInputName = inputName ?? sessionHandle.inputName ?? "ppg";
  const resolvedOutputName = outputName ?? sessionHandle.outputName ?? "vascular_age";
  try {
    const tensor = new sessionHandle.ort.Tensor("float32", prepared.data, MODEL_INPUT_SHAPE);
    const outputs = await sessionHandle.session.run({ [resolvedInputName]: tensor });
    const output = outputs[resolvedOutputName] ?? outputs[Object.keys(outputs)[0]];
    const outputValues = output?.data ? Array.from(output.data, Number) : [];
    if (outputValues.length !== 1 || !Number.isFinite(outputValues[0])) {
      return {
        status: "abstained",
        experimental: true,
        label: MODEL_PROVENANCE.outputLabel,
        value: null,
        reasonCodes: ["model_output_invalid"],
        metadata: { ...prepared.metadata, outputShape: output?.dims ?? null },
        provenance: MODEL_PROVENANCE,
      };
    }
    return {
      status: "ok",
      experimental: true,
      label: MODEL_PROVENANCE.outputLabel,
      value: outputValues[0],
      reasonCodes: [],
      metadata: {
        ...prepared.metadata,
        outputShape: output?.dims ?? [1, 1],
        inputName: resolvedInputName,
        outputName: resolvedOutputName,
      },
      provenance: MODEL_PROVENANCE,
    };
  } catch (error) {
    return {
      status: "abstained",
      experimental: true,
      label: MODEL_PROVENANCE.outputLabel,
      value: null,
      reasonCodes: ["onnx_inference_failed"],
      metadata: {
        ...prepared.metadata,
        error: error instanceof Error ? error.message : String(error),
      },
      provenance: MODEL_PROVENANCE,
    };
  }
}
