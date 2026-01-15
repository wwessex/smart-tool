/**
 * AI Prompts for SMART Action Tool
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

Respond in valid JSON format only:
{
  "improved": "The improved action text that addresses all SMART criteria...",
  "explanation": "Brief explanation of what was changed and why...",
  "changes": ["Specific change 1", "Specific change 2", "Specific change 3"]
}`;

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
