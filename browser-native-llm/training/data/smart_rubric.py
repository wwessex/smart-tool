"""
SMART scoring rubric for filtering synthetic training data.

Validates and scores generated SMART actions against the criteria:
- Specific: concrete verb + artefact
- Measurable: numeric target
- Achievable: effort within constraints
- Relevant: connected to goal
- Time-bound: explicit deadline

Used during data generation to filter out low-quality examples
before they enter the training set.
"""

import json
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class CriterionScore:
    name: str
    score: float  # 0.0 to 1.0
    passed: bool
    reason: str


@dataclass
class SMARTScore:
    specific: CriterionScore
    measurable: CriterionScore
    achievable: CriterionScore
    relevant: CriterionScore
    time_bound: CriterionScore
    overall: float  # 0.0 to 1.0
    valid_json: bool
    has_all_fields: bool

    @property
    def passed(self) -> bool:
        """Pass if overall score >= 0.6 and all required fields present."""
        return self.overall >= 0.6 and self.has_all_fields and self.valid_json


REQUIRED_FIELDS = [
    "action", "metric", "baseline", "target",
    "deadline", "rationale", "effort_estimate", "first_step",
]

SPECIFIC_VERBS = {
    "write", "rewrite", "create", "update", "complete", "send", "apply",
    "research", "attend", "prepare", "build", "tailor", "proofread",
    "register", "set up", "configure", "draft", "review", "practise",
    "practice", "schedule", "contact", "identify", "list", "submit",
    "enrol", "enroll", "sign up", "download", "install", "upload",
    "edit", "revise", "organise", "organize", "track", "record",
    "request", "book", "join", "follow",
}

VAGUE_TERMS = {
    "improve", "try to", "maybe", "consider", "think about",
    "look into", "possibly", "hopefully",
}


def score_action(
    action: dict,
    goal: str = "",
    hours_per_week: int = 10,
) -> SMARTScore:
    """Score a single SMART action dict."""

    # Check all required fields
    has_all_fields = all(
        isinstance(action.get(f), str) and len(action.get(f, "").strip()) > 0
        for f in REQUIRED_FIELDS
    )

    specific = _check_specific(action)
    measurable = _check_measurable(action)
    achievable = _check_achievable(action, hours_per_week)
    relevant = _check_relevant(action, goal)
    time_bound = _check_time_bound(action)

    scores = [specific.score, measurable.score, achievable.score,
              relevant.score, time_bound.score]
    overall = sum(scores) / len(scores)

    return SMARTScore(
        specific=specific,
        measurable=measurable,
        achievable=achievable,
        relevant=relevant,
        time_bound=time_bound,
        overall=overall,
        valid_json=True,
        has_all_fields=has_all_fields,
    )


def score_plan(
    actions: list[dict],
    goal: str = "",
    hours_per_week: int = 10,
) -> tuple[float, list[SMARTScore]]:
    """Score a complete plan (list of actions)."""
    if not actions:
        return 0.0, []

    scores = [score_action(a, goal, hours_per_week) for a in actions]
    avg_score = sum(s.overall for s in scores) / len(scores)

    # Penalise plans with too few or too many actions
    if len(actions) < 3:
        avg_score *= 0.7
    elif len(actions) > 8:
        avg_score *= 0.9

    return avg_score, scores


def validate_json_output(text: str) -> Optional[list[dict]]:
    """Parse and validate JSON output from a teacher model."""
    text = text.strip()

    # Try direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    except json.JSONDecodeError:
        pass

    # Try extracting JSON array
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

    return None


def filter_dataset(
    input_path: str,
    output_path: str,
    min_score: float = 0.6,
    min_actions: int = 3,
) -> dict[str, int]:
    """Filter a generated dataset, keeping only high-quality examples."""
    stats = {"total": 0, "passed": 0, "failed_json": 0, "failed_score": 0, "failed_fields": 0}

    with open(input_path) as fin, open(output_path, "w") as fout:
        for line in fin:
            stats["total"] += 1
            record = json.loads(line)

            # Parse the assistant output
            actions = validate_json_output(record.get("assistant", ""))
            if actions is None:
                stats["failed_json"] += 1
                continue

            if len(actions) < min_actions:
                stats["failed_score"] += 1
                continue

            # Score the plan
            goal = record.get("profile", {}).get("job_goal", "")
            hours = record.get("profile", {}).get("hours_per_week", 10)
            plan_score, action_scores = score_plan(actions, goal, hours)

            if plan_score < min_score:
                stats["failed_score"] += 1
                continue

            if not all(s.has_all_fields for s in action_scores):
                stats["failed_fields"] += 1
                continue

            stats["passed"] += 1
            record["plan_score"] = plan_score
            fout.write(json.dumps(record) + "\n")

    return stats


# --- Criterion checks ---

def _check_specific(action: dict) -> CriterionScore:
    text = action.get("action", "").lower()
    has_verb = any(verb in text for verb in SPECIFIC_VERBS)
    has_vague = any(term in text for term in VAGUE_TERMS)
    has_detail = len(action.get("action", "")) >= 20
    first_step_ok = len(action.get("first_step", "")) >= 10

    score = 0.0
    if has_verb:
        score += 0.4
    if not has_vague:
        score += 0.2
    if has_detail:
        score += 0.2
    if first_step_ok:
        score += 0.2

    return CriterionScore(
        name="specific",
        score=score,
        passed=score >= 0.6,
        reason="Has concrete verb and detail" if score >= 0.6 else "Lacks specificity",
    )


def _check_measurable(action: dict) -> CriterionScore:
    combined = f"{action.get('metric', '')} {action.get('target', '')}".lower()
    has_number = bool(re.search(r'\d+', combined))
    countable = ["number of", "count", "completed", "submitted", "per week",
                 "per day", "times", "sessions", "applications"]
    has_countable = any(term in combined for term in countable)

    score = 0.0
    if has_number:
        score += 0.5
    if has_countable:
        score += 0.3
    if action.get("metric", "") != action.get("action", ""):
        score += 0.2

    return CriterionScore(
        name="measurable",
        score=score,
        passed=score >= 0.5,
        reason="Has numeric/countable metric" if score >= 0.5 else "Lacks measurable target",
    )


def _check_achievable(action: dict, hours_per_week: int) -> CriterionScore:
    effort = action.get("effort_estimate", "").lower()
    hours_match = re.search(r'(\d+)\s*(?:-\s*(\d+))?\s*hours?', effort)

    score = 0.5  # Start neutral
    if hours_match:
        max_hours = int(hours_match.group(2) or hours_match.group(1))
        is_weekly = "week" in effort or "/w" in effort
        if is_weekly and max_hours > hours_per_week:
            score -= 0.3
        else:
            score += 0.25
    else:
        score += 0.1

    return CriterionScore(
        name="achievable",
        score=min(1.0, max(0.0, score)),
        passed=score >= 0.5,
        reason="Effort appears achievable" if score >= 0.5 else "Effort may exceed constraints",
    )


def _check_relevant(action: dict, goal: str) -> CriterionScore:
    action_text = f"{action.get('action', '')} {action.get('rationale', '')}".lower()
    goal_terms = [t for t in goal.lower().split() if len(t) > 2]

    job_terms = ["cv", "resume", "application", "interview", "network",
                 "linkedin", "job", "role", "career", "employer", "skill"]

    goal_overlap = sum(1 for t in goal_terms if t in action_text)
    job_related = any(t in action_text for t in job_terms)

    score = 0.0
    score += min(goal_overlap * 0.15, 0.4)
    if job_related:
        score += 0.3
    if action.get("rationale", ""):
        score += 0.2

    return CriterionScore(
        name="relevant",
        score=min(1.0, score),
        passed=score >= 0.4,
        reason="Related to job goal" if score >= 0.4 else "Not clearly relevant",
    )


def _check_time_bound(action: dict) -> CriterionScore:
    deadline = action.get("deadline", "")
    has_iso = bool(re.search(r'\d{4}-\d{2}-\d{2}', deadline))
    has_date = bool(re.search(
        r'\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', deadline, re.I
    ))
    has_relative = bool(re.search(r'(\d+)\s*(week|day|month)', deadline, re.I))

    score = 0.0
    if has_iso:
        score += 0.6
    elif has_date:
        score += 0.5
    elif has_relative:
        score += 0.4

    if deadline:
        score += 0.4

    return CriterionScore(
        name="time_bound",
        score=min(1.0, score),
        passed=score >= 0.6,
        reason="Has clear deadline" if score >= 0.6 else "Missing or vague deadline",
    )


if __name__ == "__main__":
    # Example usage
    example_action = {
        "action": "Tailor CV to highlight customer service experience relevant to admin roles",
        "metric": "Number of role-specific bullet points added",
        "baseline": "0 tailored bullet points",
        "target": "8 tailored bullet points",
        "deadline": "2026-03-01",
        "rationale": "A tailored CV increases interview callback rates for admin positions",
        "effort_estimate": "2-3 hours one-off",
        "first_step": "Open current CV and compare it against 3 admin job descriptions",
    }

    result = score_action(example_action, goal="entry-level admin role")
    print(f"Overall: {result.overall:.2f} (passed: {result.passed})")
    for criterion in [result.specific, result.measurable, result.achievable,
                      result.relevant, result.time_bound]:
        print(f"  {criterion.name}: {criterion.score:.2f} ({criterion.reason})")
