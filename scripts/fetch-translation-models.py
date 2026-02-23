#!/usr/bin/env python3
"""Download OPUS-MT translation models for offline Lengua Materna translation.

Downloads pre-converted ONNX models from the Xenova HuggingFace Hub namespace
into public/models/ so the Lengua Materna engine can run fully offline with
no remote CDN fallback.

Only the files needed by Puente Engine are downloaded (config JSONs and
quantized ONNX encoder/decoder), skipping large fp32/fp16 weights.

Usage:
    # Download ALL 30 models (~3.15 GB)
    python scripts/fetch-translation-models.py

    # Download only the 12 priority models (~1.26 GB)
    python scripts/fetch-translation-models.py --priority

    # Download models for specific languages (both directions)
    python scripts/fetch-translation-models.py --langs pl,ar,cy

    # Dry-run to see what would be downloaded
    python scripts/fetch-translation-models.py --dry-run
"""

import argparse
import os
import shutil

from huggingface_hub import snapshot_download

# ---------------------------------------------------------------------------
# Model registry — mirrors browser-translation/src/models/registry.ts
# ---------------------------------------------------------------------------

# All 30 model IDs from the Lengua Materna registry (15 en→target + 15 target→en)
ALL_MODELS = [
    # English → Target
    "opus-mt-en-de",
    "opus-mt-en-fr",
    "opus-mt-en-es",
    "opus-mt-en-it",
    "opus-mt-en-pt",
    "opus-mt-en-pl",
    "opus-mt-en-ar",
    "opus-mt-en-hi",
    "opus-mt-en-ur",
    "opus-mt-en-cy",
    "opus-mt-en-bn",
    "opus-mt-en-pa",
    "opus-mt-en-ps",
    "opus-mt-en-so",
    "opus-mt-en-ti",
    # Target → English
    "opus-mt-de-en",
    "opus-mt-fr-en",
    "opus-mt-es-en",
    "opus-mt-it-en",
    "opus-mt-pt-en",
    "opus-mt-pl-en",
    "opus-mt-ar-en",
    "opus-mt-hi-en",
    "opus-mt-ur-en",
    "opus-mt-cy-en",
    "opus-mt-bn-en",
    "opus-mt-pa-en",
    "opus-mt-ps-en",
    "opus-mt-so-en",
    "opus-mt-ti-en",
]

# High-demand languages for UK employment services (both directions)
PRIORITY_LANGS = {"pl", "ar", "ur", "cy", "bn", "so"}

# Files needed by Puente Engine — skip large fp32/fp16/alternative weights
ALLOW_PATTERNS = [
    "*.json",
    "onnx/encoder_model_quantized.onnx",
    "onnx/decoder_model_merged_quantized.onnx",
]

# HuggingFace namespace for pre-converted ONNX OPUS-MT models
HF_NAMESPACE = "Xenova"

# Cache location (CI can set HF_HUB_CACHE=/tmp/hf-cache to control disk use)
HF_CACHE = os.environ.get("HF_HUB_CACHE", os.path.join(os.getcwd(), ".hf-cache"))


def get_models_for_langs(langs: set[str]) -> list[str]:
    """Return model IDs for the given language codes (both directions)."""
    models = []
    for model_id in ALL_MODELS:
        parts = model_id.replace("opus-mt-", "").split("-")
        if len(parts) == 2:
            src, tgt = parts
            if src in langs or tgt in langs:
                models.append(model_id)
    return models


def resolve_token(cli_token: str | None) -> str | None:
    """Resolve HuggingFace token from CLI arg, env var, or cached login."""
    if cli_token:
        return cli_token
    return os.environ.get("HF_TOKEN") or None


def download_model(model_id: str, dest: str, token: str | None = None) -> None:
    """Download a single translation model from HuggingFace."""
    repo_id = f"{HF_NAMESPACE}/{model_id}"
    os.makedirs(dest, exist_ok=True)

    snapshot_download(
        repo_id=repo_id,
        local_dir=dest,
        cache_dir=HF_CACHE,
        allow_patterns=ALLOW_PATTERNS,
        resume_download=True,
        token=token,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Download OPUS-MT translation models for offline Lengua Materna"
    )
    parser.add_argument(
        "--priority",
        action="store_true",
        help=f"Download only priority language models ({', '.join(sorted(PRIORITY_LANGS))})",
    )
    parser.add_argument(
        "--langs",
        type=str,
        help="Comma-separated language codes to download (e.g., pl,ar,cy)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="public/models",
        help="Output directory for models (default: public/models)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which models would be downloaded without downloading",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="HuggingFace access token for gated/private models (also reads HF_TOKEN env var)",
    )
    args = parser.parse_args()

    # Determine which models to download
    if args.langs:
        langs = {l.strip() for l in args.langs.split(",")}
        models = get_models_for_langs(langs)
    elif args.priority:
        models = get_models_for_langs(PRIORITY_LANGS)
    else:
        models = list(ALL_MODELS)

    if not models:
        print("No models matched the selection criteria.")
        return

    estimated_size_gb = len(models) * 105 / 1024  # ~105 MB per model
    print(f"Models to download: {len(models)} (~{estimated_size_gb:.1f} GB)")
    for m in models:
        print(f"  {HF_NAMESPACE}/{m}")

    if args.dry_run:
        print("\nDry run — no files downloaded.")
        return

    token = resolve_token(args.token)
    if token:
        print(f"Using HuggingFace token: {'hf_...' + token[-4:]}")
    else:
        print("No HuggingFace token provided. Gated models may fail to download.")
        print("  Set HF_TOKEN env var or pass --token to authenticate.")

    os.makedirs(args.output, exist_ok=True)

    downloaded = 0
    failed = []
    for model_id in models:
        dest = os.path.join(args.output, model_id)
        print(f"\n[{downloaded + 1}/{len(models)}] Downloading {HF_NAMESPACE}/{model_id} → {dest}")
        try:
            download_model(model_id, dest, token=token)
            downloaded += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            failed.append(model_id)

    # Clean up HF cache to free disk (important in CI)
    if os.path.isdir(HF_CACHE):
        try:
            shutil.rmtree(HF_CACHE)
            print(f"\nCleaned cache: {HF_CACHE}")
        except Exception as e:
            print(f"\nWarning: could not clean cache {HF_CACHE}: {e}")

    print(f"\nDone. Downloaded {downloaded}/{len(models)} models.")
    if failed:
        print(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
