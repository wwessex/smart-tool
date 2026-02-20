"""
Preference pair generator for DPO training.

Generates pairwise comparisons (chosen vs rejected) scored by a
rubric. Three categories:
- Quality: better vs worse SMART action plans
- Safety: safe vs biased/harmful outputs
- Conciseness: concise vs verbose outputs

Can operate on teacher-model outputs or augmented synthetic data.
"""

import json
import random
import argparse
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

from smart_rubric import score_plan, validate_json_output


@dataclass
class PreferencePair:
    """A single preference training pair."""
    prompt: str  # system + user prompt
    chosen: str  # preferred response
    rejected: str  # less preferred response
    category: str  # quality, safety, or conciseness
    chosen_score: float
    rejected_score: float
    metadata: dict


def generate_quality_pairs(
    dataset_path: str,
    output_path: str,
    num_pairs: int = 1000,
) -> int:
    """Generate quality preference pairs from scored dataset.

    Strategy: for each prompt, generate/select two responses and
    label the higher-scoring one as 'chosen'.
    """
    # Load scored examples (grouped by similar profiles)
    examples = []
    with open(dataset_path) as f:
        for line in f:
            record = json.loads(line)
            if "plan_score" in record and "assistant" in record:
                examples.append(record)

    if len(examples) < 2:
        print("Not enough scored examples for pairing")
        return 0

    pairs = []
    used = set()

    # Strategy 1: pair high-scoring with lower-scoring examples
    examples.sort(key=lambda x: x["plan_score"], reverse=True)
    top_half = examples[:len(examples) // 2]
    bottom_half = examples[len(examples) // 2:]

    for i, chosen_ex in enumerate(top_half):
        if len(pairs) >= num_pairs:
            break

        # Find a rejected example with a similar profile but lower score
        for j, rejected_ex in enumerate(bottom_half):
            pair_key = f"{i}-{j}"
            if pair_key in used:
                continue

            # Check that prompts are somewhat similar (same category)
            if chosen_ex.get("category") != rejected_ex.get("category"):
                continue

            score_diff = chosen_ex["plan_score"] - rejected_ex["plan_score"]
            if score_diff < 0.1:
                continue

            used.add(pair_key)
            pairs.append(PreferencePair(
                prompt=f"{chosen_ex['system']}\n\n{chosen_ex['user']}",
                chosen=chosen_ex["assistant"],
                rejected=rejected_ex["assistant"],
                category="quality",
                chosen_score=chosen_ex["plan_score"],
                rejected_score=rejected_ex["plan_score"],
                metadata={
                    "score_diff": score_diff,
                    "chosen_category": chosen_ex.get("category", ""),
                },
            ))
            break

    # Write pairs
    _write_pairs(pairs, output_path)
    return len(pairs)


def generate_conciseness_pairs(
    dataset_path: str,
    output_path: str,
    num_pairs: int = 500,
) -> int:
    """Generate conciseness preference pairs.

    Strategy: take good examples and create verbose versions (rejected),
    or take verbose examples and create concise versions (chosen).
    """
    examples = []
    with open(dataset_path) as f:
        for line in f:
            record = json.loads(line)
            if "assistant" in record:
                examples.append(record)

    pairs = []

    for ex in random.sample(examples, min(num_pairs, len(examples))):
        actions = validate_json_output(ex["assistant"])
        if not actions:
            continue

        # Create a verbose version by adding filler text to actions
        verbose_actions = []
        for action in actions:
            verbose = dict(action)
            verbose["action"] = _make_verbose(verbose.get("action", ""))
            verbose["rationale"] = _make_verbose(verbose.get("rationale", ""))
            verbose_actions.append(verbose)

        chosen = json.dumps(actions, indent=2)
        rejected = json.dumps(verbose_actions, indent=2)

        if chosen != rejected:
            pairs.append(PreferencePair(
                prompt=f"{ex.get('system', '')}\n\n{ex.get('user', '')}",
                chosen=chosen,
                rejected=rejected,
                category="conciseness",
                chosen_score=0.8,
                rejected_score=0.4,
                metadata={"transform": "verbose_expansion"},
            ))

    _write_pairs(pairs, output_path)
    return len(pairs)


def generate_safety_pairs(
    output_path: str,
    num_pairs: int = 500,
) -> int:
    """Generate safety preference pairs.

    Creates pairs where the rejected response contains:
    - Assumptions about protected characteristics
    - Medical/legal advice
    - Discriminatory language
    - Unrealistic promises
    """
    safety_scenarios = [
        {
            "prompt": "I'm a single mother looking for part-time work.",
            "chosen_note": "Focuses on flexible role search and practical steps",
            "rejected_note": "Makes assumptions about capabilities or suggests discriminatory framing",
        },
        {
            "prompt": "I have a disability affecting stamina and need remote work.",
            "chosen_note": "Suggests reasonable adjustments language and remote search strategies",
            "rejected_note": "Gives medical advice or suggests hiding the disability",
        },
        {
            "prompt": "I have a criminal record and want to find work.",
            "chosen_note": "Practical steps for roles that accept spent convictions, disclosure guidance",
            "rejected_note": "Suggests lying about record or makes moral judgements",
        },
        {
            "prompt": "English is my second language and I'm anxious about interviews.",
            "chosen_note": "Suggests language practice resources and confidence-building steps",
            "rejected_note": "Suggests roles 'suitable for non-native speakers' (stereotyping)",
        },
        {
            "prompt": "I'm 55 and worried I'm too old to change careers.",
            "chosen_note": "Highlights transferable experience and age-inclusive employers",
            "rejected_note": "Reinforces age concerns or suggests 'age-appropriate' roles",
        },
    ]

    pairs = []

    for scenario in safety_scenarios:
        # Create multiple variations
        for _ in range(num_pairs // len(safety_scenarios)):
            # In practice, these would be generated by a teacher model
            # with specific safe/unsafe prompting. Here we create templates.
            pairs.append(PreferencePair(
                prompt=scenario["prompt"],
                chosen=f"[Safe response following: {scenario['chosen_note']}]",
                rejected=f"[Unsafe response following: {scenario['rejected_note']}]",
                category="safety",
                chosen_score=0.9,
                rejected_score=0.2,
                metadata={
                    "safety_type": "bias_avoidance",
                    "note": "Template - needs teacher model generation",
                },
            ))

    _write_pairs(pairs[:num_pairs], output_path)
    return len(pairs[:num_pairs])


def _make_verbose(text: str) -> str:
    """Add filler words to make text unnecessarily verbose."""
    fillers = [
        "It is really important that you ",
        "You should definitely consider ",
        "This is a great opportunity to ",
        "Make sure you take the time to carefully ",
    ]
    if len(text) < 30:
        return text
    return random.choice(fillers) + text.lower()


def _write_pairs(pairs: list[PreferencePair], output_path: str) -> None:
    """Write preference pairs to JSONL file."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w") as f:
        for pair in pairs:
            f.write(json.dumps(asdict(pair)) + "\n")

    print(f"Written {len(pairs)} pairs → {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate DPO preference pairs")
    parser.add_argument("--dataset", default="./data/scored_dataset.jsonl",
                        help="Input scored dataset")
    parser.add_argument("--output-dir", default="./data/preferences/",
                        help="Output directory for preference pairs")
    parser.add_argument("--quality-pairs", type=int, default=30000)
    parser.add_argument("--safety-pairs", type=int, default=15000)
    parser.add_argument("--conciseness-pairs", type=int, default=10000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    total += generate_quality_pairs(
        args.dataset, str(output_dir / "quality.jsonl"), args.quality_pairs
    )
    total += generate_safety_pairs(
        str(output_dir / "safety.jsonl"), args.safety_pairs
    )
    total += generate_conciseness_pairs(
        args.dataset, str(output_dir / "conciseness.jsonl"), args.conciseness_pairs
    )

    print(f"\nTotal preference pairs: {total}")
