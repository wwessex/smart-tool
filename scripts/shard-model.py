#!/usr/bin/env python3
"""
Split an ONNX model file into fixed-size shards with a manifest.

Usage:
    python scripts/shard-model.py public/models/smart-planner-150m-q4/onnx/model_q4.onnx

This produces:
    model_q4.shard_000.bin
    model_q4.shard_001.bin
    ...
    model_q4.shards.json   (manifest with SHA-256 hashes)
"""

import hashlib
import json
import os
import sys

DEFAULT_SHARD_SIZE = 50 * 1024 * 1024  # 50 MB


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def shard_model(model_path: str, shard_size: int = DEFAULT_SHARD_SIZE) -> None:
    if not os.path.isfile(model_path):
        print(f"Error: {model_path} not found", file=sys.stderr)
        sys.exit(1)

    model_dir = os.path.dirname(model_path)
    model_name = os.path.basename(model_path)
    stem = os.path.splitext(model_name)[0]
    total_size = os.path.getsize(model_path)

    print(f"Sharding {model_name} ({total_size / (1024*1024):.1f} MB) into {shard_size / (1024*1024):.0f} MB shards...")

    shards = []
    shard_idx = 0
    offset = 0

    with open(model_path, "rb") as f:
        while True:
            data = f.read(shard_size)
            if not data:
                break

            shard_name = f"{stem}.shard_{shard_idx:03d}.bin"
            shard_path = os.path.join(model_dir, shard_name)

            with open(shard_path, "wb") as sf:
                sf.write(data)

            shard_hash = sha256_file(shard_path)

            shards.append({
                "filename": shard_name,
                "offset": offset,
                "size_bytes": len(data),
                "sha256": shard_hash,
            })

            print(f"  {shard_name} ({len(data) / (1024*1024):.1f} MB) sha256={shard_hash[:16]}...")
            offset += len(data)
            shard_idx += 1

    # Verify total size
    total_shard_bytes = sum(s["size_bytes"] for s in shards)
    assert total_shard_bytes == total_size, (
        f"Shard total {total_shard_bytes} != original {total_size}"
    )

    # Write manifest
    manifest = {
        "model_file": model_name,
        "total_bytes": total_size,
        "shard_size_bytes": shard_size,
        "shard_count": len(shards),
        "shards": shards,
        "original_sha256": sha256_file(model_path),
    }

    manifest_path = os.path.join(model_dir, f"{stem}.shards.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest written to {manifest_path}")
    print(f"Total: {len(shards)} shards, {total_size / (1024*1024):.1f} MB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <model.onnx> [shard_size_mb]", file=sys.stderr)
        sys.exit(1)

    path = sys.argv[1]
    size = int(sys.argv[2]) * 1024 * 1024 if len(sys.argv) > 2 else DEFAULT_SHARD_SIZE
    shard_model(path, size)
