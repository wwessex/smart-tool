"""
Export trained SMART Planner model to ONNX format for browser deployment.

Converts a PyTorch checkpoint to ONNX format compatible with
ONNX Runtime Web / Transformers.js for in-browser inference.

Usage:
    python export_onnx.py --checkpoint ../checkpoints/dpo/final.pt --output ./export/onnx/
"""

import argparse
import json
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent.parent / "model"))
from architecture import SmartPlannerModel, ModelConfig


def export_to_onnx(
    checkpoint_path: str,
    output_dir: str,
    opset_version: int = 17,
    max_seq_length: int = 1024,
) -> None:
    """Export model to ONNX format."""
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    # Load model
    device = torch.device("cpu")
    config = ModelConfig()

    model = SmartPlannerModel(config).to(device)

    if Path(checkpoint_path).exists():
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=True)
        state_dict = ckpt.get("model_state_dict", ckpt)
        model.load_state_dict(state_dict, strict=False)
        print(f"Loaded checkpoint from {checkpoint_path}")
    else:
        print("Warning: No checkpoint found, exporting with random weights")

    model.eval()

    # Create dummy inputs
    batch_size = 1
    seq_length = 64  # Short sequence for export
    dummy_input = torch.randint(0, config.vocab_size, (batch_size, seq_length))

    # Export to ONNX
    onnx_path = output / "model.onnx"

    print(f"Exporting to ONNX (opset {opset_version})...")
    torch.onnx.export(
        model,
        (dummy_input,),
        str(onnx_path),
        input_names=["input_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size", 1: "sequence_length"},
        },
        opset_version=opset_version,
        do_constant_folding=True,
    )

    print(f"ONNX model saved: {onnx_path}")
    print(f"  Size: {onnx_path.stat().st_size / (1024 * 1024):.1f} MB")

    # Validate the export
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(onnx_path))
        test_input = dummy_input.numpy()
        outputs = session.run(None, {"input_ids": test_input})
        print(f"  Validation: OK (output shape: {outputs[0].shape})")
    except ImportError:
        print("  Validation: skipped (onnxruntime not installed)")

    # Save config for browser runtime
    config_data = {
        "model_type": "smart-planner",
        "d_model": config.d_model,
        "n_layers": config.n_layers,
        "n_heads": config.n_heads,
        "n_kv_heads": config.n_kv_heads,
        "d_ff": config.d_ff,
        "vocab_size": config.vocab_size,
        "max_seq_length": config.max_seq_length,
        "norm_eps": config.norm_eps,
        "rope_theta": config.rope_theta,
    }

    config_path = output / "config.json"
    with open(config_path, "w") as f:
        json.dump(config_data, f, indent=2)

    print(f"Config saved: {config_path}")

    # Create manifest for browser chunk loader
    import hashlib

    def file_hash(path: Path) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()

    manifest = {
        "model_id": "smart-planner-150m",
        "version": "0.1.0",
        "format": "onnx",
        "total_bytes": onnx_path.stat().st_size,
        "files": [
            {
                "filename": "model.onnx",
                "size_bytes": onnx_path.stat().st_size,
                "sha256": file_hash(onnx_path),
                "required": True,
            }
        ],
        "tokenizer_file": "tokenizer.json",
        "config_file": "config.json",
    }

    manifest_path = output / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest saved: {manifest_path}")


def split_onnx_external_data(
    onnx_path: str,
    output_dir: str,
    chunk_size_mb: int = 25,
) -> None:
    """Split large ONNX model into external data files for chunked loading.

    ONNX supports storing tensor data in separate files, which enables
    chunked downloading and avoids protobuf size limits (>2GB).
    """
    try:
        import onnx
        from onnx.external_data_helper import convert_model_to_external_data

        model = onnx.load(onnx_path)
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)

        convert_model_to_external_data(
            model,
            all_tensors_to_one_file=False,
            location="weights",
            size_threshold=0,
            convert_attribute=True,
        )

        onnx.save_model(
            model,
            str(output / "model.onnx"),
            save_as_external_data=True,
            all_tensors_to_one_file=False,
            location="weights",
        )

        print(f"Split ONNX model with external data to {output_dir}")
    except ImportError:
        print("onnx package not installed. Cannot split external data.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export SMART Planner to ONNX")
    parser.add_argument("--checkpoint", default="../checkpoints/dpo/final.pt")
    parser.add_argument("--output", default="./export/onnx/")
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--split-external", action="store_true",
                        help="Split weights into external data files")
    args = parser.parse_args()

    export_to_onnx(args.checkpoint, args.output, args.opset)

    if args.split_external:
        split_onnx_external_data(
            f"{args.output}/model.onnx",
            f"{args.output}/split/",
        )
