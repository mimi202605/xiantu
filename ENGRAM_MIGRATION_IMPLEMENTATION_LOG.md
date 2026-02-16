# Engram Migration Implementation Log

## Phase 0 (Completed)

### Objectives

- Add non-breaking engram schemas and feature flags.
- Persist/read `系统.扩展.engramMemory` safely.
- Ensure migration/repair/validation do not drop engram data.
- Add Settings UI for controlled rollout.
- Keep legacy behavior unchanged by default.

### Delivered

- Added engram types/config:
  - `MingEngramConfig`
  - `MingEventNode`
  - `MingEntityNode`
  - `MingEngramMeta`
  - `MingEngramMemory`
- Added `src/services/engram/` skeleton:
  - `types.ts`
  - `config.ts`
  - `memoryRepository.ts`
  - `vectorRepository.ts`
  - `index.ts`
- Wired `gameStateStore`:
  - load from `系统.扩展.engramMemory`
  - save to `系统.扩展.engramMemory`
  - reset runtime engram state
- Updated safety chain:
  - `saveMigration.ts`
  - `dataRepair.ts`
  - `saveValidationV3.ts`
- Added Engram settings UI:
  - new `EngramSettingsSection.vue`
  - integrated in `SettingsPanel.vue`
  - persisted to `dad_game_settings.engram`

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- default remains legacy-safe:
  - `engram.enabled = false`
  - `engram.retrievalMode = 'legacy'`

### Next

- Phase 1: implement EventNode ingestion and unified hybrid retriever (without vectors first), and replace `memoryRetrieve()` only when `retrievalMode='hybrid'`.

---

## Phase 1 (Completed)

### Objectives

- Land a runnable engram read/write path.
- Keep `legacy` unchanged and switch retrieval entry in `hybrid`.
- Start with non-vector baseline scoring and formatting.

### Delivered

- Added event write pipeline:
  - `src/services/engram/eventBuilder.ts`
  - `AIBidirectionalSystem.processGmResponse()` appends built `EventNode` to `engramMemory.events`.
- Added hybrid retrieval pipeline:
  - `src/services/engram/unifiedRetriever.ts`
  - `src/services/engram/injectionFormatter.ts`
  - unified candidates from `events + triples + graph + rules`.
- Added mode gate in main loop:
  - `legacy` -> `memoryRetrieve()`
  - `hybrid` -> `unifiedRetrieve()`
- Added storage config loader:
  - `loadEngramConfigFromStorage()` in `config.ts`
- Synced split generation:
  - retrieval block also injected in split step1/step2 prompts.

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- default remains legacy-safe:
  - `engram.enabled = false`
  - no behavior change unless user enables hybrid mode.

### Notes

- Phase 1 intentionally does not include embeddings/rerank execution.
- Vector path and rerank path are reserved for Phase 2+ rollout.

### Next

- Phase 2: embedding service + vector index write/read + score fusion + optional rerank.

---

## Phase 2 (Completed)

### Objectives

- Add embedding generation service and connect vector write/read path.
- Add hybrid score fusion with vector similarity.
- Add optional rerank stage with safe fallback.
- Keep legacy behavior unchanged and non-blocking.

### Delivered

- Added embedding service:
  - `src/services/engram/embeddingService.ts`
  - reads API assignment from API management (`embedding` -> fallback `main`)
  - calls OpenAI-compatible `/v1/embeddings`
  - falls back to deterministic local pseudo embedding on any failure
- Added optional rerank service:
  - `src/services/engram/rerankService.ts`
  - configurable external rerank endpoint (`config.rerank.providerUrl`)
  - graceful fallback when unavailable
- Upgraded vector repository:
  - `vectorRepository.ts` adds `mergeEventVectors()` for incremental event-vector upsert.
- Wired write path in main loop:
  - `AIBidirectionalSystem.processGmResponse()`
  - after EventNode append, generate vectors for new events and persist to vector store
  - vector store key remains `engram_vectors_{characterId}_{slotId}`
- Upgraded hybrid read path:
  - `unifiedRetriever.ts` now loads vector store by active save context
  - computes query embedding, applies `topK/minScore`, fuses vector score with baseline score
  - optional rerank fusion stage added
- Updated API surface/UI:
  - `apiManagementStore.ts`: add `APIUsageType='embedding'` and default assignment/mode
  - `APIManagementPanel.vue`: expose `Embedding向量化` as a dedicated API assignment item
  - mode selector hidden for embedding-only function (not applicable)

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- legacy-safe guarantees preserved:
  - `engram.enabled=false` keeps old path
  - vector/rerank failures only warn and fall back, no main-loop interruption

### Notes

- Embedding API path is currently OpenAI-compatible (`/v1/embeddings`) to maximize provider compatibility.
- Rerank endpoint format is kept flexible (accepts common `results[index, score]` response shape).

### Next

- Phase 3: entity extraction/upsert + graph enrichment from event stream + memory trim policy execution.

---

## Phase 3 (Completed)

### Objectives

- Extract entity nodes from event stream and upsert into engram memory.
- Execute configurable trim policy to control long-run memory growth.
- Feed engram entity graph back into unified retrieval.

### Delivered

- Added entity extraction builder:
  - `src/services/engram/entityBuilder.ts`
  - builds `MingEntityNode` from:
    - event fields (`role`, `location`, `event`)
    - current save context (`角色名字`, `社交.关系`)
- Wired entity upsert in write path:
  - `AIBidirectionalSystem.processGmResponse()`
  - after event append, calls `buildEntitiesFromEvents()` + `upsertEngramEntities()`
- Added trim execution:
  - `memoryRepository.ts` adds `trimEngramMemory(memory, trimConfig)`
  - supports `trigger='count' | 'token'`
  - preserves `keepRecent` newest events first, then keeps most recent old events within budget
  - updates `meta.last_trimmed_at` when trim occurs
- Upgraded unified retrieval graph input:
  - `unifiedRetriever.ts` now adds candidates from `engramMemory.entities`
  - these candidates are merged into graph-related context scoring/sorting
- Updated engram service exports:
  - `index.ts` exports `entityBuilder` entry points

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- legacy-safe guarantees preserved:
  - no behavior change unless engram/hybrid is enabled
  - failures remain non-blocking with graceful fallback

### Next

- Phase 4: entity-level vectorization, relation extraction edges, and graph-oriented retrieval formatting.

---

## Phase 4 (Completed)

### Objectives

- Extend vector path from events to entities.
- Use entity vectors during hybrid retrieval.
- Keep all behavior backward-compatible and non-blocking.

### Delivered

- Upgraded vector repository:
  - `vectorRepository.ts` adds `mergeEntityVectors()` for `entityVectors` incremental upsert.
- Upgraded write path:
  - `AIBidirectionalSystem.processGmResponse()` now embeds and writes:
    - new events
    - newly extracted entities
  - updates engram runtime flags:
    - `events[].is_embedded`
    - `entities[].is_embedded`
  - records vectorized entity count delta in change logs.
- Upgraded hybrid retrieval:
  - `unifiedRetriever.ts` now computes vector similarity for:
    - event candidates
    - entity candidates
  - applies `minScore/topK` and section-specific score fusion.

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- legacy-safe guarantees preserved:
  - hybrid-only enhancement
  - failures still degrade gracefully

### Next

- Phase 5: extract explicit entity relations/edges and expose graph-centric retrieval section formatting.

---

## Phase 5 (Completed)

### Objectives

- Add explicit entity relation edges to engram memory.
- Extract/update relations during write path.
- Feed relation edges into unified retrieval graph context.

### Delivered

- Added relation data model:
  - `MingEntityRelation` in `src/types/game.d.ts`
  - `MingEngramMemory.relations` array
- Extended repository layer:
  - `memoryRepository.ts`
  - normalize/read/write now include `relations`
  - added `upsertEngramRelations()`
- Added relation extraction service:
  - `src/services/engram/relationBuilder.ts`
  - event-driven relation extraction:
    - `co_occurs_with`
    - `appears_at`
    - `involved_in`
  - includes social relation edges from `社交.关系`
- Wired write path:
  - `AIBidirectionalSystem.processGmResponse()` now:
    - builds relations after entities are upserted
    - upserts to `engramMemory.relations`
- Wired read path:
  - `unifiedRetriever.ts` consumes `engramMemory.relations`
  - relation candidates now contribute to graph section scoring/sorting
- Updated validation:
  - `saveValidationV3.ts` adds warning for malformed `engramMemory.relations`

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- legacy-safe guarantees preserved:
  - enhancement stays behind engram/hybrid config
  - fallback behavior remains non-blocking

### Next

- Phase 6: relation-aware formatting/debug visibility and provider adapter hardening for embedding/rerank endpoints.

---

## Phase 6 (Completed)

### Objectives

- Improve hybrid retrieval observability for debugging/tuning.
- Harden embedding provider adapters without sacrificing fallback safety.

### Delivered

- Added debug observability in main loop:
  - `AIBidirectionalSystem.ts`
  - when `engram.debug` is enabled:
    - logs unified retrieval stats
    - writes `engramHybridStats` module to prompt assembly record
- Hardened embedding provider adapters:
  - `embeddingService.ts`
  - provider-specific endpoints:
    - `ollama` -> `/api/embeddings`
    - `cohere` -> `/v1/embed`
    - default -> `/v1/embeddings`
  - allows no-apiKey mode for `ollama`
  - maintains pseudo embedding fallback for all failures

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- legacy-safe guarantees preserved:
  - debug additions are opt-in
  - fallback behavior remains non-blocking

### Next

- Phase 7: add retrieval debug UI panel and expand setting controls for rerank/trim introspection.

---

## Phase 7 (Completed)

### Objectives

- Expose rerank/trim controls in settings UI.
- Keep config behavior consistent with normalization constraints.

### Delivered

- Expanded Engram settings UI:
  - `src/components/engram/EngramSettingsSection.vue`
  - added controls for:
    - rerank: `enabled/providerUrl/model/topN`
    - trim: `enabled/trigger/tokenLimit/countLimit/keepRecent`
- All control values flow through existing `withUpdate + normalizeEngramConfig` path.
- Added wide input style for endpoint URL usability.

### Verification

- `npm run type-check` passed.
- IDE lint checks passed.
- legacy-safe guarantees preserved:
  - only config UI changed
  - no forced behavior change unless user enables/tunes engram

### Next

- Phase 8: add dedicated retrieval debug panel and end-to-end regression tests for legacy vs hybrid parity.
