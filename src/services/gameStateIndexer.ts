/**
 * @fileoverview
 * Game State Indexer: merges LLM-produced semantic_memory into 系统.扩展.
 * Entity/relationship graph is derived from 社交.关系 only (no game_entities).
 */
import type { GameTime } from '@/types/game';
import { gameTimeToSortable } from '@/utils/time';
import type { SemanticTriple, SemanticMemoryStore, SemanticMemoryOutput } from '@/types/gameStateIndex';

const DEFAULT_SEMANTIC: SemanticMemoryStore = { triples: [] };

function toSemantic(x: SemanticMemoryStore | null | undefined): SemanticMemoryStore {
  if (!x || typeof x !== 'object') return { ...DEFAULT_SEMANTIC };
  return { triples: Array.isArray(x.triples) ? x.triples : [] };
}

function isTriple(o: unknown): o is SemanticTriple {
  return !!o && typeof o === 'object' && typeof (o as SemanticTriple).subject === 'string' && typeof (o as SemanticTriple).predicate === 'string' && typeof (o as SemanticTriple).object === 'string';
}

function mergeTriples(existing: SemanticTriple[], incoming: SemanticTriple[]): SemanticTriple[] {
  const combined = [...existing];
  for (const t of incoming) {
    if (isTriple(t)) combined.push(t);
  }
  return combined;
}

/**
 * Merge LLM-produced semantic_memory into saveData.系统.扩展.
 * Idempotent if incoming is empty. Creates 系统.扩展 if missing.
 * game_entities removed: entity/relationship graph is derived from 社交.关系 only.
 */
export function mergeInto扩展(
  saveData: Record<string, unknown>,
  incoming: { semantic_memory?: SemanticMemoryOutput | null }
): void {
  const sys = (saveData as any).系统;
  if (!sys || typeof sys !== 'object') (saveData as any).系统 = {};
  const 系统 = (saveData as any).系统;
  if (!系统.扩展 || typeof 系统.扩展 !== 'object') 系统.扩展 = {};
  const 扩展 = 系统.扩展;

  const existingSem = toSemantic(扩展.语义记忆);
  const incomingSm = incoming.semantic_memory;
  if (incomingSm && Array.isArray(incomingSm.triples) && incomingSm.triples.length > 0) {
    const 元数据时间 = (saveData as any)?.元数据?.时间;
    const fallbackTs = 元数据时间 && typeof (元数据时间 as any).年 === 'number'
      ? gameTimeToSortable(元数据时间 as GameTime)
      : new Date().toISOString();
    const filled = incomingSm.triples.map((t) => {
      if (!isTriple(t)) return t;
      if (t.timestamp) return t;
      return { ...t, timestamp: fallbackTs };
    });
    existingSem.triples = mergeTriples(existingSem.triples, filled);
  }
  扩展.语义记忆 = existingSem;
}

/**
 * Read 语义记忆 from saveData (or any v3-like object).
 * 游戏实体索引 removed: entities/relationships are derived from 社交.关系.
 */
export function readFrom扩展(saveData: Record<string, unknown>): {
  semanticMemory: SemanticMemoryStore;
} {
  const 扩展 = (saveData as any)?.系统?.扩展;
  return { semanticMemory: toSemantic(扩展?.语义记忆) };
}
