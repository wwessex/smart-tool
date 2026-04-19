import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const smartDataPath = path.join(repoRoot, "src", "lib", "smart-data.ts");
const sourceManifestPath = path.join(
  repoRoot,
  "browser-translation",
  "src",
  "models",
  "translation-sources.json",
);
const glossaryOutPath = path.join(
  repoRoot,
  "browser-translation",
  "src",
  "dictionaries",
  "glossary-provenance.generated.json",
);
const acceptanceOutPath = path.join(
  repoRoot,
  "browser-translation",
  "evaluation",
  "acceptance-set.json",
);

const GLOSSARY_VERSION = "2026-04-19";

const reviewedSources = [
  "internal:smart-output-templates",
  "internal:current-reviewed-dictionaries",
  "internal:known-regressions-pr-159",
  "internal:known-regressions-pr-168",
  "external-reviewed:kaikki-wiktextract",
  "external-reviewed:panlex",
  "external-reviewed:opus",
  "external-reviewed:tatoeba",
];

const employmentDomainSeeds = [
  "job search",
  "job applications",
  "digital skills",
  "work experience",
  "communication skills",
  "support worker",
  "careers adviser",
  "childcare options",
  "travel support",
  "benefit entitlement",
  "universal credit",
  "council tax",
  "application form",
  "mock interview",
];

const regressionSeeds = [
  "During our meeting on",
  "and I",
  "has confirmed this action is both realistic and achievable",
  "has confirmed",
  "in our next meeting in",
  "has discussed and agreed to",
  "has agreed to",
];

const generalLexiconSeeds = [
  "confirmed",
  "both",
  "on",
  "where",
  "how much",
  "who",
  "their",
  "our",
];

function extractBuilderPhrases(sourceText) {
  const blockRegex =
    /export const BUILDER_(?:NOW|TASK)\s*=\s*\{([\s\S]*?)\n\};/g;
  const phrases = [];

  for (const block of sourceText.matchAll(blockRegex)) {
    const body = block[1];
    for (const entry of body.matchAll(/:\s*"([^"]+)"/g)) {
      phrases.push(entry[1]);
    }
  }

  return [...new Set(phrases)];
}

function buildAcceptanceCases(targetLanguages, coreTemplates) {
  return [
    ...coreTemplates.map((source, index) => ({
      id: `core-${String(index + 1).padStart(3, "0")}`,
      tier: "core_templates",
      source,
      targetLanguages,
      invariants: [
        "no_untranslated_english_leakage_above_threshold",
        "stable_connector_phrasing",
      ],
    })),
    ...employmentDomainSeeds.map((source, index) => ({
      id: `employment-${String(index + 1).padStart(3, "0")}`,
      tier: "employment_domain",
      source,
      targetLanguages,
      invariants: [
        "no_untranslated_english_leakage_above_threshold",
        "employment_domain_term_present",
      ],
    })),
    ...generalLexiconSeeds.map((source, index) => ({
      id: `general-${String(index + 1).padStart(3, "0")}`,
      tier: "general_lexicon",
      source,
      targetLanguages,
      invariants: ["general_lexicon_covered_or_model_translated"],
    })),
  ];
}

const smartDataSource = fs.readFileSync(smartDataPath, "utf8");
const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
const targetLanguages = [...new Set(
  Object.keys(sourceManifest.pairs)
    .flatMap((pair) => pair.split("-"))
    .filter((code) => code !== "en"),
)];

const coreTemplateSeeds = [
  ...extractBuilderPhrases(smartDataSource),
  ...regressionSeeds,
];

const provenancePayload = {
  version: GLOSSARY_VERSION,
  generatedAt: new Date().toISOString(),
  reviewedSources,
  tiers: {
    core_templates: [...new Set(coreTemplateSeeds)].sort(),
    employment_domain: [...new Set(employmentDomainSeeds)].sort(),
    general_lexicon: [...new Set(generalLexiconSeeds)].sort(),
  },
  notes: "Generated from internal SMART templates plus reviewed regression/domain seeds.",
};

const acceptancePayload = {
  version: GLOSSARY_VERSION,
  generatedAt: new Date().toISOString(),
  targetLanguages,
  cases: buildAcceptanceCases(targetLanguages, provenancePayload.tiers.core_templates),
};

fs.writeFileSync(glossaryOutPath, JSON.stringify(provenancePayload, null, 2) + "\n");
fs.writeFileSync(acceptanceOutPath, JSON.stringify(acceptancePayload, null, 2) + "\n");

console.log(`Wrote ${glossaryOutPath}`);
console.log(`Wrote ${acceptanceOutPath}`);
