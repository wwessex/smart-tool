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
      "Suggest contacting Shelter helpline (0808 800 4444) or local authority housing team",
      "If transport is also a barrier, suggest services that offer outreach or home visits",
    ],
    do_not_assume: ["stable address", "internet access at home", "safe storage for documents", "ability to receive post reliably"],
    starter_actions: [
      "Contact local council Housing Options team",
      "Gather housing documents for referrals",
      "Research local housing support services",
      "Register with a care-of address for receiving post if needed",
      "Ask about Discretionary Housing Payments if in temporary accommodation",
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
      "Suggest Citizens Advice (citizensadvice.org.uk) for benefits and debt guidance",
      "Consider Flexible Support Fund or Jobcentre Plus travel costs if applicable",
      "If housing is also a barrier, prioritise financial stability actions first",
    ],
    do_not_assume: ["money for travel", "internet access", "ability to pay for courses or certifications", "bank account access"],
    starter_actions: [
      "Complete a benefits entitlement check using an online calculator",
      "Create a simple weekly budget",
      "Contact debt advice service (StepChange or Citizens Advice) if needed",
      "Ask Jobcentre about Flexible Support Fund for job search costs",
      "Open a basic bank account if needed for receiving wages",
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
      "If transport is also a barrier, prioritise remote or local roles first",
      "Suggest checking eligibility for Tax-Free Childcare or Universal Credit childcare element",
    ],
    do_not_assume: ["availability during school hours", "childcare arrangements", "ability to attend daytime appointments", "partner or family support with caring"],
    starter_actions: [
      "Research local childcare options and costs",
      "Explore flexible or part-time roles",
      "Contact local carers support service",
      "Check eligibility for Tax-Free Childcare or childcare cost support",
      "Map available time windows around caring commitments",
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
      "Suggest National Databank free mobile data or community wifi schemes",
    ],
    do_not_assume: ["internet access", "computer ownership", "smartphone", "email address", "printer access"],
    starter_actions: [
      "Register for free library computer access",
      "Explore low-cost connectivity options or National Databank free data",
      "Set up a free email address with support",
      "Ask about device loan schemes through local digital inclusion projects",
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
      "Suggest NHS Talking Therapies self-referral or GP referral for counselling",
      "If confidence is also a barrier, start with private or one-to-one activities before group tasks",
    ],
    do_not_assume: ["consistent energy levels", "ability to maintain routine", "readiness for high-pressure activities", "stable medication or treatment"],
    starter_actions: [
      "Contact wellbeing or mental health service",
      "Practise one self-care activity three times this week",
      "Identify two triggers and one coping strategy for each",
      "Self-refer to NHS Talking Therapies if appropriate",
      "Discuss any impact on work capability with advisor",
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
      "Suggest volunteering as a way to build social connections and work experience simultaneously",
      "If confidence is also a barrier, start with small group or one-to-one activities",
    ],
    do_not_assume: ["family support", "existing social network", "transport to social venues", "comfort attending new groups alone"],
    starter_actions: [
      "Research local community groups or job clubs",
      "Identify supportive people in current network",
      "Ask about mentoring services",
      "Explore volunteering opportunities that build social connections",
      "Attend a supported group session with advisor introduction",
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
      "If English language is also a barrier, focus on workplace vocabulary and phrases",
    ],
    do_not_assume: ["confident speaker", "comfortable with phone calls", "able to attend group workshops"],
    starter_actions: [
      "Practise a one-minute self-introduction",
      "Attend a communication workshop",
      "Record a practice introduction and review it",
      "Practise workplace telephone skills with advisor role-play",
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
      "Suggest free courses like Learn My Way, Google Digital Garage, or local library digital skills sessions",
      "If digital hardware is also a barrier, ensure access is secured before setting digital tasks",
    ],
    do_not_assume: ["ability to use email", "ability to navigate job boards independently", "confidence with technology"],
    starter_actions: [
      "Complete first module of digital skills course",
      "Practise writing a professional email",
      "Learn to use a job search website with support",
      "Register for a free Learn My Way or Google Digital Garage course",
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
      "Functional Skills courses (Entry Level to Level 2) are free for adults in England",
      "Suggest advisor-assisted application completion rather than independent form-filling",
      "If confidence is also a barrier, normalise the situation and avoid making it feel like a test",
    ],
    do_not_assume: ["ability to complete written applications independently", "confidence with numbers", "ability to read complex job descriptions", "willingness to disclose literacy needs openly"],
    starter_actions: [
      "Complete initial literacy and numeracy assessment",
      "Enrol in a free functional skills course",
      "Arrange one-to-one support sessions",
      "Practise filling in a simple form with advisor support",
      "Explore audio or video-based job search resources as alternatives to text",
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
      "Many sector-specific qualifications (CSCS, SIA, food hygiene) can be completed quickly",
      "Suggest Skills Bootcamps, sector-based work academies, or adult education courses",
    ],
    do_not_assume: ["ability to self-fund courses", "recent classroom experience", "study skills"],
    starter_actions: [
      "Research relevant courses and qualifications",
      "Complete course application with support",
      "Explore recognition of prior learning",
      "Check eligibility for funded training through Jobcentre or National Careers Service",
      "Identify short accreditations that unlock target roles (e.g., CSCS, SIA, first aid)",
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
      "Use National Careers Service Skills Health Check or similar tools for structured assessment",
    ],
    do_not_assume: ["awareness of own transferable skills", "confidence in past experience"],
    starter_actions: [
      "Complete a transferable skills audit",
      "Research target sectors where skills apply",
      "Update CV to highlight transferable skills",
      "Complete the National Careers Service Skills Health Check online",
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
      "Consider visual aids, checklists, and step-by-step guides over written paragraphs",
      "If literacy is also a barrier, use verbal and visual approaches for tasks",
    ],
    do_not_assume: ["standard learning pace", "independent study capability", "comfort with written instructions"],
    starter_actions: [
      "Complete a learning styles assessment",
      "Discuss learning support needs with provider",
      "Set clear, specific learning goals",
      "Create a visual step-by-step checklist for key tasks",
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
      "Frame gaps positively: caring, study, health recovery, personal development",
      "Suggest sector-based work academies or work trials for building recent experience",
    ],
    do_not_assume: ["recent references", "recent work experience", "confidence discussing employment gaps"],
    starter_actions: [
      "Complete an employment history timeline",
      "Identify potential references",
      "Explore volunteering opportunities",
      "Prepare a positive narrative for employment gaps",
      "Ask about work trials or sector-based work academy placements",
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
      "Ask Jobcentre about Flexible Support Fund for travel to interviews",
      "Consider cycling schemes, Wheels to Work, or community transport options",
    ],
    do_not_assume: ["driving licence", "car ownership", "money for taxis", "reliable public transport access"],
    starter_actions: [
      "Plan and save reliable routes to key locations",
      "Apply for travel support if eligible",
      "Research remote or local work opportunities",
      "Investigate Wheels to Work or community transport schemes",
      "Test the commute route before interview or start date",
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
      "Suggest Indeed, Reed, council jobs, and sector-specific boards",
      "Include speculative approaches and local employer visits alongside online search",
    ],
    do_not_assume: ["familiarity with job boards", "clear job goal", "digital access for online searching"],
    starter_actions: [
      "Set up a regular job search routine",
      "Create job alerts on two platforms",
      "Research job boards relevant to goal",
      "Register with local recruitment agencies for target sector",
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
      "If literacy is also a barrier, suggest advisor-supported application sessions",
    ],
    do_not_assume: ["experience completing applications", "cover letter writing ability", "understanding of application processes"],
    starter_actions: [
      "Submit quality applications tailored to role",
      "Start an application tracker",
      "Practise completing application forms",
      "Prepare a reusable cover letter template with advisor support",
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
      "If no CV exists, creating one from scratch is the first priority",
      "Suggest National Careers Service CV builder or advisor-supported writing",
    ],
    do_not_assume: ["existing CV", "awareness of CV best practice", "ability to write CV independently"],
    starter_actions: [
      "Update CV for target role",
      "Write STAR examples for key skills",
      "Proofread CV for errors and formatting",
      "Use the National Careers Service CV builder or a template to create a first draft",
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
      "If confidence is also a barrier, start with informal practice before formal mocks",
      "Include practical preparation: outfit, route, documents needed",
    ],
    do_not_assume: ["previous interview experience", "confidence speaking to strangers", "understanding of interview formats"],
    starter_actions: [
      "Prepare answers to common interview questions",
      "Book and attend a mock interview",
      "Research the company before interview",
      "Prepare practical interview kit (outfit, copies of CV, route plan)",
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
      "If mental wellbeing is also a barrier, limit to 1-2 actions and check in regularly",
      "Celebrate small wins explicitly in action rationale",
    ],
    do_not_assume: ["readiness for phone calls", "ability to attend group activities", "comfort with employer contact"],
    starter_actions: [
      "Identify three personal strengths with examples",
      "Take one small agreed step toward goal",
      "Complete one low-pressure daily task",
      "Attend a supported confidence-building group or workshop",
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
      "Connect actions to personal values and reasons for working, not just targets",
      "If mental wellbeing is also a barrier, explore whether low motivation has a wellbeing component",
    ],
    do_not_assume: ["consistent motivation", "existing routine", "clear understanding of job goal benefits"],
    starter_actions: [
      "Set one realistic weekly goal",
      "Create a simple weekly routine",
      "Identify one motivating reason for employment",
      "Visit a workplace or attend an open day to build connection to the goal",
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
      "Suggest National Careers Service adviser appointment or Explore Careers website",
      "Consider work tasters, job shadowing, or volunteering to test ideas",
    ],
    do_not_assume: ["clear career direction", "awareness of available roles", "understanding of own skills"],
    starter_actions: [
      "Write down target role preferences",
      "Research skills needed for target roles",
      "Complete a skills and interests audit",
      "Book a National Careers Service adviser appointment",
      "Arrange a work taster or job shadowing day in a sector of interest",
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
      "Provisional driving licence (£34) is often the quickest and cheapest photo ID",
      "If finance is also a barrier, ask Jobcentre about Flexible Support Fund for ID costs",
    ],
    do_not_assume: ["existing photo ID", "birth certificate access", "money for ID applications"],
    starter_actions: [
      "Apply for provisional driving licence (£34, 2-3 weeks)",
      "Apply for PASS card or CitizenCard",
      "Gather supporting documents for ID application",
      "Request a replacement birth certificate if needed (£11 online)",
      "Ask advisor about hardship funding for ID application costs",
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
      "Recovery milestones take priority over job search targets",
      "Suggest structured day programmes that combine recovery and employability",
    ],
    do_not_assume: ["stable routine", "consistent availability", "readiness for full-time employment", "willingness to discuss substance use openly"],
    starter_actions: [
      "Contact agreed support service for initial appointment",
      "Attend scheduled support appointment",
      "Build a simple daily routine",
      "Explore structured day programmes that combine recovery and employability skills",
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
      "Consider Access to Work scheme for workplace support",
      "Suggest National Autistic Society employment resources or local autism services",
    ],
    do_not_assume: ["comfort with unstructured environments", "ease with social situations", "ability to infer unwritten rules", "comfort with unexpected changes to plans"],
    starter_actions: [
      "Discuss reasonable workplace adjustments needed",
      "Create a communication profile",
      "Access specialist autism employment service",
      "Research Access to Work support for workplace adjustments",
      "Prepare a sensory needs checklist for potential workplaces",
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
      "Consider Access to Work for workplace support and assistive technology",
      "For dyslexia or dyscalculia, suggest specific assistive tools (text-to-speech, spell checkers)",
    ],
    do_not_assume: ["independent task completion", "ability to follow complex instructions", "standard processing speed"],
    starter_actions: [
      "Arrange learning support assessment",
      "Explore supported employment services",
      "Break job search tasks into small steps with checklists",
      "Research assistive technology that could help (e.g., text-to-speech, read-aloud tools)",
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
      "Consider Access to Work for workplace coaching and support",
      "Suggest body-doubling or co-working sessions for focused work",
    ],
    do_not_assume: ["ability to sustain long tasks", "consistent time management", "ability to remember appointments without reminders"],
    starter_actions: [
      "Create a structured daily routine",
      "Set up phone reminders for appointments",
      "Break applications into 15-minute focused sessions",
      "Research Access to Work support for ADHD coaching in employment",
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
      "Consider phased return to work or reduced hours as intermediate steps",
      "If disability is also applicable, suggest targeting Disability Confident employers",
    ],
    do_not_assume: ["consistent energy levels", "ability to work standard hours", "physical mobility", "stamina for full-time work"],
    starter_actions: [
      "Discuss work limitations and adjustments with advisor",
      "Explore Access to Work support",
      "Research flexible working opportunities",
      "Discuss fit note and work capability with GP",
      "Identify roles that accommodate health condition (remote, flexible, part-time)",
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
      "Disability Confident employers guarantee interviews for disabled applicants who meet minimum criteria",
      "If transport is also a barrier, prioritise remote roles or accessible commute routes",
    ],
    do_not_assume: ["physical mobility", "ability to commute", "standard workplace accessibility", "comfort with disclosure"],
    starter_actions: [
      "Identify reasonable adjustments needed",
      "Apply for Access to Work funding",
      "Research Disability Confident employers",
      "Prepare a disclosure statement for applications if the participant chooses to disclose",
      "Check if the Guaranteed Interview Scheme applies to target employers",
    ],
    contraindicated_stages: [],
  },
  "English Language (ESOL)": {
    id: "esol",
    label: "English Language (ESOL)",
    aliases: ["esol", "english language", "english as second language", "limited english", "no english", "interpreter", "translation"],
    category: "skills_and_qualifications",
    retrieval_tags: ["esol", "english_language", "communication", "upskilling", "support_service"],
    prompt_hints: [
      "Use simple, clear language in action descriptions",
      "Include ESOL course enrolment as a priority action",
      "Suggest workplace-focused English practice alongside general language learning",
      "Consider whether an interpreter is needed for appointments",
      "Suggest conversation practice groups alongside formal ESOL classes",
      "If communication skills is also a barrier, focus on workplace vocabulary first",
    ],
    do_not_assume: ["ability to read English job adverts independently", "ability to complete forms in English", "confidence speaking English in formal settings", "understanding of UK workplace culture"],
    starter_actions: [
      "Attend an ESOL assessment to determine current level",
      "Enrol in an ESOL course at a local provider",
      "Join an English conversation practice group",
      "Learn key workplace vocabulary for target sector",
      "Practise filling in a simple application form in English with support",
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
