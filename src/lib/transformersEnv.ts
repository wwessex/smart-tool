import { env } from "@huggingface/transformers";

/**
 * Local-only model loading (self-hosted).
 * Models must be served from `${import.meta.env.BASE_URL}models/`.
 *
 * This prevents any runtime fetches from Hugging Face or other third-party hosts.
 */
env.allowRemoteModels = false;
env.allowLocalModels = true;

// Subfolder-safe (e.g. /smart-action-tool-webapp/)
env.localModelPath = `${import.meta.env.BASE_URL}models/`;

// Cache downloaded model files in the browser (still local-only)
env.useBrowserCache = true;
