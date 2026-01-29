/**
 * @fileoverview
 * Memory Retrieval: query by relevance (graph distance), by relationships (traversal),
 * and by time/importance; combine and rank for injection into the prompt.
 *
 * Extract logic (keeps prompt token‑bounded although 系统.扩展.语义记忆.triples can grow):
 * - maxLines (default 35): total lines in the combined block; add() stops when reached.
 * - Relationship-derived triples: at most 12 (player + recent NPCs only).
 * - Semantic triples: querySemanticTriples(store, ctx, { limit:15 }) — top by contextBoost×importance×recency (recency from real time decay).
 * - Entity lines: from BFS over relationship graph (player + recent NPCs, depth 2).
 */
import type { GameTime } from '@/types/game';
import { gameTimeStringToMinutes, gameTimeToMinutes } from '@/utils/time';
import { readFrom扩展 } from './gameStateIndexer';
import type { GameEntity, EntityRelationship, SemanticTriple, SemanticMemoryStore } from '@/types/gameStateIndex';

export interface DerivedEntityIndex {
  entities: GameEntity[];
  relationships: EntityRelationship[];
}

/**
 * Derive entities and relationships from 社交.关系 and 角色.身份.
 * Replaces 游戏实体索引: player from 角色.身份.名字; NPCs from 社交.关系 keys; edges from 与玩家关系 and 关系.
 */
export function deriveFrom社交关系(
  社交关系: Record<string, { 名字?: string; 与玩家关系?: string; 关系?: Record<string, string> }> | null | undefined,
  角色身份: { 名字?: string } | null | undefined
): DerivedEntityIndex {
  const entities: GameEntity[] = [];
  const relationships: EntityRelationship[] = [];
  const rels = 社交关系 && typeof 社交关系 === 'object' ? 社交关系 : {};
  const playerName = 角色身份?.名字 || '玩家';
  entities.push({ id: 'player', name: playerName, type: 'player' });
  for (const K of Object.keys(rels)) {
    const npc = rels[K];
    if (!npc || typeof npc !== 'object') continue;
    entities.push({ id: K, name: npc.名字 ?? K, type: 'npc' });
    const 与玩家关系 = npc.与玩家关系;
    if (与玩家关系 != null && String(与玩家关系)) {
      relationships.push({ fromId: K, toId: 'player', relationship: String(与玩家关系) });
    }
    const 关系 = npc.关系;
    if (关系 && typeof 关系 === 'object') {
      for (const B of Object.keys(关系)) {
        if (!(B in rels)) continue;
        const lab = 关系[B];
        if (lab != null && typeof lab === 'string') relationships.push({ fromId: K, toId: B, relationship: lab });
      }
    }
  }
  return { entities, relationships };
}

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
    const el = queue.shift();
    if (!el) break;
    const { id, hop, via, rel } = el;
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
  index: DerivedEntityIndex,
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

/** Default importance when missing. */
const DEFAULT_IMPORTANCE = 5;

/** Recency when triple has no timestamp (treat as oldest). */
const RECENCY_NO_TS = 0.2;

/** Default halflife in "turns" (game minutes or real minutes) for decay(age)=1/(1+age/halflife). */
const DEFAULT_HALFLIFE_TURNS = 10;

/** Context boost when subject/object is in { 玩家, playerName, recentNpcNames }. */
const CONTEXT_BOOST = 1.5;

/**
 * Parse triple timestamp to a comparable value; higher = more recent.
 * Handles ISO strings (Date.parse), game-time "Y-M-D-H-m" (gameTimeStringToMinutes), or missing (-Infinity).
 */
export function parseTripleTimestamp(t: SemanticTriple): number {
  const ts = t.timestamp;
  if (!ts || typeof ts !== 'string') return -Infinity;
  const gm = gameTimeStringToMinutes(ts);
  if (gm !== null) return gm;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? -Infinity : ms;
}

export type SortTriplesBy = 'subject' | 'predicate' | 'object' | 'importance' | 'timestamp' | 'category';
export type SortOrder = 'asc' | 'desc';

/**
 * Sort triples by the given dimension. Used by retrieval and by GameVariableGameIndexSection.
 * For importance/timestamp, missing values are treated as lowest (importance 5, timestamp -Infinity).
 */
export function sortTriples(
  triples: SemanticTriple[],
  by: SortTriplesBy,
  order: SortOrder
): SemanticTriple[] {
  const k = order === 'asc' ? 1 : -1;
  return [...triples].sort((a, b) => {
    let va: string | number;
    let vb: string | number;
    switch (by) {
      case 'subject':   va = a.subject;   vb = b.subject; break;
      case 'predicate': va = a.predicate; vb = b.predicate; break;
      case 'object':    va = a.object;    vb = b.object; break;
      case 'category':  va = a.category ?? ''; vb = b.category ?? ''; break;
      case 'importance': va = typeof a.importance === 'number' ? a.importance : DEFAULT_IMPORTANCE; vb = typeof b.importance === 'number' ? b.importance : DEFAULT_IMPORTANCE; break;
      case 'timestamp': va = parseTripleTimestamp(a); vb = parseTripleTimestamp(b); break;
      default: return 0;
    }
    const c = va < vb ? -1 : va > vb ? 1 : 0;
    return k * c;
  });
}

export interface QuerySemanticTriplesOpts {
  limit?: number;
  saveData?: Record<string, unknown>;
  halflifeTurns?: number;
}

/**
 * Query semantic triples by contextBoost × importance × recency; recency uses real time decay from timestamp.
 * now = 元数据.时间 from saveData or new Date(). Game-time ts with GameTime now uses game minutes; ISO with Date uses real minutes; mixed → recency 0.5.
 */
function querySemanticTriples(
  store: SemanticMemoryStore,
  ctx: RetrievalContext,
  opts: QuerySemanticTriplesOpts = {}
): SemanticTriple[] {
  const limit = opts.limit ?? 15;
  const halflife = opts.halflifeTurns ?? DEFAULT_HALFLIFE_TURNS;
  const saveData = opts.saveData;
  const 元数据时间 = saveData && (saveData as any)?.元数据?.时间;
  const isGameTime = (x: unknown): x is GameTime =>
    !!x && typeof x === 'object' && typeof (x as any).年 === 'number';
  const now = isGameTime(元数据时间) ? 元数据时间 : new Date();

  const ctxIds = new Set<string>([
    '玩家', ctx.playerName, 'player', ...(ctx.recentNpcNames || [])
  ].filter(Boolean) as string[]);

  const decay = (age: number) => 1 / (1 + Math.max(0, age) / halflife);

  const withScore = (t: SemanticTriple) => {
    const imp = typeof t.importance === 'number' ? t.importance : DEFAULT_IMPORTANCE;
    const contextBoost = (ctxIds.has(t.subject) || ctxIds.has(t.object)) ? CONTEXT_BOOST : 1;

    let recency: number;
    const ts = t.timestamp;
    if (!ts || typeof ts !== 'string') {
      recency = RECENCY_NO_TS;
    } else {
      const gm = gameTimeStringToMinutes(ts);
      if (gm !== null && isGameTime(now)) {
        const age = gameTimeToMinutes(now) - gm;
        recency = decay(age);
      } else if (gm === null && now instanceof Date) {
        const ms = Date.parse(ts);
        const ageMin = Number.isNaN(ms) ? 1e6 : (now.getTime() - ms) / 60000;
        recency = decay(ageMin);
      } else {
        recency = 0.5;
      }
    }

    return { t, score: contextBoost * imp * recency };
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
  const { semanticMemory } = readFrom扩展(saveData);
  const derived = deriveFrom社交关系((saveData as any)?.社交?.关系, (saveData as any)?.角色?.身份);
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

  const { entityLines } = queryByRelationships(derived, ctx);
  if (entityLines.length > 0) {
    lines.push('# 相关实体');
    add(entityLines);
  }

  const byRelTriples: SemanticTriple[] = [];
  const relIds = new Set<string>();
  const playerId = derived.entities.find(e => e.name === ctx.playerName)?.id;
  if (playerId) relIds.add(playerId);
  if (ctx.playerName) relIds.add('player');
  for (const n of ctx.recentNpcNames || []) {
    const e = derived.entities.find(x => x.name === n);
    if (e?.id) relIds.add(e.id);
  }
  const ent = derived.entities;
  const playerLabel = ctx.playerName || '玩家';
  for (const r of derived.relationships) {
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

  const byImportance = querySemanticTriples(semanticMemory, ctx, { limit: 15, saveData });
  const impFormatted = formatTriples(byImportance, ctx.playerName);
  if (impFormatted.length > 0) {
    if (lines.length) lines.push('');
    lines.push('# 语义记忆');
    add(impFormatted);
  }

  if (lines.length === 0) return '';
  return lines.join('\n').trim();
}
