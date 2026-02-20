/**
 * Local action library for grounding LLM outputs.
 *
 * Manages a curated set of SMART action templates assembled from
 * open-licensed official sources (UK National Careers Service under OGL,
 * O*NET under CC BY, ESCO under CC BY). Templates provide realistic,
 * actionable job-search steps that anchor model outputs and reduce
 * hallucination.
 */

import type { ActionTemplate, SkillEntry, RetrievalPack, JobSearchStage } from "../types.js";
import { validateUrl, splitOnWhitespace } from "../utils/sanitize.js";

/** In-memory action library loaded from a retrieval pack. */
export class ActionLibrary {
  private templates: ActionTemplate[] = [];
  private skills: SkillEntry[] = [];
  private templatesByStage: Map<JobSearchStage, ActionTemplate[]> = new Map();
  private templatesByTag: Map<string, ActionTemplate[]> = new Map();
  private version = "";

  /** Load a retrieval pack (from bundled JSON or fetched from URL). */
  loadPack(pack: RetrievalPack): void {
    this.templates = pack.templates;
    this.skills = pack.skills;
    this.version = pack.version;

    // Build indices
    this.templatesByStage.clear();
    this.templatesByTag.clear();

    for (const template of this.templates) {
      // Index by stage
      const stageList = this.templatesByStage.get(template.stage) ?? [];
      stageList.push(template);
      this.templatesByStage.set(template.stage, stageList);

      // Index by tags
      for (const tag of template.tags) {
        const tagLower = tag.toLowerCase();
        const tagList = this.templatesByTag.get(tagLower) ?? [];
        tagList.push(template);
        this.templatesByTag.set(tagLower, tagList);
      }
    }
  }

  /** Load a retrieval pack from a URL. */
  async loadFromUrl(url: string): Promise<void> {
    const validatedUrl = validateUrl(url);
    const response = await fetch(validatedUrl);
    if (!response.ok) {
      throw new Error(`Failed to load retrieval pack from ${url}: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new Error(`Unexpected content-type for retrieval pack: ${contentType}`);
    }
    const pack: RetrievalPack = await response.json();
    this.loadPack(pack);
  }

  /** Get all templates for a given job-search stage. */
  getByStage(stage: JobSearchStage): ActionTemplate[] {
    return this.templatesByStage.get(stage) ?? [];
  }

  /** Get templates matching any of the given tags. */
  getByTags(tags: string[]): ActionTemplate[] {
    const seen = new Set<string>();
    const results: ActionTemplate[] = [];

    for (const tag of tags) {
      const matches = this.templatesByTag.get(tag.toLowerCase()) ?? [];
      for (const template of matches) {
        if (!seen.has(template.id)) {
          seen.add(template.id);
          results.push(template);
        }
      }
    }

    return results;
  }

  /** Get templates relevant to specific barriers. */
  getByBarriers(barriers: string[]): ActionTemplate[] {
    const barriersLower = barriers.map((b) => b.toLowerCase());
    return this.templates.filter((t) =>
      t.relevant_barriers.some((rb) =>
        barriersLower.some((b) => rb.toLowerCase().includes(b) || b.includes(rb.toLowerCase()))
      )
    );
  }

  /** Get templates appropriate for a given confidence level. */
  getByConfidence(confidenceLevel: number): ActionTemplate[] {
    return this.templates.filter((t) => t.min_confidence <= confidenceLevel);
  }

  /**
   * Search templates by a free-text query.
   * Uses simple keyword matching against action_template, tags, and stage.
   */
  search(query: string, maxResults: number = 10): ActionTemplate[] {
    const queryTerms = splitOnWhitespace(query.toLowerCase())
      .filter((t) => t.length > 2);

    if (queryTerms.length === 0) return [];

    const scored: Array<{ template: ActionTemplate; score: number }> = [];

    for (const template of this.templates) {
      let score = 0;
      const searchText = [
        template.action_template,
        template.stage,
        ...template.tags,
        ...template.relevant_barriers,
      ]
        .join(" ")
        .toLowerCase();

      for (const term of queryTerms) {
        if (searchText.includes(term)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ template, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => s.template);
  }

  /** Look up skills by keyword or category. */
  searchSkills(query: string, maxResults: number = 10): SkillEntry[] {
    const queryLower = query.toLowerCase();
    return this.skills
      .filter(
        (s) =>
          s.label.toLowerCase().includes(queryLower) ||
          s.category.toLowerCase().includes(queryLower) ||
          s.occupations.some((o) => o.toLowerCase().includes(queryLower))
      )
      .slice(0, maxResults);
  }

  /** Get all available job-search stages that have templates. */
  getAvailableStages(): JobSearchStage[] {
    return Array.from(this.templatesByStage.keys());
  }

  get templateCount(): number {
    return this.templates.length;
  }

  get skillCount(): number {
    return this.skills.length;
  }

  get packVersion(): string {
    return this.version;
  }
}
