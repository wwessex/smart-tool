import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateWithDesktopHelper,
  getDesktopHelperHealth,
  loadDesktopHelper,
  unloadDesktopHelper,
} from "@/lib/desktop-helper-client";

describe("desktop-helper-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests helper health from the loopback origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
        ready: true,
        status: "ready",
        backend: "llama.cpp-cpu",
        model_id: "smart-tool-planner-gguf-v1",
      })),
    );

    const health = await getDesktopHelperHealth();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:43117/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(health).toMatchObject({
      ok: true,
      ready: true,
      status: "ready",
    });
  });

  it("posts load, generate, and unload payloads as JSON", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        ready: true,
        status: "ready",
        backend: "llama.cpp-cpu",
        model_id: "smart-tool-planner-gguf-v1",
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        text: "Generated text",
        tokens_generated: 32,
        time_ms: 15,
        backend: "llama.cpp-cpu",
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));

    await loadDesktopHelper("smart-tool-planner-gguf-v1");
    await generateWithDesktopHelper("Prompt", { max_new_tokens: 128, temperature: 0 });
    await unloadDesktopHelper();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:43117/load",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ model_id: "smart-tool-planner-gguf-v1" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:43117/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt: "Prompt", config: { max_new_tokens: 128, temperature: 0 } }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:43117/unload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      }),
    );
  });
});
