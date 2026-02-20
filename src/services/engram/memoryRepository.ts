import type {
  MingEngramMemory,
  MingEngramMeta,
  MingEntityRelation,
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
  relations: [],
  meta: createDefaultEngramMeta(),
});

export const ensureEngramMemory = (raw: unknown): MingEngramMemory => {
  const fallback = createEmptyEngramMemory();
  if (!raw || typeof raw !== 'object') return fallback;

  const value = raw as Partial<MingEngramMemory>;
  const events = Array.isArray(value.events) ? value.events : [];
  const entities = Array.isArray(value.entities) ? value.entities : [];
  const relations = Array.isArray(value.relations) ? value.relations : [];
  const metaRaw = value.meta && typeof value.meta === 'object' ? value.meta : {};

  return {
    events: events as MingEventNode[],
    entities: entities as MingEntityNode[],
    relations: relations as MingEntityRelation[],
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

export const upsertEngramRelations = (
  memory: MingEngramMemory,
  relations: MingEntityRelation[],
): MingEngramMemory => {
  if (!Array.isArray(relations) || relations.length === 0) return memory;

  const byId = new Map(memory.relations.map((relation) => [relation.id, relation]));
  for (const relation of relations) {
    if (!relation || typeof relation !== 'object' || !relation.id) continue;
    byId.set(relation.id, relation);
  }

  return {
    ...memory,
    relations: Array.from(byId.values()),
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

/**
 * 将普通 NPC 排除出 Engram：仅保留 重点 NPC 对应的实体与关系；demote 后调用即可清理。
 * 不修改 events；仅过滤 entities 与 relations。
 */
export function pruneEngramToImportantNpcs(
  memory: MingEngramMemory,
  社交关系: Record<string, { 类型?: string; 名字?: string }> | null | undefined,
): MingEngramMemory {
  if (!社交关系 || typeof 社交关系 !== 'object') return memory;

  const 普通Names = new Set<string>();
  for (const [key, npc] of Object.entries(社交关系)) {
    if ((npc as any)?.类型 !== '普通') continue;
    const k = typeof key === 'string' ? key.trim() : '';
    if (k) 普通Names.add(k);
    const 名字 = (npc as any)?.名字;
    if (typeof 名字 === 'string' && 名字.trim()) 普通Names.add(名字.trim());
  }
  if (普通Names.size === 0) return memory;

  const isOrdinaryNpc = (entity: MingEntityNode): boolean => {
    if ((entity as any)?.type !== 'char') return false;
    const name = typeof (entity as any).name === 'string' ? (entity as any).name.trim() : '';
    return name.length > 0 && 普通Names.has(name);
  };

  const toRemoveIds = new Set(
    memory.entities.filter(isOrdinaryNpc).map((e) => e.id).filter(Boolean),
  );
  const nextEntities = memory.entities.filter((e) => !toRemoveIds.has(e.id));
  const nextRelations = memory.relations.filter(
    (r) => !toRemoveIds.has((r as any).from_id) && !toRemoveIds.has((r as any).to_id),
  );

  if (nextEntities.length === memory.entities.length && nextRelations.length === memory.relations.length) {
    return memory;
  }

  return {
    ...memory,
    entities: nextEntities,
    relations: nextRelations,
  };
}

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
