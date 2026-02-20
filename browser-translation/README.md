# @smart-tool/browser-translation

Offline-first, privacy-preserving in-browser translation engine for the SMART Action Tool. Replaces the previous cloud/NLLB-based translation with lightweight, per-language-pair **OPUS-MT (Marian)** models running locally via **Transformers.js + ONNX Runtime Web**.

## Status: Not Yet Integrated

This module is **designed but not yet wired** into the main smart-tool application. It lives in its own folder for review and iteration before replacing `src/lib/localTranslator.ts` and `src/hooks/useTranslation.ts`.

## Why Replace the Current Approach?

| Aspect | Current (NLLB-200-distilled-600M) | New (OPUS-MT per-pair) |
|--------|-----------------------------------|------------------------|
| Model size | Multi-GB single model | ~50–150 MB per pair (quantized) |
| Licence | CC-BY-NC-4.0 (non-commercial) | CC-BY-4.0 (commercial OK) |
| Coverage | 200 languages in one model | Per-pair models + pivot through English |
| Memory | Loads entire 600M model | Only loads needed pairs (LRU, max 3) |
| Quality | Good for high-resource, variable for low-resource | Optimised per pair |

## Architecture

```
browser-translation/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── types.ts                    # All TypeScript type definitions
│   ├── engine/
│   │   ├── translator.ts           # TranslationEngine — main public class
│   │   ├── pipeline-manager.ts     # LRU pipeline lifecycle management
│   │   └── text-chunker.ts         # Sentence/paragraph segmentation
│   ├── models/
│   │   ├── registry.ts             # Language pair → OPUS-MT model mapping
│   │   └── pivot.ts                # Pivot translation routing (via English)
│   ├── runtime/
│   │   ├── backend-selector.ts     # WebGPU / WASM capability detection
│   │   ├── worker.ts               # Web Worker entry point
│   │   └── worker-client.ts        # Main thread ↔ Worker messaging
│   ├── cache/
│   │   ├── translation-cache.ts    # LRU cache for translated segments
│   │   └── model-cache.ts          # Browser Cache API for model files
│   └── utils/
│       └── rtl.ts                  # Right-to-left language detection
├── evaluation/
│   ├── golden-set.json             # Reference translations for quality testing
│   └── evaluate.ts                 # chrF scoring + placeholder checks
├── scripts/
│   ├── convert-model.py            # ONNX export from HuggingFace
│   └── quantize-model.py           # Post-export int8/fp16 quantization
├── package.json
├── tsconfig.json
└── README.md
```

## Key Design Decisions

### Per-Language-Pair Models (not multilingual)
OPUS-MT models are directional (en→de ≠ de→en). This means better quality per pair but more models to manage. The `PipelineManager` handles this with LRU eviction (default max 3 loaded simultaneously).

### Pivot Translation Through English
For language pairs without a direct model (e.g., pl→ar), the engine automatically routes through English: pl→en→ar. Following Firefox's approach, pivot is limited to one hop maximum.

### Web Worker Inference
Translation runs off the main thread via a Web Worker to keep the UI responsive. The `TranslationWorkerClient` provides a Promise-based API with request correlation and timeouts.

### Placeholder Preservation
Format strings like `{name}`, `%s`, `{{count}}` are extracted before translation and restored after, preventing the model from mangling template variables.

### WebGPU with WASM Fallback
The engine auto-detects WebGPU support and falls back to WASM SIMD or basic WASM. WASM multi-threading requires cross-origin isolation (COOP/COEP headers).

## Supported Languages

All current smart-tool languages plus additional high-value pairs:

| Language | Code | Direction | Direct Model | Notes |
|----------|------|-----------|:---:|-------|
| English | en | LTR | — | Source/pivot language |
| Welsh | cy | LTR | en→cy | Via Celtic group model |
| Polish | pl | LTR | en↔pl | |
| Urdu | ur | RTL | en→ur | |
| Bengali | bn | LTR | en→bn | Via multilingual model |
| Arabic | ar | RTL | en↔ar | |
| Punjabi | pa | LTR | en→pa | Via multilingual model |
| Pashto | ps | RTL | en→ps | Via multilingual model |
| Somali | so | LTR | en→so | Via multilingual model |
| Tigrinya | ti | LTR | en→ti | Via multilingual model |
| German | de | LTR | en↔de | |
| French | fr | LTR | en↔fr | |
| Spanish | es | LTR | en↔es | |
| Italian | it | LTR | en→it | |
| Portuguese | pt | LTR | en→pt | |
| Hindi | hi | LTR | en→hi | |

## Usage (Future Integration)

```ts
import { TranslationEngine } from "@smart-tool/browser-translation";

const engine = new TranslationEngine({
  modelBasePath: "/models/",
  allowRemoteModels: false,
  useBrowserCache: true,
  maxLoadedPipelines: 3,
  maxChunkChars: 900,
});

await engine.initialize({
  onModelLoadProgress: (p) => console.log(`${p.modelId}: ${p.phase}`),
  onBackendSelected: (b) => console.log(`Backend: ${b}`),
});

const result = await engine.translate({
  text: "Update your CV with recent work experience.",
  sourceLang: "en",
  targetLang: "pl",
});

console.log(result.translated);
console.log(`Took ${result.durationMs}ms, pivot: ${result.usedPivot}`);
```

### With Web Worker

```ts
import { TranslationWorkerClient } from "@smart-tool/browser-translation";

const client = new TranslationWorkerClient("/worker.js");

await client.initialize({
  modelBasePath: "/models/",
  allowRemoteModels: false,
  useBrowserCache: true,
  maxLoadedPipelines: 3,
  maxChunkChars: 900,
});

const result = await client.translate({
  text: "Register with three employment agencies by Friday.",
  sourceLang: "en",
  targetLang: "ar",
});
```

## Model Preparation

### Option A: Use Pre-Built Xenova Models (Fastest)

Many OPUS-MT models are already converted to ONNX with quantized variants in the `Xenova/*` namespace on Hugging Face. The `MODEL_REGISTRY` in `src/models/registry.ts` references these.

### Option B: Convert Your Own

```bash
# Install dependencies
pip install optimum[onnxruntime] transformers sentencepiece

# Convert a model to ONNX
python scripts/convert-model.py --model Helsinki-NLP/opus-mt-en-de --output ./models/

# Quantize to int8 for smaller downloads
python scripts/quantize-model.py --input ./models/opus-mt-en-de --output ./models/opus-mt-en-de-int8

# Batch convert all priority models
python scripts/convert-model.py --batch --output ./models/
```

## Quality Evaluation

The `evaluation/` folder contains a golden set of reference translations for regression testing:

```bash
npx tsx evaluation/evaluate.ts
```

Metrics: chrF score (character n-gram F-score) and placeholder preservation checks.

## Integration Plan

When ready to integrate into the main app:

1. Replace `src/lib/localTranslator.ts` with imports from this module
2. Update `src/hooks/useTranslation.ts` to use `TranslationEngine`
3. Update `SUPPORTED_LANGUAGES` references in `LanguageSelector.tsx`
4. Add model files to `public/models/` or configure remote loading
5. Add Web Worker build configuration to Vite

## Licensing

- **Engine code**: MIT (this repository)
- **OPUS-MT models**: CC-BY-4.0 (requires attribution — see `getAttributions()`)
- **Marian NMT framework**: MIT
- **Transformers.js**: Apache-2.0
- **ONNX Runtime Web**: MIT
