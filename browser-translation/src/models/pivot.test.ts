import { describe, expect, it } from "vitest";

import { canTranslate, resolveRoute } from "./pivot.js";

describe("resolveRoute with reverse xx->en models", () => {
  it("uses direct routes for newly supported xx->en pairs", () => {
    expect(resolveRoute("cy", "en")).toEqual({
      steps: ["cy-en"],
      isPivot: false,
      hops: 1,
    });

    expect(resolveRoute("ur", "en")).toEqual({
      steps: ["ur-en"],
      isPivot: false,
      hops: 1,
    });
  });

  it("routes xx->yy through English when both legs exist", () => {
    expect(resolveRoute("cy", "de")).toEqual({
      steps: ["cy-en", "en-de"],
      isPivot: true,
      hops: 2,
    });

    expect(resolveRoute("ps", "fr")).toEqual({
      steps: ["ps-en", "en-fr"],
      isPivot: true,
      hops: 2,
    });

    expect(resolveRoute("ti", "ar")).toEqual({
      steps: ["ti-en", "en-ar"],
      isPivot: true,
      hops: 2,
    });
  });

  it("improves canTranslate coverage for reverse-source languages", () => {
    expect(canTranslate("bn", "en")).toBe(true);
    expect(canTranslate("bn", "es")).toBe(true);
    expect(canTranslate("pt", "pl")).toBe(true);
    expect(canTranslate("so", "it")).toBe(true);

    expect(canTranslate("so", "ja")).toBe(false);
  });
});
