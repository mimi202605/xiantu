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
