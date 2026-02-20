"""
Synthetic training data generator for SMART action plans.

Generates instruction-following examples using a self-instruct approach:
1. Generate diverse candidate profiles (job target, constraints, barriers)
2. Inject grounding snippets from curated action library
3. Produce SMARTAction[] outputs following the required schema
4. Filter and validate outputs using SMART criteria
5. Generate preference pairs for DPO training

Uses teacher model APIs (OpenAI/Anthropic) for generation.
The generated data is for training only; the final model runs in-browser.
"""

import json
import random
import hashlib
import argparse
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


@dataclass
class CandidateProfile:
    """A synthetic job-seeker profile."""
    job_goal: str
    current_situation: str
    hours_per_week: int
    timeframe_weeks: int
    skills: list[str]
    barriers: list[str]
    confidence_level: int
    industry: str
    work_arrangement: str


@dataclass
class SMARTActionData:
    """Training example in instruction format."""
    system: str
    user: str
    assistant: str  # JSON string of SMARTAction[]
    profile: CandidateProfile
    category: str  # "single_objective", "weekly_plan", "barrier_handling"


# --- Profile generation data ---

JOB_GOALS = [
    "entry-level admin role", "junior data analyst", "customer service representative",
    "care worker", "teaching assistant", "warehouse operative",
    "retail sales assistant", "IT support technician", "marketing assistant",
    "bookkeeper", "receptionist", "delivery driver",
    "social worker", "healthcare assistant", "web developer",
    "project coordinator", "HR administrator", "graphic designer",
    "electrician apprentice", "nursery assistant",
    "security guard", "events coordinator", "accounts assistant",
    "fitness instructor", "pharmacy technician",
]

SITUATIONS = [
    "unemployed for {months} months",
    "career changer from {prev_industry}",
    "returning to work after {reason}",
    "recently graduated with {qualification}",
    "currently in {current_role} seeking change",
    "redundancy from {prev_industry}",
    "part-time worker seeking full-time",
]

PREV_INDUSTRIES = [
    "retail management", "hospitality", "manufacturing",
    "construction", "food service", "call centre work",
    "warehouse work", "cleaning", "driving",
]

RETURN_REASONS = [
    "caring for children", "health issues", "travelling",
    "caring for a family member", "maternity leave",
]

QUALIFICATIONS = [
    "a Level 2 diploma", "GCSEs", "a degree in an unrelated subject",
    "a Foundation degree", "no formal qualifications", "NVQ Level 3",
]

SKILLS_POOL = [
    "communication", "customer service", "teamwork", "basic Excel",
    "time management", "problem solving", "organisation", "leadership",
    "data entry", "cash handling", "driving licence", "first aid",
    "food hygiene", "DBS checked", "manual handling", "IT literacy",
    "social media", "writing", "maths", "phone skills",
    "Python", "JavaScript", "project management", "sales",
]

BARRIERS_POOL = [
    "transport", "childcare", "confidence", "cv_gaps",
    "lack_of_experience", "career_change", "digital_skills",
    "health", "disability", "mental_health", "time_management",
    "motivation", "language", "criminal_record", "housing",
]

INDUSTRIES = [
    "healthcare", "education", "retail", "technology",
    "construction", "hospitality", "finance", "public sector",
    "manufacturing", "creative industries", "logistics",
]


def generate_profile() -> CandidateProfile:
    """Generate a random but realistic candidate profile."""
    job_goal = random.choice(JOB_GOALS)
    hours = random.choice([2, 4, 6, 8, 10, 15, 20])
    timeframe = random.choice([4, 6, 8, 10, 12])
    confidence = random.randint(1, 5)

    # Generate situation
    situation_template = random.choice(SITUATIONS)
    situation = situation_template.format(
        months=random.randint(1, 24),
        prev_industry=random.choice(PREV_INDUSTRIES),
        reason=random.choice(RETURN_REASONS),
        qualification=random.choice(QUALIFICATIONS),
        current_role=random.choice(PREV_INDUSTRIES),
    )

    # Select skills (2-5)
    num_skills = random.randint(2, 5)
    skills = random.sample(SKILLS_POOL, num_skills)

    # Select barriers (0-3)
    num_barriers = random.randint(0, 3)
    barriers = random.sample(BARRIERS_POOL, num_barriers)

    # Lower confidence correlates with more barriers
    if confidence <= 2 and num_barriers == 0:
        barriers = random.sample(["confidence", "motivation", "cv_gaps"], random.randint(1, 2))

    return CandidateProfile(
        job_goal=job_goal,
        current_situation=situation,
        hours_per_week=hours,
        timeframe_weeks=timeframe,
        skills=skills,
        barriers=barriers,
        confidence_level=confidence,
        industry=random.choice(INDUSTRIES),
        work_arrangement=random.choice(["any", "remote", "hybrid", "on-site"]),
    )


def format_user_prompt(profile: CandidateProfile) -> str:
    """Format a profile into a user prompt."""
    lines = [
        f"I'm looking for a {profile.job_goal}.",
        f"Current situation: {profile.current_situation}.",
        f"I can spend {profile.hours_per_week} hours per week on job search.",
        f"I want a job within {profile.timeframe_weeks} weeks.",
    ]

    if profile.skills:
        lines.append(f"My skills: {', '.join(profile.skills)}.")

    if profile.barriers:
        barriers_text = ", ".join(b.replace("_", " ") for b in profile.barriers)
        lines.append(f"Challenges: {barriers_text}.")

    if profile.work_arrangement != "any":
        lines.append(f"I need {profile.work_arrangement} work.")

    return " ".join(lines)


SYSTEM_PROMPT = """You are a SMART action planner for job seekers. Generate a JSON array of SMART actions.

RULES:
1. Output ONLY valid JSON. No other text.
2. Each action MUST have ALL fields: action, metric, baseline, target, deadline, rationale, effort_estimate, first_step.
3. SPECIFIC: Each action must contain a concrete verb and specific artefact.
4. MEASURABLE: Each metric must include a numeric target or countable outcome.
5. ACHIEVABLE: Actions must fit within the stated hours/week and respect barriers.
6. RELEVANT: Actions must connect to the stated job goal.
7. TIME-BOUND: Each deadline must be a specific date or timeframe window.
8. Generate 3-8 actions covering different job-search stages.
9. For low-confidence users, start with small, low-friction first steps.
10. NEVER provide medical, legal, or financial advice."""


def create_training_example(
    profile: CandidateProfile,
    category: str = "single_objective",
) -> SMARTActionData:
    """Create a training example (without the assistant response, which
    needs to come from a teacher model)."""
    user_prompt = format_user_prompt(profile)

    return SMARTActionData(
        system=SYSTEM_PROMPT,
        user=user_prompt,
        assistant="",  # To be filled by teacher model
        profile=profile,
        category=category,
    )


def generate_dataset_prompts(
    output_path: str,
    num_examples: int = 1000,
    category_weights: Optional[dict[str, float]] = None,
) -> None:
    """Generate a set of training prompts to be sent to a teacher model."""
    if category_weights is None:
        category_weights = {
            "single_objective": 0.6,
            "weekly_plan": 0.2,
            "barrier_handling": 0.2,
        }

    examples = []
    seen_hashes = set()

    for _ in range(num_examples * 2):  # Generate extra for dedup
        if len(examples) >= num_examples:
            break

        # Choose category
        category = random.choices(
            list(category_weights.keys()),
            weights=list(category_weights.values()),
            k=1,
        )[0]

        profile = generate_profile()

        # For barrier_handling category, ensure meaningful barriers
        if category == "barrier_handling":
            if len(profile.barriers) < 1:
                profile.barriers = random.sample(
                    ["disability", "health", "confidence", "childcare", "mental_health"],
                    random.randint(1, 3),
                )
            profile.confidence_level = min(profile.confidence_level, 3)

        example = create_training_example(profile, category)

        # Deduplication
        content_hash = hashlib.md5(
            f"{example.user}".encode()
        ).hexdigest()

        if content_hash not in seen_hashes:
            seen_hashes.add(content_hash)
            examples.append(example)

    # Write prompts to file
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w") as f:
        for example in examples:
            record = {
                "system": example.system,
                "user": example.user,
                "category": example.category,
                "profile": asdict(example.profile),
            }
            f.write(json.dumps(record) + "\n")

    print(f"Generated {len(examples)} prompts → {output_path}")
    print(f"  Categories: {dict((c, sum(1 for e in examples if e.category == c)) for c in category_weights)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic SMART action training data")
    parser.add_argument("--output", default="./data/prompts.jsonl", help="Output JSONL file")
    parser.add_argument("--num-examples", type=int, default=1000, help="Number of examples to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    random.seed(args.seed)
    generate_dataset_prompts(args.output, args.num_examples)
