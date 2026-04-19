import type {
  DictionaryEntry,
  GlossaryMetadata,
  GlossaryTier,
  PhraseDictionary,
} from "./types.js";

export const GLOSSARY_VERSION = "2026-04-19";

const REVIEWED_SOURCES = [
  "internal:smart-output-templates",
  "internal:current-reviewed-dictionaries",
  "internal:known-regressions-pr-159",
  "internal:known-regressions-pr-168",
  "external-reviewed:kaikki-wiktextract",
  "external-reviewed:panlex",
  "external-reviewed:opus",
  "external-reviewed:tatoeba",
];

const CORE_TEMPLATE_PATTERNS = [
  "has discussed and agreed",
  "has agreed to",
  "commits to",
  "with support from",
  "in order to",
  "to address",
  "will ",
  "we have agreed",
  "this action",
  "our next meeting",
  "during our meeting",
  "has confirmed",
  "realistic and achievable",
];

const EMPLOYMENT_DOMAIN_PATTERNS = [
  "job",
  "employment",
  "interview",
  "cv",
  "resume",
  "course",
  "training",
  "advisor",
  "adviser",
  "support worker",
  "digital",
  "work ",
  "workplace",
  "benefit",
  "universal credit",
  "council tax",
  "childcare",
  "travel",
  "bus",
  "application",
  "vacancy",
  "employer",
  "qualification",
  "skills",
];

function classifyTier(entry: DictionaryEntry): GlossaryTier {
  const haystack = `${entry.src} ${entry.pos ?? ""}`.toLowerCase();

  if (CORE_TEMPLATE_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    return "core_templates";
  }

  if (EMPLOYMENT_DOMAIN_PATTERNS.some((pattern) => haystack.includes(pattern))) {
    return "employment_domain";
  }

  return "general_lexicon";
}

export function annotateDictionaryWithGlossaryMetadata(
  dictionary: PhraseDictionary
): PhraseDictionary {
  const annotateEntry = (entry: DictionaryEntry): DictionaryEntry => {
    const tier = entry.tier ?? classifyTier(entry);
    return {
      ...entry,
      tier,
      sources: entry.sources ?? ["internal:current-reviewed-dictionaries"],
    };
  };

  const phrases = dictionary.phrases.map(annotateEntry);
  const words = dictionary.words.map(annotateEntry);
  const tierCounts: Record<GlossaryTier, number> = {
    core_templates: 0,
    employment_domain: 0,
    general_lexicon: 0,
  };

  for (const entry of [...phrases, ...words]) {
    tierCounts[entry.tier ?? "general_lexicon"] += 1;
  }

  const metadata: GlossaryMetadata = {
    version: GLOSSARY_VERSION,
    pair: dictionary.pair,
    sources: REVIEWED_SOURCES,
    tierCounts,
  };

  return {
    ...dictionary,
    phrases,
    words,
    metadata,
  };
}
