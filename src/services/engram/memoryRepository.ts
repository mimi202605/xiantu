import type {
  MingEngramMemory,
  MingEngramMeta,
  MingEntityNode,
  MingEventNode,
  MingEngramTrimConfig,
  SaveData,
} from '@/types/game';

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

const estimateEventTokens = (event: MingEventNode): number => {
  const summary = typeof event.summary === 'string' ? event.summary : '';
  return Math.max(4, Math.ceil(summary.length / 4));
};

/**
 * Apply engram trim policy while preserving latest events.
 * This only affects `events`; entities are retained.
 */
export const trimEngramMemory = (
  memory: MingEngramMemory,
  trimConfig: MingEngramTrimConfig,
): MingEngramMemory => {
  if (!trimConfig?.enabled || !Array.isArray(memory.events) || memory.events.length === 0) return memory;

  const keepRecent = Math.max(1, trimConfig.keepRecent || 1);
  const events = [...memory.events];
  const recent = events.slice(-keepRecent);
  const oldPart = events.slice(0, Math.max(0, events.length - keepRecent));

  let keptOld: MingEventNode[] = oldPart;
  if (trimConfig.trigger === 'count') {
    const oldBudget = Math.max(0, (trimConfig.countLimit || events.length) - recent.length);
    keptOld = oldPart.slice(-oldBudget);
  } else {
    const tokenLimit = Math.max(200, trimConfig.tokenLimit || 200);
    const recentTokens = recent.reduce((sum, event) => sum + estimateEventTokens(event), 0);
    const oldBudget = Math.max(0, tokenLimit - recentTokens);

    let acc = 0;
    const picked: MingEventNode[] = [];
    for (let index = oldPart.length - 1; index >= 0; index -= 1) {
      const event = oldPart[index];
      const cost = estimateEventTokens(event);
      if (acc + cost > oldBudget) break;
      acc += cost;
      picked.push(event);
    }
    keptOld = picked.reverse();
  }

  const nextEvents = [...keptOld, ...recent];
  if (nextEvents.length >= memory.events.length) return memory;

  return {
    ...memory,
    events: nextEvents,
    meta: {
      ...memory.meta,
      last_trimmed_at: Date.now(),
    },
  };
};
