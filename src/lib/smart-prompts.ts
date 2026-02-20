/**
 * AI Prompts for SMART Action Tool
 * Optimized for both small local LLMs (135M-500M) and cloud AI
 */

export const IMPROVE_PROMPT = `You are a SMART action improvement specialist for employment advisors. Your job is to enhance employment-related actions to be more Specific, Measurable, Achievable, Relevant, and Time-bound.

Current action: {action}
Barrier being addressed: {barrier}
Participant name: {forename}
Current SMART score: {score}/5
Unmet criteria: {unmetCriteria}

Instructions:
1. Improve the action text to address ALL unmet SMART criteria
2. Keep the core intent of the original action
3. Use stronger commitment language ("will" instead of "try to")
4. Include specific dates, quantities, or measurable outcomes
5. Ensure it clearly links to the barrier being addressed
6. For barriers like autism, ADHD, learning difficulties, or developmental conditions, focus on reasonable adjustments and supportive actions

CRITICAL: You MUST respond with ONLY valid JSON. No explanation text before or after the JSON object.

Response format:
\`\`\`json
{
  "improved": "The improved action text that addresses all SMART criteria...",
  "explanation": "Brief explanation of what was changed and why...",
  "changes": ["Specific change 1", "Specific change 2", "Specific change 3"]
}
\`\`\``;

export const FIX_CRITERION_PROMPT = `You are a SMART action specialist for UK employment advisors. Fix ONLY the {criterion} criterion in this action.

Current action: {action}
Barrier being addressed: {barrier}
Participant name: {forename}

The action is missing the {criterion} element. Fix ONLY this aspect while keeping everything else the same.

{criterionGuidance}

IMPORTANT: Make minimal changes - only add what's needed to satisfy the {criterion} criterion.

CRITICAL: Respond with ONLY valid JSON:
\`\`\`json
{{
  "fixed": "The improved action with ONLY the {criterion} element fixed...",
  "whatChanged": "Brief description of what was added/changed"
}}
\`\`\``;

export const CRITERION_GUIDANCE: Record<string, string> = {
  specific: `To make it SPECIFIC, add:
- WHO is doing the action (use the participant's name)
- WHAT exactly they will do (concrete action verb)
- WHERE it will happen (location, website, etc.)
Example: "John will apply for 3 warehouse roles on Indeed.co.uk"`,
  
  measurable: `To make it MEASURABLE, add:
- A specific NUMBER (e.g., "2 applications", "3 employers")
- A specific DATE (e.g., "by 20-Jan-26")
- OR a clear outcome that can be verified
Example: "Submit 2 applications by 25-Jan-26"`,
  
  achievable: `To make it ACHIEVABLE, add:
- Evidence of agreement (e.g., "has agreed to", "discussed and confirmed")
- Show commitment (e.g., "commits to", "will")
- Mention support if relevant (e.g., "with support from advisor")
Example: "John has agreed to complete the CV update with support from the careers advisor"`,
  
  relevant: `To make it RELEVANT, add:
- Clear link to the barrier being addressed
- Explain HOW this action helps with employment
- Connect the action to their job goal
Example: "To address transport barriers, John will research bus routes to the industrial estate"`,
  
  timeBound: `To make it TIME-BOUND, add:
- A specific deadline (e.g., "by 25-Jan-26")
- A review date (e.g., "review at next appointment on 30-Jan-26")
- A timeframe (e.g., "within 2 weeks")
Example: "Complete by Friday 24-Jan-26, to be reviewed at next appointment"`
};

export const WIZARD_PROMPTS = {
  now: {
    who: "Enter the participant's first name",
    barrier: "What barrier to work are we addressing?",
    what: "What specific action will they take?",
    responsible: "Who is responsible for supporting this action?",
    help: "How will this action help with their employment goal?",
    when: "When will this be reviewed?"
  },
  future: {
    who: "Enter the participant's first name",
    task: "What activity, event, or task will they complete?",
    outcome: "What is the expected outcome or result?",
    when: "When will this be reviewed?"
  }
};

// ===== AI DRAFT PROMPTS FOR LOCAL LLM =====
// These are optimized for small LLMs (135M-500M parameters)
// Keep prompts concise, direct, and context-specific
// CRITICAL: Include negative instructions to prevent off-topic generation

export const DRAFT_ACTION_PROMPT = `TASK: Write ONE realistic employment action sentence.

CONTEXT:
- Person: {forename}
- Barrier: {barrier}
- Deadline: {targetDate}
- Supporter: {responsible}

RULES:
1. Start with "{forename} will"
2. Include specific task related to "{barrier}"
3. End with "by {targetDate}"
4. Employment focus only - job search, skills, interviews, CV, etc.
5. NEVER mention money, prizes, awards, payments, or rewards.
6. NEVER promise job offers or guaranteed outcomes.

WRONG: "working on a project", "learning Python", "be awarded £5000", "receive a prize", "get hired"
RIGHT: "{forename} will apply for 3 jobs on Indeed by {targetDate}."

OUTPUT: One sentence only, no quotes.`;

// Compact version for smaller models - even more direct
export const DRAFT_ACTION_PROMPT_COMPACT = `Write ONE job search action for {forename}.

Barrier: {barrier}
Deadline: {targetDate}

Format: "{forename} will [job search action] by {targetDate}."

NOT about: projects, coding, teams, AI, meetings, prizes, money, awards.
ONLY about: jobs, CV, interviews, applications, skills.

One sentence:`;

// Help prompts - use {subject} placeholder which will be "I" or forename
export const DRAFT_HELP_PROMPT = `Given this action: "{action}"

How will completing this help {subject} get a job?
Write a brief benefit (one phrase).

Examples:
- "get shortlisted for interviews"
- "have a stronger CV"
- "feel more confident"

OUTPUT: One phrase, no quotes, no "This will help".`;

// Compact version
export const DRAFT_HELP_PROMPT_COMPACT = `Action: "{action}"

Job benefit for {subject}? One phrase:`;

export const DRAFT_OUTCOME_PROMPT = `TASK: Write what {forename} will realistically achieve from this activity.

Activity: {task}

RULES:
1. Start with "{forename} will"
2. Focus on employment benefit (job skills, confidence, knowledge)
3. One or two sentences max
4. NEVER mention money, prizes, awards, or guaranteed job offers.

WRONG: "complete the project", "learn new technologies", "be awarded £5000", "receive a prize"
RIGHT: "{forename} will gain interview skills and feel more confident meeting employers."

OUTPUT: One sentence, no quotes.`;

// Compact version
export const DRAFT_OUTCOME_PROMPT_COMPACT = `Activity: {task}

What will {forename} gain for job search?
Format: "{forename} will [employment benefit]."
NOT: money, prizes, awards, job offers.

One sentence:`;

// Helper to select appropriate prompt based on model size
export function getPromptForModel(
  promptType: 'action' | 'help' | 'outcome',
  modelId?: string,
  isCompact: boolean = false
): string {
  // Use compact prompts for smallest models or when explicitly requested
  const useCompact = isCompact || (modelId && modelId.includes('135M'));
  
  switch (promptType) {
    case 'action':
      return useCompact ? DRAFT_ACTION_PROMPT_COMPACT : DRAFT_ACTION_PROMPT;
    case 'help':
      return useCompact ? DRAFT_HELP_PROMPT_COMPACT : DRAFT_HELP_PROMPT;
    case 'outcome':
      return useCompact ? DRAFT_OUTCOME_PROMPT_COMPACT : DRAFT_OUTCOME_PROMPT;
    default:
      return DRAFT_ACTION_PROMPT;
  }
}

// Helper to get correct subject for help prompt based on responsible person
export function getHelpSubject(forename: string, responsible: string): string {
  const lowerResp = responsible.toLowerCase().trim();
  // If responsible is "I" or "Advisor", the help describes benefit to the participant
  // But the language should match first-person if "I" was selected as the participant
  if (lowerResp === 'i') {
    return 'me';  // First person - "help me get..."
  }
  return forename;  // Third person - "help John get..."
}
