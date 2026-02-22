/**
 * Canonical barrier catalog.
 *
 * Maps every barrier dropdown value to a structured profile containing:
 * - id: snake_case canonical ID (deterministic, used for retrieval matching)
 * - label: human-readable label (matches the UI dropdown text)
 * - aliases: alternative phrasings an advisor or participant might use
 * - category: broad barrier family for routing
 * - retrieval_tags: tags to boost retrieval pack matching
 * - prompt_hints: injected into the prompt to guide the LLM
 * - do_not_assume: things the model must NOT assume about the participant
 * - starter_actions: low-friction first steps appropriate for this barrier
 * - contraindicated_stages: job-search stages to deprioritise for this barrier
 */

export interface BarrierEntry {
  /** Snake-case canonical ID. */
  id: string;
  /** Human-readable label (matches UI dropdown). */
  label: string;
  /** Alternative phrasings and keywords. */
  aliases: string[];
  /** Broad category for routing. */
  category: BarrierCategory;
  /** Tags to boost retrieval pack matching. */
  retrieval_tags: string[];
  /** Guidance hints injected into the LLM prompt. */
  prompt_hints: string[];
  /** Things the model must NOT assume. */
  do_not_assume: string[];
  /** Low-friction first steps suitable for this barrier. */
  starter_actions: string[];
  /** Job-search stages to deprioritise when this barrier is selected. */
  contraindicated_stages: string[];
}

export type BarrierCategory =
  | "practical_access"
  | "skills_and_qualifications"
  | "health_and_wellbeing"
  | "confidence_and_motivation"
  | "job_search_readiness"
  | "neurodiversity_and_learning"
  | "identity_and_documents";

/**
 * The canonical barrier catalog keyed by UI dropdown label.
 *
 * Every entry in DEFAULT_BARRIERS from smart-data.ts should have
 * a corresponding entry here. If a barrier is not found, the system
 * falls back to keyword-based normalisation (existing behaviour).
 */
export const BARRIER_CATALOG: Record<string, BarrierEntry> = {
  "Housing": {
    id: "housing",
    label: "Housing",
    aliases: ["housing", "homeless", "temporary accommodation", "sofa surfing", "no fixed address", "eviction", "rough sleeping"],
    category: "practical_access",
    retrieval_tags: ["housing", "accommodation", "stability", "support_service"],
    prompt_hints: [
      "Prioritise stability actions before job applications",
      "Include referrals to housing support services where appropriate",
      "Do not set unrealistic job search targets while housing is unstable",
    ],
    do_not_assume: ["stable address", "internet access at home", "safe storage for documents"],
    starter_actions: [
      "Contact local council Housing Options team",
      "Gather housing documents for referrals",
      "Research local housing support services",
    ],
    contraindicated_stages: ["applications", "interviewing"],
  },

  "Finance": {
    id: "finance",
    label: "Finance",
    aliases: ["finance", "debt", "money", "financial difficulties", "benefits", "budgeting", "arrears", "cost of living"],
    category: "practical_access",
    retrieval_tags: ["finance", "benefits", "budgeting", "debt", "support_service"],
    prompt_hints: [
      "Include actions to check benefits entitlement or access financial support",
      "Consider travel cost barriers when suggesting activities",
      "Suggest free or low-cost resources where possible",
    ],
    do_not_assume: ["money for travel", "internet access", "ability to pay for courses or certifications"],
    starter_actions: [
      "Complete a benefits entitlement check",
      "Create a simple weekly budget",
      "Contact debt advice service if needed",
    ],
    contraindicated_stages: [],
  },

  "Caring Responsibilities": {
    id: "caring_responsibilities",
    label: "Caring Responsibilities",
    aliases: ["childcare", "children", "school run", "caring", "carer", "elderly care", "dependants", "parental duties"],
    category: "practical_access",
    retrieval_tags: ["childcare", "caring", "flexible_working", "part_time", "support_service"],
    prompt_hints: [
      "Use flexible scheduling language and avoid rigid time commitments",
      "Suggest actions that can be done around caring responsibilities",
      "Include research into flexible or part-time work options",
      "Consider school hours and term-time working",
    ],
    do_not_assume: ["availability during school hours", "childcare arrangements", "ability to attend daytime appointments"],
    starter_actions: [
      "Research local childcare options and costs",
      "Explore flexible or part-time roles",
      "Contact local carers support service",
    ],
    contraindicated_stages: [],
  },

  "Digital Hardware & Connectivity": {
    id: "digital_access",
    label: "Digital Hardware & Connectivity",
    aliases: ["digital hardware", "connectivity", "no internet", "no computer", "no laptop", "wifi", "broadband", "phone"],
    category: "practical_access",
    retrieval_tags: ["digital_access", "hardware", "connectivity", "library", "support_service"],
    prompt_hints: [
      "Do not assume device or internet availability",
      "Suggest library computer access or community digital hubs",
      "Include actions that can be done offline or with limited digital access",
      "Prioritise getting digital access before requiring online activities",
    ],
    do_not_assume: ["internet access", "computer ownership", "smartphone", "email address", "printer access"],
    starter_actions: [
      "Register for free library computer access",
      "Explore low-cost connectivity options",
      "Set up a free email address with support",
    ],
    contraindicated_stages: ["online_presence"],
  },

  "Mental Wellbeing": {
    id: "mental_health",
    label: "Mental Wellbeing",
    aliases: ["mental wellbeing", "mental health", "wellbeing", "depression", "anxiety", "stress", "low mood"],
    category: "health_and_wellbeing",
    retrieval_tags: ["mental_health", "wellbeing", "self_care", "support_service", "confidence"],
    prompt_hints: [
      "Start with small, low-friction steps to build momentum",
      "Include wellbeing activities alongside job search tasks",
      "Do not overload with too many actions at once",
      "Suggest professional support referrals where appropriate",
    ],
    do_not_assume: ["consistent energy levels", "ability to maintain routine", "readiness for high-pressure activities"],
    starter_actions: [
      "Contact wellbeing or mental health service",
      "Practise one self-care activity three times this week",
      "Identify two triggers and one coping strategy for each",
    ],
    contraindicated_stages: ["interviewing"],
  },

  "Social & Support Networks": {
    id: "social_isolation",
    label: "Social & Support Networks",
    aliases: ["social", "support network", "isolation", "lonely", "no friends", "no family support"],
    category: "confidence_and_motivation",
    retrieval_tags: ["social", "isolation", "networking", "community", "support_service"],
    prompt_hints: [
      "Include group activities or community engagement opportunities",
      "Suggest peer support and networking as a first step",
      "Build social confidence before formal networking",
    ],
    do_not_assume: ["family support", "existing social network", "transport to social venues"],
    starter_actions: [
      "Research local community groups or job clubs",
      "Identify supportive people in current network",
      "Ask about mentoring services",
    ],
    contraindicated_stages: [],
  },

  "Communication Skills": {
    id: "communication",
    label: "Communication Skills",
    aliases: ["communication skills", "communication", "speaking", "verbal", "presentation", "articulation"],
    category: "skills_and_qualifications",
    retrieval_tags: ["communication", "speaking", "presentation", "workshop", "upskilling"],
    prompt_hints: [
      "Include structured communication practice activities",
      "Build up gradually from low-pressure to higher-pressure scenarios",
      "Suggest workshops or supported practice sessions",
    ],
    do_not_assume: ["confident speaker", "comfortable with phone calls", "able to attend group workshops"],
    starter_actions: [
      "Practise a one-minute self-introduction",
      "Attend a communication workshop",
      "Record a practice introduction and review it",
    ],
    contraindicated_stages: [],
  },

  "Digital Skills": {
    id: "digital_skills",
    label: "Digital Skills",
    aliases: ["digital skills", "computer skills", "technology", "not good with computers", "IT skills"],
    category: "skills_and_qualifications",
    retrieval_tags: ["digital_skills", "computer", "training", "upskilling", "online_learning"],
    prompt_hints: [
      "Suggest beginner-friendly digital skills resources",
      "Include guided support for online tasks rather than independent ones",
      "Build digital confidence incrementally",
    ],
    do_not_assume: ["ability to use email", "ability to navigate job boards independently", "confidence with technology"],
    starter_actions: [
      "Complete first module of digital skills course",
      "Practise writing a professional email",
      "Learn to use a job search website with support",
    ],
    contraindicated_stages: ["online_presence"],
  },

  "Literacy and/or Numeracy": {
    id: "literacy_numeracy",
    label: "Literacy and/or Numeracy",
    aliases: ["literacy", "numeracy", "reading", "writing", "maths", "spelling", "functional skills"],
    category: "skills_and_qualifications",
    retrieval_tags: ["literacy", "numeracy", "functional_skills", "upskilling", "support_service"],
    prompt_hints: [
      "Use clear, simple language in action descriptions",
      "Suggest one-to-one support rather than independent written tasks",
      "Include referrals to functional skills provision",
      "Do not set tasks requiring unsupported reading or writing",
    ],
    do_not_assume: ["ability to complete written applications independently", "confidence with numbers", "ability to read complex job descriptions"],
    starter_actions: [
      "Complete initial literacy and numeracy assessment",
      "Enrol in a free functional skills course",
      "Arrange one-to-one support sessions",
    ],
    contraindicated_stages: [],
  },

  "Qualifications": {
    id: "qualifications",
    label: "Qualifications",
    aliases: ["qualifications", "no qualifications", "certificates", "education", "no GCSEs"],
    category: "skills_and_qualifications",
    retrieval_tags: ["qualifications", "training", "courses", "upskilling", "certification"],
    prompt_hints: [
      "Suggest relevant courses or qualifications that support the job goal",
      "Include free or funded training options",
      "Consider prior learning and experience-based routes",
    ],
    do_not_assume: ["ability to self-fund courses", "recent classroom experience", "study skills"],
    starter_actions: [
      "Research relevant courses and qualifications",
      "Complete course application with support",
      "Explore recognition of prior learning",
    ],
    contraindicated_stages: [],
  },

  "Transferable Skills": {
    id: "transferable_skills",
    label: "Transferable Skills",
    aliases: ["transferable skills", "transferable", "skills from previous roles", "relevant experience"],
    category: "skills_and_qualifications",
    retrieval_tags: ["transferable_skills", "skills_audit", "cv", "career_change"],
    prompt_hints: [
      "Help identify transferable skills from all previous experience including volunteering",
      "Connect existing skills to target role requirements",
      "Include skills audit as an early action",
    ],
    do_not_assume: ["awareness of own transferable skills", "confidence in past experience"],
    starter_actions: [
      "Complete a transferable skills audit",
      "Research target sectors where skills apply",
      "Update CV to highlight transferable skills",
    ],
    contraindicated_stages: [],
  },

  "Learning Capability": {
    id: "learning_capability",
    label: "Learning Capability",
    aliases: ["learning capability", "slow learner", "difficulty learning", "learning support needs"],
    category: "neurodiversity_and_learning",
    retrieval_tags: ["learning_capability", "learning_support", "reasonable_adjustments", "upskilling"],
    prompt_hints: [
      "Suggest appropriate learning support and reasonable adjustments",
      "Break tasks into smaller, clearer steps",
      "Use simple and direct language",
    ],
    do_not_assume: ["standard learning pace", "independent study capability", "comfort with written instructions"],
    starter_actions: [
      "Complete a learning styles assessment",
      "Discuss learning support needs with provider",
      "Set clear, specific learning goals",
    ],
    contraindicated_stages: [],
  },

  "Previous Work History": {
    id: "work_history",
    label: "Previous Work History",
    aliases: ["previous work history", "work history", "employment gaps", "long-term unemployed", "no recent experience"],
    category: "job_search_readiness",
    retrieval_tags: ["work_history", "employment_gaps", "volunteering", "references", "cv"],
    prompt_hints: [
      "Include strategies for addressing employment gaps positively",
      "Suggest volunteering or work experience to build recent history",
      "Help prepare explanations for gaps in employment",
    ],
    do_not_assume: ["recent references", "recent work experience", "confidence discussing employment gaps"],
    starter_actions: [
      "Complete an employment history timeline",
      "Identify potential references",
      "Explore volunteering opportunities",
    ],
    contraindicated_stages: [],
  },

  "Transport": {
    id: "transport",
    label: "Transport",
    aliases: ["transport", "no car", "bus routes", "travel", "commute", "getting there", "travel costs"],
    category: "practical_access",
    retrieval_tags: ["transport", "travel", "route_planning", "travel_support", "remote_work"],
    prompt_hints: [
      "Include transport-first steps before suggesting in-person activities",
      "Consider remote or home-based alternatives where possible",
      "Include travel cost assessment and support options",
      "Suggest route planning as an early action",
    ],
    do_not_assume: ["driving licence", "car ownership", "money for taxis", "reliable public transport access"],
    starter_actions: [
      "Plan and save reliable routes to key locations",
      "Apply for travel support if eligible",
      "Research remote or local work opportunities",
    ],
    contraindicated_stages: [],
  },

  "Job Search": {
    id: "job_search",
    label: "Job Search",
    aliases: ["job search", "finding jobs", "where to look", "job boards", "searching for work"],
    category: "job_search_readiness",
    retrieval_tags: ["job_search", "job_boards", "job_alerts", "applications"],
    prompt_hints: [
      "Include structured job search routines",
      "Suggest multiple job search channels",
      "Set realistic search targets",
    ],
    do_not_assume: ["familiarity with job boards", "clear job goal", "digital access for online searching"],
    starter_actions: [
      "Set up a regular job search routine",
      "Create job alerts on two platforms",
      "Research job boards relevant to goal",
    ],
    contraindicated_stages: [],
  },

  "Job Applications": {
    id: "applications",
    label: "Job Applications",
    aliases: ["job applications", "applications", "applying", "application forms", "covering letters"],
    category: "job_search_readiness",
    retrieval_tags: ["applications", "cover_letter", "application_forms", "cv"],
    prompt_hints: [
      "Include application quality as well as quantity targets",
      "Suggest tailoring each application to the role",
      "Include application tracking",
    ],
    do_not_assume: ["experience completing applications", "cover letter writing ability", "understanding of application processes"],
    starter_actions: [
      "Submit quality applications tailored to role",
      "Start an application tracker",
      "Practise completing application forms",
    ],
    contraindicated_stages: [],
  },

  "CV": {
    id: "cv",
    label: "CV",
    aliases: ["cv", "resume", "curriculum vitae", "no cv", "cv needs updating", "cv gaps"],
    category: "job_search_readiness",
    retrieval_tags: ["cv", "resume", "tailoring", "achievements", "cv_gaps"],
    prompt_hints: [
      "Focus on CV improvement as a priority action",
      "Include specific CV sections to update",
      "Suggest STAR examples for evidence",
    ],
    do_not_assume: ["existing CV", "awareness of CV best practice", "ability to write CV independently"],
    starter_actions: [
      "Update CV for target role",
      "Write STAR examples for key skills",
      "Proofread CV for errors and formatting",
    ],
    contraindicated_stages: [],
  },

  "Interviews": {
    id: "interviews",
    label: "Interviews",
    aliases: ["interviews", "interview", "interview skills", "interview anxiety", "mock interview"],
    category: "job_search_readiness",
    retrieval_tags: ["interview", "preparation", "mock_interview", "star_method", "confidence"],
    prompt_hints: [
      "Build interview confidence through gradual preparation",
      "Include mock interview practice",
      "Suggest structured answer preparation (STAR format)",
    ],
    do_not_assume: ["previous interview experience", "confidence speaking to strangers", "understanding of interview formats"],
    starter_actions: [
      "Prepare answers to common interview questions",
      "Book and attend a mock interview",
      "Research the company before interview",
    ],
    contraindicated_stages: [],
  },

  "Confidence": {
    id: "confidence",
    label: "Confidence",
    aliases: ["confidence", "low confidence", "self-esteem", "anxious", "anxiety", "nervous", "scared", "worried", "self-doubt"],
    category: "confidence_and_motivation",
    retrieval_tags: ["confidence", "small_steps", "self_esteem", "anxiety", "motivation"],
    prompt_hints: [
      "Start with very small, low-friction tasks to build momentum",
      "Use exposure-based progression (small steps to bigger ones)",
      "Focus on strength identification and evidence gathering",
      "Do not suggest high-pressure activities early in the plan",
    ],
    do_not_assume: ["readiness for phone calls", "ability to attend group activities", "comfort with employer contact"],
    starter_actions: [
      "Identify three personal strengths with examples",
      "Take one small agreed step toward goal",
      "Complete one low-pressure daily task",
    ],
    contraindicated_stages: ["interviewing", "networking"],
  },

  "Motivation": {
    id: "motivation",
    label: "Motivation",
    aliases: ["motivation", "unmotivated", "lost hope", "can't be bothered", "no drive", "demotivated"],
    category: "confidence_and_motivation",
    retrieval_tags: ["motivation", "routine", "goals", "milestones", "small_steps"],
    prompt_hints: [
      "Set achievable milestones to maintain momentum",
      "Include routine-building activities",
      "Break larger goals into small, completable weekly tasks",
    ],
    do_not_assume: ["consistent motivation", "existing routine", "clear understanding of job goal benefits"],
    starter_actions: [
      "Set one realistic weekly goal",
      "Create a simple weekly routine",
      "Identify one motivating reason for employment",
    ],
    contraindicated_stages: [],
  },

  "Job Goal": {
    id: "job_goal",
    label: "Job Goal",
    aliases: ["job goal", "no job goal", "career direction", "don't know what to do", "unclear goal"],
    category: "job_search_readiness",
    retrieval_tags: ["job_goal", "career_direction", "discovery", "skills_audit", "research"],
    prompt_hints: [
      "Prioritise goal clarification actions before applications",
      "Include skills audits and sector research",
      "Do not set application targets until a goal is defined",
    ],
    do_not_assume: ["clear career direction", "awareness of available roles", "understanding of own skills"],
    starter_actions: [
      "Write down target role preferences",
      "Research skills needed for target roles",
      "Complete a skills and interests audit",
    ],
    contraindicated_stages: ["applications", "interviewing"],
  },

  "Photo ID": {
    id: "photo_id",
    label: "Photo ID",
    aliases: ["photo id", "id documents", "no id", "passport", "driving licence", "proof of identity"],
    category: "identity_and_documents",
    retrieval_tags: ["photo_id", "documents", "identity", "gov_services"],
    prompt_hints: [
      "Make obtaining ID a priority action before applications requiring it",
      "Suggest the most cost-effective and fastest ID option",
      "Include document gathering as an early step",
    ],
    do_not_assume: ["existing photo ID", "birth certificate access", "money for ID applications"],
    starter_actions: [
      "Apply for provisional driving licence",
      "Apply for PASS card or CitizenCard",
      "Gather supporting documents for ID application",
    ],
    contraindicated_stages: [],
  },

  "Substance Misuse": {
    id: "substance_misuse",
    label: "Substance Misuse",
    aliases: ["substance misuse", "substance", "alcohol", "drugs", "addiction", "recovery"],
    category: "health_and_wellbeing",
    retrieval_tags: ["substance_misuse", "recovery", "support_service", "wellbeing"],
    prompt_hints: [
      "Prioritise engagement with support services",
      "Set realistic, flexible targets that accommodate recovery",
      "Do not set rigid deadlines that could increase pressure",
      "Include routine-building alongside employment actions",
    ],
    do_not_assume: ["stable routine", "consistent availability", "readiness for full-time employment"],
    starter_actions: [
      "Contact agreed support service for initial appointment",
      "Attend scheduled support appointment",
      "Build a simple daily routine",
    ],
    contraindicated_stages: ["interviewing"],
  },

  "Autism": {
    id: "autism",
    label: "Autism",
    aliases: ["autism", "autistic", "ASD", "autism spectrum"],
    category: "neurodiversity_and_learning",
    retrieval_tags: ["autism", "neurodiversity", "reasonable_adjustments", "communication", "support_service"],
    prompt_hints: [
      "Use clear, literal, and unambiguous language in action descriptions",
      "Include preparation for sensory and communication needs",
      "Suggest specialist autism employment support",
      "Include reasonable adjustments planning",
    ],
    do_not_assume: ["comfort with unstructured environments", "ease with social situations", "ability to infer unwritten rules"],
    starter_actions: [
      "Discuss reasonable workplace adjustments needed",
      "Create a communication profile",
      "Access specialist autism employment service",
    ],
    contraindicated_stages: [],
  },

  "Learning Difficulties": {
    id: "learning_difficulties",
    label: "Learning Difficulties",
    aliases: ["learning difficulties", "learning disability", "dyslexia", "dyscalculia"],
    category: "neurodiversity_and_learning",
    retrieval_tags: ["learning_difficulties", "supported_employment", "reasonable_adjustments", "support_service"],
    prompt_hints: [
      "Break tasks into smaller, concrete steps with visual support",
      "Suggest supported employment or job coaching",
      "Use simple, clear language throughout",
      "Include task breakdowns and checklists",
    ],
    do_not_assume: ["independent task completion", "ability to follow complex instructions", "standard processing speed"],
    starter_actions: [
      "Arrange learning support assessment",
      "Explore supported employment services",
      "Break job search tasks into small steps with checklists",
    ],
    contraindicated_stages: [],
  },

  "ADHD": {
    id: "adhd",
    label: "ADHD",
    aliases: ["adhd", "attention deficit", "hyperactivity", "difficulty focusing", "easily distracted"],
    category: "neurodiversity_and_learning",
    retrieval_tags: ["adhd", "neurodiversity", "routine", "focus", "reasonable_adjustments"],
    prompt_hints: [
      "Include structured routines and reminder systems",
      "Break tasks into short focused sessions (15-minute chunks)",
      "Suggest external accountability structures",
      "Include organisational tools and strategies",
    ],
    do_not_assume: ["ability to sustain long tasks", "consistent time management", "ability to remember appointments without reminders"],
    starter_actions: [
      "Create a structured daily routine",
      "Set up phone reminders for appointments",
      "Break applications into 15-minute focused sessions",
    ],
    contraindicated_stages: [],
  },

  "Health Condition": {
    id: "health_condition",
    label: "Health Condition",
    aliases: ["health condition", "health", "chronic illness", "stamina", "fatigue", "pain", "medical condition"],
    category: "health_and_wellbeing",
    retrieval_tags: ["health", "reasonable_adjustments", "flexible_working", "access_to_work", "support_service"],
    prompt_hints: [
      "Suggest flexible working arrangements where possible",
      "Include Access to Work support exploration",
      "Set realistic targets that accommodate health limitations",
      "Do not assume consistent energy or availability",
    ],
    do_not_assume: ["consistent energy levels", "ability to work standard hours", "physical mobility", "stamina for full-time work"],
    starter_actions: [
      "Discuss work limitations and adjustments with advisor",
      "Explore Access to Work support",
      "Research flexible working opportunities",
    ],
    contraindicated_stages: [],
  },

  "Disability": {
    id: "disability",
    label: "Disability",
    aliases: ["disability", "disabled", "physical disability", "wheelchair", "mobility", "impairment"],
    category: "health_and_wellbeing",
    retrieval_tags: ["disability", "reasonable_adjustments", "access_to_work", "disability_confident", "support_service"],
    prompt_hints: [
      "Include reasonable adjustments planning as an early action",
      "Suggest targeting Disability Confident employers",
      "Include Access to Work application support",
      "Focus on what the participant can do, not limitations",
    ],
    do_not_assume: ["physical mobility", "ability to commute", "standard workplace accessibility", "comfort with disclosure"],
    starter_actions: [
      "Identify reasonable adjustments needed",
      "Apply for Access to Work funding",
      "Research Disability Confident employers",
    ],
    contraindicated_stages: [],
  },
};

/**
 * Look up a barrier entry by dropdown label.
 * Falls back to a fuzzy match on aliases if exact match fails.
 */
export function lookupBarrier(label: string): BarrierEntry | null {
  // Exact match on label
  if (BARRIER_CATALOG[label]) {
    return BARRIER_CATALOG[label];
  }

  // Fuzzy match on aliases
  const lower = label.toLowerCase().trim();
  for (const entry of Object.values(BARRIER_CATALOG)) {
    if (entry.id === lower) return entry;
    if (entry.aliases.some((a) => a.toLowerCase() === lower)) return entry;
  }

  // Partial match on aliases (for custom text input)
  for (const entry of Object.values(BARRIER_CATALOG)) {
    if (entry.aliases.some((a) => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower))) {
      return entry;
    }
  }

  return null;
}

/**
 * Get all barrier entries as an array.
 */
export function getAllBarriers(): BarrierEntry[] {
  return Object.values(BARRIER_CATALOG);
}
