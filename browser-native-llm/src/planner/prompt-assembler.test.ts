import { describe, expect, it } from "vitest";
import { assemblePrompt } from "./prompt-assembler.js";
import type { UserProfile } from "../types.js";
import type { RetrievalResult } from "../retrieval/retriever.js";

const profile: UserProfile = {
  job_goal: "Data analyst",
  current_situation: "Career changer",
  hours_per_week: 6,
  timeframe_weeks: 8,
  skills: ["Excel", "SQL"],
  barriers: ["confidence"],
  confidence_level: 2,
  participant_name: "Alex",
  supporter: "Advisor",
  generation_mode: "action",
};

const retrieval: RetrievalResult = {
  templates: [],
  skills: [],
  stages: [],
  retrieval_summary: "",
  score_breakdown: [],
};

describe("assemblePrompt", () => {
  it("explicitly requires ASCII quotes for JSON output", () => {
    const prompt = assemblePrompt(profile, retrieval).text;

    expect(prompt).toContain("Use ASCII double quotes (\") as JSON delimiters");
    expect(prompt).toContain("Never use typographic quotes");
  });

  it("tells the model to preserve Unicode characters in values", () => {
    const prompt = assemblePrompt(profile, retrieval).text;

    expect(prompt).toContain("Preserve natural spelling and Unicode characters");
  });
});
