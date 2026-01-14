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

export const DEFAULT_BARRIERS = [
  "Housing",
  "Finance",
  "Caring Responsibilities",
  "Digital Hardware & Connectivity",
  "Mental Wellbeing",
  "Social & Support Networks",
  "Communication Skills",
  "Digital Skills",
  "Literacy and/ Numeracy",
  "Qualifications",
  "Transferable Skills",
  "Learning Capability",
  "Previous Work History",
  "Transport",
  "Job Search",
  "Job Applications",
  "CV",
  "Interviews",
  "Confidence",
  "Motivation",
  "Job Goal",
  "Photo ID",
  "Substance Misuse"
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
  p1: "On",
  p2: "will attend",
  p4: "This will be reviewed in our next meeting in"
};

export const GUIDANCE = [
  {
    title: "Purpose",
    body: "This tool helps you create consistent, SMART-style actions for participants faster than ever and get past \"Action Block\"."
  },
  {
    title: "Barrier to action now",
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
  "Photo ID": [
    {
      "title": "Apply for ID",
      "action": "Start an application for photo ID (e.g., provisional licence or PASS card) and gather required documents by {targetDate}.",
      "help": "remove barriers to employment checks and services."
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
    {"title": "Job fair attendance", "outcome": "[Name] will speak with employers about available roles in [sector], collect contact details, and identify potential opportunities to follow up on."},
    {"title": "Networking practice", "outcome": "[Name] will practise introducing themselves to employers and talking about their skills and experience."},
    {"title": "CV handout", "outcome": "[Name] will hand out copies of their CV to employers and ask about current vacancies."}
  ],
  "workshop": [
    {"title": "Skills workshop", "outcome": "[Name] will participate in the [topic] workshop and learn [key skill] to apply to their job search."},
    {"title": "Group session", "outcome": "[Name] will take part in group activities and engage with other participants to build confidence."},
    {"title": "Training session", "outcome": "[Name] will complete the training and receive a certificate to add to their CV."}
  ],
  "interview": [
    {"title": "Mock interview", "outcome": "[Name] will complete a mock interview, practise answering competency questions, and receive feedback on areas to improve."},
    {"title": "Interview preparation", "outcome": "[Name] will prepare STAR examples for common interview questions and build confidence for upcoming interviews."},
    {"title": "Interview attendance", "outcome": "[Name] will attend the interview, present themselves professionally, and follow up afterwards regardless of outcome."}
  ],
  "cv": [
    {"title": "CV review session", "outcome": "[Name] will review and update their CV with support, focusing on [section] to better highlight their skills."},
    {"title": "CV creation", "outcome": "[Name] will create a tailored CV for [sector/role] with support from their advisor."}
  ],
  "application": [
    {"title": "Application support", "outcome": "[Name] will complete and submit an application for [role] at [employer] with support."},
    {"title": "Application practice", "outcome": "[Name] will practise completing application forms and answering competency questions."}
  ],
  "default": [
    {"title": "General activity", "outcome": "[Name] will participate in [activity] and identify next steps towards their employment goal."},
    {"title": "Review meeting", "outcome": "[Name] will review progress towards their employment goals and agree priorities for the coming weeks."},
    {"title": "Support session", "outcome": "[Name] will receive support with [topic] and develop a clearer plan for moving forward."}
  ]
};
