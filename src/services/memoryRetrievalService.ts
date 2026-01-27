/**
 * @fileoverview
 * Memory Retrieval: query by relevance (graph distance), by relationships (traversal),
 * and by time/importance; combine and rank for injection into the prompt.
 *
 * Extract logic (keeps prompt token‑bounded although 系统.扩展.语义记忆.triples can grow):
 * - maxLines (default 35): total lines in the combined block; add() stops when reached.
 * - Relationship-derived triples: at most 12 (player + recent NPCs only).
 * - Semantic triples: queryByTimeImportance(store, 15) — top 15 by importance×recency.
 * - Entity lines: from BFS over relationship graph (player + recent NPCs, depth 2).
 */
import { readFrom扩展 } from './gameStateIndexer';
import type { GameEntity, EntityRelationship, SemanticTriple, GameEntityIndex, SemanticMemoryStore } from '@/types/gameStateIndex';

export interface RetrievalContext {
  playerName?: string;
  /** Location 描述, e.g. "大陆·区域·地点" */
  locationDesc?: string;
  /** NPC names recently in scene or in 关系 */
  recentNpcNames?: string[];
  /** Max total lines to return in the combined string */
  maxLines?: number;
}

/** Default max lines for the injected block */
const DEFAULT_MAX_LINES = 35;

/**
 * Build an adjacency map: id -> [ { toId, relationship } ]
 */
function buildGraph(relationships: EntityRelationship[]): Map<string, Array<{ toId: string; relationship: string }>> {
  const m = new Map<string, Array<{ toId: string; relationship: string }>>();
  for (const r of relationships) {
    if (!m.has(r.fromId)) m.set(r.fromId, []);
    m.get(r.fromId)!.push({ toId: r.toId, relationship: r.relationship });
  }
  return m;
}

/**
 * BFS from startIds, collect (id, hop). Max depth 2.
 */
function bfsHops(
  startIds: Set<string>,
  graph: Map<string, Array<{ toId: string; relationship: string }>>,
  entityById: Map<string, GameEntity>,
  maxDepth: number
): Map<string, { hop: number; via?: string; rel?: string }> {
  const result = new Map<string, { hop: number; via?: string; rel?: string }>();
  const queue: Array<{ id: string; hop: number; via?: string; rel?: string }> = [];
  for (const id of startIds) {
    if (entityById.has(id)) {
      result.set(id, { hop: 0 });
      queue.push({ id, hop: 0 });
    }
  }
  const seen = new Set<string>(startIds);
  while (queue.length > 0) {
    const { id, hop, via, rel } = queue.shift!();
    if (hop >= maxDepth) continue;
    const edges = graph.get(id) || [];
    for (const { toId, relationship } of edges) {
      if (seen.has(toId)) continue;
      seen.add(toId);
      result.set(toId, { hop: hop + 1, via: id, rel: relationship });
      queue.push({ id: toId, hop: hop + 1, via: id, rel: relationship });
    }
  }
  return result;
}

/**
 * Resolve name to entity id (first match by name or id).
 */
function resolveIds(names: string[], entityById: Map<string, GameEntity>, entities: GameEntity[]): Set<string> {
  const s = new Set<string>();
  const byName = new Map<string, GameEntity>();
  for (const e of entities) {
    if (e.name && !byName.has(e.name)) byName.set(e.name, e);
    if (e.id) entityById.set(e.id, e);
  }
  for (const n of names) {
    if (!n || typeof n !== 'string') continue;
    const e = byName.get(n) || entities.find(x => x.id === n || x.name === n);
    if (e?.id) s.add(e.id);
  }
  return s;
}

/**
 * Query by relationships: e.g. who knows whom, NPC at location.
 * Returns triples and entity infos that are reachable from context.
 */
function queryByRelationships(
  index: GameEntityIndex,
  ctx: RetrievalContext
): { triples: SemanticTriple[]; entityLines: string[] } {
  const { entities, relationships } = index;
  const entityById = new Map<string, GameEntity>();
  for (const e of entities) entityById.set(e.id, e);

  const startNames = [ctx.playerName, ...(ctx.recentNpcNames || [])].filter(Boolean) as string[];
  const startIds = resolveIds(startNames, entityById, entities);

  const graph = buildGraph(relationships);
  const hops = bfsHops(startIds, graph, entityById, 2);

  const entityLines: string[] = [];
  const seenEnt = new Set<string>();
  for (const [id, { hop, rel }] of hops) {
    if (seenEnt.has(id)) continue;
    seenEnt.add(id);
    const e = entityById.get(id);
    if (!e) continue;
    const tag = rel ? ` (${rel})` : '';
    entityLines.push(`- ${e.name}[${e.type}]${tag}`);
  }

  const relatedIds = new Set(hops.keys());
  const tripleLines: SemanticTriple[] = [];
  return { triples: tripleLines, entityLines };
}

/**
 * Query by time/importance: recent and high-importance triples.
 * Used as the main extract for 系统.扩展.语义记忆.triples (limit 15 in retrieve).
 */
function queryByTimeImportance(store: SemanticMemoryStore, limit: number): SemanticTriple[] {
  const withScore = (t: SemanticTriple) => {
    const imp = typeof t.importance === 'number' ? t.importance : 5;
    const recency = t.timestamp ? 1 : 0.5;
    return { t, score: imp * recency };
  };
  return store.triples
    .map(withScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.t);
}

/**
 * Format triples as short lines.
 */
function formatTriples(triples: SemanticTriple[], playerName?: string): string[] {
  return triples.map(t => {
    const sub = t.subject === playerName ? '玩家' : t.subject;
    const obj = t.object === playerName ? '玩家' : t.object;
    return `- ${sub} ${t.predicate} ${obj}`;
  });
}

/**
 * Main entry: retrieve from saveData (or v3-like) and return a string block
 * suitable for injection into the system prompt.
 */
export function retrieve(
  saveData: Record<string, unknown>,
  ctx: RetrievalContext
): string {
  const { gameEntityIndex, semanticMemory } = readFrom扩展(saveData);
  const maxLines = typeof ctx.maxLines === 'number' && ctx.maxLines > 0 ? ctx.maxLines : DEFAULT_MAX_LINES;

  const lines: string[] = [];
  const used = new Set<string>();

  const add = (arr: string[], prefix?: string) => {
    for (const l of arr) {
      const key = (prefix || '') + l;
      if (used.has(key) || lines.length >= maxLines) break;
      used.add(key);
      lines.push(l);
    }
  };

  const { entityLines } = queryByRelationships(gameEntityIndex, ctx);
  if (entityLines.length > 0) {
    lines.push('# 相关实体');
    add(entityLines);
  }

  const byRelTriples: SemanticTriple[] = [];
  const relIds = new Set<string>();
  const playerId = gameEntityIndex.entities.find(e => e.name === ctx.playerName)?.id;
  if (playerId) relIds.add(playerId);
  if (ctx.playerName) relIds.add('player');
  for (const n of ctx.recentNpcNames || []) {
    const e = gameEntityIndex.entities.find(x => x.name === n);
    if (e?.id) relIds.add(e.id);
  }
  const ent = gameEntityIndex.entities;
  const playerLabel = ctx.playerName || '玩家';
  for (const r of gameEntityIndex.relationships) {
    if (relIds.has(r.fromId) || relIds.has(r.toId)) {
      const sub = r.fromId === 'player' ? playerLabel : (ent.find(x => x.id === r.fromId)?.name || r.fromId);
      const obj = r.toId === 'player' ? playerLabel : (ent.find(x => x.id === r.toId)?.name || r.toId);
      byRelTriples.push({ subject: sub, predicate: r.relationship, object: obj });
    }
  }
  const relFormatted = formatTriples(byRelTriples.slice(0, 12), ctx.playerName);
  if (relFormatted.length > 0) {
    if (lines.length) lines.push('');
    lines.push('# 关系');
    add(relFormatted);
  }

  const byImportance = queryByTimeImportance(semanticMemory, 15);
  const impFormatted = formatTriples(byImportance, ctx.playerName);
  if (impFormatted.length > 0) {
    if (lines.length) lines.push('');
    lines.push('# 语义记忆');
    add(impFormatted);
  }

  if (lines.length === 0) return '';
  return lines.join('\n').trim();
}
