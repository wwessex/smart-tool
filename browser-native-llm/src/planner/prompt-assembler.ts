/**
 * Prompt assembler for the SMART action planner.
 *
 * Constructs structured prompts from user profiles and retrieved
 * action templates. The prompt format enforces JSON-only output
 * and includes SMART criteria rules as system instructions.
 */

import type { UserProfile, ActionTemplate, SkillEntry, ResolvedBarrier } from "../types.js";
import type { RetrievalResult } from "../retrieval/retriever.js";

/** Assembled prompt ready for the inference engine. */
export interface AssembledPrompt {
  /** The full prompt text. */
  text: string;
  /** Approximate token count (rough estimate). */
  estimated_tokens: number;
  /** Template IDs used for grounding traceability. */
  grounding_template_ids: string[];
  /** Prompt assembly observability metadata for truncation behavior. */
  metadata: {
    dropped_sections: string[];
    templates_included_count: number;
    skills_included_count: number;
    templates_dropped_count: number;
    skills_dropped_count: number;
  };
}

/** Configuration for prompt assembly. */
export interface PromptAssemblerConfig {
  /** Maximum prompt length in characters (to stay within context window). */
  max_prompt_chars: number;
  /** Number of example actions to include. */
  num_examples: number;
  /** Whether to include the retrieval pack templates verbatim. */
  include_templates: boolean;
  /** Maximum number of skills to include before any truncation drops all skills. */
  max_skills_context: number;
}

const DEFAULT_CONFIG: PromptAssemblerConfig = {
  max_prompt_chars: 3000,
  num_examples: 2,
  include_templates: true,
  max_skills_context: 3,
};

/**
 * Assemble a prompt from profile and retrieval results.
 */
export function assemblePrompt(
  profile: UserProfile,
  retrieval: RetrievalResult,
  config: Partial<PromptAssemblerConfig> = {}
): AssembledPrompt {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const mustKeepSections = {
    system: buildSystemInstructions(),
    profile: buildProfileSection(profile),
    barrier_guidance: profile.resolved_barrier
      ? buildBarrierGuidanceSection(profile.resolved_barrier)
      : "",
    output_format: buildOutputInstruction(profile),
  };

  const templatePool = cfg.include_templates
    ? [...retrieval.templates].sort((a, b) => templatePriorityScore(b, profile) - templatePriorityScore(a, profile))
    : [];
  const skillsPool = retrieval.skills.slice(0, cfg.max_skills_context);
  let templatesIncludedCount = templatePool.length;
  let skillsIncludedCount = skillsPool.length;

  const composePrompt = (): string => {
    const parts = [
      mustKeepSections.system,
      mustKeepSections.profile,
    ];

    if (templatesIncludedCount > 0) {
      parts.push(buildTemplateSection(templatePool.slice(0, templatesIncludedCount), profile));
    }

    if (skillsIncludedCount > 0) {
      parts.push(buildSkillsSection(skillsPool.slice(0, skillsIncludedCount)));
    }

    if (mustKeepSections.barrier_guidance) {
      parts.push(mustKeepSections.barrier_guidance);
    }

    parts.push(mustKeepSections.output_format);
    return parts.join("\n\n");
  };

  let text = composePrompt();

  // Section-priority budget strategy:
  // must keep = system/profile/barrier_guidance/output_format
  // nice-to-have = templates/skills
  // degrade gracefully by trimming templates first, then skills.
  while (text.length > cfg.max_prompt_chars) {
    if (templatesIncludedCount > 0) {
      templatesIncludedCount -= 1;
      text = composePrompt();
      continue;
    }

    if (skillsIncludedCount > 0) {
      skillsIncludedCount -= 1;
      text = composePrompt();
      continue;
    }

    // Budget exhausted while preserving required sections.
    break;
  }

  const grounding_template_ids = templatePool
    .slice(0, templatesIncludedCount)
    .map((t) => t.id);

  const dropped_sections: string[] = [];
  if (templatePool.length > 0 && templatesIncludedCount === 0) {
    dropped_sections.push("templates");
  } else if (templatesIncludedCount < templatePool.length) {
    dropped_sections.push("templates_partial");
  }
  if (skillsPool.length > 0 && skillsIncludedCount === 0) {
    dropped_sections.push("skills");
  } else if (skillsIncludedCount < skillsPool.length) {
    dropped_sections.push("skills_partial");
  }

  // Rough token estimate: ~4 chars per token for English
  const estimated_tokens = Math.ceil(text.length / 4);

  return {
    text,
    estimated_tokens,
    grounding_template_ids,
    metadata: {
      dropped_sections,
      templates_included_count: templatesIncludedCount,
      skills_included_count: skillsIncludedCount,
      templates_dropped_count: templatePool.length - templatesIncludedCount,
      skills_dropped_count: skillsPool.length - skillsIncludedCount,
    },
  };
}

function buildSystemInstructions(): string {
  return `<|begin|>system
You are a SMART action planner for job seekers. Generate a JSON array of SMART actions.

RULES:
1. Output ONLY valid JSON inside <|json|> and <|/json|> tags. No other text.
2. Each action MUST have ALL required fields: action, metric, baseline, target, deadline, rationale, effort_estimate, first_step.
3. SPECIFIC: Each action must contain a concrete verb and specific artefact (e.g., "rewrite CV bullet points", not "improve CV").
4. MEASURABLE: Each metric must include a numeric target or countable outcome.
5. ACHIEVABLE: Actions must fit within the stated hours/week and respect barriers.
6. RELEVANT: Actions must connect to the stated job goal and industry.
7. TIME-BOUND: Each deadline must be a specific date or timeframe window.
8. Generate 3-8 actions covering different job-search stages.
9. Order actions by priority (most impactful first).
10. For low-confidence users, start with small, low-friction first steps.
11. NEVER provide medical, legal, or financial advice.
12. NEVER request or assume protected characteristics beyond what the user shares.
13. If a barrier is provided, prioritise barrier-reduction actions before generic job applications.
14. For confidence <=2, ensure the first action is low-friction and completable in under 30 minutes.
<|end|>`;
}

function buildProfileSection(profile: UserProfile): string {
  const lines = [
    "<|begin|>user",
    "PROFILE:",
    `- Goal: ${profile.job_goal}`,
  ];

  if (profile.participant_name) {
    lines.push(`- Participant name: ${profile.participant_name}`);
  }

  if (profile.current_situation) {
    lines.push(`- Current situation: ${profile.current_situation}`);
  }

  if (profile.supporter) {
    lines.push(`- Supported by: ${profile.supporter}`);
  }

  lines.push(`- Available time: ${profile.hours_per_week} hours/week`);
  lines.push(`- Timeframe: ${profile.timeframe_weeks} weeks`);

  if (profile.skills.length > 0) {
    lines.push(`- Skills: ${profile.skills.join(", ")}`);
  }

  if (profile.barriers.length > 0) {
    lines.push(`- Key barrier(s): ${profile.barriers.map(b => b.replace(/_/g, " ")).join(", ")}`);
  }

  lines.push(`- Confidence level: ${profile.confidence_level}/5`);

  if (profile.industry) {
    lines.push(`- Industry: ${profile.industry}`);
  }

  if (profile.work_arrangement && profile.work_arrangement !== "any") {
    lines.push(`- Work arrangement: ${profile.work_arrangement}`);
  }

  return lines.join("\n");
}

function buildTemplateSection(
  templates: ActionTemplate[],
  profile: UserProfile
): string {
  const lines = ["REFERENCE ACTIONS (adapt and personalise these):"];

  for (const template of templates) {
    // Substitute placeholders in template
    const action = substitutePlaceholders(template.action_template, profile);
    const metric = substitutePlaceholders(template.metric_template, profile);
    const prerequisites = (template.required_prerequisites ?? []).join("; ");
    const contraindications = (template.contraindicated_barriers ?? []).join(", ");
    const supportLevel = template.support_level ? `, support: ${template.support_level}` : "";
    const prereqNote = prerequisites ? `, prerequisites: ${prerequisites}` : "";
    const avoidNote = contraindications ? `, avoid_for: ${contraindications}` : "";
    lines.push(`- [${template.id}] ${action} (measure: ${metric}, effort: ${template.effort_hint}${supportLevel}${prereqNote}${avoidNote})`);
  }

  return lines.join("\n");
}

function buildSkillsSection(skills: SkillEntry[]): string {
  const lines = ["RELEVANT SKILLS TO HIGHLIGHT:"];
  for (const skill of skills) {
    lines.push(`- ${skill.label} (${skill.category})`);
  }
  return lines.join("\n");
}

function buildOutputInstruction(profile: UserProfile): string {
  const today = new Date();
  const deadlineDate = new Date(today);
  deadlineDate.setDate(today.getDate() + profile.timeframe_weeks * 7);

  const nameContext = profile.participant_name
    ? ` for ${profile.participant_name}`
    : " for this person";
  const barrierContext = profile.barriers.length > 0
    ? ` that specifically address their ${profile.barriers.map(b => b.replace(/_/g, " ")).join(" and ")} barrier(s)`
    : "";

  return `Generate ${getActionCount(profile)} SMART actions${nameContext}${barrierContext}. All deadlines must be between ${formatDate(today)} and ${formatDate(deadlineDate)}.
<|end|>
<|begin|>assistant
<|json|>`;
}

function buildBarrierGuidanceSection(barrier: ResolvedBarrier): string {
  const lines = [`BARRIER GUIDANCE (${barrier.label}):`];

  if (barrier.prompt_hints.length > 0) {
    for (const hint of barrier.prompt_hints) {
      lines.push(`- ${hint}`);
    }
  }

  if (barrier.do_not_assume.length > 0) {
    lines.push("DO NOT ASSUME:");
    for (const assumption of barrier.do_not_assume) {
      lines.push(`- ${assumption}`);
    }
  }

  if ((barrier.starter_actions ?? []).length > 0) {
    lines.push("BARRIER-FIRST STARTER ACTIONS (prefer these early):");
    for (const starter of barrier.starter_actions ?? []) {
      lines.push(`- ${starter}`);
    }
  }

  return lines.join("\n");
}

function getActionCount(profile: UserProfile): string {
  // Fewer actions for users with less time or lower confidence
  if (profile.hours_per_week <= 4 || profile.confidence_level <= 1) return "3-4";
  if (profile.hours_per_week <= 8 || profile.confidence_level <= 2) return "4-5";
  return "5-7";
}

function substitutePlaceholders(template: string, profile: UserProfile): string {
  return template
    .replace(/\{goal\}/g, profile.job_goal)
    .replace(/\{industry\}/g, profile.industry ?? "your target sector")
    .replace(/\{skill\}/g, profile.skills[0] ?? "relevant")
    .replace(/\{count\}/g, "3")
    .replace(/\{barrier\}/g, profile.barriers[0]?.replace(/_/g, " ") ?? "")
    .replace(/\{name\}/g, profile.participant_name || "the participant");
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function templatePriorityScore(template: ActionTemplate, profile: UserProfile): number {
  let score = 0;

  if (profile.resolved_barrier) {
    const barrierTerms = [profile.resolved_barrier.id, ...profile.resolved_barrier.retrieval_tags]
      .map((term) => term.toLowerCase());
    const hasBarrierMatch = template.relevant_barriers.some((barrier) =>
      barrierTerms.some((term) => barrier.toLowerCase().includes(term) || term.includes(barrier.toLowerCase()))
    ) || template.tags.some((tag) =>
      barrierTerms.some((term) => tag.toLowerCase().includes(term))
    );

    if (hasBarrierMatch) {
      score += 100;
    }
  }

  const confidenceDistance = Math.abs(template.min_confidence - profile.confidence_level);
  score += Math.max(0, 10 - confidenceDistance);

  return score;
}
