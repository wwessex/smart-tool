import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_INTERNAL_PORT = 43118;
export const DEFAULT_MODEL_ID = "smart-tool-planner-gguf-v1";
export const DEFAULT_MANIFEST_PATH = (() => {
  try {
    const manifestUrl = new URL("../desktop-accelerator.manifest.json", import.meta.url);
    if (manifestUrl.protocol === "file:") {
      return fileURLToPath(manifestUrl);
    }
  } catch {
    // Vitest can evaluate this module under a synthetic URL, so fall back to cwd-relative lookup.
  }

  return path.resolve(process.cwd(), "desktop-helper", "desktop-accelerator.manifest.json");
})();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseCommaList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseArgs(value) {
  return (value || "")
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"|"$/g, "")) || [];
}

export function getDefaultAppDataDir(platform = process.platform) {
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Smart Tool", "Desktop Helper");
  }
  if (platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "Smart Tool",
      "Desktop Helper",
    );
  }
  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "smart-tool",
    "desktop-helper",
  );
}

export function createError(statusCode, payload) {
  const error = new Error(payload?.message || payload?.error || "Request failed");
  error.statusCode = statusCode;
  error.payload = payload;
  return error;
}

function normalizeSha256(value) {
  return String(value || "")
    .trim()
    .replace(/^sha256:/i, "")
    .replace(/^"|"$/g, "")
    .toLowerCase();
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueNumbers(values) {
  return values.filter((value, index, list) => list.indexOf(value) === index);
}

function parseManifest(rawManifest, manifestPath) {
  if (!rawManifest || typeof rawManifest !== "object") {
    throw new Error(`Desktop accelerator manifest at ${manifestPath} must be a JSON object.`);
  }

  if (!Array.isArray(rawManifest.models) || rawManifest.models.length === 0) {
    throw new Error(`Desktop accelerator manifest at ${manifestPath} must include at least one model.`);
  }

  const models = rawManifest.models.map((model) => {
    if (!model || typeof model !== "object") {
      throw new Error(`Desktop accelerator manifest at ${manifestPath} contains an invalid model entry.`);
    }
    if (typeof model.id !== "string" || !model.id.trim()) {
      throw new Error(`Desktop accelerator manifest at ${manifestPath} contains a model without an id.`);
    }
    return {
      ...model,
      id: model.id.trim(),
      filename: typeof model.filename === "string" && model.filename.trim()
        ? model.filename.trim()
        : `${model.id.trim()}.gguf`,
      download_url: typeof model.download_url === "string" && model.download_url.trim()
        ? model.download_url.trim()
        : null,
      sha256: normalizeSha256(model.sha256),
      size_bytes: numberOrNull(model.size_bytes),
      context_size: numberOrNull(model.context_size),
      runtime: model.runtime && typeof model.runtime === "object" ? model.runtime : {},
    };
  });

  const duplicateIds = models.filter(
    (model, index, list) => list.findIndex((candidate) => candidate.id === model.id) !== index,
  );
  if (duplicateIds.length > 0) {
    throw new Error(`Desktop accelerator manifest at ${manifestPath} contains duplicate model ids.`);
  }

  const defaultModelId = typeof rawManifest.default_model_id === "string" && rawManifest.default_model_id.trim()
    ? rawManifest.default_model_id.trim()
    : models[0].id;

  if (!models.some((model) => model.id === defaultModelId)) {
    throw new Error(
      `Desktop accelerator manifest at ${manifestPath} references missing default model ${defaultModelId}.`,
    );
  }

  return {
    version: numberOrNull(rawManifest.version) || 1,
    default_model_id: defaultModelId,
    models,
  };
}

function applyManifestOverrides(manifest, options = {}) {
  const targetModelId = options.defaultModelId
    || process.env.SMART_TOOL_HELPER_MODEL_ID
    || manifest.default_model_id;
  const modelUrlOverride = options.modelUrlOverride || process.env.SMART_TOOL_HELPER_MODEL_URL;
  const modelShaOverride = normalizeSha256(
    options.modelSha256Override || process.env.SMART_TOOL_HELPER_MODEL_SHA256,
  );
  const modelSizeOverride = numberOrNull(
    options.modelSizeBytesOverride || process.env.SMART_TOOL_HELPER_MODEL_SIZE_BYTES,
  );
  const filenameOverride = options.filenameOverride || process.env.SMART_TOOL_HELPER_MODEL_FILENAME;

  if (!modelUrlOverride && !modelShaOverride && modelSizeOverride == null && !filenameOverride) {
    return manifest;
  }

  return {
    ...manifest,
    models: manifest.models.map((model) => {
      if (model.id !== targetModelId) return model;
      return {
        ...model,
        download_url: modelUrlOverride || model.download_url,
        sha256: modelShaOverride || model.sha256,
        size_bytes: modelSizeOverride ?? model.size_bytes,
        filename: filenameOverride || model.filename,
      };
    }),
  };
}

export function loadDesktopAcceleratorManifest(options = {}) {
  const manifestPath = options.manifestPath || process.env.SMART_TOOL_HELPER_MANIFEST_PATH || DEFAULT_MANIFEST_PATH;
  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  return applyManifestOverrides(parseManifest(raw, manifestPath), options);
}

async function sha256File(targetPath) {
  const hash = createHash("sha256");
  const handle = await fs.open(targetPath, "r");

  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

function createTelemetry(telemetry) {
  const noop = () => undefined;

  if (!telemetry) {
    return {
      info: (...args) => console.info("[desktop-accelerator]", ...args),
      warn: (...args) => console.warn("[desktop-accelerator]", ...args),
      error: (...args) => console.error("[desktop-accelerator]", ...args),
    };
  }

  return {
    info: telemetry.info || telemetry.log || noop,
    warn: telemetry.warn || telemetry.log || noop,
    error: telemetry.error || telemetry.log || noop,
  };
}

function defaultState(message) {
  return {
    ok: false,
    status: "not-installed",
    ready: false,
    backend: null,
    model_id: null,
    message,
  };
}

export class DesktopAcceleratorHost {
  constructor(options = {}) {
    this.host = options.host || DEFAULT_HOST;
    this.internalPort = options.internalPort || DEFAULT_INTERNAL_PORT;
    this.platform = options.platform || process.platform;
    this.arch = options.arch || process.arch;
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.spawnImpl = options.spawnImpl || spawn;
    this.sleepImpl = options.sleepImpl || sleep;
    this.telemetry = createTelemetry(options.telemetry);
    this.manifest = options.manifest || loadDesktopAcceleratorManifest(options);
    this.defaultModelId = options.defaultModelId || this.manifest.default_model_id || DEFAULT_MODEL_ID;
    this.modelRegistry = new Map(this.manifest.models.map((model) => [model.id, model]));
    this.modelDir = options.modelDir
      || process.env.SMART_TOOL_HELPER_MODEL_DIR
      || path.join(getDefaultAppDataDir(this.platform), "models");
    this.llamaServerBin = options.llamaServerBin || process.env.SMART_TOOL_LLAMA_SERVER_BIN || "llama-server";
    this.threads = numberOrNull(options.threads || process.env.SMART_TOOL_HELPER_THREADS)
      || Math.max(1, (os.availableParallelism?.() || 4) - 1);
    this.contextSizeOverride = numberOrNull(options.contextSize || process.env.SMART_TOOL_HELPER_CTX);
    this.gpuLayersOverride = numberOrNull(options.gpuLayers || process.env.SMART_TOOL_HELPER_GPU_LAYERS);
    this.extraArgs = options.extraArgs || parseArgs(process.env.SMART_TOOL_LLAMA_SERVER_ARGS);
    this.pollIntervalMs = options.pollIntervalMs || 250;
    this.readyTimeoutMs = options.readyTimeoutMs || 30_000;
    this.state = defaultState("Desktop Accelerator is not configured.");
    this.child = null;
    this.stdoutTail = [];
    this.stderrTail = [];
    this.loadPromise = null;
    this.downloadPromise = null;
    this.lastGpuLayers = 0;
  }

  resolveModel(modelId = this.defaultModelId) {
    const model = this.modelRegistry.get(modelId);
    if (!model) {
      throw createError(503, {
        ok: false,
        status: "not-installed",
        ready: false,
        message: `No model manifest entry configured for ${modelId}.`,
      });
    }
    return model;
  }

  configurationError(modelId = this.state.model_id || this.defaultModelId) {
    try {
      const model = this.resolveModel(modelId);
      if (!this.fetchImpl) {
        return "Desktop Accelerator requires fetch support in this runtime.";
      }
      if (!model.download_url) {
        return `No download URL configured for ${model.id}.`;
      }
      return null;
    } catch (error) {
      return error?.payload?.message || error.message || "Desktop Accelerator is not configured.";
    }
  }

  runtimeSettingsFor(modelId = this.defaultModelId) {
    const model = this.resolveModel(modelId);
    const runtime = model.runtime && typeof model.runtime === "object" ? model.runtime : {};
    const platformOverrides = runtime.platform_overrides && typeof runtime.platform_overrides === "object"
      ? runtime.platform_overrides
      : {};
    const platformKey = `${this.platform}-${this.arch}`;
    return {
      ...runtime,
      ...(platformOverrides[platformKey] || {}),
    };
  }

  contextSizeFor(modelId = this.defaultModelId) {
    if (this.contextSizeOverride != null) return this.contextSizeOverride;
    const model = this.resolveModel(modelId);
    return model.context_size || this.runtimeSettingsFor(modelId).context_size || 4096;
  }

  gpuLayersFor(modelId = this.defaultModelId) {
    if (this.gpuLayersOverride != null) return Math.max(0, this.gpuLayersOverride);
    const runtime = this.runtimeSettingsFor(modelId);
    return Math.max(0, numberOrNull(runtime.gpu_layers) || 0);
  }

  backendLabelFor(gpuLayers) {
    return gpuLayers > 0 ? "llama.cpp-gpu" : "llama.cpp-cpu";
  }

  health() {
    const modelId = this.state.model_id || this.defaultModelId;
    const configError = this.configurationError(modelId);

    if (configError && this.state.status !== "ready") {
      return {
        ok: false,
        status: "not-installed",
        ready: false,
        backend: null,
        model_id: modelId,
        message: configError,
      };
    }

    if (!this.child && this.state.status === "ready") {
      return {
        ok: false,
        status: "warming-up",
        ready: false,
        backend: this.state.backend || this.backendLabelFor(this.lastGpuLayers),
        model_id: modelId,
        message: "Desktop Accelerator is idle. Call /load to warm it up again.",
      };
    }

    return {
      ok: this.state.ready,
      status: this.state.status,
      ready: this.state.ready,
      backend: this.state.backend,
      model_id: this.state.model_id,
      message: this.state.message,
    };
  }

  modelPathFor(modelId = this.defaultModelId) {
    const model = this.resolveModel(modelId);
    return path.join(this.modelDir, model.filename || `${model.id}.gguf`);
  }

  async validateModelFile(targetPath, model) {
    if (!existsSync(targetPath)) return false;

    if (model.size_bytes != null) {
      const stats = await fs.stat(targetPath);
      if (stats.size !== model.size_bytes) return false;
    }

    if (model.sha256) {
      const actualSha = await sha256File(targetPath);
      if (actualSha !== model.sha256) return false;
    }

    return true;
  }

  async ensureModel(modelId = this.defaultModelId) {
    const model = this.resolveModel(modelId);
    const modelPath = this.modelPathFor(modelId);

    if (await this.validateModelFile(modelPath, model)) {
      return modelPath;
    }

    await fs.rm(modelPath, { force: true }).catch(() => undefined);

    if (!this.downloadPromise) {
      this.state = {
        ok: false,
        status: "downloading-model",
        ready: false,
        backend: this.backendLabelFor(this.gpuLayersFor(modelId)),
        model_id: modelId,
        message: "Downloading planner model to local app data.",
      };
      this.telemetry.info("model download started", { modelId, targetPath: modelPath });
      this.downloadPromise = this.downloadModel(model, modelPath)
        .then(async () => {
          this.telemetry.info("model download finished", { modelId, targetPath: modelPath });
        })
        .catch((error) => {
          this.telemetry.error("model download failed", { modelId, message: error.message || String(error) });
          throw error;
        })
        .finally(() => {
          this.downloadPromise = null;
        });
    }

    await this.downloadPromise;
    return modelPath;
  }

  async downloadModel(model, targetPath) {
    const response = await this.fetchImpl(model.download_url);
    if (!response.ok || !response.body) {
      throw createError(502, {
        ok: false,
        status: "error",
        ready: false,
        message: `Model download failed (${response.status}).`,
      });
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.part`;
    await fs.rm(tempPath, { force: true }).catch(() => undefined);

    const source = Readable.fromWeb(response.body);
    const destination = createWriteStream(tempPath);
    await pipeline(source, destination);

    if (!(await this.validateModelFile(tempPath, model))) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw createError(502, {
        ok: false,
        status: "error",
        ready: false,
        message: "Downloaded model failed checksum or size validation.",
      });
    }

    await fs.rename(tempPath, targetPath);
  }

  async waitForInternalReady(timeoutMs = this.readyTimeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const response = await this.fetchImpl(`http://${this.host}:${this.internalPort}/health`);
        if (response.ok) return;
      } catch {
        // Keep polling while llama.cpp warms up.
      }
      await this.sleepImpl(this.pollIntervalMs);
    }

    throw new Error(
      this.stderrTail.at(-1)
      || this.stdoutTail.at(-1)
      || "llama.cpp server did not become ready in time.",
    );
  }

  async stopProcess() {
    if (!this.child) return;

    const child = this.child;
    this.child = null;

    child.kill?.("SIGTERM");

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill?.("SIGKILL");
      }, 2_000);

      child.once?.("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  attachChildProcess(child, modelId, gpuLayers) {
    child.stdout?.on?.("data", (chunk) => {
      this.stdoutTail.push(String(chunk).trim());
      if (this.stdoutTail.length > 20) this.stdoutTail.shift();
    });
    child.stderr?.on?.("data", (chunk) => {
      this.stderrTail.push(String(chunk).trim());
      if (this.stderrTail.length > 20) this.stderrTail.shift();
    });
    child.once?.("exit", (code) => {
      if (this.child === child) {
        this.child = null;
        this.state = {
          ok: false,
          status: "error",
          ready: false,
          backend: this.backendLabelFor(gpuLayers),
          model_id: modelId,
          message: `llama.cpp exited with code ${code ?? "unknown"}.`,
        };
        this.telemetry.error("runtime exited", { modelId, code, backend: this.state.backend });
      }
    });
  }

  spawnServerProcess(modelPath, modelId, gpuLayers) {
    const args = [
      "--host", this.host,
      "--port", String(this.internalPort),
      "-m", modelPath,
      "-c", String(this.contextSizeFor(modelId)),
      "-t", String(this.threads),
      "-ngl", String(gpuLayers),
      ...this.extraArgs,
    ];

    const child = this.spawnImpl(this.llamaServerBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    this.child = child;
    this.lastGpuLayers = gpuLayers;
    this.attachChildProcess(child, modelId, gpuLayers);

    return child;
  }

  async startServer(modelPath, modelId) {
    await this.stopProcess();
    this.stdoutTail = [];
    this.stderrTail = [];

    const requestedGpuLayers = this.gpuLayersFor(modelId);
    const attempts = uniqueNumbers(requestedGpuLayers > 0 ? [requestedGpuLayers, 0] : [0]);
    let lastError = null;

    for (const gpuLayers of attempts) {
      const startedAt = Date.now();
      this.state = {
        ok: false,
        status: "warming-up",
        ready: false,
        backend: this.backendLabelFor(gpuLayers),
        model_id: modelId,
        message: "Starting Desktop Accelerator runtime.",
      };
      this.telemetry.info("runtime warm-up started", {
        modelId,
        backend: this.backendLabelFor(gpuLayers),
        gpuLayers,
      });

      this.spawnServerProcess(modelPath, modelId, gpuLayers);

      try {
        await this.waitForInternalReady();
        this.telemetry.info("runtime warm-up finished", {
          modelId,
          backend: this.backendLabelFor(gpuLayers),
          gpuLayers,
          timeMs: Date.now() - startedAt,
        });
        return {
          backend: this.backendLabelFor(gpuLayers),
          gpuLayers,
        };
      } catch (error) {
        lastError = error;
        this.telemetry.warn("runtime warm-up failed", {
          modelId,
          backend: this.backendLabelFor(gpuLayers),
          gpuLayers,
          message: error.message || String(error),
        });
        await this.stopProcess();
        if (gpuLayers === 0) break;
      }
    }

    throw lastError || new Error("Desktop Accelerator failed to start.");
  }

  async load(modelId = this.defaultModelId) {
    if (this.loadPromise) return this.loadPromise;
    if (this.child && this.state.ready && this.state.model_id === modelId) {
      return this.health();
    }

    this.loadPromise = (async () => {
      try {
        const configError = this.configurationError(modelId);
        if (configError) {
          throw createError(503, {
            ok: false,
            status: "not-installed",
            ready: false,
            message: configError,
          });
        }

        const modelPath = await this.ensureModel(modelId);
        const runtime = await this.startServer(modelPath, modelId);
        this.state = {
          ok: true,
          status: "ready",
          ready: true,
          backend: runtime.backend,
          model_id: modelId,
          message: "Desktop Accelerator is ready.",
        };
        return this.health();
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  async generate(prompt, config = {}) {
    if (!this.child || !this.state.ready) {
      throw createError(503, {
        error: "Desktop Accelerator is not ready. Call /load first.",
      });
    }

    const start = Date.now();
    const response = await this.fetchImpl(`http://${this.host}:${this.internalPort}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        prompt,
        stream: false,
        n_predict: Number(config.max_new_tokens || 320),
        temperature: Number(config.temperature ?? 0),
        top_p: Number(config.top_p ?? 1),
        repeat_penalty: Number(config.repetition_penalty ?? 1.1),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw createError(502, { error: text || `llama.cpp request failed (${response.status})` });
    }

    const payload = await response.json();
    return {
      text: payload.content || payload.response || "",
      tokens_generated: Number(payload.tokens_predicted ?? payload.tokens_evaluated ?? 0),
      time_ms: Date.now() - start,
      backend: this.state.backend || this.backendLabelFor(this.lastGpuLayers),
    };
  }

  async unload() {
    await this.stopProcess();
    this.state = {
      ok: false,
      status: this.configurationError() ? "not-installed" : "warming-up",
      ready: false,
      backend: this.backendLabelFor(this.lastGpuLayers),
      model_id: this.state.model_id || this.defaultModelId,
      message: this.configurationError() || "Desktop Accelerator unloaded. Call /load to warm it up again.",
    };
    this.telemetry.info("runtime unloaded", {
      modelId: this.state.model_id,
      backend: this.state.backend,
    });
    return { ok: true };
  }
}

export function createDesktopAcceleratorHost(options = {}) {
  return new DesktopAcceleratorHost(options);
}

export { DesktopAcceleratorHost as LlamaCppEngine };
