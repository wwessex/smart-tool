#!/usr/bin/env python3
"""
Convert OPUS-MT (Marian) translation models to ONNX format for browser inference.

Uses Hugging Face Optimum to export encoder-decoder models to ONNX,
producing separate encoder/decoder files that Transformers.js can load.

Prerequisites:
    pip install optimum[onnxruntime] transformers sentencepiece

Usage:
    # Convert a single model
    python convert-model.py --model Helsinki-NLP/opus-mt-en-de --output ./models/opus-mt-en-de

    # Convert with merged decoder (reduces memory usage)
    python convert-model.py --model Helsinki-NLP/opus-mt-en-de --output ./models/opus-mt-en-de --merge-decoder

    # Convert multiple priority models
    python convert-model.py --batch --output ./models/

Example models for the Lengua Materna Translation Engine:
    Helsinki-NLP/opus-mt-en-de   (English → German)
    Helsinki-NLP/opus-mt-en-fr   (English → French)
    Helsinki-NLP/opus-mt-en-es   (English → Spanish)
    Helsinki-NLP/opus-mt-en-pl   (English → Polish)
    Helsinki-NLP/opus-mt-en-ar   (English → Arabic)
    Helsinki-NLP/opus-mt-en-ur   (English → Urdu)
    Helsinki-NLP/opus-mt-en-hi   (English → Hindi)
    Helsinki-NLP/opus-mt-tc-big-en-cel  (English → Celtic languages, incl. Welsh)
"""

import argparse
import subprocess
import sys
from pathlib import Path

# Priority models matching the Lengua Materna supported languages
PRIORITY_MODELS = [
    "Helsinki-NLP/opus-mt-en-de",
    "Helsinki-NLP/opus-mt-en-fr",
    "Helsinki-NLP/opus-mt-en-es",
    "Helsinki-NLP/opus-mt-en-it",
    "Helsinki-NLP/opus-mt-en-pt",
    "Helsinki-NLP/opus-mt-en-pl",
    "Helsinki-NLP/opus-mt-en-ar",
    "Helsinki-NLP/opus-mt-en-ur",
    "Helsinki-NLP/opus-mt-en-hi",
    # Reverse pairs (target → English) for pivot translation
    "Helsinki-NLP/opus-mt-de-en",
    "Helsinki-NLP/opus-mt-fr-en",
    "Helsinki-NLP/opus-mt-es-en",
    "Helsinki-NLP/opus-mt-ar-en",
    "Helsinki-NLP/opus-mt-pl-en",
]


def convert_model(model_id: str, output_dir: Path, merge_decoder: bool = True) -> None:
    """Convert a single model to ONNX using optimum-cli."""
    output_path = output_dir / model_id.split("/")[-1]
    output_path.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable, "-m", "optimum.exporters.onnx",
        "--model", model_id,
        "--task", "text2text-generation",
        str(output_path),
    ]

    if merge_decoder:
        # Merge decoder and decoder-with-past to reduce file count and memory usage
        cmd.append("--merge")

    print(f"\n{'='*60}")
    print(f"Converting: {model_id}")
    print(f"Output:     {output_path}")
    print(f"{'='*60}\n")

    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        print(f"WARNING: Conversion failed for {model_id} (exit code {result.returncode})")
        return

    print(f"\nSuccessfully converted {model_id} to {output_path}")

    # List output files
    for f in sorted(output_path.rglob("*")):
        if f.is_file():
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"  {f.name}: {size_mb:.1f} MB")


def main():
    parser = argparse.ArgumentParser(
        description="Convert OPUS-MT models to ONNX for browser inference"
    )
    parser.add_argument(
        "--model",
        type=str,
        help="Hugging Face model ID to convert (e.g., Helsinki-NLP/opus-mt-en-de)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("./models"),
        help="Output directory for ONNX files (default: ./models)",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Convert all priority models",
    )
    parser.add_argument(
        "--no-merge",
        action="store_true",
        help="Don't merge decoder files (keeps decoder and decoder-with-past separate)",
    )

    args = parser.parse_args()

    if not args.model and not args.batch:
        parser.error("Specify --model MODEL_ID or --batch")

    merge = not args.no_merge

    if args.batch:
        print(f"Converting {len(PRIORITY_MODELS)} priority models...")
        for model_id in PRIORITY_MODELS:
            convert_model(model_id, args.output, merge_decoder=merge)
    else:
        convert_model(args.model, args.output, merge_decoder=merge)

    print("\nConversion complete.")
    print("Next step: run quantize-model.py to create quantized variants.")


if __name__ == "__main__":
    main()
