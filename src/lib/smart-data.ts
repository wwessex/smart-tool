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
  p2: "will", // Changed from "will attend" - verb is now contextual
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
// NOTE: Suggestions are designed to be practical and avoid assuming resources advisors may not have.
// Use concrete free resources where possible, or flexible language that advisors can adapt.
export const ACTION_LIBRARY: Record<string, Array<{title: string; action: string; help: string}>> = {
  "Housing": [
    {
      "title": "Contact Housing Options",
      "action": "Contact the local council's Housing Options team (find details at gov.uk/find-local-council) to discuss current housing situation and next steps by {targetDate}.",
      "help": "you access appropriate housing support and reduce risk of homelessness."
    },
    {
      "title": "Gather housing documents",
      "action": "Gather key housing documents (tenancy agreement, ID, any recent letters about housing) and bring them to our next appointment on {targetDate}.",
      "help": "us make referrals and evidence your situation quickly."
    },
    {
      "title": "Search properties online",
      "action": "Spend 30 minutes, three times this week, searching for affordable properties on Rightmove, Zoopla, or SpareRoom and save at least 5 links by {targetDate}.",
      "help": "you move towards stable accommodation."
    }
  ],
  "Finance": [
    {
      "title": "Create a simple budget",
      "action": "Create a weekly budget by writing down all income and essential outgoings on paper or using the free Money Helper budget planner at moneyhelper.org.uk, and bring it completed by {targetDate}.",
      "help": "you understand where your money is going and identify savings."
    },
    {
      "title": "Check benefits entitlement",
      "action": "Use the free Turn2us benefits calculator at benefits-calculator.turn2us.org.uk to check entitlement and note any actions needed (new claims, updates) by {targetDate}.",
      "help": "you maximise income and reduce financial pressure."
    },
    {
      "title": "Set up payment plan",
      "action": "Contact your creditor by phone or letter to request an affordable repayment plan you can manage, and write down what was agreed by {targetDate}.",
      "help": "you stabilise finances and avoid arrears escalating."
    },
    {
      "title": "Get free debt advice",
      "action": "Contact StepChange (0800 138 1111) or Citizens Advice for free, confidential debt advice and note the next steps suggested by {targetDate}.",
      "help": "you access expert support to manage debt."
    }
  ],
  "Transport": [
    {
      "title": "Plan route to appointments",
      "action": "Use Google Maps or Traveline (traveline.info) to plan your route to appointments, noting costs and journey times, and confirm you can attend by {targetDate}.",
      "help": "you attend reliably and reduce missed sessions."
    },
    {
      "title": "Research travel discounts",
      "action": "Research available travel discounts (e.g., jobseeker bus passes, railcards, cycle schemes) in your area and note which ones you may be eligible for by {targetDate}.",
      "help": "reduce travel costs as a barrier to job search."
    },
    {
      "title": "Explore alternative transport",
      "action": "Research alternative transport options for getting to work (walking, cycling, car-sharing, community transport) and identify what might work for your target job location by {targetDate}.",
      "help": "widen the range of jobs you can realistically apply for."
    }
  ],
  "Job Search": [
    {
      "title": "Set job search routine",
      "action": "Complete two job searches per week using Indeed, Reed, or Find a Job (findajob.dwp.gov.uk), saving at least three suitable roles each time, by {targetDate}.",
      "help": "build momentum and increase chances of interviews."
    },
    {
      "title": "Create job alerts",
      "action": "Set up email job alerts for your target role and location on Indeed and one other job site (e.g., Reed, CV-Library) by {targetDate}.",
      "help": "you see suitable vacancies as soon as they're posted."
    },
    {
      "title": "Register on job sites",
      "action": "Create or update your profile on at least two job sites (e.g., Indeed, Reed, LinkedIn) with your skills and job preferences by {targetDate}.",
      "help": "make you visible to employers searching for candidates."
    }
  ],
  "Job Applications": [
    {
      "title": "Submit quality applications",
      "action": "Submit {n} quality applications for suitable roles, tailoring each application to match the job description, by {targetDate}.",
      "help": "increase your chances of securing interviews."
    },
    {
      "title": "Track your applications",
      "action": "Start an application tracker (a simple list or spreadsheet noting: job title, company, date applied, outcome) and update it after every application by {targetDate}.",
      "help": "you stay organised and follow up on applications effectively."
    },
    {
      "title": "Prepare application answers",
      "action": "Write answers to common application questions (e.g., 'Why do you want this job?', 'Describe your relevant experience') and save them to reuse and adapt by {targetDate}.",
      "help": "speed up future applications and improve quality."
    }
  ],
  "CV": [
    {
      "title": "Update CV for target role",
      "action": "Update your CV for your target role, including a tailored profile statement and your most relevant experience, and bring it to our next meeting or email it by {targetDate}.",
      "help": "present your skills clearly to employers."
    },
    {
      "title": "Add STAR examples",
      "action": "Write two examples using the STAR method (Situation, Task, Action, Result) for key skills like teamwork or problem-solving, and keep them in your notes by {targetDate}.",
      "help": "strengthen applications and prepare you for interviews."
    },
    {
      "title": "Get CV feedback",
      "action": "Ask someone you trust (advisor, friend, family member) to review your CV and suggest improvements by {targetDate}.",
      "help": "spot errors and improve how your CV reads to employers."
    }
  ],
  "Interviews": [
    {
      "title": "Prepare interview answers",
      "action": "Prepare answers to five common interview questions for your target role (search 'common interview questions' online for examples) and practise saying them aloud by {targetDate}.",
      "help": "improve confidence and interview performance."
    },
    {
      "title": "Practise mock interview",
      "action": "Practise a mock interview with your advisor, a friend, or family member, using questions relevant to your target role, by {targetDate}.",
      "help": "identify areas to improve before real interviews."
    },
    {
      "title": "Research the employer",
      "action": "Before any interview, research the employer (their website, recent news, what they do) and prepare two questions to ask them, by {targetDate}.",
      "help": "show genuine interest and stand out to employers."
    }
  ],
  "Confidence": [
    {
      "title": "Identify your strengths",
      "action": "Write down three strengths you have with a real example for each (e.g., 'I'm reliable - I never missed a shift at my last job') and bring them to our next meeting by {targetDate}.",
      "help": "build confidence and communicate your value to employers."
    },
    {
      "title": "Take a small step",
      "action": "Take one small step towards your goal this week (e.g., make one phone enquiry, visit one employer, send one application) and note how it went by {targetDate}.",
      "help": "reduce anxiety and build confidence through progress."
    },
    {
      "title": "Positive reflection",
      "action": "At the end of each day this week, write down one thing that went well (however small) and bring your notes to our next meeting by {targetDate}.",
      "help": "build a more positive mindset for job searching."
    }
  ],
  "Motivation": [
    {
      "title": "Set a weekly goal",
      "action": "Set one realistic weekly goal linked to your job search (e.g., 'Apply for 2 jobs', 'Update my CV'), complete it, and tell me how it went by {targetDate}.",
      "help": "maintain motivation through achievable milestones."
    },
    {
      "title": "Create a simple routine",
      "action": "Create a simple weekly routine that includes dedicated job search time and breaks for wellbeing, and try following it for one week by {targetDate}.",
      "help": "build structure and consistency."
    },
    {
      "title": "Identify your 'why'",
      "action": "Write down your main reasons for wanting to work (e.g., income, independence, social contact, career goals) and bring them to our next meeting by {targetDate}.",
      "help": "remind yourself of your motivation when job searching feels hard."
    }
  ],
  "Substance Misuse": [
    {
      "title": "Contact FRANK helpline",
      "action": "Contact FRANK (0300 123 6600 or talktofrank.com) for confidential drug advice, or discuss options for local support services with your advisor, by {targetDate}.",
      "help": "you access specialist support and stabilise routines."
    },
    {
      "title": "Attend support appointment",
      "action": "Attend the scheduled support appointment and write down any next steps agreed by {targetDate}.",
      "help": "move forward with the support plan."
    },
    {
      "title": "Identify triggers",
      "action": "Identify two situations that make things harder and one thing that helps you cope with each, and discuss them at our next meeting by {targetDate}.",
      "help": "develop awareness and practical coping strategies."
    }
  ],
  "Mental Wellbeing": [
    {
      "title": "Self-refer to NHS talking therapies",
      "action": "Self-refer to NHS Talking Therapies (search 'NHS talking therapies' + your area, or ask your GP) to access free counselling support by {targetDate}.",
      "help": "you access professional support to improve mental wellbeing."
    },
    {
      "title": "Practise self-care activity",
      "action": "Choose one self-care activity (e.g., a daily walk, listening to music, journaling) and do it at least three times this week, noting how it made you feel, by {targetDate}.",
      "help": "build healthy routines and improve overall wellbeing."
    },
    {
      "title": "Contact Samaritans if struggling",
      "action": "If you're struggling, contact Samaritans (call 116 123, free, 24/7) to talk things through, and let me know how you're doing at our next meeting by {targetDate}.",
      "help": "you access immediate support when needed."
    },
    {
      "title": "Use NHS mental health resources",
      "action": "Visit nhs.uk/mental-health and read about one topic relevant to you (e.g., managing anxiety, low mood), noting any tips to try, by {targetDate}.",
      "help": "develop practical coping skills using trusted information."
    }
  ],
  "Digital Skills": [
    {
      "title": "Complete free online course",
      "action": "Complete one module of a free digital skills course (e.g., Learn My Way at learnmyway.com, or Google Digital Garage at grow.google/intl/uk) by {targetDate}.",
      "help": "develop essential digital skills for job searching and employment."
    },
    {
      "title": "Practise email skills",
      "action": "Practise writing a professional email (e.g., a job enquiry or thank-you email) and show it to your advisor for feedback by {targetDate}.",
      "help": "build confidence in professional digital communication."
    },
    {
      "title": "Use a computer at the library",
      "action": "Visit your local library to use the free computers and internet for job searching, and complete at least one job-related task there by {targetDate}.",
      "help": "you have regular access to digital tools for your job search."
    },
    {
      "title": "Learn to search for jobs online",
      "action": "Practise searching for jobs on Indeed or Find a Job (findajob.dwp.gov.uk) and save three suitable vacancies by {targetDate}.",
      "help": "build confidence using job search websites independently."
    }
  ],
  "Communication Skills": [
    {
      "title": "Practise your introduction",
      "action": "Practise introducing yourself professionally in under one minute (your name, experience, what you're looking for) and rehearse it at least three times by {targetDate}.",
      "help": "build confidence for interviews and networking."
    },
    {
      "title": "Practise phone skills",
      "action": "Practise making a phone call (e.g., calling to ask about a job vacancy) with your advisor or a trusted person before making a real call by {targetDate}.",
      "help": "build confidence for phone conversations with employers."
    },
    {
      "title": "Prepare talking points",
      "action": "Write down three key points you want to make about yourself to employers (your skills, experience, enthusiasm) and practise saying them aloud by {targetDate}.",
      "help": "communicate clearly and confidently."
    }
  ],
  "Caring Responsibilities": [
    {
      "title": "Research childcare options",
      "action": "Research local childcare options using childcarechoices.gov.uk (including costs and tax-free childcare) and note down two possibilities by {targetDate}.",
      "help": "identify solutions to balance caring and work commitments."
    },
    {
      "title": "Contact Carers UK",
      "action": "Contact Carers UK helpline (0808 808 7777) or visit carersuk.org to find out about support and benefits for carers by {targetDate}.",
      "help": "access support that may help you pursue employment."
    },
    {
      "title": "Explore flexible work options",
      "action": "Research jobs that offer flexible working (part-time, remote, term-time, shift patterns) that would fit around your caring responsibilities by {targetDate}.",
      "help": "find realistic employment options that work with your situation."
    }
  ],
  "Qualifications": [
    {
      "title": "Research free courses",
      "action": "Research free courses available to you (e.g., Skills Bootcamps, adult education, OpenLearn at open.edu) and shortlist two that support your job goal by {targetDate}.",
      "help": "identify training opportunities to improve employability."
    },
    {
      "title": "Check course funding",
      "action": "Find out if you're eligible for free or funded training (many courses are free for unemployed adults) by contacting a local college or using the National Careers Service by {targetDate}.",
      "help": "access training without cost being a barrier."
    },
    {
      "title": "Contact National Careers Service",
      "action": "Contact the National Careers Service (0800 100 900 or nationalcareers.service.gov.uk) for free advice on courses and qualifications by {targetDate}.",
      "help": "get expert guidance on training and career options."
    }
  ],
  "Job Goal": [
    {
      "title": "Define job goal",
      "action": "Write down your target job role, including: type of work, preferred hours, acceptable travel distance, and minimum pay needed, and bring it to our next meeting by {targetDate}.",
      "help": "focus your job search on realistic and achievable goals."
    },
    {
      "title": "Research target role",
      "action": "Research what skills and qualifications employers ask for in your target role (look at 5 job adverts) and note any gaps to work on by {targetDate}.",
      "help": "identify steps to become more competitive for your target job."
    },
    {
      "title": "Explore career ideas",
      "action": "Use the National Careers Service website (nationalcareers.service.gov.uk/explore-careers) to explore job roles that match your interests and skills by {targetDate}.",
      "help": "discover realistic job options you may not have considered."
    }
  ],
  "Photo ID": [
    {
      "title": "Apply for provisional licence",
      "action": "{forename} has agreed to apply for a provisional driving licence online at gov.uk/apply-first-provisional-driving-licence by {targetDate}. This provides valid photo ID for employment. Cost: £34, delivery: 2-3 weeks.",
      "help": "Provisional licences are widely accepted as photo ID."
    },
    {
      "title": "Apply for PASS card",
      "action": "{forename} will apply for a CitizenCard (citizencard.com) or My ID card (myidcard.co.uk) by {targetDate}. Cost: around £15, delivery: 1-2 weeks.",
      "help": "PASS cards are accepted as proof of age and ID."
    },
    {
      "title": "Check free ID schemes",
      "action": "{forename} will check if there are any local schemes offering free or subsidised ID (some councils and charities help with this) by asking at Citizens Advice or the library by {targetDate}.",
      "help": "access ID without cost being a barrier."
    }
  ],
  "Digital Hardware & Connectivity": [
    {
      "title": "Library computer access",
      "action": "{forename} will visit the local library to register for free computer and internet access by {targetDate}. Libraries offer free Wi-Fi, computers, and often printing.",
      "help": "you have a reliable place to do job searching and applications."
    },
    {
      "title": "Explore free Wi-Fi options",
      "action": "{forename} will identify places with free Wi-Fi for job searching (libraries, community centres, some cafés) and make a list by {targetDate}.",
      "help": "you can get online even without home internet."
    },
    {
      "title": "Research low-cost phone options",
      "action": "{forename} will research low-cost SIM-only mobile plans (e.g., Giffgaff, Smarty, Lebara) or pay-as-you-go options for calls and data by {targetDate}.",
      "help": "stay contactable for employers without high costs."
    },
    {
      "title": "Check device access schemes",
      "action": "{forename} will ask at the library or Citizens Advice about any local schemes offering free or low-cost devices (tablets, laptops) for job seekers by {targetDate}.",
      "help": "access a device for job searching."
    }
  ],
  "Literacy and/or Numeracy": [
    {
      "title": "Explore free Functional Skills",
      "action": "{forename} will contact a local adult education provider or search for 'free functional skills courses' in their area to find out about English and maths support by {targetDate}.",
      "help": "Functional Skills courses are usually free for adults."
    },
    {
      "title": "Use free learning apps",
      "action": "{forename} will try a free learning app (e.g., BBC Skillswise at bbc.co.uk/teach/skillswise, or Duolingo for English) for 15 minutes, three times this week, by {targetDate}.",
      "help": "practise skills in a flexible, low-pressure way."
    },
    {
      "title": "Discuss support needs",
      "action": "{forename} will discuss any reading, writing, or maths challenges openly with their advisor by {targetDate} so we can find the right support together.",
      "help": "ensure support is tailored to your actual needs."
    },
    {
      "title": "Practise form-filling",
      "action": "{forename} will practise filling in a sample job application form with advisor support by {targetDate} to build confidence.",
      "help": "prepare for real applications."
    }
  ],
  "Transferable Skills": [
    {
      "title": "List your transferable skills",
      "action": "{forename} will write down skills from previous experience (paid work, volunteering, home, hobbies) that could apply to other jobs, with advisor support, by {targetDate}.",
      "help": "Many skills transfer across different sectors."
    },
    {
      "title": "Identify target sectors",
      "action": "{forename} will research two sectors where their current skills are in demand (e.g., hospitality, retail, care, logistics) by {targetDate}.",
      "help": "focus job search on realistic opportunities."
    },
    {
      "title": "Update CV with skills",
      "action": "{forename} will update their CV to clearly list transferable skills with examples of where they used them by {targetDate}.",
      "help": "show employers what you can offer."
    }
  ],
  "Learning Capability": [
    {
      "title": "Discuss learning preferences",
      "action": "{forename} will discuss how they learn best (e.g., watching, doing, reading, listening) with their advisor by {targetDate} so training can be matched to their style.",
      "help": "find the most effective way for you to learn."
    },
    {
      "title": "Request learning support",
      "action": "{forename} will ask any training provider about available support (e.g., extra time, one-to-one help, different formats) before starting a course by {targetDate}.",
      "help": "ensure support is in place from the start."
    },
    {
      "title": "Set small learning goals",
      "action": "{forename} will set one small learning goal related to their job search (e.g., learn to use one new website, practise one skill) and complete it by {targetDate}.",
      "help": "build confidence through achievable progress."
    }
  ],
  "Previous Work History": [
    {
      "title": "Complete employment timeline",
      "action": "{forename} will write out their employment history (dates, job titles, main duties) with advisor support by {targetDate}, noting any gaps that may need explaining.",
      "help": "prepare for applications and interviews."
    },
    {
      "title": "Identify references",
      "action": "{forename} will identify two people who could provide a reference (e.g., previous manager, volunteer supervisor, tutor, community leader) and check they're willing by {targetDate}.",
      "help": "have references ready when employers ask."
    },
    {
      "title": "Prepare gap explanations",
      "action": "{forename} will prepare brief, honest explanations for any gaps in work history (e.g., caring, health, study) with advisor support by {targetDate}.",
      "help": "answer questions about gaps confidently."
    }
  ],
  "Social & Support Networks": [
    {
      "title": "Identify your supporters",
      "action": "{forename} will write down names of people who could support their job search (family, friends, former colleagues) and what each might help with by {targetDate}.",
      "help": "use your existing network for support."
    },
    {
      "title": "Find a local job club",
      "action": "{forename} will search for local job clubs or employment support groups (check library noticeboards, council websites, or Facebook groups) and attend one by {targetDate}.",
      "help": "get peer support and practical help."
    },
    {
      "title": "Tell someone about your job search",
      "action": "{forename} will tell at least one trusted person about the kind of work they're looking for by {targetDate} - many jobs come through word of mouth.",
      "help": "people can't help if they don't know you're looking."
    }
  ],
  "English Language (ESOL)": [
    {
      "title": "Find ESOL classes",
      "action": "{forename} will search for free ESOL classes in their area (try local colleges, community centres, or search 'free ESOL classes near me') and find out about enrolment by {targetDate}.",
      "help": "many ESOL classes are free and focus on everyday and work English."
    },
    {
      "title": "Practise English daily",
      "action": "{forename} will practise English for 15 minutes daily using a free app (e.g., Duolingo, BBC Learning English at bbc.co.uk/learningenglish) by {targetDate}.",
      "help": "build skills through regular practice."
    },
    {
      "title": "Practise speaking English",
      "action": "{forename} will find opportunities to practise speaking English (e.g., conversation groups, speaking with advisor, everyday situations) at least twice before {targetDate}.",
      "help": "build confidence for interviews and work."
    }
  ],
  "Autism": [
    {
      "title": "Identify helpful adjustments",
      "action": "{forename} will think about what helps them work well (e.g., quiet environment, clear written instructions, routine, advance notice of changes) and write these down with advisor support by {targetDate}.",
      "help": "prepare to discuss reasonable adjustments with employers."
    },
    {
      "title": "Create a one-page profile",
      "action": "{forename} will create a simple one-page profile about how they work best and any support they find helpful, to share with employers if they choose, by {targetDate}.",
      "help": "communicate your needs clearly when you're ready."
    },
    {
      "title": "Research autism employment support",
      "action": "{forename} will research autism employment support in their area (try searching 'autism employment support' + your area, or ask about Access to Work) by {targetDate}.",
      "help": "access specialist support if it would help."
    },
    {
      "title": "Prepare for interviews differently",
      "action": "{forename} will discuss with their advisor how to prepare for interviews in a way that works for them (e.g., written questions in advance, practising set answers, managing sensory needs) by {targetDate}.",
      "help": "approach interviews in a way that suits you."
    }
  ],
  "Learning Difficulties": [
    {
      "title": "Discuss support needs",
      "action": "{forename} will discuss what support helps them learn and work effectively (e.g., clear simple instructions, more time, practical demonstrations) with their advisor by {targetDate}.",
      "help": "ensure the right support is in place."
    },
    {
      "title": "Research supported employment",
      "action": "{forename} will research supported employment services in their area (search 'supported employment' + your area, or ask at the Job Centre) by {targetDate}.",
      "help": "access tailored job search support if helpful."
    },
    {
      "title": "Break down job search tasks",
      "action": "{forename} and advisor will create a simple step-by-step checklist for the next job search task, breaking it into small manageable steps, by {targetDate}.",
      "help": "make progress feel manageable and clear."
    },
    {
      "title": "Identify good job matches",
      "action": "{forename} will discuss their interests and strengths with their advisor to identify job types that would suit them by {targetDate}.",
      "help": "focus on jobs where you'll thrive."
    }
  ],
  "ADHD": [
    {
      "title": "Create a simple routine",
      "action": "{forename} will create a simple daily or weekly routine for job search activities (writing it down or using a planner) with advisor support by {targetDate}.",
      "help": "build structure that supports focus."
    },
    {
      "title": "Set up reminders",
      "action": "{forename} will set up phone alarms, calendar reminders, or sticky notes for important appointments and deadlines by {targetDate}.",
      "help": "stay on track with commitments."
    },
    {
      "title": "Use short focused sessions",
      "action": "{forename} will try working on job applications in 15-20 minute focused sessions with short breaks, completing {n} applications by {targetDate}.",
      "help": "make tasks feel more manageable."
    },
    {
      "title": "Identify what helps you focus",
      "action": "{forename} will think about what helps them focus and stay organised (e.g., quiet space, music, lists, body doubling) and try using one strategy this week by {targetDate}.",
      "help": "find strategies that work for you."
    }
  ],
  "Health Condition": [
    {
      "title": "Discuss work limitations",
      "action": "{forename} will discuss with their advisor any limitations or adjustments they may need in work due to their health condition by {targetDate}.",
      "help": "identify suitable roles and plan for reasonable adjustments."
    },
    {
      "title": "Research Access to Work",
      "action": "{forename} will research Access to Work (gov.uk/access-to-work) to understand what support may be available and whether to apply, by {targetDate}.",
      "help": "Access to Work can fund adjustments and support in employment."
    },
    {
      "title": "Search for flexible roles",
      "action": "{forename} will search for jobs that offer flexibility (part-time, remote working, flexible hours) that would accommodate their health needs by {targetDate}.",
      "help": "find sustainable employment options."
    },
    {
      "title": "Review fit note if applicable",
      "action": "{forename} will discuss any current or recent fit note with their advisor by {targetDate} to ensure the job search takes health advice into account.",
      "help": "job search is aligned with medical guidance."
    }
  ],
  "Disability": [
    {
      "title": "Identify reasonable adjustments",
      "action": "{forename} will think about what adjustments they may need in work (e.g., equipment, flexible hours, accessibility) and discuss them with their advisor by {targetDate}.",
      "help": "prepare to request reasonable adjustments."
    },
    {
      "title": "Apply for Access to Work",
      "action": "{forename} will start an Access to Work application at gov.uk/access-to-work with advisor support if eligible by {targetDate}.",
      "help": "Access to Work can fund equipment, support, and travel costs."
    },
    {
      "title": "Find Disability Confident employers",
      "action": "{forename} will search for Disability Confident employers (look for the logo on job adverts, or search 'Disability Confident employers' + your area) by {targetDate}.",
      "help": "focus on employers committed to inclusive hiring."
    },
    {
      "title": "Decide about disclosure",
      "action": "{forename} will discuss with their advisor whether, when, and how to tell employers about their disability, preparing what to say if they choose to, by {targetDate}.",
      "help": "make informed choices about disclosure."
    }
  ]
};

// Fallback suggestions when no specific barrier match is found
// These are intentionally generic but still actionable
export const FALLBACK_SUGGESTIONS = [
  {"title": "Make a phone call", "action": "Make a phone call to [who?] about [what?] and write down what was agreed by {targetDate}.", "help": "move things forward and have a clear record."} ,
  {"title": "Gather documents", "action": "Gather the documents you need (e.g., ID, letters, proof of address) and bring them to our next appointment on {targetDate}.", "help": "us take the next steps without delay."} ,
  {"title": "Research online", "action": "Spend 30 minutes researching [topic] online and write down what you found by {targetDate}.", "help": "you make informed decisions."} ,
  {"title": "Complete a form", "action": "Complete the [form name] form and save a copy or screenshot of the confirmation by {targetDate}.", "help": "progress to the next stage."} ,
  {"title": "Write a simple plan", "action": "Write down the steps you will take to [goal] and bring your plan to our next meeting by {targetDate}.", "help": "keep actions clear and achievable."},
  {"title": "Contact Citizens Advice", "action": "Contact Citizens Advice (citizensadvice.org.uk or 0800 144 8848) about [issue] and note their advice by {targetDate}.", "help": "you get expert, free advice on your situation."}
];

// Task-based suggestions for scheduling future activities
// These are practical outcomes that don't assume specific resources or services
export const TASK_SUGGESTIONS: Record<string, Array<{title: string; outcome: string}>> = {
  "job fair": [
    {"title": "Speak with employers", "outcome": "[Name] will speak with at least 3 employers about available roles, ask about their application process, and collect any contact details or cards."},
    {"title": "Practise introductions", "outcome": "[Name] will practise introducing themselves to employers and talking about their skills and what they're looking for."},
    {"title": "Give out CVs", "outcome": "[Name] will bring copies of their CV and hand them to employers at relevant stalls, asking about current vacancies."},
    {"title": "Research opportunities", "outcome": "[Name] will note down at least 5 companies or roles to research further after the event."}
  ],
  "workshop": [
    {"title": "Participate and take notes", "outcome": "[Name] will participate fully in the session, take notes on key points, and identify one thing to apply to their job search."},
    {"title": "Engage with others", "outcome": "[Name] will take part in group activities and speak with at least one other participant to share experiences."},
    {"title": "Complete any tasks", "outcome": "[Name] will complete any tasks or activities during the session and ask questions if unsure."}
  ],
  "interview": [
    {"title": "Complete mock interview", "outcome": "[Name] will complete a mock interview, practise answering questions out loud, and note feedback on areas to improve."},
    {"title": "Prepare STAR examples", "outcome": "[Name] will prepare answers to common interview questions using the STAR method (Situation, Task, Action, Result)."},
    {"title": "Attend real interview", "outcome": "[Name] will attend the interview on time, dressed appropriately, and follow up with the employer afterwards regardless of outcome."},
    {"title": "Research the employer", "outcome": "[Name] will research the employer before the interview and prepare at least two questions to ask them."}
  ],
  "cv": [
    {"title": "Review and update CV", "outcome": "[Name] will review and update their CV, focusing on making their experience and skills clear to employers."},
    {"title": "Get CV feedback", "outcome": "[Name] will bring their CV for review and make improvements based on feedback."},
    {"title": "Tailor CV to role", "outcome": "[Name] will update their CV to match a specific job they're interested in."}
  ],
  "application": [
    {"title": "Complete application", "outcome": "[Name] will complete the application, checking it carefully before submitting."},
    {"title": "Practise application answers", "outcome": "[Name] will practise answering common application questions and save their answers for future use."},
    {"title": "Submit by deadline", "outcome": "[Name] will submit the completed application before the closing date, saving a copy for their records."}
  ],
  "appointment": [
    {"title": "Attend appointment", "outcome": "[Name] will attend the appointment on time and note down any next steps or actions agreed."},
    {"title": "Prepare questions", "outcome": "[Name] will prepare questions or topics to discuss at the appointment in advance."},
    {"title": "Follow up actions", "outcome": "[Name] will complete any actions agreed at the appointment by the next review date."}
  ],
  "training": [
    {"title": "Complete training", "outcome": "[Name] will attend and complete the training session, asking questions if anything is unclear."},
    {"title": "Apply learning", "outcome": "[Name] will identify one thing from the training to apply to their job search and try it within a week."},
    {"title": "Obtain certificate", "outcome": "[Name] will complete the training and obtain any certificate or evidence of completion."}
  ],
  "default": [
    {"title": "Participate fully", "outcome": "[Name] will participate fully in this activity and identify one next step for their job search afterwards."},
    {"title": "Review progress", "outcome": "[Name] will review progress towards their employment goals and agree clear priorities for the coming weeks."},
    {"title": "Discuss support needs", "outcome": "[Name] will discuss what support would be most helpful and agree actions for moving forward."},
    {"title": "Set specific goals", "outcome": "[Name] will set at least one specific, achievable goal to complete before the next meeting."}
  ]
};
