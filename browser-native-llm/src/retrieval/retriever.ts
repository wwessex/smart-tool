/**
 * Local retrieval engine for grounding LLM prompts.
 *
 * Given a user profile and goal, retrieves the most relevant action
 * templates and skills from the local action library. Retrieved
 * snippets are injected into the prompt to ground model outputs
 * in curated, realistic job-search guidance.
 */

import type { UserProfile, ActionTemplate, SkillEntry, JobSearchStage, ResolvedBarrier } from "../types.js";
import { ActionLibrary } from "./action-library.js";
import { splitOnWhitespace } from "../utils/sanitize.js";

const WORD_RE = /[a-z0-9]+(?:[\-_][a-z0-9]+)*/gi;

function normalizeTerm(text: string): string {
  return text.toLowerCase().replace(/[\-_]+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map(normalizeTerm).filter((t) => t.length > 0);
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

function hasTokenBoundaryMatch(text: string, term: string): boolean {
  const normalized = normalizeTerm(term);
  if (!normalized) return false;

  if (normalized.includes(" ")) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s_-]+");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(text);
  }

  return tokenSet(text).has(normalized);
}

function overlapRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const token of left) {
    if (right.has(token)) common++;
  }
  return common / Math.min(left.size, right.size);
}

function phraseOverlapScore(query: string, text: string): number {
  const queryTokens = splitOnWhitespace(query.toLowerCase()).filter((t) => t.length > 2);
  if (queryTokens.length < 2) return 0;

  let hitCount = 0;
  let total = 0;
  for (let i = 0; i < queryTokens.length - 1; i++) {
    const phrase = `${queryTokens[i]} ${queryTokens[i + 1]}`;
    total += 1;
    if (hasTokenBoundaryMatch(text, phrase)) {
      hitCount += 1;
    }
  }

  return total > 0 ? hitCount / total : 0;
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }

  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/** Result of a retrieval query. */
export interface RetrievalResult {
  /** Templates selected for prompt injection. */
  templates: ActionTemplate[];
  /** Relevant skills from the taxonomy. */
  skills: SkillEntry[];
  /** Stages the retrieval covers. */
  stages: JobSearchStage[];
  /** Short summary for debugging/tracing. */
  retrieval_summary: string;
  /** Per-template score diagnostics for offline tuning. */
  score_breakdown: Array<{ template_id: string; score: number; features: Record<string, number> }>;
}

/** Configuration for the retriever. */
export interface RetrieverConfig {
  /** Maximum templates to include in a single prompt. */
  max_templates: number;
  /** Maximum skills to include. */
  max_skills: number;
  /** Minimum relevance score to include a template (0-1). */
  min_relevance: number;
  /** Whether to diversify across job-search stages. */
  diversify_stages: boolean;
}

const DEFAULT_CONFIG: RetrieverConfig = {
  max_templates: 8,
  max_skills: 5,
  min_relevance: 0.1,
  diversify_stages: true,
};

const WEIGHTS = {
  goal_token_overlap: 2.6,
  goal_phrase_overlap: 2.2,
  barrier_exact_match: 4.8,
  barrier_tag_exact_match: 3.8,
  skill_token_overlap: 1.8,
  confidence_fit: 1.0,
  support_fit: 1.2,
  effort_fit: 0.5,
  prerequisites_bonus: 0.8,
  semantic_similarity: 1.6,
  contraindicated_stage_penalty: -3.0,
  contraindicated_barrier_penalty: -5.0,
};

interface ScoredCandidate {
  template: ActionTemplate;
  score: number;
  features: Record<string, number>;
}

/**
 * Retrieves relevant templates and skills for a user profile.
 * Uses a multi-signal scoring approach combining:
 * - Barrier matching
 * - Goal/skill keyword matching
 * - Confidence-level filtering
 * - Stage diversification
 */
export class LocalRetriever {
  private library: ActionLibrary;
  private config: RetrieverConfig;

  constructor(library: ActionLibrary, config: Partial<RetrieverConfig> = {}) {
    this.library = library;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Retrieve templates and skills relevant to the user profile. */
  retrieve(profile: UserProfile): RetrievalResult {
    const candidates = this.gatherCandidates(profile);
    const scored = this.scoreCandidates(candidates, profile);

    const selectedTemplates = profile.resolved_barrier
      ? this.barrierPrioritisedSelect(scored, this.config.max_templates, profile)
      : this.config.diversify_stages
        ? this.diverseSelect(scored, this.config.max_templates)
        : scored.slice(0, this.config.max_templates).map((s) => s.template);

    const selectedSet = new Set(selectedTemplates.map((t) => t.id));
    const score_breakdown = scored
      .filter((s) => selectedSet.has(s.template.id))
      .map((s) => ({ template_id: s.template.id, score: s.score, features: s.features }));

    const skills = this.retrieveSkills(profile);
    const stages = [...new Set(selectedTemplates.map((t) => t.stage))];

    return {
      templates: selectedTemplates,
      skills,
      stages,
      retrieval_summary: `Retrieved ${selectedTemplates.length} templates across ${stages.length} stages, ${skills.length} skills (barrier: ${profile.resolved_barrier?.id ?? "none"})`,
      score_breakdown,
    };
  }

  private barrierPrioritisedSelect(
    scored: ScoredCandidate[],
    maxCount: number,
    profile: UserProfile,
  ): ActionTemplate[] {
    const resolved = profile.resolved_barrier!;
    const barrierTerms = [resolved.id, ...resolved.retrieval_tags].map(normalizeTerm);
    const contraindicated = new Set(resolved.contraindicated_stages);

    const barrierMatched: ScoredCandidate[] = [];
    const other: ScoredCandidate[] = [];

    for (const item of scored) {
      if (contraindicated.has(item.template.stage)) continue;
      if (this.isTemplateContraindicatedForBarrier(item.template, resolved)) continue;

      const barrierExact = item.template.relevant_barriers.some((rb) =>
        barrierTerms.some((bt) => hasTokenBoundaryMatch(rb.toLowerCase(), bt) || hasTokenBoundaryMatch(bt, rb.toLowerCase()))
      );
      const barrierTagExact = item.template.tags.some((tag) =>
        barrierTerms.some((bt) => hasTokenBoundaryMatch(tag.toLowerCase(), bt))
      );

      if (barrierExact || barrierTagExact) {
        barrierMatched.push(item);
      } else {
        other.push(item);
      }
    }

    const minBarrier = Math.min(Math.ceil(maxCount / 2), barrierMatched.length);
    const selected: ActionTemplate[] = barrierMatched.slice(0, minBarrier).map((s) => s.template);

    const remaining = maxCount - selected.length;
    if (remaining > 0 && other.length > 0) {
      selected.push(...this.diverseSelect(other, remaining));
    }

    if (selected.length < maxCount && barrierMatched.length > minBarrier) {
      for (let i = minBarrier; i < barrierMatched.length && selected.length < maxCount; i++) {
        selected.push(barrierMatched[i].template);
      }
    }

    return selected;
  }

  private gatherCandidates(profile: UserProfile): Set<ActionTemplate> {
    const candidates = new Set<ActionTemplate>();

    if (profile.barriers.length > 0) {
      for (const t of this.library.getByBarriers(profile.barriers)) candidates.add(t);
    }

    if (profile.resolved_barrier) {
      for (const t of this.library.getByTags(profile.resolved_barrier.retrieval_tags)) candidates.add(t);
    }

    for (const t of this.library.search(profile.job_goal, 20)) candidates.add(t);

    if (profile.skills.length > 0) {
      for (const t of this.library.getByTags(profile.skills)) candidates.add(t);
    }

    if (profile.industry) {
      for (const t of this.library.getByTags([profile.industry])) candidates.add(t);
    }

    for (const t of this.library.getByConfidence(profile.confidence_level)) candidates.add(t);

    if (candidates.size < this.config.max_templates) {
      const coreStages: JobSearchStage[] = ["cv_preparation", "applications", "networking", "interviewing"];
      const contraindicated = profile.resolved_barrier?.contraindicated_stages ?? [];
      for (const stage of coreStages) {
        if (!contraindicated.includes(stage)) {
          for (const t of this.library.getByStage(stage)) candidates.add(t);
        }
      }
    }

    return candidates;
  }

  private scoreCandidates(candidates: Set<ActionTemplate>, profile: UserProfile): ScoredCandidate[] {
    const scored: ScoredCandidate[] = [];

    const goalQuery = profile.job_goal.toLowerCase();
    const goalTokens = tokenSet(goalQuery);
    const skillTokens = tokenSet(profile.skills.join(" "));
    const barrierTerms = profile.barriers.map(normalizeTerm).filter((t) => t.length > 0);
    const resolved = profile.resolved_barrier;
    const semanticQuery = this.buildLightweightSemanticVector(profile);

    for (const template of candidates) {
      const features: Record<string, number> = {};
      const templateText = [template.action_template, template.stage, ...template.tags, ...template.relevant_barriers].join(" ").toLowerCase();
      const templateTokens = tokenSet(templateText);

      features.goal_token_overlap = overlapRatio(goalTokens, templateTokens) * WEIGHTS.goal_token_overlap;
      features.goal_phrase_overlap = phraseOverlapScore(goalQuery, templateText) * WEIGHTS.goal_phrase_overlap;

      const barrierExactHits = barrierTerms.filter((barrier) =>
        template.relevant_barriers.some((rb) => hasTokenBoundaryMatch(rb.toLowerCase(), barrier))
      ).length;
      features.barrier_exact_match = barrierExactHits * WEIGHTS.barrier_exact_match;

      if (resolved) {
        const barrierTagHits = resolved.retrieval_tags.filter((tag) =>
          template.tags.some((templateTag) => hasTokenBoundaryMatch(templateTag.toLowerCase(), tag.toLowerCase()))
        ).length;
        features.barrier_tag_exact_match = barrierTagHits * WEIGHTS.barrier_tag_exact_match;

        if (resolved.contraindicated_stages.includes(template.stage)) {
          features.contraindicated_stage_penalty = WEIGHTS.contraindicated_stage_penalty;
        }

        if (this.isTemplateContraindicatedForBarrier(template, resolved)) {
          features.contraindicated_barrier_penalty = WEIGHTS.contraindicated_barrier_penalty;
        }

        if ((template.required_prerequisites ?? []).length > 0) {
          features.prerequisites_bonus = WEIGHTS.prerequisites_bonus;
        }
      }

      const skillTagText = template.tags.join(" ").toLowerCase();
      features.skill_token_overlap = overlapRatio(skillTokens, tokenSet(skillTagText)) * WEIGHTS.skill_token_overlap;

      if (template.min_confidence <= profile.confidence_level) {
        features.confidence_fit = WEIGHTS.confidence_fit;
      }

      if (template.support_level === "high" && profile.confidence_level <= 2) {
        features.support_fit = WEIGHTS.support_fit;
      } else if (template.support_level === "medium" && profile.confidence_level <= 3) {
        features.support_fit = WEIGHTS.support_fit * 0.75;
      } else if (template.support_level === "low" && profile.confidence_level >= 4) {
        features.support_fit = WEIGHTS.support_fit * 0.5;
      }

      if (template.effort_hint && profile.hours_per_week > 0) {
        features.effort_fit = WEIGHTS.effort_fit;
      }

      const templateEmbedding = this.library.getTemplateEmbedding(template.id);
      if (semanticQuery && templateEmbedding) {
        const sim = Math.max(0, cosineSimilarity(semanticQuery, templateEmbedding));
        features.semantic_similarity = sim * WEIGHTS.semantic_similarity;
      }

      const score = Object.values(features).reduce((sum, val) => sum + val, 0);
      if (score >= this.config.min_relevance) {
        scored.push({ template, score, features });
      }
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  private buildLightweightSemanticVector(profile: UserProfile): number[] | null {
    const corpus = `${profile.job_goal} ${profile.skills.join(" ")} ${profile.barriers.join(" ")}`.trim();
    const terms = tokenize(corpus).filter((term) => term.length > 2);
    if (terms.length === 0) return null;

    // 16-d hashed bag-of-words vector for lightweight paraphrase signal.
    const dims = 16;
    const vector = new Array<number>(dims).fill(0);
    for (const term of terms) {
      let hash = 2166136261;
      for (let i = 0; i < term.length; i++) {
        hash ^= term.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
      const idx = Math.abs(hash) % dims;
      vector[idx] += 1;
    }

    return vector;
  }

  private diverseSelect(scored: ScoredCandidate[], maxCount: number): ActionTemplate[] {
    const byStage = new Map<JobSearchStage, ScoredCandidate[]>();

    for (const item of scored) {
      const stageList = byStage.get(item.template.stage) ?? [];
      stageList.push(item);
      byStage.set(item.template.stage, stageList);
    }

    const selected: ActionTemplate[] = [];
    const stageQueues = Array.from(byStage.values());
    let stageIndex = 0;

    while (selected.length < maxCount && stageQueues.some((q) => q.length > 0)) {
      const queue = stageQueues[stageIndex % stageQueues.length];
      if (queue.length > 0) {
        selected.push(queue.shift()!.template);
      }
      stageIndex++;
    }

    return selected;
  }

  private isTemplateContraindicatedForBarrier(template: ActionTemplate, barrier: ResolvedBarrier): boolean {
    const contraindicated = (template.contraindicated_barriers ?? []).map((b) => b.toLowerCase());
    if (contraindicated.length === 0) return false;

    const barrierTerms = [barrier.id, ...barrier.retrieval_tags].map(normalizeTerm);
    return contraindicated.some((cb) =>
      barrierTerms.some((term) => hasTokenBoundaryMatch(cb, term) || hasTokenBoundaryMatch(term, cb))
    );
  }

  private retrieveSkills(profile: UserProfile): SkillEntry[] {
    const allSkills: SkillEntry[] = [];
    const seen = new Set<string>();

    for (const skill of this.library.searchSkills(profile.job_goal, 3)) {
      if (!seen.has(skill.id)) {
        seen.add(skill.id);
        allSkills.push(skill);
      }
    }

    for (const userSkill of profile.skills) {
      for (const skill of this.library.searchSkills(userSkill, 2)) {
        if (!seen.has(skill.id)) {
          seen.add(skill.id);
          allSkills.push(skill);
        }
      }
    }

    return allSkills.slice(0, this.config.max_skills);
  }
}
