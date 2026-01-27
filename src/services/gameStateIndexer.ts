/**
 * @fileoverview
 * Game State Indexer: merges LLM-produced game_entities and semantic_memory
 * into 系统.扩展, and persists via saveData. Supports fast in-memory structure
 * for retrieval; storage is inside SaveData -> IndexedDB.
 */
import type {
  GameEntity,
  EntityRelationship,
  SemanticTriple,
  GameEntityIndex,
  SemanticMemoryStore,
  GameEntitiesOutput,
  SemanticMemoryOutput,
} from '@/types/gameStateIndex';

const DEFAULT_INDEX: GameEntityIndex = { entities: [], relationships: [] };
const DEFAULT_SEMANTIC: SemanticMemoryStore = { triples: [] };

/** Max triples to keep; drop lowest-importance when over. */
const MAX_TRIPLES = 800;

/** Max entities; drop by oldest updatedAt when over. */
const MAX_ENTITIES = 400;

/** Max relationships. */
const MAX_RELATIONSHIPS = 600;

function toIndex(x: GameEntityIndex | null | undefined): GameEntityIndex {
  if (!x || typeof x !== 'object') return { ...DEFAULT_INDEX };
  return {
    entities: Array.isArray(x.entities) ? x.entities : [],
    relationships: Array.isArray(x.relationships) ? x.relationships : [],
  };
}

function toSemantic(x: SemanticMemoryStore | null | undefined): SemanticMemoryStore {
  if (!x || typeof x !== 'object') return { ...DEFAULT_SEMANTIC };
  return { triples: Array.isArray(x.triples) ? x.triples : [] };
}

function isEntity(o: unknown): o is GameEntity {
  return !!o && typeof o === 'object' && typeof (o as GameEntity).id === 'string' && typeof (o as GameEntity).name === 'string' && typeof (o as GameEntity).type === 'string';
}

function isRelationship(o: unknown): o is EntityRelationship {
  return !!o && typeof o === 'object' && typeof (o as EntityRelationship).fromId === 'string' && typeof (o as EntityRelationship).toId === 'string' && typeof (o as EntityRelationship).relationship === 'string';
}

function isTriple(o: unknown): o is SemanticTriple {
  return !!o && typeof o === 'object' && typeof (o as SemanticTriple).subject === 'string' && typeof (o as SemanticTriple).predicate === 'string' && typeof (o as SemanticTriple).object === 'string';
}

function mergeEntity(existing: GameEntity, incoming: GameEntity): GameEntity {
  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    name: incoming.name ?? existing.name,
    type: incoming.type || existing.type,
    updatedAt: incoming.updatedAt || existing.updatedAt || new Date().toISOString(),
    firstSeen: existing.firstSeen || incoming.firstSeen,
    tags: [...new Set([...(existing.tags || []), ...(incoming.tags || [])])],
    metadata: { ...(existing.metadata || {}), ...(incoming.metadata || {}) },
  };
}

function mergeRelationships(existing: EntityRelationship[], incoming: EntityRelationship[]): EntityRelationship[] {
  const key = (r: EntityRelationship) => `${r.fromId}\t${r.relationship}\t${r.toId}`;
  const map = new Map<string, EntityRelationship>();
  for (const r of existing) {
    if (isRelationship(r)) map.set(key(r), r);
  }
  for (const r of incoming) {
    if (isRelationship(r)) map.set(key(r), r);
  }
  let out = Array.from(map.values());
  if (out.length > MAX_RELATIONSHIPS) {
    out = out.slice(-MAX_RELATIONSHIPS);
  }
  return out;
}

function mergeTriples(existing: SemanticTriple[], incoming: SemanticTriple[]): SemanticTriple[] {
  const combined = [...existing];
  for (const t of incoming) {
    if (isTriple(t)) combined.push(t);
  }
  if (combined.length <= MAX_TRIPLES) return combined;
  const withImportance = (t: SemanticTriple) => ({ t, imp: typeof t.importance === 'number' ? t.importance : 5 });
  combined.sort((a, b) => withImportance(b).imp - withImportance(a).imp);
  return combined.slice(0, MAX_TRIPLES);
}

function capEntities(list: GameEntity[]): GameEntity[] {
  if (list.length <= MAX_ENTITIES) return list;
  const byDate = (a: GameEntity, b: GameEntity) => (b.updatedAt || b.firstSeen || '').localeCompare(a.updatedAt || a.firstSeen || '');
  return [...list].sort(byDate).slice(0, MAX_ENTITIES);
}

/**
 * Merge LLM-produced game_entities and semantic_memory into saveData.系统.扩展.
 * Idempotent if incoming is empty. Creates 系统.扩展 if missing.
 */
export function mergeInto扩展(
  saveData: Record<string, unknown>,
  incoming: { game_entities?: GameEntitiesOutput | null; semantic_memory?: SemanticMemoryOutput | null }
): void {
  const sys = (saveData as any).系统;
  if (!sys || typeof sys !== 'object') (saveData as any).系统 = {};
  const 系统 = (saveData as any).系统;
  if (!系统.扩展 || typeof 系统.扩展 !== 'object') 系统.扩展 = {};
  const 扩展 = 系统.扩展;

  const existingIndex = toIndex(扩展.游戏实体索引);
  const incomingGe = incoming.game_entities;
  if (incomingGe && (Array.isArray(incomingGe.entities) && incomingGe.entities.length > 0 || Array.isArray(incomingGe.relationships) && incomingGe.relationships.length > 0)) {
    const entityMap = new Map<string, GameEntity>();
    for (const e of existingIndex.entities) {
      if (isEntity(e)) entityMap.set(e.id, e);
    }
    const now = new Date().toISOString();
    for (const e of incomingGe.entities || []) {
      if (!isEntity(e)) continue;
      const id = (e.id || `${e.type}_${e.name}`).trim() || `entity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const withMeta = { ...e, id, updatedAt: e.updatedAt || now, firstSeen: e.firstSeen || now };
      const prev = entityMap.get(id);
      entityMap.set(id, prev ? mergeEntity(prev, withMeta) : withMeta);
    }
    existingIndex.entities = capEntities(Array.from(entityMap.values()));
    existingIndex.relationships = mergeRelationships(existingIndex.relationships, incomingGe.relationships || []);
  }
  扩展.游戏实体索引 = existingIndex;

  const existingSem = toSemantic(扩展.语义记忆);
  const incomingSm = incoming.semantic_memory;
  if (incomingSm && Array.isArray(incomingSm.triples) && incomingSm.triples.length > 0) {
    existingSem.triples = mergeTriples(existingSem.triples, incomingSm.triples);
  }
  扩展.语义记忆 = existingSem;
}

/**
 * Read 游戏实体索引 and 语义记忆 from saveData (or any v3-like object).
 */
export function readFrom扩展(saveData: Record<string, unknown>): {
  gameEntityIndex: GameEntityIndex;
  semanticMemory: SemanticMemoryStore;
} {
  const 扩展 = (saveData as any)?.系统?.扩展;
  return {
    gameEntityIndex: toIndex(扩展?.游戏实体索引),
    semanticMemory: toSemantic(扩展?.语义记忆),
  };
}
