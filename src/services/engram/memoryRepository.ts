import type { MingEngramMemory, MingEngramMeta, MingEntityNode, MingEventNode, SaveData } from '@/types/game';

export const ENGRAM_SCHEMA_VERSION = 1;

export const createDefaultEngramMeta = (): MingEngramMeta => ({
  last_summarized_floor: 0,
  last_extracted_floor: 0,
  schema_version: ENGRAM_SCHEMA_VERSION,
});

export const createEmptyEngramMemory = (): MingEngramMemory => ({
  events: [],
  entities: [],
  meta: createDefaultEngramMeta(),
});

export const ensureEngramMemory = (raw: unknown): MingEngramMemory => {
  const fallback = createEmptyEngramMemory();
  if (!raw || typeof raw !== 'object') return fallback;

  const value = raw as Partial<MingEngramMemory>;
  const events = Array.isArray(value.events) ? value.events : [];
  const entities = Array.isArray(value.entities) ? value.entities : [];
  const metaRaw = value.meta && typeof value.meta === 'object' ? value.meta : {};

  return {
    events: events as MingEventNode[],
    entities: entities as MingEntityNode[],
    meta: {
      ...fallback.meta,
      ...(metaRaw as Partial<MingEngramMeta>),
      schema_version:
        typeof (metaRaw as any).schema_version === 'number'
          ? (metaRaw as any).schema_version
          : ENGRAM_SCHEMA_VERSION,
    },
  };
};

export const readEngramMemoryFromSaveData = (saveData: SaveData | Record<string, unknown>): MingEngramMemory => {
  const root = (saveData ?? {}) as any;
  return ensureEngramMemory(root?.系统?.扩展?.engramMemory);
};

export const writeEngramMemoryToSaveData = (
  saveData: SaveData | Record<string, unknown>,
  memory: MingEngramMemory,
): void => {
  const root = (saveData ?? {}) as any;
  if (!root.系统 || typeof root.系统 !== 'object') root.系统 = {};
  if (!root.系统.扩展 || typeof root.系统.扩展 !== 'object') root.系统.扩展 = {};
  root.系统.扩展.engramMemory = ensureEngramMemory(memory);
};

export const appendEngramEvents = (
  memory: MingEngramMemory,
  events: MingEventNode[],
): MingEngramMemory => {
  if (!Array.isArray(events) || events.length === 0) return memory;
  return {
    ...memory,
    events: [...memory.events, ...events],
  };
};

export const upsertEngramEntities = (
  memory: MingEngramMemory,
  entities: MingEntityNode[],
): MingEngramMemory => {
  if (!Array.isArray(entities) || entities.length === 0) return memory;

  const byId = new Map(memory.entities.map((entity) => [entity.id, entity]));
  for (const entity of entities) {
    if (!entity || typeof entity !== 'object' || !entity.id) continue;
    byId.set(entity.id, entity);
  }

  return {
    ...memory,
    entities: Array.from(byId.values()),
  };
};

export const patchEngramMeta = (
  memory: MingEngramMemory,
  patch: Partial<MingEngramMeta>,
): MingEngramMemory => ({
  ...memory,
  meta: {
    ...memory.meta,
    ...patch,
    schema_version:
      typeof patch.schema_version === 'number'
        ? patch.schema_version
        : memory.meta.schema_version ?? ENGRAM_SCHEMA_VERSION,
  },
});
