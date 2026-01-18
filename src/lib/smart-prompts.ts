/**
 * AI Prompts for SMART Action Tool
 * 
 * IMPORTANT: These prompts are designed to generate practical, actionable suggestions
 * that don't assume advisors have access to specific resources (booklets, templates, 
 * specific services, etc.). When referencing resources, use:
 * - Free, publicly available resources (gov.uk, NHS, Citizens Advice, etc.)
 * - Generic descriptions that advisors can adapt ("the agreed provider", "your local...")
 * - Simple alternatives (pen and paper, notes on phone, etc.)
 */

export const IMPROVE_PROMPT = `You are a SMART action improvement specialist for UK employment advisors. Your job is to enhance employment-related actions to be more Specific, Measurable, Achievable, Relevant, and Time-bound.

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

IMPORTANT - Be practical and realistic:
- Do NOT reference resources the advisor may not have (booklets, worksheets, templates, specific courses)
- Use free, widely available resources when needed (gov.uk websites, NHS services, Citizens Advice, public libraries)
- Keep actions achievable with basic tools (pen and paper, phone, internet access at library)
- If the participant has limited resources, suggest free alternatives
- Focus on what the participant will DO, not what they will read or be given

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

IMPORTANT: 
- Make minimal changes - only add what's needed to satisfy the {criterion} criterion
- Be practical - don't reference resources the advisor may not have (booklets, worksheets, specific templates)
- Use free, public resources if needed (gov.uk, NHS, Citizens Advice, libraries)
- Keep it achievable with basic tools available to anyone

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
