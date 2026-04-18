import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopHelperServer } from "../../../desktop-helper/src/server.js";

const allowedOrigin = "http://localhost:8080";

describe("desktop-helper-server", () => {
  let app;
  let baseUrl;
  let engine;

  beforeEach(async () => {
    engine = {
      health: vi.fn().mockReturnValue({
        ok: true,
        ready: true,
        status: "ready",
        backend: "llama.cpp-cpu",
        model_id: "smart-tool-planner-gguf-v1",
        message: "Ready",
      }),
      load: vi.fn().mockResolvedValue({
        ok: true,
        ready: true,
        status: "ready",
        backend: "llama.cpp-cpu",
        model_id: "smart-tool-planner-gguf-v1",
        message: "Ready",
      }),
      generate: vi.fn().mockResolvedValue({
        text: "Generated text",
        tokens_generated: 21,
        time_ms: 9,
        backend: "llama.cpp-cpu",
      }),
      unload: vi.fn().mockResolvedValue({ ok: true }),
    };

    app = createDesktopHelperServer({
      host: "127.0.0.1",
      port: 0,
      allowedOrigins: [allowedOrigin],
      engine,
    });
    const address = await app.start();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP server address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (app) {
      await app.stop();
    }
  });

  it("returns helper health with the expected JSON shape", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: allowedOrigin,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
      model_id: "smart-tool-planner-gguf-v1",
    });
    expect(engine.health).toHaveBeenCalledTimes(1);
  });

  it("rejects disallowed origins", async () => {
    const response = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers: {
        Origin: "https://example.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Prompt",
        config: {},
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin not allowed." });
    expect(engine.generate).not.toHaveBeenCalled();
  });

  it("allows the production smartactiontool.app origin by default", async () => {
    const defaultOriginApp = createDesktopHelperServer({
      host: "127.0.0.1",
      port: 0,
      engine,
    });

    try {
      const address = await defaultOriginApp.start();
      if (!address || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }

      const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
        headers: {
          Origin: "https://smartactiontool.app",
        },
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        ready: true,
        status: "ready",
      });
    } finally {
      await defaultOriginApp.stop();
    }
  });

  it("supports unload and reload cycles without changing the contract", async () => {
    const loadResponse1 = await fetch(`${baseUrl}/load`, {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model_id: "smart-tool-planner-gguf-v1" }),
    });
    const unloadResponse = await fetch(`${baseUrl}/unload`, {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const loadResponse2 = await fetch(`${baseUrl}/load`, {
      method: "POST",
      headers: {
        Origin: allowedOrigin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model_id: "smart-tool-planner-gguf-v1" }),
    });

    expect(loadResponse1.status).toBe(200);
    await expect(loadResponse1.json()).resolves.toMatchObject({
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
    });

    expect(unloadResponse.status).toBe(200);
    await expect(unloadResponse.json()).resolves.toEqual({ ok: true });

    expect(loadResponse2.status).toBe(200);
    await expect(loadResponse2.json()).resolves.toMatchObject({
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
    });

    expect(engine.load).toHaveBeenCalledTimes(2);
    expect(engine.unload).toHaveBeenCalled();
  });
});
