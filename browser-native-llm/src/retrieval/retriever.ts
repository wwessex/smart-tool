/**
 * Local retrieval engine for grounding LLM prompts.
 *
 * Given a user profile and goal, retrieves the most relevant action
 * templates and skills from the local action library. Retrieved
 * snippets are injected into the prompt to ground model outputs
 * in curated, realistic job-search guidance.
 */

import type { UserProfile, ActionTemplate, SkillEntry, JobSearchStage } from "../types.js";
import { ActionLibrary } from "./action-library.js";
import { splitOnWhitespace } from "../utils/sanitize.js";

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
    // Collect candidate templates from multiple signals
    const candidates = this.gatherCandidates(profile);

    // Score and rank candidates
    const scored = this.scoreCandidates(candidates, profile);

    // Select top templates, optionally diversifying across stages
    const selectedTemplates = this.config.diversify_stages
      ? this.diverseSelect(scored, this.config.max_templates)
      : scored.slice(0, this.config.max_templates).map((s) => s.template);

    // Retrieve relevant skills
    const skills = this.retrieveSkills(profile);

    // Determine which stages are covered
    const stages = [...new Set(selectedTemplates.map((t) => t.stage))];

    return {
      templates: selectedTemplates,
      skills,
      stages,
      retrieval_summary: `Retrieved ${selectedTemplates.length} templates across ${stages.length} stages, ${skills.length} skills`,
    };
  }

  private gatherCandidates(profile: UserProfile): Set<ActionTemplate> {
    const candidates = new Set<ActionTemplate>();

    // Signal 1: barrier-matched templates
    if (profile.barriers.length > 0) {
      for (const t of this.library.getByBarriers(profile.barriers)) {
        candidates.add(t);
      }
    }

    // Signal 2: goal keyword search
    const goalTemplates = this.library.search(profile.job_goal, 20);
    for (const t of goalTemplates) {
      candidates.add(t);
    }

    // Signal 3: skill-tagged templates
    if (profile.skills.length > 0) {
      const skillTemplates = this.library.getByTags(profile.skills);
      for (const t of skillTemplates) {
        candidates.add(t);
      }
    }

    // Signal 4: industry-tagged templates
    if (profile.industry) {
      const industryTemplates = this.library.getByTags([profile.industry]);
      for (const t of industryTemplates) {
        candidates.add(t);
      }
    }

    // Signal 5: confidence-appropriate templates
    const confidenceTemplates = this.library.getByConfidence(profile.confidence_level);
    for (const t of confidenceTemplates) {
      candidates.add(t);
    }

    // If we have very few candidates, add templates from all core stages
    if (candidates.size < this.config.max_templates) {
      const coreStages: JobSearchStage[] = [
        "cv_preparation",
        "applications",
        "networking",
        "interviewing",
      ];
      for (const stage of coreStages) {
        for (const t of this.library.getByStage(stage)) {
          candidates.add(t);
        }
      }
    }

    return candidates;
  }

  private scoreCandidates(
    candidates: Set<ActionTemplate>,
    profile: UserProfile
  ): Array<{ template: ActionTemplate; score: number }> {
    const scored: Array<{ template: ActionTemplate; score: number }> = [];
    const goalTerms = splitOnWhitespace(profile.job_goal.toLowerCase());
    const barrierTerms = profile.barriers.map((b) => b.toLowerCase());
    const skillTerms = profile.skills.map((s) => s.toLowerCase());

    for (const template of candidates) {
      let score = 0;
      const templateText = [
        template.action_template,
        ...template.tags,
        ...template.relevant_barriers,
      ]
        .join(" ")
        .toLowerCase();

      // Goal relevance (up to 3 points)
      for (const term of goalTerms) {
        if (term.length > 2 && templateText.includes(term)) {
          score += 1;
        }
      }
      score = Math.min(score, 3);

      // Barrier match (2 points per matching barrier)
      for (const barrier of barrierTerms) {
        if (template.relevant_barriers.some((rb) => rb.toLowerCase().includes(barrier))) {
          score += 2;
        }
      }

      // Skill match (1 point per matching skill)
      for (const skill of skillTerms) {
        if (template.tags.some((tag) => tag.toLowerCase().includes(skill))) {
          score += 1;
        }
      }

      // Confidence appropriateness (1 point if within range)
      if (template.min_confidence <= profile.confidence_level) {
        score += 1;
      }

      // Effort feasibility (1 point if effort hint seems compatible with hours)
      if (template.effort_hint && profile.hours_per_week > 0) {
        score += 0.5;
      }

      if (score >= this.config.min_relevance) {
        scored.push({ template, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Select templates ensuring diversity across job-search stages.
   * Uses round-robin across stages, prioritising higher-scored templates.
   */
  private diverseSelect(
    scored: Array<{ template: ActionTemplate; score: number }>,
    maxCount: number
  ): ActionTemplate[] {
    const byStage = new Map<JobSearchStage, Array<{ template: ActionTemplate; score: number }>>();

    for (const item of scored) {
      const stage = item.template.stage;
      const stageList = byStage.get(stage) ?? [];
      stageList.push(item);
      byStage.set(stage, stageList);
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

  private retrieveSkills(profile: UserProfile): SkillEntry[] {
    const allSkills: SkillEntry[] = [];
    const seen = new Set<string>();

    // Search by goal
    for (const skill of this.library.searchSkills(profile.job_goal, 3)) {
      if (!seen.has(skill.id)) {
        seen.add(skill.id);
        allSkills.push(skill);
      }
    }

    // Search by existing skills
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
