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
