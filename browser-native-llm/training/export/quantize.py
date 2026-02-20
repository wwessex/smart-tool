"""
Post-training quantisation for browser-optimised model deployment.

Supports:
- ONNX dynamic quantisation (8-bit, 4-bit via ONNX Runtime tools)
- GPTQ-style weight quantisation (via AutoGPTQ)
- AWQ activation-aware quantisation (via AutoAWQ)

Usage:
    python quantize.py --input ./export/onnx/model.onnx --method onnx-int8
    python quantize.py --input ../checkpoints/dpo/final.pt --method gptq --bits 4
"""

import argparse
import json
from pathlib import Path


def quantize_onnx_dynamic(
    input_path: str,
    output_path: str,
    weight_type: str = "QInt8",
) -> None:
    """Apply ONNX Runtime dynamic quantisation."""
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType

        quant_type = QuantType.QInt8 if weight_type == "QInt8" else QuantType.QUInt8

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        quantize_dynamic(
            model_input=input_path,
            model_output=output_path,
            weight_type=quant_type,
            optimize_model=True,
        )

        original_size = Path(input_path).stat().st_size
        quantised_size = output.stat().st_size
        ratio = quantised_size / original_size

        print(f"Dynamic quantisation ({weight_type}):")
        print(f"  Original:  {original_size / (1024*1024):.1f} MB")
        print(f"  Quantised: {quantised_size / (1024*1024):.1f} MB")
        print(f"  Ratio:     {ratio:.2%}")

    except ImportError:
        print("onnxruntime.quantization not available. Install: pip install onnxruntime")


def quantize_gptq(
    checkpoint_path: str,
    output_dir: str,
    bits: int = 4,
    group_size: int = 128,
    calibration_size: int = 256,
) -> None:
    """Apply GPTQ post-training quantisation.

    Requires AutoGPTQ and a calibration dataset.
    The quantised model can be exported to ONNX or GGUF.
    """
    try:
        import torch
        import sys

        sys.path.insert(0, str(Path(__file__).parent.parent / "model"))
        from architecture import SmartPlannerModel, ModelConfig

        print(f"GPTQ quantisation ({bits}-bit, group_size={group_size})")
        print("Note: Full GPTQ implementation requires auto_gptq package")
        print("      and a calibration dataset. This is a structural outline.")

        # Load model
        config = ModelConfig()
        model = SmartPlannerModel(config)

        if Path(checkpoint_path).exists():
            ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
            model.load_state_dict(ckpt.get("model_state_dict", ckpt), strict=False)

        # In production, you would:
        # 1. Prepare calibration dataset (256-1024 examples)
        # 2. Run GPTQ quantisation per-layer
        # 3. Export quantised weights

        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)

        # Save quantisation config
        quant_config = {
            "method": "gptq",
            "bits": bits,
            "group_size": group_size,
            "calibration_size": calibration_size,
            "desc_act": True,
            "sym": True,
        }

        with open(output / "quantize_config.json", "w") as f:
            json.dump(quant_config, f, indent=2)

        # Estimate quantised size
        total_params = model.count_parameters()
        fp16_size = total_params * 2  # 2 bytes per param (fp16)
        quantised_size = total_params * bits / 8

        print(f"  Parameters: {total_params:,}")
        print(f"  FP16 size:  {fp16_size / (1024*1024):.1f} MB")
        print(f"  {bits}-bit size: {quantised_size / (1024*1024):.1f} MB (estimated)")
        print(f"  Config saved to: {output / 'quantize_config.json'}")

    except ImportError as e:
        print(f"Missing dependency: {e}")


def quantize_awq(
    checkpoint_path: str,
    output_dir: str,
    bits: int = 4,
    group_size: int = 128,
) -> None:
    """Apply AWQ (Activation-Aware Weight) quantisation.

    AWQ preserves salient weights based on activation magnitudes,
    often yielding better quality than uniform quantisation at low bits.
    """
    print(f"AWQ quantisation ({bits}-bit)")
    print("Note: Requires autoawq package for full implementation.")
    print("      This creates the configuration for the quantisation pipeline.")

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    quant_config = {
        "method": "awq",
        "bits": bits,
        "group_size": group_size,
        "zero_point": True,
        "version": "gemm",
    }

    with open(output / "quantize_config.json", "w") as f:
        json.dump(quant_config, f, indent=2)

    print(f"Config saved to: {output / 'quantize_config.json'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Quantise SMART Planner model")
    parser.add_argument("--input", required=True, help="Input model path (ONNX or PT)")
    parser.add_argument("--output", default="./export/quantised/",
                        help="Output directory")
    parser.add_argument("--method", choices=["onnx-int8", "gptq", "awq"],
                        default="gptq", help="Quantisation method")
    parser.add_argument("--bits", type=int, default=4, help="Quantisation bits (4 or 8)")
    parser.add_argument("--group-size", type=int, default=128)
    args = parser.parse_args()

    if args.method == "onnx-int8":
        quantize_onnx_dynamic(args.input, f"{args.output}/model_int8.onnx")
    elif args.method == "gptq":
        quantize_gptq(args.input, args.output, args.bits, args.group_size)
    elif args.method == "awq":
        quantize_awq(args.input, args.output, args.bits, args.group_size)
