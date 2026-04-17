import http from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 43117;
const DEFAULT_INTERNAL_PORT = 43118;
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:8080", "https://wwessex.github.io"];
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MODEL_ID = "smart-tool-planner-gguf-v1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCommaList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(value) {
  return (value || "")
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"|"$/g, "")) || [];
}

function getDefaultAppDataDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Smart Tool", "Desktop Helper");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Smart Tool", "Desktop Helper");
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "smart-tool", "desktop-helper");
}

function withCors(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: "Origin",
  };
}

function sendJson(res, statusCode, payload, origin, allowedOrigins) {
  res.writeHead(statusCode, {
    ...JSON_HEADERS,
    ...withCors(origin, allowedOrigins),
  });
  res.end(JSON.stringify(payload));
}

function createError(statusCode, payload) {
  const error = new Error(payload?.message || payload?.error || "Request failed");
  error.statusCode = statusCode;
  error.payload = payload;
  return error;
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw createError(415, { error: "Requests must use application/json." });
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    const size = chunks.reduce((sum, part) => sum + part.length, 0);
    if (size > 1_000_000) {
      throw createError(413, { error: "Request body too large." });
    }
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw createError(400, { error: "Invalid JSON body." });
  }
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Model download failed (${response.status})`);
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.part`;
  const source = Readable.fromWeb(response.body);
  const destination = (await import("node:fs")).createWriteStream(tempPath);
  await pipeline(source, destination);
  await fs.rename(tempPath, targetPath);
}

export class LlamaCppEngine {
  constructor(options = {}) {
    this.host = options.host || DEFAULT_HOST;
    this.internalPort = options.internalPort || DEFAULT_INTERNAL_PORT;
    this.modelDir = options.modelDir || process.env.SMART_TOOL_HELPER_MODEL_DIR || path.join(getDefaultAppDataDir(), "models");
    this.modelUrls = options.modelUrls || {
      [MODEL_ID]: process.env.SMART_TOOL_HELPER_MODEL_URL || null,
    };
    this.llamaServerBin = options.llamaServerBin || process.env.SMART_TOOL_LLAMA_SERVER_BIN || "llama-server";
    this.threads = Number(options.threads || process.env.SMART_TOOL_HELPER_THREADS || Math.max(1, (os.availableParallelism?.() || 4) - 1));
    this.contextSize = Number(options.contextSize || process.env.SMART_TOOL_HELPER_CTX || 4096);
    this.gpuLayers = Number(options.gpuLayers || process.env.SMART_TOOL_HELPER_GPU_LAYERS || 0);
    this.extraArgs = options.extraArgs || parseArgs(process.env.SMART_TOOL_LLAMA_SERVER_ARGS);
    this.backend = options.backend || (this.gpuLayers > 0 ? "llama.cpp-gpu" : "llama.cpp-cpu");
    this.state = {
      ok: false,
      status: "not-installed",
      ready: false,
      backend: null,
      model_id: null,
      message: "Desktop Accelerator is not configured.",
    };
    this.child = null;
    this.stdoutTail = [];
    this.stderrTail = [];
    this.loadPromise = null;
    this.downloadPromise = null;
  }

  configurationError() {
    const configuredUrl = this.modelUrls[MODEL_ID];
    if (!configuredUrl) {
      return "Set SMART_TOOL_HELPER_MODEL_URL to enable Desktop Accelerator model download.";
    }
    return null;
  }

  health() {
    const configError = this.configurationError();
    if (configError && this.state.status !== "ready") {
      return {
        ok: false,
        status: "not-installed",
        ready: false,
        backend: null,
        model_id: null,
        message: configError,
      };
    }

    if (!this.child && this.state.status === "ready") {
      return {
        ok: false,
        status: "warming-up",
        ready: false,
        backend: this.backend,
        model_id: this.state.model_id,
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

  modelPathFor(modelId) {
    return path.join(this.modelDir, `${modelId}.gguf`);
  }

  async ensureModel(modelId) {
    const modelPath = this.modelPathFor(modelId);
    if (existsSync(modelPath)) return modelPath;

    const modelUrl = this.modelUrls[modelId];
    if (!modelUrl) {
      throw createError(503, {
        ok: false,
        status: "not-installed",
        ready: false,
        message: `No model URL configured for ${modelId}.`,
      });
    }

    if (!this.downloadPromise) {
      this.state = {
        ok: false,
        status: "downloading-model",
        ready: false,
        backend: this.backend,
        model_id: modelId,
        message: "Downloading planner model to local app data.",
      };
      this.downloadPromise = downloadFile(modelUrl, modelPath).finally(() => {
        this.downloadPromise = null;
      });
    }

    await this.downloadPromise;
    return modelPath;
  }

  async waitForInternalReady(timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://${this.host}:${this.internalPort}/health`);
        if (response.ok) return;
      } catch {
        // keep polling while the process warms up
      }
      await sleep(250);
    }

    throw new Error(this.stderrTail.at(-1) || this.stdoutTail.at(-1) || "llama.cpp server did not become ready in time.");
  }

  async stopProcess() {
    if (!this.child) return;

    const child = this.child;
    this.child = null;
    child.kill("SIGTERM");

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 2_000);

      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async startServer(modelPath, modelId) {
    await this.stopProcess();

    this.stdoutTail = [];
    this.stderrTail = [];

    const args = [
      "--host", this.host,
      "--port", String(this.internalPort),
      "-m", modelPath,
      "-c", String(this.contextSize),
      "-t", String(this.threads),
      "-ngl", String(this.gpuLayers),
      ...this.extraArgs,
    ];

    const child = spawn(this.llamaServerBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    child.stdout?.on("data", (chunk) => {
      this.stdoutTail.push(String(chunk).trim());
      if (this.stdoutTail.length > 20) this.stdoutTail.shift();
    });
    child.stderr?.on("data", (chunk) => {
      this.stderrTail.push(String(chunk).trim());
      if (this.stderrTail.length > 20) this.stderrTail.shift();
    });
    child.once("exit", (code) => {
      if (this.child === child) {
        this.child = null;
        this.state = {
          ok: false,
          status: "error",
          ready: false,
          backend: this.backend,
          model_id: modelId,
          message: `llama.cpp exited with code ${code ?? "unknown"}.`,
        };
      }
    });

    this.child = child;
    await this.waitForInternalReady();
  }

  async load(modelId) {
    if (this.loadPromise) return this.loadPromise;
    if (this.child && this.state.ready && this.state.model_id === modelId) {
      return this.health();
    }

    this.loadPromise = (async () => {
      try {
        const configError = this.configurationError();
        if (configError) {
          throw createError(503, {
            ok: false,
            status: "not-installed",
            ready: false,
            message: configError,
          });
        }

        const modelPath = await this.ensureModel(modelId);
        this.state = {
          ok: false,
          status: "warming-up",
          ready: false,
          backend: this.backend,
          model_id: modelId,
          message: "Starting Desktop Accelerator runtime.",
        };
        await this.startServer(modelPath, modelId);
        this.state = {
          ok: true,
          status: "ready",
          ready: true,
          backend: this.backend,
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
    const response = await fetch(`http://${this.host}:${this.internalPort}/completion`, {
      method: "POST",
      headers: JSON_HEADERS,
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
    const text = payload.content || payload.response || "";
    return {
      text,
      tokens_generated: Number(payload.tokens_predicted ?? payload.tokens_evaluated ?? 0),
      time_ms: Date.now() - start,
      backend: this.backend,
    };
  }

  async unload() {
    await this.stopProcess();
    this.state = {
      ok: false,
      status: this.configurationError() ? "not-installed" : "warming-up",
      ready: false,
      backend: this.backend,
      model_id: this.state.model_id,
      message: this.configurationError() || "Desktop Accelerator unloaded. Call /load to warm it up again.",
    };
    return { ok: true };
  }
}

export function createDesktopHelperServer(options = {}) {
  const allowedOrigins = [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...parseCommaList(process.env.SMART_TOOL_ALLOWED_ORIGINS),
    ...parseCommaList(process.env.SMART_TOOL_APP_ORIGIN),
    ...(options.allowedOrigins || []),
  ].filter((value, index, list) => list.indexOf(value) === index);

  const host = options.host || DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const engine = options.engine || new LlamaCppEngine({ host, internalPort: options.internalPort || DEFAULT_INTERNAL_PORT });

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) {
      sendJson(res, 403, { error: "Origin not allowed." }, origin, allowedOrigins);
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, withCors(origin, allowedOrigins));
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, engine.health(), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && req.url === "/load") {
        const body = await readJsonBody(req);
        if (typeof body.model_id !== "string" || !body.model_id.trim()) {
          throw createError(400, { error: "model_id is required." });
        }
        sendJson(res, 200, await engine.load(body.model_id), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && req.url === "/generate") {
        const body = await readJsonBody(req);
        if (typeof body.prompt !== "string" || !body.prompt.trim()) {
          throw createError(400, { error: "prompt is required." });
        }
        if (body.config != null && typeof body.config !== "object") {
          throw createError(400, { error: "config must be an object." });
        }
        sendJson(res, 200, await engine.generate(body.prompt, body.config || {}), origin, allowedOrigins);
        return;
      }

      if (req.method === "POST" && req.url === "/unload") {
        await readJsonBody(req);
        sendJson(res, 200, await engine.unload(), origin, allowedOrigins);
        return;
      }

      throw createError(404, { error: "Not found." });
    } catch (error) {
      sendJson(
        res,
        error.statusCode || 500,
        error.payload || { error: error.message || "Internal server error." },
        origin,
        allowedOrigins,
      );
    }
  });

  return {
    server,
    engine,
    allowedOrigins,
    async start() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      return server.address();
    },
    async stop() {
      await engine.unload().catch(() => undefined);
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
  const app = createDesktopHelperServer();
  app.start()
    .then(() => {
      process.stdout.write(`Desktop helper listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
