import {
  BARRIER_CATALOG,
  lookupBarrier,
  type BarrierCategory,
} from '@smart-tool/browser-native-llm';

// ============= Barrier Taxonomy (derived from canonical BARRIER_CATALOG) =============

/**
 * Maps BarrierCategory (long form from catalog) to short category names
 * used throughout the frontend for classification and storage.
 */
const CATEGORY_SHORT_NAMES: Record<BarrierCategory, string> = {
  practical_access: "practical",
  confidence_and_motivation: "confidence",
  health_and_wellbeing: "wellbeing",
  skills_and_qualifications: "skills",
  job_search_readiness: "job-search",
  neurodiversity_and_learning: "neurodiversity",
  identity_and_documents: "practical",
};

/**
 * Barrier → short category mapping, derived from BARRIER_CATALOG.
 * Previously maintained as a separate hand-written record.
 */
export const BARRIER_CATEGORIES: Record<string, string> = Object.fromEntries(
  Object.entries(BARRIER_CATALOG).map(([label, entry]) => [
    label,
    CATEGORY_SHORT_NAMES[entry.category],
  ])
);

// "English Language (ESOL)" fallback — now in BARRIER_CATALOG, but kept for safety
if (!BARRIER_CATEGORIES["English Language (ESOL)"]) {
  BARRIER_CATEGORIES["English Language (ESOL)"] = "skills";
}
// "Social & Support Networks" category override — the catalog classifies it as
// confidence_and_motivation, but the frontend has historically used "experience"
BARRIER_CATEGORIES["Social & Support Networks"] = "experience";
// "Previous Work History" — catalog uses job_search_readiness, frontend uses "experience"
BARRIER_CATEGORIES["Previous Work History"] = "experience";

// Reverse lookup: category -> barriers in that category
export function getBarriersByCategory(category: string): string[] {
  return Object.entries(BARRIER_CATEGORIES)
    .filter(([, cat]) => cat === category)
    .map(([barrier]) => barrier);
}

/**
 * Classify a barrier string to its short category name (fuzzy).
 * Uses the canonical BARRIER_CATALOG for lookup, falling back to alias matching.
 */
export function classifyBarrier(barrier: string): string {
  const b = (barrier || "").trim();
  if (!b) return "unknown";

  // Fast exact match via derived mapping
  if (BARRIER_CATEGORIES[b]) return BARRIER_CATEGORIES[b];

  // Case-insensitive match against derived mapping
  const lower = b.toLowerCase();
  for (const [key, cat] of Object.entries(BARRIER_CATEGORIES)) {
    if (key.toLowerCase() === lower) return cat;
  }

  // Use the catalog's fuzzy lookup (matches on aliases, partial text)
  const catalogEntry = lookupBarrier(b);
  if (catalogEntry) return CATEGORY_SHORT_NAMES[catalogEntry.category];

  return "unknown";
}

// Default data lifted from the spreadsheet's DATA sheet (Restart SMART Action Tool v1)
export const DEFAULT_TIMESCALES = [
  "1 week",
  "2 weeks",
  "3 weeks",
  "1 month",
  "2 months",
  "3 months",
  "4 months",
  "5 months",
  "6 months"
];

/**
 * Default barrier list, derived from BARRIER_CATALOG keys.
 */
export const DEFAULT_BARRIERS: string[] = [
  ...Object.keys(BARRIER_CATALOG),
];

// Builder phrases (DATA sheet) - SMART format for Restart Advisors
export const BUILDER_NOW = {
  p1: "During our meeting on",
  p2: "identified development areas around",
  p3: "As discussed and agreed,",
  p4: "will",
  p5: "This action will help",
  p6: "We have agreed today that this action is both realistic and achievable.",
  p7: "This will be reviewed in our next review meeting in"
};

export const BUILDER_TASK = {
  p1: "As discussed and agreed, on",
  p2: "will", // Changed from "will attend" - verb is now contextual
  p3: "This will be reviewed in our next meeting in"
};

export const GUIDANCE = [
  {
    title: "Purpose",
    body: "This tool helps you create consistent, SMART-style actions for participants faster than ever and get past \"Action Block\"."
  },
  {
    title: "Barrier to action",
    body: [
      "Complete every field.",
      "Write the action so it's clear and measurable (what, when, where).",
      "Proofread before pasting into important documents."
    ]
  },
  {
    title: "Task-based",
    body: [
      "Use this to schedule future tasks, events, or activities.",
      "Describe what the participant will do and the expected outcome."
    ]
  },
  {
    title: "Review",
    body: "Always proofread. Browser spellcheck is enabled in the text boxes, but you're still the editor-in-chief."
  }
];

// Advisor assist: curated suggestions per barrier (runs instantly, offline)
export const ACTION_LIBRARY: Record<string, Array<{title: string; action: string; help: string}>> = {
  "Housing": [
    {
      "title": "Contact Housing Options team",
      "action": "Contact the local council Housing Options team to discuss current housing situation and next steps by {targetDate}.",
      "help": "you access appropriate housing support and reduce risk of homelessness."
    },
    {
      "title": "Gather housing documents",
      "action": "Gather key housing documents (tenancy agreement, ID, recent correspondence) and bring them to our next appointment on {targetDate}.",
      "help": "us make referrals and evidence your situation quickly."
    },
    {
      "title": "Search & shortlist properties",
      "action": "Spend 30 minutes, three times this week, searching and shortlisting affordable properties on two approved sites, and save the links by {targetDate}.",
      "help": "you move towards stable accommodation."
    }
  ],
  "Finance": [
    {
      "title": "Create a simple budget",
      "action": "Create a weekly budget listing income and essential outgoings, using the provided template, and bring it completed by {targetDate}.",
      "help": "you understand where your money is going and identify savings."
    },
    {
      "title": "Check benefits entitlement",
      "action": "Use a benefits calculator to check entitlement and note any actions needed (claims, updates) by {targetDate}.",
      "help": "you maximise income and reduce financial pressure."
    },
    {
      "title": "Set up payment plan",
      "action": "Contact your creditor to request an affordable repayment plan and record the outcome by {targetDate}.",
      "help": "you stabilise finances and avoid arrears escalating."
    }
  ],
  "Transport": [
    {
      "title": "Plan route to appointments",
      "action": "Plan and save a reliable route to your appointments (including costs and timings) and confirm you can attend by {targetDate}.",
      "help": "you attend reliably and reduce missed sessions."
    },
    {
      "title": "Apply for travel support",
      "action": "Complete the travel support application (if eligible) and submit required evidence by {targetDate}.",
      "help": "remove cost as a barrier to attendance and job search."
    }
  ],
  "Job Search": [
    {
      "title": "Set job search routine",
      "action": "Complete two job searches per week using agreed sites, saving at least three suitable roles each time, by {targetDate}.",
      "help": "build momentum and increase chances of interviews."
    },
    {
      "title": "Create job alerts",
      "action": "Set up job alerts for your target role and location on two job boards by {targetDate}.",
      "help": "you see suitable vacancies quickly."
    }
  ],
  "Job Applications": [
    {
      "title": "Submit applications",
      "action": "Submit {n} quality applications for suitable roles, tailored to the job description, by {targetDate}.",
      "help": "increase your chances of securing interviews."
    },
    {
      "title": "Track applications",
      "action": "Start an application tracker (role, company, date applied, outcome) and update it after every application until {targetDate}.",
      "help": "you stay organised and follow up effectively."
    }
  ],
  "CV": [
    {
      "title": "Update CV for target role",
      "action": "Update your CV for your target role, including a tailored profile and recent achievements, and send it to me by {targetDate}.",
      "help": "present your skills clearly to employers."
    },
    {
      "title": "Add STAR examples",
      "action": "Write two STAR examples for key skills in your CV (e.g., teamwork, reliability) and add them to your notes by {targetDate}.",
      "help": "strengthen applications and interview answers."
    }
  ],
  "Interviews": [
    {
      "title": "Prepare interview answers",
      "action": "Prepare answers to five common interview questions for your target role and practise them twice before {targetDate}.",
      "help": "improve confidence and interview performance."
    },
    {
      "title": "Mock interview",
      "action": "Book and attend a mock interview session, bringing the job description and your CV, by {targetDate}.",
      "help": "identify improvements before real interviews."
    }
  ],
  "Confidence": [
    {
      "title": "Confidence actions",
      "action": "Identify three strengths you can evidence with examples, write them down, and bring them to our next meeting by {targetDate}.",
      "help": "build confidence and communicate strengths to employers."
    },
    {
      "title": "Small exposure step",
      "action": "Take one small agreed step towards your goal (e.g., make one phone call or attend one service) and note how it went by {targetDate}.",
      "help": "reduce anxiety and build confidence through progress."
    }
  ],
  "Motivation": [
    {
      "title": "Set a weekly goal",
      "action": "Set one realistic weekly goal linked to your job goal, complete it, and report back on progress by {targetDate}.",
      "help": "maintain motivation through achievable milestones."
    },
    {
      "title": "Routine planning",
      "action": "Create a simple weekly routine including job search time and wellbeing breaks, and try it for one week by {targetDate}.",
      "help": "build structure and consistency."
    }
  ],
  "Substance Misuse": [
    {
      "title": "Contact support service",
      "action": "Contact the agreed local support service to arrange an initial appointment and confirm the date/time by {targetDate}.",
      "help": "you access specialist support and stabilise routines."
    },
    {
      "title": "Attend appointment",
      "action": "Attend the scheduled support appointment and note any next steps agreed by {targetDate}.",
      "help": "move forward with the support plan."
    }
  ],
  "Mental Wellbeing": [
    {
      "title": "Contact wellbeing service",
      "action": "Contact the agreed wellbeing or mental health service to arrange an initial appointment by {targetDate}.",
      "help": "you access professional support to improve mental wellbeing."
    },
    {
      "title": "Practise self-care activity",
      "action": "Practise one agreed self-care activity (e.g., walking, journaling) at least three times this week and note how it went by {targetDate}.",
      "help": "build healthy routines and improve overall wellbeing."
    },
    {
      "title": "Identify triggers",
      "action": "Identify and write down two situations that affect your wellbeing and one coping strategy for each by {targetDate}.",
      "help": "develop awareness and practical coping skills."
    }
  ],
  "Digital Skills": [
    {
      "title": "Complete digital skills course",
      "action": "Complete the first module of the agreed online digital skills course and save the certificate by {targetDate}.",
      "help": "develop essential digital skills for job searching and employment."
    },
    {
      "title": "Practise email skills",
      "action": "Practise writing a professional email (e.g., job enquiry) and send it to me for feedback by {targetDate}.",
      "help": "build confidence in professional digital communication."
    }
  ],
  "Communication Skills": [
    {
      "title": "Practise speaking skills",
      "action": "Practise introducing yourself professionally in under one minute and record or rehearse it three times by {targetDate}.",
      "help": "build confidence for interviews and networking."
    },
    {
      "title": "Attend communication workshop",
      "action": "Book and attend the communication or presentation skills workshop by {targetDate}.",
      "help": "develop skills for workplace communication."
    }
  ],
  "Caring Responsibilities": [
    {
      "title": "Explore childcare options",
      "action": "Research and note down two local childcare options (including costs and availability) by {targetDate}.",
      "help": "identify solutions to balance caring and work commitments."
    },
    {
      "title": "Contact support for carers",
      "action": "Contact the local carers' support service to discuss available support and respite options by {targetDate}.",
      "help": "access support that enables you to pursue employment."
    }
  ],
  "Qualifications": [
    {
      "title": "Research courses",
      "action": "Research and shortlist two relevant courses or qualifications that support your job goal by {targetDate}.",
      "help": "identify training opportunities to improve employability."
    },
    {
      "title": "Apply for course",
      "action": "Complete the application for the agreed course and submit it with required documents by {targetDate}.",
      "help": "progress your learning and qualifications."
    }
  ],
  "Job Goal": [
    {
      "title": "Define job goal",
      "action": "Write down your target job role, including the type of work, hours, and location preferences, and bring it to our next meeting by {targetDate}.",
      "help": "focus your job search on realistic and achievable goals."
    },
    {
      "title": "Research target role",
      "action": "Research the skills and qualifications needed for your target role and note any gaps by {targetDate}.",
      "help": "identify steps to become more competitive for your target job."
    }
  ],
  "Photo ID": [
    {
      "title": "Apply for provisional licence",
      "action": "{forename} has agreed to apply for a provisional driving licence online at gov.uk by {targetDate}. This will provide valid photo ID for employment.",
      "help": "Costs £34, takes 2-3 weeks to arrive."
    },
    {
      "title": "Apply for PASS card",
      "action": "{forename} will apply for a CitizenCard or similar PASS-approved ID card by {targetDate}. Advisor will provide guidance on the application process.",
      "help": "PASS cards are accepted as proof of age ID."
    },
    {
      "title": "Request passport application",
      "action": "{forename} has agreed to complete and submit a passport application with advisor support by {targetDate}. This will serve as primary photo ID.",
      "help": "Standard passport costs £82.50, allow 10 weeks processing."
    }
  ],
  "Digital Hardware & Connectivity": [
    {
      "title": "Library computer access",
      "action": "{forename} will register for free computer access at the local library by {targetDate} to enable job searching and applications.",
      "help": "Libraries offer free internet and often have printing facilities."
    },
    {
      "title": "Digital skills assessment",
      "action": "{forename} has agreed to complete a basic digital skills assessment with advisor support by {targetDate} to identify training needs.",
      "help": "Helps identify specific areas for development."
    },
    {
      "title": "Smartphone support",
      "action": "{forename} will explore options for low-cost smartphone access through the relevant provider by {targetDate} to access job apps and emails.",
      "help": "Some providers offer discounted plans for jobseekers."
    }
  ],
  "Literacy and/or Numeracy": [
    {
      "title": "Skills assessment",
      "action": "{forename} has agreed to complete an initial literacy and numeracy assessment by {targetDate} to identify support needs.",
      "help": "Assessments are confidential and help tailor support."
    },
    {
      "title": "Enrol in basic skills course",
      "action": "{forename} will enrol in a free functional skills course at a local provider by {targetDate} to improve confidence with reading, writing, or maths.",
      "help": "Functional Skills courses are free for adults."
    },
    {
      "title": "One-to-one support",
      "action": "{forename} has agreed to attend one-to-one support sessions with a tutor to work on specific literacy or numeracy goals by {targetDate}.",
      "help": "Individual support can be arranged through local providers."
    }
  ],
  "Transferable Skills": [
    {
      "title": "Skills audit",
      "action": "{forename} will complete a transferable skills audit with advisor support by {targetDate} to identify strengths from previous experience.",
      "help": "Many skills transfer across different sectors."
    },
    {
      "title": "Identify target sectors",
      "action": "{forename} has agreed to research potential sectors where current skills could be applied by {targetDate}.",
      "help": "Focus on industries with skills shortages."
    },
    {
      "title": "Update CV with skills",
      "action": "{forename} will update CV to highlight transferable skills relevant to target roles by {targetDate}.",
      "help": "Use action words and specific examples."
    }
  ],
  "Learning Capability": [
    {
      "title": "Learning style assessment",
      "action": "{forename} has agreed to complete a learning styles assessment by {targetDate} to understand preferred learning methods.",
      "help": "Helps identify most effective training approaches."
    },
    {
      "title": "Arrange learning support",
      "action": "{forename} will meet with the learning provider by {targetDate} to discuss any learning support needs or reasonable adjustments.",
      "help": "Support may include extra time, different formats, or assistive technology."
    },
    {
      "title": "Set learning goals",
      "action": "{forename} has agreed to identify specific learning goals related to employment by {targetDate} with advisor support.",
      "help": "Clear goals help track progress and motivation."
    }
  ],
  "Previous Work History": [
    {
      "title": "Employment history review",
      "action": "{forename} will complete an employment history timeline with advisor support by {targetDate} to identify gaps and talking points.",
      "help": "Preparing explanations for gaps builds confidence."
    },
    {
      "title": "Reference identification",
      "action": "{forename} has agreed to identify potential references from previous roles or volunteering by {targetDate}.",
      "help": "References can include volunteer supervisors, tutors, or community leaders."
    },
    {
      "title": "Volunteering to build recent history",
      "action": "{forename} will apply to volunteer with organisations by {targetDate} to build recent work experience.",
      "help": "Short-term volunteering can provide recent references."
    }
  ],
  "Social & Support Networks": [
    {
      "title": "Identify support contacts",
      "action": "{forename} will identify supportive people in their network who can help with job search by {targetDate}.",
      "help": "Support network might include family, friends, community groups."
    },
    {
      "title": "Join community group",
      "action": "{forename} has agreed to research and attend local community groups or job clubs by {targetDate}.",
      "help": "Groups provide peer support and networking opportunities."
    },
    {
      "title": "Mentoring referral",
      "action": "{forename} will be referred to a mentoring service by {targetDate} for additional one-to-one support during job search.",
      "help": "Mentors can provide guidance and encouragement."
    }
  ],
  "English Language (ESOL)": [
    {
      "title": "ESOL assessment",
      "action": "{forename} will attend an ESOL assessment at the local provider by {targetDate} to determine current level and support needs.",
      "help": "Assessment helps identify appropriate class level."
    },
    {
      "title": "Enrol in ESOL course",
      "action": "{forename} has agreed to enrol in an ESOL course at the local provider by {targetDate} to improve workplace English.",
      "help": "Many ESOL courses focus on employment-related vocabulary."
    },
    {
      "title": "Practice speaking English",
      "action": "{forename} will attend English conversation practice sessions by {targetDate} to build speaking confidence.",
      "help": "Speaking practice helps prepare for interviews."
    }
  ],
  "Autism": [
    {
      "title": "Discuss workplace adjustments",
      "action": "{forename} will identify reasonable workplace adjustments they may need (e.g., quiet space, clear instructions, routine) and discuss them with their advisor by {targetDate}.",
      "help": "understand what adjustments will help in employment."
    },
    {
      "title": "Create communication profile",
      "action": "{forename} will create a simple communication profile explaining their preferences and any adjustments needed, with advisor support, by {targetDate}.",
      "help": "communicate needs clearly to future employers."
    },
    {
      "title": "Access specialist support",
      "action": "{forename} will be referred to a specialist autism employment service for tailored support by {targetDate}.",
      "help": "access specialist guidance for employment."
    },
    {
      "title": "Practise interview scenarios",
      "action": "{forename} will practise interview scenarios with advisor support, focusing on structured responses and managing sensory needs, by {targetDate}.",
      "help": "build confidence for interviews."
    }
  ],
  "Learning Difficulties": [
    {
      "title": "Arrange learning support assessment",
      "action": "{forename} will attend a learning support assessment by {targetDate} to identify any reasonable adjustments needed for training or employment.",
      "help": "understand specific support needs."
    },
    {
      "title": "Explore supported employment",
      "action": "{forename} will be referred to a supported employment service by {targetDate} for tailored job search support.",
      "help": "access specialist employment support."
    },
    {
      "title": "Break down tasks",
      "action": "{forename} and advisor will break down job search tasks into smaller steps with visual checklists by {targetDate}.",
      "help": "make progress manageable and clear."
    },
    {
      "title": "Identify job match",
      "action": "{forename} will discuss strengths and interests with advisor to identify suitable job roles by {targetDate}.",
      "help": "focus job search on appropriate roles."
    }
  ],
  "ADHD": [
    {
      "title": "Create structured routine",
      "action": "{forename} will create a structured daily routine for job search activities with advisor support by {targetDate}.",
      "help": "build consistent job search habits."
    },
    {
      "title": "Use reminder systems",
      "action": "{forename} will set up phone reminders or calendar alerts for appointments and deadlines by {targetDate}.",
      "help": "stay on track with commitments."
    },
    {
      "title": "Break tasks into chunks",
      "action": "{forename} will break job applications into 15-minute focused sessions with breaks, completing {n} applications by {targetDate}.",
      "help": "make tasks more manageable."
    },
    {
      "title": "Discuss workplace strategies",
      "action": "{forename} will identify workplace strategies that help with focus and organisation by {targetDate}.",
      "help": "prepare for success in employment."
    }
  ],
  "Health Condition": [
    {
      "title": "Discuss work limitations",
      "action": "{forename} will discuss any work limitations or adjustments needed due to health condition with advisor by {targetDate}.",
      "help": "identify suitable roles and adjustments."
    },
    {
      "title": "Access to Work application",
      "action": "{forename} will explore Access to Work support and begin an application if eligible by {targetDate}.",
      "help": "access funding for workplace adjustments."
    },
    {
      "title": "Flexible working research",
      "action": "{forename} will research roles offering flexible working arrangements that accommodate health needs by {targetDate}.",
      "help": "find sustainable employment options."
    },
    {
      "title": "Fit note discussion",
      "action": "{forename} will discuss fit note recommendations with GP and share relevant information with advisor by {targetDate}.",
      "help": "ensure appropriate support is in place."
    }
  ],
  "Disability": [
    {
      "title": "Discuss reasonable adjustments",
      "action": "{forename} will identify reasonable adjustments needed for work and discuss how to communicate these to employers by {targetDate}.",
      "help": "prepare for disclosure conversations."
    },
    {
      "title": "Access to Work referral",
      "action": "{forename} will be supported to apply for Access to Work funding by {targetDate}.",
      "help": "access support and equipment for employment."
    },
    {
      "title": "Disability Confident employers",
      "action": "{forename} will identify and target Disability Confident employers in their local area by {targetDate}.",
      "help": "focus on inclusive employers."
    },
    {
      "title": "Support worker discussion",
      "action": "{forename} will discuss whether a job coach or support worker would help in employment by {targetDate}.",
      "help": "explore available support options."
    }
  ]
};

export const FALLBACK_SUGGESTIONS = [
  {"title": "Book an appointment", "action": "Book an appointment with the relevant service and confirm the date/time by {targetDate}.", "help": "you access the right support quickly."} ,
  {"title": "Gather key documents", "action": "Gather the key documents needed (ID, letters, evidence) and bring them to our next appointment on {targetDate}.", "help": "us take the next steps without delay."} ,
  {"title": "Make one call", "action": "Make the agreed phone call to the relevant organisation and note the outcome by {targetDate}.", "help": "move the situation forward."} ,
  {"title": "Complete an online form", "action": "Complete the required online form and save confirmation/receipt by {targetDate}.", "help": "progress the next stage."} ,
  {"title": "Create a simple plan", "action": "Write a short step-by-step plan for what you will do next, and share it at our next review by {targetDate}.", "help": "keep actions clear and achievable."}
];

// Task-based suggestions for scheduling future activities
export const TASK_SUGGESTIONS: Record<string, Array<{title: string; outcome: string}>> = {
  "job fair": [
    {"title": "Employer conversations", "outcome": "[Name] will speak to at least 3 employers at the event and note down the roles discussed and any next steps."},
    {"title": "Sector exploration", "outcome": "[Name] will find out about roles and entry requirements in at least one sector of interest and identify whether any match their skills."},
    {"title": "Follow-up contacts", "outcome": "[Name] will collect contact details or application links from employers they are interested in and follow up within one week."},
    {"title": "Application insight", "outcome": "[Name] will ask employers about their application process and what makes a strong candidate, and share what they learned at the next appointment."}
  ],
  "workshop": [
    {"title": "Skills workshop", "outcome": "[Name] will participate fully in the session and apply what they learn to their job search."},
    {"title": "Group session", "outcome": "[Name] will take part in group activities and engage with other participants to build confidence."},
    {"title": "Training session", "outcome": "[Name] will complete the training and receive a certificate to add to their CV."}
  ],
  "interview": [
    {"title": "Mock interview", "outcome": "[Name] will complete a mock interview, practise answering competency questions, and receive feedback on areas to improve."},
    {"title": "Interview preparation", "outcome": "[Name] will prepare STAR examples for common interview questions and build confidence for upcoming interviews."},
    {"title": "Interview attendance", "outcome": "[Name] will attend the interview, present themselves professionally, and follow up afterwards regardless of outcome."}
  ],
  "cv": [
    {"title": "CV review session", "outcome": "[Name] will review and update their CV with support, focusing on key sections to better highlight their skills."},
    {"title": "CV creation", "outcome": "[Name] will create a tailored CV with support from their advisor."}
  ],
  "application": [
    {"title": "Application support", "outcome": "[Name] will complete and submit an application with support."},
    {"title": "Application practice", "outcome": "[Name] will practise completing application forms and answering competency questions."}
  ],
  "default": [
    {"title": "General activity", "outcome": "[Name] will participate fully and identify next steps towards their employment goal."},
    {"title": "Review meeting", "outcome": "[Name] will review progress towards their employment goals and agree priorities for the coming weeks."},
    {"title": "Support session", "outcome": "[Name] will receive support and develop a clearer plan for moving forward."}
  ]
};

// ============= Exemplar Library =============
// Curated high-quality barrier→action examples used for RAG-style retrieval
// before AI generation. Each exemplar represents an "accepted" action — the
// kind of output an advisor would keep without editing.
//
// Fields:
//   barrier       – the barrier label (matches DEFAULT_BARRIERS keys)
//   category      – barrier taxonomy category
//   action        – the final SMART action text (with {forename}/{targetDate} placeholders)
//   help          – how it helps with employment
//   tags          – keywords for retrieval matching
//   rating        – quality score 1-5 (all exemplars here are 5)
export interface ActionExemplar {
  barrier: string;
  category: string;
  action: string;
  help: string;
  tags: string[];
  rating: number;
}

export const EXEMPLAR_LIBRARY: ActionExemplar[] = [
  // ---- confidence ----
  {
    barrier: "Confidence",
    category: "confidence",
    action: "{forename} has agreed to identify three personal strengths, write them down with real examples, and bring them to our next meeting by {targetDate}.",
    help: "build self-awareness and communicate strengths clearly to employers.",
    tags: ["confidence", "strengths", "self-esteem", "interview", "short-term"],
    rating: 5,
  },
  {
    barrier: "Confidence",
    category: "confidence",
    action: "{forename} will complete two mock interviews with advisor support, recording answers for self-review, by {targetDate}.",
    help: "reduce interview anxiety through repeated practice and feedback.",
    tags: ["confidence", "interview", "practice", "mock", "feedback"],
    rating: 5,
  },
  {
    barrier: "Confidence",
    category: "confidence",
    action: "{forename} has agreed to attend a confidence-building workshop and note two takeaways to apply in job search by {targetDate}.",
    help: "gain practical techniques for managing nerves in professional settings.",
    tags: ["confidence", "workshop", "anxiety", "nerves", "professional"],
    rating: 5,
  },
  // ---- motivation ----
  {
    barrier: "Motivation",
    category: "confidence",
    action: "{forename} will set one realistic weekly job search goal, track progress in a journal, and review it at our next meeting by {targetDate}.",
    help: "maintain momentum through achievable milestones and accountability.",
    tags: ["motivation", "goal", "routine", "accountability", "weekly"],
    rating: 5,
  },
  {
    barrier: "Motivation",
    category: "confidence",
    action: "{forename} has agreed to create a simple weekly routine that includes dedicated job search time and one wellbeing activity, and try it for one week by {targetDate}.",
    help: "build structure and consistency to support sustained job search effort.",
    tags: ["motivation", "routine", "structure", "wellbeing", "consistency"],
    rating: 5,
  },
  // ---- CV ----
  {
    barrier: "CV",
    category: "job-search",
    action: "{forename} will rewrite their personal statement and tailor their CV to warehouse roles, sending the updated version to advisor by {targetDate}.",
    help: "present relevant skills clearly and increase chances of being shortlisted.",
    tags: ["cv", "personal statement", "tailored", "warehouse", "update"],
    rating: 5,
  },
  {
    barrier: "CV",
    category: "job-search",
    action: "{forename} has agreed to add two STAR examples demonstrating teamwork and reliability to their CV and share the draft by {targetDate}.",
    help: "strengthen applications with evidence-based examples employers look for.",
    tags: ["cv", "star", "examples", "teamwork", "reliability"],
    rating: 5,
  },
  // ---- Interviews ----
  {
    barrier: "Interviews",
    category: "job-search",
    action: "{forename} will prepare answers to five common interview questions for retail roles and practise them aloud twice before {targetDate}.",
    help: "improve interview performance and reduce anxiety through preparation.",
    tags: ["interview", "practice", "questions", "retail", "preparation"],
    rating: 5,
  },
  {
    barrier: "Interviews",
    category: "job-search",
    action: "{forename} has agreed to book and attend a mock interview session, bringing the job description and CV, by {targetDate}.",
    help: "identify areas for improvement before real interviews.",
    tags: ["interview", "mock", "feedback", "job description", "cv"],
    rating: 5,
  },
  // ---- Transport ----
  {
    barrier: "Transport",
    category: "practical",
    action: "{forename} will research and save a reliable bus route to the industrial estate, including costs and timings, and confirm attendance by {targetDate}.",
    help: "remove transport uncertainty as a barrier to attending work or interviews.",
    tags: ["transport", "bus", "route", "commute", "costs", "timings"],
    rating: 5,
  },
  {
    barrier: "Transport",
    category: "practical",
    action: "{forename} has agreed to complete the travel support application with required evidence and submit it by {targetDate}.",
    help: "access financial support for travel costs during job search.",
    tags: ["transport", "travel support", "application", "funding", "evidence"],
    rating: 5,
  },
  // ---- Job Search ----
  {
    barrier: "Job Search",
    category: "job-search",
    action: "{forename} will complete two job searches per week using Indeed and council jobs, saving at least three suitable roles each time, by {targetDate}.",
    help: "build momentum and increase chances of finding suitable vacancies.",
    tags: ["job search", "indeed", "vacancies", "weekly", "routine"],
    rating: 5,
  },
  {
    barrier: "Job Search",
    category: "job-search",
    action: "{forename} has agreed to set up job alerts for care assistant roles within 5 miles on two job boards by {targetDate}.",
    help: "see suitable vacancies quickly without manual searching every day.",
    tags: ["job search", "alerts", "care assistant", "local", "automated"],
    rating: 5,
  },
  // ---- Job Applications ----
  {
    barrier: "Job Applications",
    category: "job-search",
    action: "{forename} will submit three quality applications for suitable roles, each tailored to the job description, by {targetDate}.",
    help: "increase chances of securing interviews through targeted applications.",
    tags: ["applications", "tailored", "job description", "quality", "submit"],
    rating: 5,
  },
  // ---- Digital Skills ----
  {
    barrier: "Digital Skills",
    category: "skills",
    action: "{forename} has agreed to complete the first module of the agreed online digital skills course and save the certificate by {targetDate}.",
    help: "develop essential digital skills needed for job searching and employment.",
    tags: ["digital", "course", "module", "certificate", "online"],
    rating: 5,
  },
  {
    barrier: "Digital Skills",
    category: "skills",
    action: "{forename} will practise writing a professional email enquiry about a job vacancy and send it to advisor for feedback by {targetDate}.",
    help: "build confidence in professional digital communication.",
    tags: ["digital", "email", "professional", "communication", "practice"],
    rating: 5,
  },
  // ---- Housing ----
  {
    barrier: "Housing",
    category: "practical",
    action: "{forename} has agreed to contact the local council Housing Options team to discuss their current situation and next steps by {targetDate}.",
    help: "access appropriate housing support and reduce risk of homelessness.",
    tags: ["housing", "council", "support", "options", "referral"],
    rating: 5,
  },
  // ---- Finance ----
  {
    barrier: "Finance",
    category: "practical",
    action: "{forename} will create a weekly budget listing income and essential outgoings using the provided template and bring it completed by {targetDate}.",
    help: "understand spending patterns and identify areas to reduce financial pressure.",
    tags: ["finance", "budget", "income", "outgoings", "template"],
    rating: 5,
  },
  {
    barrier: "Finance",
    category: "practical",
    action: "{forename} has agreed to use an online benefits calculator to check entitlement and note any actions needed by {targetDate}.",
    help: "maximise income and reduce financial barriers to employment.",
    tags: ["finance", "benefits", "entitlement", "calculator", "income"],
    rating: 5,
  },
  // ---- Mental Wellbeing ----
  {
    barrier: "Mental Wellbeing",
    category: "wellbeing",
    action: "{forename} has agreed to contact the agreed wellbeing service to arrange an initial appointment by {targetDate}.",
    help: "access professional support to improve mental wellbeing and work readiness.",
    tags: ["mental health", "wellbeing", "appointment", "support", "referral"],
    rating: 5,
  },
  {
    barrier: "Mental Wellbeing",
    category: "wellbeing",
    action: "{forename} will practise one agreed self-care activity (walking 20 minutes daily) at least three times this week and note how it went by {targetDate}.",
    help: "build healthy routines that support overall wellbeing and employment readiness.",
    tags: ["mental health", "self-care", "walking", "routine", "wellbeing"],
    rating: 5,
  },
  // ---- Autism ----
  {
    barrier: "Autism",
    category: "neurodiversity",
    action: "{forename} will identify three reasonable workplace adjustments they may need (e.g., quiet space, written instructions) and discuss them with advisor by {targetDate}.",
    help: "prepare for communicating support needs to future employers.",
    tags: ["autism", "adjustments", "workplace", "communication", "support"],
    rating: 5,
  },
  // ---- ADHD ----
  {
    barrier: "ADHD",
    category: "neurodiversity",
    action: "{forename} has agreed to set up phone reminders for all appointments and deadlines, and break job applications into 15-minute focused sessions with breaks, by {targetDate}.",
    help: "stay organised and make tasks more manageable through structured approaches.",
    tags: ["adhd", "reminders", "focus", "structure", "breaks", "organisation"],
    rating: 5,
  },
  // ---- Qualifications ----
  {
    barrier: "Qualifications",
    category: "skills",
    action: "{forename} has agreed to research and shortlist two relevant courses that support their job goal and share findings with advisor by {targetDate}.",
    help: "identify training opportunities to improve employability.",
    tags: ["qualifications", "courses", "training", "research", "employability"],
    rating: 5,
  },
  // ---- Caring Responsibilities ----
  {
    barrier: "Caring Responsibilities",
    category: "practical",
    action: "{forename} will research and note down two local childcare options including costs and availability by {targetDate}.",
    help: "identify solutions to balance caring commitments with work.",
    tags: ["childcare", "caring", "costs", "availability", "work-life balance"],
    rating: 5,
  },
  // ---- Photo ID ----
  {
    barrier: "Photo ID",
    category: "practical",
    action: "{forename} has agreed to apply for a provisional driving licence online at gov.uk by {targetDate} to provide valid photo ID for employment.",
    help: "obtain official photo ID required by most employers.",
    tags: ["photo id", "provisional licence", "gov.uk", "identity", "document"],
    rating: 5,
  },
  {
    barrier: "Photo ID",
    category: "practical",
    action: "{forename} will gather supporting documents (birth certificate, proof of address) needed for ID application with advisor support by {targetDate}.",
    help: "prepare everything needed to apply for photo ID without delays.",
    tags: ["photo id", "documents", "birth certificate", "proof of address"],
    rating: 5,
  },
  // ---- Learning Difficulties ----
  {
    barrier: "Learning Difficulties",
    category: "neurodiversity",
    action: "{forename} will attend a learning support assessment by {targetDate} to identify reasonable adjustments needed for training and employment.",
    help: "understand specific support needs and access appropriate services.",
    tags: ["learning difficulties", "assessment", "reasonable adjustments", "support"],
    rating: 5,
  },
  {
    barrier: "Learning Difficulties",
    category: "neurodiversity",
    action: "{forename} and advisor will break job search tasks into small steps with visual checklists, completing one item per day by {targetDate}.",
    help: "make progress manageable through clear, structured task breakdowns.",
    tags: ["learning difficulties", "checklists", "small steps", "visual support"],
    rating: 5,
  },
  // ---- Health Condition ----
  {
    barrier: "Health Condition",
    category: "wellbeing",
    action: "{forename} will explore Access to Work support and begin an application if eligible by {targetDate}.",
    help: "access funding for workplace adjustments that accommodate health needs.",
    tags: ["health", "access to work", "adjustments", "funding", "support"],
    rating: 5,
  },
  {
    barrier: "Health Condition",
    category: "wellbeing",
    action: "{forename} has agreed to research and shortlist three roles offering flexible or part-time working that accommodates health needs by {targetDate}.",
    help: "find sustainable employment options that work around health limitations.",
    tags: ["health", "flexible working", "part time", "adjustments", "applications"],
    rating: 5,
  },
  // ---- Disability ----
  {
    barrier: "Disability",
    category: "wellbeing",
    action: "{forename} will identify reasonable adjustments needed for work and prepare a brief disclosure statement with advisor support by {targetDate}.",
    help: "prepare for communicating workplace needs clearly to potential employers.",
    tags: ["disability", "reasonable adjustments", "disclosure", "workplace"],
    rating: 5,
  },
  {
    barrier: "Disability",
    category: "wellbeing",
    action: "{forename} has agreed to research and target Disability Confident employers in the local area, applying to at least two suitable roles by {targetDate}.",
    help: "focus on inclusive employers who guarantee interviews for disabled applicants meeting minimum criteria.",
    tags: ["disability", "disability confident", "inclusive employers", "applications"],
    rating: 5,
  },
  // ---- Previous Work History ----
  {
    barrier: "Previous Work History",
    category: "experience",
    action: "{forename} will complete an employment history timeline with advisor support by {targetDate}, identifying transferable skills from each period.",
    help: "build a clear picture of experience and address employment gaps positively.",
    tags: ["work history", "employment gaps", "timeline", "transferable skills"],
    rating: 5,
  },
  {
    barrier: "Previous Work History",
    category: "experience",
    action: "{forename} has agreed to apply for volunteering with two organisations by {targetDate} to build recent work experience and references.",
    help: "gain recent references and demonstrate current reliability to employers.",
    tags: ["work history", "volunteering", "references", "experience", "recent"],
    rating: 5,
  },
  // ---- English Language (ESOL) ----
  {
    barrier: "English Language (ESOL)",
    category: "skills",
    action: "{forename} will attend an ESOL assessment at a local provider by {targetDate} to determine current English level and appropriate course.",
    help: "identify the right level of English language support for employment.",
    tags: ["esol", "english language", "assessment", "course", "level"],
    rating: 5,
  },
  {
    barrier: "English Language (ESOL)",
    category: "skills",
    action: "{forename} has agreed to learn and practise ten key workplace vocabulary words for their target sector each week until {targetDate}.",
    help: "build workplace-specific English skills relevant to target roles.",
    tags: ["esol", "english language", "vocabulary", "workplace", "practice"],
    rating: 5,
  },
  // ---- Social & Support Networks ----
  {
    barrier: "Social & Support Networks",
    category: "experience",
    action: "{forename} has agreed to research and attend a local community group or job club by {targetDate} to build social connections and peer support.",
    help: "reduce isolation and build a support network that aids job search.",
    tags: ["social", "community", "job club", "peer support", "networking"],
    rating: 5,
  },
  {
    barrier: "Social & Support Networks",
    category: "experience",
    action: "{forename} will explore and apply for volunteering opportunities that build both social connections and work experience by {targetDate}.",
    help: "build social confidence and recent experience simultaneously.",
    tags: ["social", "volunteering", "connections", "work experience"],
    rating: 5,
  },
  // ---- Learning Capability ----
  {
    barrier: "Learning Capability",
    category: "neurodiversity",
    action: "{forename} has agreed to complete a learning styles assessment by {targetDate} to understand preferred learning methods for training.",
    help: "identify the most effective learning approaches for skills development.",
    tags: ["learning capability", "learning styles", "assessment", "training"],
    rating: 5,
  },
  {
    barrier: "Learning Capability",
    category: "neurodiversity",
    action: "{forename} will create a visual step-by-step checklist for key job search tasks with advisor support by {targetDate}.",
    help: "make job search activities clear and manageable through structured visual guides.",
    tags: ["learning capability", "visual support", "checklists", "structured tasks"],
    rating: 5,
  },
  // ---- Transferable Skills ----
  {
    barrier: "Transferable Skills",
    category: "skills",
    action: "{forename} will complete the National Careers Service Skills Health Check and discuss results with advisor by {targetDate}.",
    help: "identify transferable skills from all previous experience including volunteering.",
    tags: ["transferable skills", "skills audit", "health check", "career change"],
    rating: 5,
  },
  {
    barrier: "Transferable Skills",
    category: "skills",
    action: "{forename} has agreed to update their CV to highlight transferable skills relevant to target roles by {targetDate}.",
    help: "present existing skills in a way that matches target role requirements.",
    tags: ["transferable skills", "cv", "update", "target roles"],
    rating: 5,
  },
  // ---- Substance Misuse ----
  {
    barrier: "Substance Misuse",
    category: "wellbeing",
    action: "{forename} has agreed to contact the agreed support service to arrange an initial appointment and confirm the date by {targetDate}.",
    help: "access specialist support and begin stabilising routines for employment readiness.",
    tags: ["substance misuse", "recovery", "support service", "appointment"],
    rating: 5,
  },
  {
    barrier: "Substance Misuse",
    category: "wellbeing",
    action: "{forename} will build a simple structured daily routine including one small employment-related task and review progress by {targetDate}.",
    help: "develop consistency and structure that supports both recovery and job search.",
    tags: ["substance misuse", "routine", "recovery", "structure", "employment"],
    rating: 5,
  },
  // ---- Digital Hardware & Connectivity ----
  {
    barrier: "Digital Hardware & Connectivity",
    category: "practical",
    action: "{forename} will register for free computer access at the local library by {targetDate} to enable regular job searching and applications.",
    help: "secure reliable digital access for online job search activities.",
    tags: ["digital access", "library", "computer", "internet", "job search"],
    rating: 5,
  },
  {
    barrier: "Digital Hardware & Connectivity",
    category: "practical",
    action: "{forename} has agreed to set up a free email address with advisor support and test login for key job search accounts by {targetDate}.",
    help: "establish digital presence needed for job applications and employer communication.",
    tags: ["digital access", "email", "setup", "accounts", "connectivity"],
    rating: 5,
  },
  // ---- Literacy and/or Numeracy ----
  {
    barrier: "Literacy and/or Numeracy",
    category: "skills",
    action: "{forename} has agreed to complete an initial literacy and numeracy assessment by {targetDate} to identify support needs.",
    help: "understand current level and access appropriate skills support.",
    tags: ["literacy", "numeracy", "assessment", "functional skills", "support"],
    rating: 5,
  },
  {
    barrier: "Literacy and/or Numeracy",
    category: "skills",
    action: "{forename} will enrol in a free Functional Skills course at a local provider by {targetDate} to improve confidence with reading, writing, or maths.",
    help: "build core skills needed for employment applications and workplace tasks.",
    tags: ["literacy", "numeracy", "functional skills", "course", "enrolment"],
    rating: 5,
  },
  // ---- Job Goal ----
  {
    barrier: "Job Goal",
    category: "job-search",
    action: "{forename} will research three potential career paths matching current skills and interests, noting entry requirements, by {targetDate}.",
    help: "clarify career direction before committing to specific job applications.",
    tags: ["job goal", "career direction", "research", "skills", "discovery"],
    rating: 5,
  },
  {
    barrier: "Job Goal",
    category: "job-search",
    action: "{forename} has agreed to complete a skills and interests audit with advisor support and write down target role preferences by {targetDate}.",
    help: "focus job search on realistic and achievable goals based on strengths.",
    tags: ["job goal", "skills audit", "interests", "target role", "discovery"],
    rating: 5,
  },
  // ---- Job Applications (additional) ----
  {
    barrier: "Job Applications",
    category: "job-search",
    action: "{forename} has agreed to start an application tracker recording company, role, date applied, and follow-up dates, and update it after every application until {targetDate}.",
    help: "stay organised and follow up effectively on all applications.",
    tags: ["applications", "tracker", "organisation", "follow-up"],
    rating: 5,
  },
  // ---- Housing (additional) ----
  {
    barrier: "Housing",
    category: "practical",
    action: "{forename} will gather key housing documents (tenancy agreement, ID, recent correspondence) and bring them to our next appointment on {targetDate}.",
    help: "enable referrals and evidence the housing situation quickly.",
    tags: ["housing", "documents", "tenancy", "evidence", "referral"],
    rating: 5,
  },
  // ---- Caring Responsibilities (additional) ----
  {
    barrier: "Caring Responsibilities",
    category: "practical",
    action: "{forename} has agreed to create a childcare availability map for the next four weeks and shortlist flexible roles matching those time windows by {targetDate}.",
    help: "identify realistic employment options that fit around caring commitments.",
    tags: ["childcare", "caring", "flexible", "availability", "time windows"],
    rating: 5,
  },
];
