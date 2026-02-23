import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomKnowledgeEntry,
  deleteCustomKnowledgeEntry,
  listCustomKnowledgeEntries,
  updateCustomKnowledgeEntry,
} from "@/lib/custom-knowledge-base";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

describe("custom-knowledge-base api client", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("lists entries and passes search query params", async () => {
    invokeMock.mockResolvedValue({ data: { data: [] }, error: null });

    await listCustomKnowledgeEntries({ q: "transport", limit: 10 });

    expect(invokeMock).toHaveBeenCalledWith("custom-knowledge-base?q=transport&limit=10", {
      method: "GET",
    });
  });

  it("creates an entry", async () => {
    invokeMock.mockResolvedValue({
      data: { data: { id: "1", title: "t", content: "c", tags: [], metadata: {}, created_at: "", updated_at: "" } },
      error: null,
    });

    const entry = await createCustomKnowledgeEntry({ title: "t", content: "c" });
    expect(entry.id).toBe("1");
    expect(invokeMock).toHaveBeenCalledWith("custom-knowledge-base", expect.objectContaining({ method: "POST" }));
  });

  it("updates an entry", async () => {
    invokeMock.mockResolvedValue({
      data: { data: { id: "1", title: "next", content: "c", tags: [], metadata: {}, created_at: "", updated_at: "" } },
      error: null,
    });

    await updateCustomKnowledgeEntry("1", { title: "next" });

    expect(invokeMock).toHaveBeenCalledWith("custom-knowledge-base/1", expect.objectContaining({ method: "PUT" }));
  });

  it("deletes an entry", async () => {
    invokeMock.mockResolvedValue({ data: { data: { id: "1" } }, error: null });

    const id = await deleteCustomKnowledgeEntry("1");

    expect(id).toBe("1");
    expect(invokeMock).toHaveBeenCalledWith("custom-knowledge-base/1", expect.objectContaining({ method: "DELETE" }));
  });
});
