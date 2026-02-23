# AI Knowledge Base Assessment & Implementation Plan

## Current state (what exists today)

Yes — the project already has a **local, offline retrieval knowledge base** for AI planning.

- The browser-native LLM is explicitly designed around local retrieval: `User Input → Profile Normaliser → Local Retrieval → Prompt Assembly → LLM Inference`.
- The runtime documents a local retrieval pack (`retrieval-packs/job-search-actions.json`) grounded in curated job-search guidance.
- The main app hook (`useBrowserNativeLLM`) configures `SmartPlanner` with a retrieval pack URL and loads `public/retrieval-packs/job-search-actions.json`.
- The planner/library/retriever stack (`ActionLibrary`, `LocalRetriever`) is already implemented and used in both inference mode and template-only fallback mode.

In short: there is already a “smart knowledge base”, implemented as a retrieval pack + local retriever.

## Gaps worth addressing

Even with an existing retrieval pack, there are improvement opportunities:

1. **Freshness/versioning**
   - Retrieval pack updates are file-based; no explicit semantic versioning and migration policy in app docs.
2. **Coverage visibility**
   - No explicit coverage report for barrier/sector/topic representation in the pack.
3. **Retrieval quality observability**
   - Limited telemetry around retrieval hit quality and template usefulness over time.
4. **Governance workflow**
   - No clearly documented editorial workflow for adding/removing/approving entries.

## Implementation plan (enhancement roadmap)

### Phase 1 — Audit and baseline (1 sprint)

- Define a canonical schema contract for retrieval entries (required fields, tags, confidence hints).
- Add a validation script that checks pack integrity and taxonomy consistency in CI.
- Generate a baseline “coverage matrix” (barriers × action types × sectors).

**Deliverables**
- `docs/retrieval-pack-schema.md`
- CI job `validate:retrieval-pack`
- `docs/retrieval-coverage-baseline.md`

### Phase 2 — Quality and ranking improvements (1–2 sprints)

- Introduce weighted ranking signals (barrier match > skills > locale > recency).
- Add deduplication and diversity constraints to avoid near-identical actions in top results.
- Improve fallback behavior when retrieval confidence is low (explicit uncertainty templates).

**Deliverables**
- Retriever ranking config + tests
- Top-k diversity tests
- Retrieval confidence thresholds documented

### Phase 3 — Content ops and governance (1 sprint)

- Create contributor workflow for pack edits (review checklist, source attribution, licensing checks).
- Add changelog/version metadata embedded in retrieval pack.
- Add acceptance criteria for new entries (clarity, SMART alignment, safety/appropriateness).

**Deliverables**
- `docs/retrieval-pack-governance.md`
- Pack versioning policy
- PR template section for retrieval changes

### Phase 4 — Continuous evaluation (ongoing)

- Extend evaluation harness to score retrieval relevance separately from generation quality.
- Track “retrieval-assisted pass rate” across representative prompt suites.
- Add periodic regression report in CI artifacts.

**Deliverables**
- Retrieval relevance metric dashboard (or JSON artifact)
- CI regression checks for retrieval quality

## Definition of done

- Retrieval pack is schema-validated in CI.
- Coverage report is published and reviewed.
- Retrieval relevance metrics are stable or improving across releases.
- Governance docs exist and are followed for all retrieval pack updates.

