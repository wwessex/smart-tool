import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopAcceleratorHost } from "../../../desktop-helper/src/host.js";

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn(() => {
    queueMicrotask(() => {
      child.emit("exit", 0);
    });
  });
  return child;
}

describe("desktop-accelerator-host", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "smart-tool-host-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("surfaces manifest configuration errors through health", () => {
    const host = new DesktopAcceleratorHost({
      manifest: {
        version: 1,
        default_model_id: "smart-tool-planner-gguf-v1",
        models: [
          {
            id: "smart-tool-planner-gguf-v1",
            filename: "planner.gguf",
            download_url: null,
            sha256: null,
            size_bytes: null,
            context_size: 4096,
            runtime: {},
          },
        ],
      },
      fetchImpl: vi.fn(),
      telemetry: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(host.health()).toMatchObject({
      ok: false,
      ready: false,
      status: "not-installed",
      message: "No download URL configured for smart-tool-planner-gguf-v1.",
    });
  });

  it("reports missing packaged runtimes before attempting to spawn", () => {
    const host = new DesktopAcceleratorHost({
      manifest: {
        version: 1,
        default_model_id: "smart-tool-planner-gguf-v1",
        models: [
          {
            id: "smart-tool-planner-gguf-v1",
            filename: "planner.gguf",
            download_url: "https://example.com/model.gguf",
            sha256: null,
            size_bytes: null,
            context_size: 4096,
            runtime: {},
          },
        ],
      },
      fetchImpl: vi.fn(),
      runtimeSearchRoots: [path.join(tempDir, "missing-runtime")],
      telemetry: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(host.health()).toMatchObject({
      ok: false,
      ready: false,
      status: "not-installed",
      message: "Desktop Accelerator could not find a bundled llama-server runtime.",
    });
  });

  it("downloads once, generates, unloads, and reloads without changing the contract", async () => {
    const modelBytes = Buffer.from("gguf-model");
    const modelSha = sha256(modelBytes);
    const modelUrl = "https://example.com/model.gguf";
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === modelUrl) {
        return new Response(modelBytes);
      }
      if (url.endsWith("/health")) {
        return new Response("ok", { status: 200 });
      }
      if (url.endsWith("/completion")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({
          content: "Generated text",
          tokens_predicted: 12,
        }), { status: 200 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    const spawnImpl = vi.fn(() => createFakeChild());

    const host = new DesktopAcceleratorHost({
      manifest: {
        version: 1,
        default_model_id: "smart-tool-planner-gguf-v1",
        models: [
          {
            id: "smart-tool-planner-gguf-v1",
            filename: "planner.gguf",
            download_url: modelUrl,
            sha256: modelSha,
            size_bytes: modelBytes.length,
            context_size: 4096,
            runtime: {},
          },
        ],
      },
      fetchImpl,
      spawnImpl,
      modelDir: tempDir,
      pollIntervalMs: 1,
      readyTimeoutMs: 10,
      telemetry: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    const loadResult1 = await host.load("smart-tool-planner-gguf-v1");
    const generateResult = await host.generate("Prompt", { max_new_tokens: 64 });
    const unloadResult = await host.unload();
    const loadResult2 = await host.load("smart-tool-planner-gguf-v1");

    expect(loadResult1).toMatchObject({
      ok: true,
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
    });
    expect(generateResult).toMatchObject({
      text: "Generated text",
      tokens_generated: 12,
      backend: "llama.cpp-cpu",
    });
    expect(unloadResult).toEqual({ ok: true });
    expect(loadResult2).toMatchObject({
      ok: true,
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
    });

    const downloadCalls = fetchImpl.mock.calls.filter(([url]) => url === modelUrl);
    expect(downloadCalls).toHaveLength(1);
  });

  it("rejects checksum mismatches before starting llama.cpp", async () => {
    const spawnImpl = vi.fn(() => createFakeChild());
    const host = new DesktopAcceleratorHost({
      manifest: {
        version: 1,
        default_model_id: "smart-tool-planner-gguf-v1",
        models: [
          {
            id: "smart-tool-planner-gguf-v1",
            filename: "planner.gguf",
            download_url: "https://example.com/model.gguf",
            sha256: "deadbeef",
            size_bytes: 9,
            context_size: 4096,
            runtime: {},
          },
        ],
      },
      fetchImpl: vi.fn(async (url: string) => {
        if (url === "https://example.com/model.gguf") {
          return new Response(Buffer.from("bad-model"));
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
      spawnImpl,
      modelDir: tempDir,
      telemetry: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    await expect(host.load("smart-tool-planner-gguf-v1")).rejects.toThrow(
      "Downloaded model failed checksum or size validation.",
    );
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("falls back to CPU when the requested GPU launch does not become ready", async () => {
    const modelBytes = Buffer.from("gpu-fallback-model");
    const modelSha = sha256(modelBytes);
    let spawnCount = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url === "https://example.com/model.gguf") {
        return new Response(modelBytes);
      }
      if (url.endsWith("/health")) {
        if (spawnCount >= 2) {
          return new Response("ok", { status: 200 });
        }
        throw new Error("not ready");
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    const spawnImpl = vi.fn(() => {
      spawnCount += 1;
      return createFakeChild();
    });

    const host = new DesktopAcceleratorHost({
      manifest: {
        version: 1,
        default_model_id: "smart-tool-planner-gguf-v1",
        models: [
          {
            id: "smart-tool-planner-gguf-v1",
            filename: "planner.gguf",
            download_url: "https://example.com/model.gguf",
            sha256: modelSha,
            size_bytes: modelBytes.length,
            context_size: 4096,
            runtime: {
              gpu_layers: 16,
            },
          },
        ],
      },
      fetchImpl,
      spawnImpl,
      modelDir: tempDir,
      pollIntervalMs: 1,
      readyTimeoutMs: 5,
      telemetry: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    const result = await host.load("smart-tool-planner-gguf-v1");

    expect(result).toMatchObject({
      ok: true,
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
    });
    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });

  it("prefers bundled runtime directories when packaging provided them", async () => {
    const runtimeRoot = path.join(tempDir, "DesktopAccelerator");
    const bundledRuntimeDir = path.join(runtimeRoot, "runtimes", "win32-x64");
    await fs.mkdir(bundledRuntimeDir, { recursive: true });
    await fs.writeFile(path.join(bundledRuntimeDir, "llama-server.exe"), "binary");

    const spawnImpl = vi.fn(() => createFakeChild());
    const host = new DesktopAcceleratorHost({
      manifest: {
        version: 1,
        default_model_id: "smart-tool-planner-gguf-v1",
        models: [
          {
            id: "smart-tool-planner-gguf-v1",
            filename: "planner.gguf",
            download_url: "https://example.com/model.gguf",
            sha256: null,
            size_bytes: null,
            context_size: 4096,
            runtime: {},
          },
        ],
      },
      fetchImpl: vi.fn(),
      platform: "win32",
      arch: "x64",
      runtimeSearchRoots: [runtimeRoot],
      spawnImpl,
      telemetry: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    host.spawnServerProcess(path.join(tempDir, "planner.gguf"), "smart-tool-planner-gguf-v1", 0);

    expect(spawnImpl).toHaveBeenCalledWith(
      path.join(bundledRuntimeDir, "llama-server.exe"),
      expect.any(Array),
      expect.objectContaining({
        cwd: bundledRuntimeDir,
        env: expect.objectContaining({
          PATH: expect.stringContaining(bundledRuntimeDir),
        }),
      }),
    );
  });
});
