import { describe, expect, it } from "vitest";
import { RuleBasedTranslator } from "./rule-translator.js";

describe("RuleBasedTranslator", () => {
  describe("French (en-fr)", () => {
    it("loads the French dictionary", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      expect(t).not.toBeNull();
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

  describe("RTL mixed-directionality", () => {
    it("wraps preserved English names in LTR isolates within Arabic output", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Sarah will attend the workshop");
      // Name should be wrapped in LTR isolate (U+2066) ... Pop Directional Isolate (U+2069)
      expect(result).toContain("Sarah");
      expect(result).toMatch(/\u2066.*Sarah.*\u2069/);
    });

    it("wraps preserved dates in LTR isolates within Arabic output", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Complete the task by 25-Jan-26");
      expect(result).toContain("25-Jan-26");
      expect(result).toMatch(/\u2066.*25-Jan-26.*\u2069/);
    });

    it("preserves standalone numbers in Arabic output", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Apply for 3 roles by Friday");
      // Single digit "3" is too short for the LTR isolate regex (needs 2+ chars),
      // but it should still be preserved in the output
      expect(result).toContain("3");
    });

    it("wraps multi-char numbers with units in LTR isolates within Arabic output", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Complete 15 applications by Friday");
      expect(result).toContain("15");
      expect(result).toMatch(/\u2066.*15.*\u2069/);
    });

    it("wraps preserved acronyms in LTR isolates within Arabic output", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Update the CV with STAR examples");
      expect(result).toMatch(/\u2066.*CV.*\u2069/);
      expect(result).toMatch(/\u2066.*STAR.*\u2069/);
    });

    it("handles multiple LTR entities mixed with Arabic text", async () => {
      const t = await RuleBasedTranslator.create("en-ar");
      const result = t!.translate("Sarah will apply for 3 roles on Indeed.co.uk by 25-Jan-26");
      // Should have RTL mark at start
      expect(result.charCodeAt(0)).toBe(0x200F);
      // All LTR entities should be isolated
      expect(result).toContain("Sarah");
      expect(result).toContain("Indeed.co.uk");
      expect(result).toContain("25-Jan-26");
      // Count LTR isolate pairs — at least 3 entities should be wrapped
      const lriCount = (result.match(/\u2066/g) || []).length;
      expect(lriCount).toBeGreaterThanOrEqual(3);
    });

    it("does not apply RTL marks for LTR languages like French", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("Sarah will attend the workshop");
      // Should NOT start with RTL mark
      expect(result.charCodeAt(0)).not.toBe(0x200F);
      // Should NOT contain LTR isolates
      expect(result).not.toContain("\u2066");
    });

    it("applies RTL marks for Urdu output", async () => {
      const t = await RuleBasedTranslator.create("en-ur");
      if (!t) return; // skip if no Urdu dictionary
      const result = t.translate("John will start the training");
      expect(result.charCodeAt(0)).toBe(0x200F);
      expect(result).toContain("John");
    });

    it("applies RTL marks for Pashto output", async () => {
      const t = await RuleBasedTranslator.create("en-ps");
      if (!t) return; // skip if no Pashto dictionary
      const result = t.translate("Sarah will complete the course");
      expect(result.charCodeAt(0)).toBe(0x200F);
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

  describe("expanded vocabulary", () => {
    it("translates referral and service terms in Urdu", async () => {
      const t = await RuleBasedTranslator.create("en-ur");
      const result = t!.translate("John will be referred to a mentoring service for additional one-to-one support");
      expect(result).toContain("حوالہ کیا جائے گا");
      expect(result).toContain("رہنمائی کی خدمت");
      expect(result).toContain("اضافی");
      expect(result).toContain("انفرادی مدد");
    });

    it("translates guidance and encouragement words in Urdu", async () => {
      const t = await RuleBasedTranslator.create("en-ur");
      const result = t!.translate("Mentors can provide guidance and encouragement");
      // "mentors" → رہنما, "guidance" → رہنمائی, "encouragement" → حوصلہ افزائی
      expect(result).toContain("رہنمائی");
      expect(result).toContain("حوصلہ افزائی");
    });

    it("translates passive phrases in French", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      const result = t!.translate("John will be referred to a counselling service");
      expect(result).toContain("sera orienté vers");
      expect(result).toContain("service de conseil");
    });

    it("translates service compound terms in German", async () => {
      const t = await RuleBasedTranslator.create("en-de");
      const result = t!.translate("additional one-to-one support from the mentoring service");
      expect(result).toContain("zusätzlich");
      expect(result).toContain("Einzelunterstützung");
      expect(result).toContain("Mentoring-Dienst");
    });

    it("translates 'can provide' phrase in French", async () => {
      const t = await RuleBasedTranslator.create("en-fr");
      // "can provide" matched when not followed by longer phrases like "provide support"
      const result = t!.translate("They can provide help");
      expect(result).toContain("peut fournir");
    });

    it("translates new adjectives in Urdu", async () => {
      const t = await RuleBasedTranslator.create("en-ur");
      const result = t!.translate("social and emotional support");
      expect(result).toContain("سماجی");
      expect(result).toContain("جذباتی");
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
