# Amor inteligente AI Engine

A browser-loadable LLM system that generates SMART (Specific, Measurable, Achievable, Relevant, Time-bound) job-seeking action plans. Runs entirely offline in the browser using WebGPU or WebAssembly inference.

## Architecture

The system is a **constrained planner** that uses a small LLM to fill and refine structured plan templates, grounded by a local retrieval pack of curated job-search guidance.

```
User Input → Profile Normaliser → Local Retrieval → Prompt Assembly → LLM Inference → JSON Validation → Repair Loop → UI Output
```

### Key design decisions

- **~150M parameter decoder-only transformer** with 4-bit quantisation (~75-84 MB download)
- **Local retrieval pack** from open-licensed sources (UK National Careers Service OGL, O*NET CC BY, ESCO CC BY) grounds outputs in realistic job-search steps
- **JSON schema + SMART validators** enforce output correctness; failed outputs trigger a repair loop or template fallback
- **WebGPU acceleration** when available, **WASM SIMD fallback** for broad compatibility
- **Offline-first**: all inference and data stays in the browser; no server required

## Directory Structure

```
browser-native-llm/
├── src/                          # TypeScript browser runtime
│   ├── index.ts                  # Public API exports
│   ├── types.ts                  # Core type definitions
│   ├── model/                    # Model config, tokenizer, inference engines
│   │   ├── config.ts             # Architecture configs (35M, 150M, 350M)
│   │   ├── tokenizer.ts          # Tokenizer wrapper
│   │   └── inference.ts          # ONNX and Puente Engine inference
│   ├── runtime/                  # Browser capability detection
│   │   ├── backend-selector.ts   # WebGPU / WASM detection and selection
│   │   └── worker.ts             # Web Worker for off-thread inference
│   ├── retrieval/                # Local retrieval-augmented generation
│   │   ├── action-library.ts     # Action template store with indices
│   │   ├── retriever.ts          # Multi-signal template retrieval
│   │   └── packs/                # Curated knowledge packs (JSON)
│   ├── planner/                  # Plan generation orchestration
│   │   ├── profile-normalizer.ts # Raw input → structured UserProfile
│   │   ├── prompt-assembler.ts   # Profile + retrieval → model prompt
│   │   └── smart-planner.ts      # Main orchestrator (public API)
│   ├── validators/               # Output validation and repair
│   │   ├── schema.ts             # JSON schema + output parser
│   │   ├── smart-validator.ts    # SMART criteria checks
│   │   └── repair.ts             # Repair loop + template fallback
│   └── delivery/                 # Model loading and caching
│       ├── chunk-loader.ts       # Chunked download with progress
│       ├── cache-manager.ts      # Cache API persistence
│       └── sw.ts                 # Service worker for offline support
├── training/                     # Python training pipeline
│   ├── config/                   # YAML configs for each training stage
│   ├── data/                     # Synthetic data generation + rubric
│   ├── model/                    # Architecture definition + training scripts
│   └── export/                   # ONNX/GGUF export + quantisation
└── evaluation/                   # Test prompts, evaluation script, rubric
```

## Browser Runtime (TypeScript)

### Installation

```bash
npm install  # or: bun install
```

### Usage

```typescript
import { SmartPlanner } from "@smart-tool/browser-native-llm";

const planner = new SmartPlanner();
await planner.initialize();

const plan = await planner.generatePlan({
  goal: "Entry-level admin role",
  hours_per_week: 6,
  timeframe: "8 weeks",
  skills: "Excel, customer service",
});

// plan.actions: SMARTAction[]
// Each action has: action, metric, baseline, target, deadline,
//                  rationale, effort_estimate, first_step
```

### Template-only mode (no model download)

```typescript
// Works immediately with no model download
const plan = planner.generateTemplatePlan({
  goal: "Junior data analyst",
  barriers: "career change, confidence",
});
```

### Browser Compatibility

| Browser | Backend | Notes |
|---------|---------|-------|
| Chrome/Edge | WebGPU | Best performance |
| Safari | WASM SIMD | Good performance |
| Firefox | WASM SIMD | Single-threaded unless cross-origin isolated |
| Mobile | WASM | Reduced model sizes recommended |

## Training Pipeline (Python)

### Prerequisites

```bash
pip install torch pyyaml numpy
# For export:
pip install onnx onnxruntime
# For quantisation:
pip install auto-gptq autoawq  # optional
```

### Three-stage training

**Stage 1: Pretraining** - Base language + planning grammar
```bash
cd training/model
python pretrain.py --config ../config/pretrain_config.yaml
```

**Stage 2: SFT** - SMART action instruction following
```bash
python sft.py --config ../config/sft_config.yaml
```

**Stage 3: DPO** - Preference optimisation for quality and safety
```bash
python dpo.py --config ../config/dpo_config.yaml
```

### Data generation

```bash
cd training/data
python generate_synthetic.py --output ./prompts.jsonl --num-examples 10000
python preference_pairs.py --dataset ./scored_dataset.jsonl
```

### Export to browser format

```bash
cd training/export
# ONNX (for Puente Engine / ONNX Runtime Web)
python export_onnx.py --checkpoint ../checkpoints/dpo/final.pt

# GGUF (for wllama / llama.cpp WASM)
python export_gguf.py --checkpoint ../checkpoints/dpo/final.pt --type f16

# Quantisation
python quantize.py --input ./export/onnx/model.onnx --method gptq --bits 4
```

## Evaluation

```bash
cd evaluation
# Run with mock template plans (no model needed)
python evaluate.py --test-prompts test_prompts.json --mock

# Run with generated results
python evaluate.py --test-prompts test_prompts.json --results results.jsonl
```

See `evaluation/rubric.md` for the human evaluation protocol.

## Model Size Options

| Variant | Parameters | 4-bit Size | Backend | Quality |
|---------|-----------|-----------|---------|---------|
| Ultra-tiny | ~35M | ~20 MB | WASM | Acceptable with templates |
| **Balanced** | **~150M** | **~80 MB** | **WebGPU/WASM** | **Recommended** |
| Higher-quality | ~350M | ~190 MB | WebGPU | Better reasoning |

## Data Sources and Licensing

The retrieval pack templates are adapted from:

- **UK National Careers Service**: Open Government Licence v3.0
- **O*NET**: CC BY 4.0 (with noted exceptions)
- **ESCO**: CC BY 4.0 (EU-owned, with pillar-specific notices)

## Status

This is a standalone development project. It is **not yet integrated** into the main smart-tool application.
