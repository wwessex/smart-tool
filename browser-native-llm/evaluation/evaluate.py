"""
Evaluation script for SMART action plan generation.

Runs test prompts through the model (or a mock) and scores outputs
against expected criteria. Produces a summary report with pass/fail
rates and detailed per-test breakdowns.

Usage:
    python evaluate.py --test-prompts test_prompts.json --results results.jsonl
    python evaluate.py --test-prompts test_prompts.json --mock  # Run with template fallback
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, asdict

sys.path.insert(0, str(Path(__file__).parent.parent / "training" / "data"))
from smart_rubric import score_plan, score_action, validate_json_output


@dataclass
class TestResult:
    test_id: str
    description: str
    passed: bool
    overall_score: float
    num_actions: int
    criteria_scores: dict
    expectation_results: dict
    issues: list[str]


def evaluate_plan(
    test_case: dict,
    plan_output: str | list[dict],
) -> TestResult:
    """Evaluate a generated plan against test case expectations."""
    test_id = test_case["id"]
    description = test_case["description"]
    expectations = test_case.get("expectations", {})
    input_data = test_case["input"]

    # Parse plan output
    if isinstance(plan_output, str):
        actions = validate_json_output(plan_output)
    else:
        actions = plan_output

    issues = []
    expectation_results = {}

    if actions is None:
        return TestResult(
            test_id=test_id,
            description=description,
            passed=False,
            overall_score=0.0,
            num_actions=0,
            criteria_scores={},
            expectation_results={"json_parse": False},
            issues=["Failed to parse JSON output"],
        )

    # Score with rubric
    goal = input_data.get("goal", "")
    hours = input_data.get("hours_per_week", 10)
    if isinstance(hours, str):
        hours = int(hours) if hours.isdigit() else 10

    plan_score, action_scores = score_plan(actions, goal, hours)

    # Check expectations
    num_actions = len(actions)

    # Action count
    min_actions = expectations.get("min_actions", 3)
    max_actions = expectations.get("max_actions", 8)
    if num_actions < min_actions:
        issues.append(f"Too few actions: {num_actions} (min {min_actions})")
        expectation_results["action_count"] = False
    elif num_actions > max_actions:
        issues.append(f"Too many actions: {num_actions} (max {max_actions})")
        expectation_results["action_count"] = False
    else:
        expectation_results["action_count"] = True

    # Must-mention keywords
    must_mention = expectations.get("must_mention", [])
    all_text = " ".join(
        f"{a.get('action', '')} {a.get('rationale', '')} {a.get('first_step', '')}"
        for a in actions
    ).lower()

    for keyword in must_mention:
        key = f"mentions_{keyword}"
        if keyword.lower() in all_text:
            expectation_results[key] = True
        else:
            expectation_results[key] = False
            issues.append(f"Missing expected keyword: '{keyword}'")

    # Numeric targets
    min_numeric = expectations.get("min_actions_with_numeric_target", 0)
    if min_numeric > 0:
        numeric_count = sum(
            1 for a in actions
            if any(c.isdigit() for c in f"{a.get('metric', '')} {a.get('target', '')}")
        )
        if numeric_count >= min_numeric:
            expectation_results["numeric_targets"] = True
        else:
            expectation_results["numeric_targets"] = False
            issues.append(f"Only {numeric_count}/{min_numeric} actions have numeric targets")

    # Time constraint respect
    if expectations.get("must_respect_4_hours_per_week"):
        weekly_terms = ["hours/week", "per week", "/week"]
        for a in actions:
            effort = a.get("effort_estimate", "").lower()
            for term in weekly_terms:
                if term in effort:
                    import re
                    match = re.search(r"(\d+)", effort)
                    if match and int(match.group(1)) > 4:
                        issues.append(f"Action exceeds 4h/week limit: {a.get('action', '')[:50]}")
                        expectation_results["time_respect"] = False
        if "time_respect" not in expectation_results:
            expectation_results["time_respect"] = True

    # No medical advice
    if expectations.get("must_not_give_medical_advice"):
        medical_terms = ["doctor", "medication", "treatment", "therapy", "diagnosis", "prescription"]
        has_medical = any(
            any(term in f"{a.get('action', '')} {a.get('first_step', '')}".lower() for term in medical_terms)
            for a in actions
        )
        expectation_results["no_medical_advice"] = not has_medical
        if has_medical:
            issues.append("Contains medical advice")


    # Barrier-keyword relevance
    barrier_keywords = expectations.get("barrier_keywords", [])
    if barrier_keywords:
        hits = sum(1 for kw in barrier_keywords if kw.lower() in all_text)
        expectation_results["barrier_relevance"] = hits >= max(1, len(barrier_keywords) // 2)
        if not expectation_results["barrier_relevance"]:
            issues.append("Actions are not sufficiently barrier-specific")

    # Low-friction first-step check (for low confidence barrier scenarios)
    if expectations.get("low_friction_first_step") and actions:
        first_step = actions[0].get("first_step", "")
        concise = len(first_step) <= 120
        has_small_term = any(term in first_step.lower() for term in ["first", "start", "one", "small", "10", "15", "20", "30"])
        expectation_results["low_friction_first_step"] = concise and has_small_term
        if not expectation_results["low_friction_first_step"]:
            issues.append("First action is not low-friction enough")

    if expectations.get("must_not_assume_device"):
        problematic_terms = ["on your laptop", "using your home wifi", "from your computer at home"]
        assumes_device = any(term in all_text for term in problematic_terms)
        expectation_results["no_device_assumption"] = not assumes_device
        if assumes_device:
            issues.append("Plan assumes personal digital device/connectivity")

    # Must not crash (for minimal input)
    expectation_results["no_crash"] = True  # If we got here, it didn't crash

    # Aggregate criteria scores
    criteria_scores = {}
    if action_scores:
        criteria_scores = {
            "specific": sum(s.specific.score for s in action_scores) / len(action_scores),
            "measurable": sum(s.measurable.score for s in action_scores) / len(action_scores),
            "achievable": sum(s.achievable.score for s in action_scores) / len(action_scores),
            "relevant": sum(s.relevant.score for s in action_scores) / len(action_scores),
            "time_bound": sum(s.time_bound.score for s in action_scores) / len(action_scores),
        }

    # Determine pass/fail
    expectation_pass_rate = (
        sum(1 for v in expectation_results.values() if v)
        / max(len(expectation_results), 1)
    )
    passed = plan_score >= 0.5 and expectation_pass_rate >= 0.7

    return TestResult(
        test_id=test_id,
        description=description,
        passed=passed,
        overall_score=plan_score,
        num_actions=num_actions,
        criteria_scores=criteria_scores,
        expectation_results=expectation_results,
        issues=issues,
    )


def run_evaluation(
    test_prompts_path: str,
    results_path: str | None = None,
    use_mock: bool = False,
) -> list[TestResult]:
    """Run full evaluation suite."""
    with open(test_prompts_path) as f:
        test_data = json.load(f)

    test_cases = test_data["test_cases"]
    results: list[TestResult] = []

    print(f"Running {len(test_cases)} test cases...")
    print("=" * 60)

    for test_case in test_cases:
        test_id = test_case["id"]

        # Get plan output
        if results_path and Path(results_path).exists():
            # Load pre-generated results
            plan_output = load_result(results_path, test_id)
        elif use_mock:
            # Generate mock template-based output
            plan_output = generate_mock_plan(test_case["input"])
        else:
            print(f"  {test_id}: SKIP (no results file or --mock flag)")
            continue

        if plan_output is None:
            print(f"  {test_id}: SKIP (no output found)")
            continue

        result = evaluate_plan(test_case, plan_output)
        results.append(result)

        status = "PASS" if result.passed else "FAIL"
        print(f"  {test_id}: {status} (score: {result.overall_score:.2f}, "
              f"actions: {result.num_actions}, issues: {len(result.issues)})")

        if result.issues:
            for issue in result.issues[:3]:
                print(f"    - {issue}")

    # Summary
    print("=" * 60)
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    print(f"Results: {passed}/{total} passed ({passed/max(total,1)*100:.0f}%)")

    if results:
        avg_score = sum(r.overall_score for r in results) / len(results)
        print(f"Average SMART score: {avg_score:.2f}")

    return results


def load_result(results_path: str, test_id: str) -> list[dict] | None:
    """Load a specific test result from a JSONL file."""
    with open(results_path) as f:
        for line in f:
            record = json.loads(line)
            if record.get("test_id") == test_id:
                return record.get("actions", record.get("output"))
    return None


def generate_mock_plan(input_data: dict) -> list[dict]:
    """Generate a mock plan using templates (for testing the evaluation framework)."""
    from datetime import timedelta

    goal = input_data.get("goal", "a job")
    timeframe = input_data.get("timeframe", "8 weeks")
    hours = input_data.get("hours_per_week", 10)

    today = datetime.now()

    actions = [
        {
            "action": f"Tailor CV to highlight skills relevant to {goal} roles",
            "metric": "Number of role-specific bullet points added",
            "baseline": "0 tailored bullet points",
            "target": "8 tailored bullet points",
            "deadline": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "rationale": f"A tailored CV increases interview chances for {goal}",
            "effort_estimate": "2-3 hours one-off",
            "first_step": "Open current CV and compare against 3 job descriptions",
        },
        {
            "action": f"Search and apply to 3 {goal} roles per week on job boards",
            "metric": "Applications submitted per week",
            "baseline": "0 applications",
            "target": "3 per week",
            "deadline": (today + timedelta(days=42)).strftime("%Y-%m-%d"),
            "rationale": f"Regular applications maintain momentum toward {goal}",
            "effort_estimate": "2 hours/week",
            "first_step": f'Search "{goal}" on a job board and bookmark 3 listings',
        },
        {
            "action": "Update LinkedIn profile headline and summary for target role",
            "metric": "Profile sections updated",
            "baseline": "Outdated profile",
            "target": "All key sections updated",
            "deadline": (today + timedelta(days=10)).strftime("%Y-%m-%d"),
            "rationale": "LinkedIn visibility increases recruiter contact rates",
            "effort_estimate": "1-2 hours one-off",
            "first_step": "Log in to LinkedIn and review current headline",
        },
        {
            "action": "Prepare STAR-format answers for 5 common interview questions",
            "metric": "STAR answers prepared and practised",
            "baseline": "0 prepared answers",
            "target": "5 STAR answers",
            "deadline": (today + timedelta(days=21)).strftime("%Y-%m-%d"),
            "rationale": "Preparation reduces interview anxiety and improves performance",
            "effort_estimate": "2-3 hours one-off",
            "first_step": "Write down 3 strengths and one example for each",
        },
        {
            "action": "Send 2 networking messages per week to professionals in the target field",
            "metric": "Networking messages sent per week",
            "baseline": "0 messages sent",
            "target": "2 per week",
            "deadline": (today + timedelta(days=42)).strftime("%Y-%m-%d"),
            "rationale": "Networking uncovers hidden job opportunities",
            "effort_estimate": "30 minutes/week",
            "first_step": "Identify 3 people in your network who work in a related field",
        },
    ]

    # Limit actions based on available time
    if isinstance(hours, str):
        hours = int(hours) if hours.isdigit() else 10
    if hours <= 4:
        actions = actions[:3]

    return actions


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate SMART plan generation")
    parser.add_argument("--test-prompts", default="test_prompts.json")
    parser.add_argument("--results", default=None, help="JSONL file with generated results")
    parser.add_argument("--mock", action="store_true", help="Use mock template plans")
    parser.add_argument("--output", default=None, help="Save evaluation results to JSON")
    args = parser.parse_args()

    results = run_evaluation(args.test_prompts, args.results, args.mock)

    if args.output:
        with open(args.output, "w") as f:
            json.dump([asdict(r) for r in results], f, indent=2)
        print(f"\nResults saved to {args.output}")
