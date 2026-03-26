import { describe, it, expect } from "vitest";
import {
  BARRIER_CATEGORIES,
  getBarriersByCategory,
  classifyBarrier,
  DEFAULT_TIMESCALES,
  DEFAULT_BARRIERS,
  BUILDER_NOW,
  BUILDER_TASK,
  GUIDANCE,
  ACTION_LIBRARY,
  FALLBACK_SUGGESTIONS,
  TASK_SUGGESTIONS,
  EXEMPLAR_LIBRARY,
} from "@/lib/smart-data";

describe("smart-data", () => {
  // ==================== BARRIER_CATEGORIES ====================

  describe("BARRIER_CATEGORIES", () => {
    it("is a non-empty record", () => {
      expect(Object.keys(BARRIER_CATEGORIES).length).toBeGreaterThan(0);
    });

    it("maps every barrier to a string category", () => {
      for (const [barrier, category] of Object.entries(BARRIER_CATEGORIES)) {
        expect(typeof barrier).toBe("string");
        expect(typeof category).toBe("string");
        expect(category.length).toBeGreaterThan(0);
      }
    });

    it("includes English Language (ESOL) as skills", () => {
      expect(BARRIER_CATEGORIES["English Language (ESOL)"]).toBe("skills");
    });

    it("overrides Social & Support Networks to experience", () => {
      expect(BARRIER_CATEGORIES["Social & Support Networks"]).toBe("experience");
    });

    it("overrides Previous Work History to experience", () => {
      expect(BARRIER_CATEGORIES["Previous Work History"]).toBe("experience");
    });

    it("contains known categories", () => {
      const categories = new Set(Object.values(BARRIER_CATEGORIES));
      expect(categories.has("practical")).toBe(true);
      expect(categories.has("confidence")).toBe(true);
      expect(categories.has("skills")).toBe(true);
    });
  });

  // ==================== getBarriersByCategory ====================

  describe("getBarriersByCategory", () => {
    it("returns barriers for a known category", () => {
      const practical = getBarriersByCategory("practical");
      expect(practical.length).toBeGreaterThan(0);
      // Every returned barrier should map back to "practical"
      for (const b of practical) {
        expect(BARRIER_CATEGORIES[b]).toBe("practical");
      }
    });

    it("returns empty array for unknown category", () => {
      expect(getBarriersByCategory("nonexistent")).toEqual([]);
    });

    it("returns barriers for experience category", () => {
      const experience = getBarriersByCategory("experience");
      expect(experience).toContain("Social & Support Networks");
      expect(experience).toContain("Previous Work History");
    });
  });

  // ==================== classifyBarrier ====================

  describe("classifyBarrier", () => {
    it("returns unknown for empty string", () => {
      expect(classifyBarrier("")).toBe("unknown");
    });

    it("returns unknown for whitespace-only input", () => {
      expect(classifyBarrier("   ")).toBe("unknown");
    });

    it("returns unknown for null/undefined coerced input", () => {
      expect(classifyBarrier(null as unknown as string)).toBe("unknown");
      expect(classifyBarrier(undefined as unknown as string)).toBe("unknown");
    });

    it("classifies exact match barriers", () => {
      expect(classifyBarrier("Housing")).toBeDefined();
      expect(classifyBarrier("Housing")).not.toBe("unknown");
    });

    it("classifies case-insensitive match", () => {
      const exact = classifyBarrier("Housing");
      expect(classifyBarrier("housing")).toBe(exact);
      expect(classifyBarrier("HOUSING")).toBe(exact);
    });

    it("classifies Social & Support Networks as experience", () => {
      expect(classifyBarrier("Social & Support Networks")).toBe("experience");
    });

    it("classifies English Language (ESOL) as skills", () => {
      expect(classifyBarrier("English Language (ESOL)")).toBe("skills");
    });

    it("returns unknown for completely unrecognized barriers", () => {
      expect(classifyBarrier("xyzzy-nonexistent-barrier-12345")).toBe("unknown");
    });

    it("classifies every DEFAULT_BARRIER to a non-unknown category", () => {
      for (const barrier of DEFAULT_BARRIERS) {
        const category = classifyBarrier(barrier);
        expect(category).not.toBe("unknown");
      }
    });
  });

  // ==================== DEFAULT_TIMESCALES ====================

  describe("DEFAULT_TIMESCALES", () => {
    it("is a non-empty array", () => {
      expect(DEFAULT_TIMESCALES.length).toBeGreaterThan(0);
    });

    it("contains only strings", () => {
      for (const ts of DEFAULT_TIMESCALES) {
        expect(typeof ts).toBe("string");
      }
    });

    it("starts with shortest timescale", () => {
      expect(DEFAULT_TIMESCALES[0]).toBe("1 week");
    });

    it("ends with longest timescale", () => {
      expect(DEFAULT_TIMESCALES[DEFAULT_TIMESCALES.length - 1]).toBe("6 months");
    });

    it("has 9 timescale options", () => {
      expect(DEFAULT_TIMESCALES).toHaveLength(9);
    });
  });

  // ==================== DEFAULT_BARRIERS ====================

  describe("DEFAULT_BARRIERS", () => {
    it("is a non-empty array", () => {
      expect(DEFAULT_BARRIERS.length).toBeGreaterThan(0);
    });

    it("contains known barriers", () => {
      expect(DEFAULT_BARRIERS).toContain("Housing");
      expect(DEFAULT_BARRIERS).toContain("CV");
      expect(DEFAULT_BARRIERS).toContain("Confidence");
    });

    it("has no duplicates", () => {
      const unique = new Set(DEFAULT_BARRIERS);
      expect(unique.size).toBe(DEFAULT_BARRIERS.length);
    });
  });

  // ==================== BUILDER_NOW / BUILDER_TASK ====================

  describe("BUILDER_NOW", () => {
    it("has all required phrase keys", () => {
      expect(BUILDER_NOW.p1).toBeDefined();
      expect(BUILDER_NOW.p2).toBeDefined();
      expect(BUILDER_NOW.p3).toBeDefined();
      expect(BUILDER_NOW.p4).toBeDefined();
      expect(BUILDER_NOW.p5).toBeDefined();
      expect(BUILDER_NOW.p6).toBeDefined();
      expect(BUILDER_NOW.p7).toBeDefined();
    });
  });

  describe("BUILDER_TASK", () => {
    it("has all required phrase keys", () => {
      expect(BUILDER_TASK.p1).toBeDefined();
      expect(BUILDER_TASK.p2).toBeDefined();
      expect(BUILDER_TASK.p3).toBeDefined();
    });
  });

  // ==================== ACTION_LIBRARY ====================

  describe("ACTION_LIBRARY", () => {
    it("is a non-empty record", () => {
      expect(Object.keys(ACTION_LIBRARY).length).toBeGreaterThan(0);
    });

    it("every entry has title, action, and help fields", () => {
      for (const [barrier, actions] of Object.entries(ACTION_LIBRARY)) {
        expect(actions.length).toBeGreaterThan(0);
        for (const a of actions) {
          expect(a.title).toBeDefined();
          expect(a.action).toBeDefined();
          expect(a.help).toBeDefined();
          expect(typeof a.title).toBe("string");
          expect(typeof a.action).toBe("string");
          expect(typeof a.help).toBe("string");
        }
      }
    });

    it("includes actions for common barriers", () => {
      expect(ACTION_LIBRARY["Housing"]).toBeDefined();
      expect(ACTION_LIBRARY["CV"]).toBeDefined();
      expect(ACTION_LIBRARY["Confidence"]).toBeDefined();
    });
  });

  // ==================== GUIDANCE ====================

  describe("GUIDANCE", () => {
    it("is a non-empty array", () => {
      expect(GUIDANCE.length).toBeGreaterThan(0);
    });

    it("each entry has title and body", () => {
      for (const g of GUIDANCE) {
        expect(g.title).toBeDefined();
        expect(g.body).toBeDefined();
      }
    });
  });

  // ==================== FALLBACK_SUGGESTIONS ====================

  describe("FALLBACK_SUGGESTIONS", () => {
    it("is a non-empty array", () => {
      expect(FALLBACK_SUGGESTIONS.length).toBeGreaterThan(0);
    });
  });

  // ==================== TASK_SUGGESTIONS ====================

  describe("TASK_SUGGESTIONS", () => {
    it("is a non-empty record", () => {
      expect(Object.keys(TASK_SUGGESTIONS).length).toBeGreaterThan(0);
    });

    it("each entry has title and outcome", () => {
      for (const [, suggestions] of Object.entries(TASK_SUGGESTIONS)) {
        for (const s of suggestions) {
          expect(s.title).toBeDefined();
          expect(s.outcome).toBeDefined();
        }
      }
    });
  });

  // ==================== EXEMPLAR_LIBRARY ====================

  describe("EXEMPLAR_LIBRARY", () => {
    it("is a non-empty array", () => {
      expect(EXEMPLAR_LIBRARY.length).toBeGreaterThan(0);
    });

    it("each exemplar has required fields", () => {
      for (const e of EXEMPLAR_LIBRARY) {
        expect(e.barrier).toBeDefined();
        expect(e.action).toBeDefined();
        expect(typeof e.barrier).toBe("string");
        expect(typeof e.action).toBe("string");
      }
    });
  });
});
