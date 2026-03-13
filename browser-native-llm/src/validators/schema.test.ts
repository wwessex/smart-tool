import { describe, expect, it } from "vitest";
import { parseJsonOutput } from "./schema.js";

describe("parseJsonOutput", () => {
  it("normalises smart quotes used as JSON delimiters", () => {
    const raw = `[
      {
        “action”: “Apply for 3 roles by Friday”
      }
    ]`;

    const parsed = parseJsonOutput(raw);
    expect(parsed).toEqual([{ action: "Apply for 3 roles by Friday" }]);
  });


  it("normalises additional unicode quote delimiters", () => {
    const raw = `[
      {
        «action»: 「Apply for 2 cleaning roles by Monday」,
        ＂metric＂: ＂2 submitted applications＂
      }
    ]`;

    const parsed = parseJsonOutput(raw);
    expect(parsed).toEqual([
      {
        action: "Apply for 2 cleaning roles by Monday",
        metric: "2 submitted applications",
      },
    ]);
  });


  it("parses single-object responses that use typographic quotes", () => {
    const raw = `The answer is below:
    {
      “reasoning": “The teacher bought 24 pencils and 20 erasers. After using 13 total, 31 remain.”,
      “translations": {
        “es": “La inteligencia artificial es poderosa, pero un diseño cuidadoso evita comportamientos inesperados.”
      }
    }`;

    const parsed = parseJsonOutput(raw);
    expect(parsed).toEqual([
      {
        reasoning:
          "The teacher bought 24 pencils and 20 erasers. After using 13 total, 31 remain.",
        translations: {
          es: "La inteligencia artificial es poderosa, pero un diseño cuidadoso evita comportamientos inesperados.",
        },
      },
    ]);
  });
  it("escapes inner double quotes inside string values", () => {
    const raw = `[
      {
        "reasoning_answer": "9 sheep remain, because "all but 9 die" means every sheep except 9 has died."
      }
    ]`;

    const parsed = parseJsonOutput(raw);
    expect(parsed).toEqual([
      {
        reasoning_answer:
          '9 sheep remain, because "all but 9 die" means every sheep except 9 has died.',
      },
    ]);
  });
});
