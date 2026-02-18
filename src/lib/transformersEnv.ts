import { env } from "@huggingface/transformers";

/**
 * Lazy-load model configuration.
 *
 * Models are NOT bundled with the application. Instead they are downloaded
 * from the Hugging Face Hub on first use and cached in the browser via
 * CacheStorage + IndexedDB so subsequent loads are instant.
 *
 * If a local copy happens to exist at `${BASE_URL}models/` it will be
 * preferred (allowLocalModels), but the default path is a remote fetch.
 */
env.allowRemoteModels = true;
env.allowLocalModels = true;

// Subfolder-safe (e.g. /smart-action-tool-webapp/)
env.localModelPath = `${import.meta.env.BASE_URL}models/`;

// Cache downloaded model files in the browser for offline reuse
env.useBrowserCache = true;
