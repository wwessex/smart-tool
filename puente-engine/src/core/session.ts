/**
 * ONNX Runtime Web session management.
 *
 * Wraps InferenceSession creation, inference execution, and disposal.
 * Maps Puente Engine backend types to ONNX Runtime execution providers.
 */

import * as ort from "onnxruntime-web";
import type { InferenceBackend, SessionOptions } from "./types.js";

/**
 * Map a Puente InferenceBackend to an ONNX Runtime execution provider name.
 */
export function getExecutionProvider(backend: InferenceBackend): string {
  switch (backend) {
    case "webgpu":
      return "webgpu";
    case "wasm-simd":
    case "wasm-basic":
    default:
      return "wasm";
  }
}

/**
 * Create an ONNX Runtime InferenceSession from model data.
 *
 * @param modelData - Model weights as ArrayBuffer or Uint8Array
 * @param options - Session creation options
 * @returns The created InferenceSession
 */
export async function createSession(
  modelData: ArrayBuffer | Uint8Array,
  options: SessionOptions
): Promise<ort.InferenceSession> {
  const sessionOptions: ort.InferenceSession.SessionOptions = {
    executionProviders: [options.executionProvider],
    graphOptimizationLevel: options.graphOptimizationLevel ?? "all",
  };

  const buffer =
    modelData instanceof Uint8Array ? modelData.buffer : modelData;

  return ort.InferenceSession.create(buffer, sessionOptions);
}

/**
 * Run inference on a session with the given input feeds.
 *
 * @param session - The ONNX InferenceSession
 * @param feeds - Input tensor map
 * @param outputNames - Optional list of output names to fetch (fetches all if omitted)
 * @returns Map of output name → Tensor
 */
export async function runSession(
  session: ort.InferenceSession,
  feeds: Record<string, ort.Tensor>,
  outputNames?: string[]
): Promise<ort.InferenceSession.OnnxValueMapType> {
  if (outputNames) {
    return session.run(feeds, outputNames);
  }
  return session.run(feeds);
}

/**
 * Release an InferenceSession's resources.
 */
export async function disposeSession(
  session: ort.InferenceSession
): Promise<void> {
  await session.release();
}

/**
 * Get the input names declared by a session.
 */
export function getInputNames(session: ort.InferenceSession): readonly string[] {
  return session.inputNames;
}

/**
 * Get the output names declared by a session.
 */
export function getOutputNames(session: ort.InferenceSession): readonly string[] {
  return session.outputNames;
}
