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
  "Literacy and/or Numeracy",
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
  "Substance Misuse",
  "Autism",
  "Learning Difficulties",
  "ADHD",
  "Health Condition",
  "Disability"
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
  p2: "will attend",
  p3: "This will be reviewed in our next meeting in"
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
    {"title": "Job fair attendance", "outcome": "[Name] will speak with employers about available roles, collect contact details, and identify potential opportunities to follow up on."},
    {"title": "Networking practice", "outcome": "[Name] will practise introducing themselves to employers and talking about their skills and experience."},
    {"title": "CV handout", "outcome": "[Name] will hand out copies of their CV to employers and ask about current vacancies."}
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
