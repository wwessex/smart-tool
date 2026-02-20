#!/usr/bin/env python3
"""
Quantize ONNX translation models for smaller browser downloads.

Applies int8 (dynamic quantization) and optionally fp16 conversion
to ONNX models produced by convert-model.py. Quantized models are
significantly smaller with minimal quality impact for translation.

Prerequisites:
    pip install onnxruntime onnx

Usage:
    # Quantize a single model directory
    python quantize-model.py --input ./models/opus-mt-en-de --output ./models/opus-mt-en-de-int8

    # Quantize with fp16 instead
    python quantize-model.py --input ./models/opus-mt-en-de --output ./models/opus-mt-en-de-fp16 --dtype fp16

    # Batch quantize all models in a directory
    python quantize-model.py --batch --input ./models/ --output ./models-quantized/

Size expectations (approximate per direction):
    fp32: ~300 MB (original)
    fp16: ~150 MB
    int8: ~75-100 MB  (recommended for browser)
"""

import argparse
import shutil
from pathlib import Path

try:
    from onnxruntime.quantization import quantize_dynamic, QuantType
    HAS_ORT = True
except ImportError:
    HAS_ORT = False

try:
    import onnx
    from onnx import numpy_helper
    import numpy as np
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False


def quantize_int8(input_dir: Path, output_dir: Path) -> None:
    """Apply dynamic int8 quantization to ONNX model files."""
    if not HAS_ORT:
        print("ERROR: onnxruntime not installed. Run: pip install onnxruntime")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # Copy non-ONNX files (config, tokenizer, etc.)
    for f in input_dir.iterdir():
        if f.is_file() and f.suffix != ".onnx":
            shutil.copy2(f, output_dir / f.name)

    # Quantize ONNX files
    for onnx_file in input_dir.glob("*.onnx"):
        output_file = output_dir / onnx_file.name
        print(f"  Quantizing {onnx_file.name} → int8...")

        quantize_dynamic(
            model_input=str(onnx_file),
            model_output=str(output_file),
            weight_type=QuantType.QUInt8,
        )

        orig_size = onnx_file.stat().st_size / (1024 * 1024)
        quant_size = output_file.stat().st_size / (1024 * 1024)
        ratio = quant_size / orig_size * 100 if orig_size > 0 else 0
        print(f"    {orig_size:.1f} MB → {quant_size:.1f} MB ({ratio:.0f}%)")


def convert_fp16(input_dir: Path, output_dir: Path) -> None:
    """Convert ONNX model weights to fp16."""
    if not HAS_ONNX:
        print("ERROR: onnx not installed. Run: pip install onnx")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # Copy non-ONNX files
    for f in input_dir.iterdir():
        if f.is_file() and f.suffix != ".onnx":
            shutil.copy2(f, output_dir / f.name)

    # Convert ONNX files to fp16
    for onnx_file in input_dir.glob("*.onnx"):
        output_file = output_dir / onnx_file.name
        print(f"  Converting {onnx_file.name} → fp16...")

        model = onnx.load(str(onnx_file))

        # Convert float32 initializers to float16
        for initializer in model.graph.initializer:
            if initializer.data_type == onnx.TensorProto.FLOAT:
                np_array = numpy_helper.to_array(initializer)
                fp16_array = np_array.astype(np.float16)
                new_init = numpy_helper.from_array(fp16_array, name=initializer.name)
                initializer.CopyFrom(new_init)

        onnx.save(model, str(output_file))

        orig_size = onnx_file.stat().st_size / (1024 * 1024)
        new_size = output_file.stat().st_size / (1024 * 1024)
        ratio = new_size / orig_size * 100 if orig_size > 0 else 0
        print(f"    {orig_size:.1f} MB → {new_size:.1f} MB ({ratio:.0f}%)")


def main():
    parser = argparse.ArgumentParser(
        description="Quantize ONNX translation models for browser deployment"
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input model directory (or parent dir for --batch)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output directory for quantized models",
    )
    parser.add_argument(
        "--dtype",
        choices=["int8", "fp16"],
        default="int8",
        help="Target quantization type (default: int8)",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Process all model subdirectories in --input",
    )

    args = parser.parse_args()

    quantize_fn = quantize_int8 if args.dtype == "int8" else convert_fp16

    if args.batch:
        subdirs = [d for d in args.input.iterdir() if d.is_dir() and any(d.glob("*.onnx"))]
        print(f"Batch quantizing {len(subdirs)} models to {args.dtype}...")
        for model_dir in sorted(subdirs):
            output = args.output / f"{model_dir.name}-{args.dtype}"
            print(f"\n{'='*60}")
            print(f"Model: {model_dir.name}")
            print(f"{'='*60}")
            quantize_fn(model_dir, output)
    else:
        if not args.input.is_dir():
            parser.error(f"Input is not a directory: {args.input}")
        quantize_fn(args.input, args.output)

    print("\nQuantization complete.")


if __name__ == "__main__":
    main()
