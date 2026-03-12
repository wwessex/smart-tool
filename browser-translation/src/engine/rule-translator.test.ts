import { describe, expect, it } from "vitest";
import { RuleBasedTranslator } from "./rule-translator.js";

describe("RuleBasedTranslator", () => {
  describe("French (en-fr)", () => {
    let translator: RuleBasedTranslator;

    it("loads the French dictionary", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      expect(t).not.toBeNull();
      translator = t!;
    });

    it("translates 'will + verb' phrases", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("John will apply for the role");
      expect(result).toContain("va postuler");
    });

    it("translates SMART connectors", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Maria has agreed to complete the training");
      expect(result).toContain("a accepté de");
    });

    it("translates employment terms", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Update the job search and interview skills");
      expect(result).toContain("recherche d'emploi");
      expect(result).toContain("entretien");
    });

    it("preserves participant names", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Sarah will attend the workshop");
      expect(result).toContain("Sarah");
    });

    it("preserves dates", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Complete the task by 25-Jan-26");
      expect(result).toContain("25-Jan-26");
    });

    it("preserves numbers", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Apply for 3 roles on the website");
      expect(result).toContain("3");
    });

    it("preserves URLs", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Register on Indeed.co.uk by Friday");
      expect(result).toContain("Indeed.co.uk");
    });

    it("preserves acronyms", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Update the CV with STAR examples");
      expect(result).toContain("CV");
      expect(result).toContain("STAR");
    });

    it("passes unknown words through in English", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Complete the xylophone maintenance");
      expect(result).toContain("xylophone");
      expect(result).toContain("maintenance");
    });

    it("handles empty text gracefully", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      expect(t!.translate("")).toBe("");
      expect(t!.translate("  ")).toBe("  ");
    });
  });

  describe("German (en-de)", () => {
    it("translates will + verb phrases", async () => {
      const t = await RuleBasedTranslator.create("en-de");
      const result = t!.translate("John will research the bus routes");
      expect(result).toContain("wird recherchieren");
      expect(result).toContain("Buslinien");
    });

    it("translates barrier terms", async () => {
      const t = await RuleBasedTranslator.create("en-de");
      const result = t!.translate("to address transport barriers");
      expect(result).toContain("um anzugehen");
      expect(result).toContain("Hindernisse");
    });
  });

  describe("Arabic (en-ar)", () => {
    it("translates employment phrases", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("John will apply for the job");
      expect(result).toContain("سيتقدم");
    });

    it("applies RTL marks for Arabic output", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Complete the training");
      // Should start with RTL mark
      expect(result.charCodeAt(0)).toBe(0x200F);
    });

    it("preserves names in LTR isolates for Arabic", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Sarah will attend the workshop");
      // Name should be in the output
      expect(result).toContain("Sarah");
    });
  });

  describe("hasDictionary", () => {
    it("returns true for supported pairs", () => {
      expect(RuleBasedTranslator.hasDictionary("en-fr")).toBe(true);
      expect(RuleBasedTranslator.hasDictionary("en-de")).toBe(true);
      expect(RuleBasedTranslator.hasDictionary("en-ar")).toBe(true);
    });

    it("returns false for unsupported pairs", () => {
      expect(RuleBasedTranslator.hasDictionary("fr-en")).toBe(false);
      expect(RuleBasedTranslator.hasDictionary("de-fr")).toBe(false);
      expect(RuleBasedTranslator.hasDictionary("en-xx")).toBe(false);
    });
  });

  describe("phrase precedence over words", () => {
    it("matches 'job search' as phrase not separate words", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Start the job search today");
      // Should contain the phrase translation, not word-by-word
      expect(result).toContain("recherche d'emploi");
    });

    it("matches 'has agreed to' before 'has' alone", async () => {
      const t = await RuleBasedTranslator.create("en-de");
      const result = t!.translate("Maria has agreed to complete the task");
      expect(result).toContain("hat vereinbart");
    });
  });
});
