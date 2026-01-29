/**
 * @fileoverview
 * Types for the token-efficient Game State Index and Semantic Memory.
 * Used to capture significant game entities and facts (triples) from LLM
 * during action generation, store in 系统.扩展, and retrieve for prompts.
 */

/** Entity type for the game world */
export type GameEntityType = 'npc' | 'location' | 'item' | 'event' | 'faction' | 'player' | 'other';

/** A single game entity (NPC, location, item, event) with metadata and tags */
export interface GameEntity {
  /** Stable id, e.g. npc_张三, loc_青城山, item_玉佩_xxx */
  id: string;
  type: GameEntityType;
  name: string;
  /** Free-form metadata: 境界, 描述, 势力, etc. */
  metadata?: Record<string, unknown>;
  /** Semantic tags for retrieval: e.g. ["重要NPC","掌门","仇敌"] */
  tags?: string[];
  /** When this entity was first indexed (game time or iso) */
  firstSeen?: string;
  /** When last updated */
  updatedAt?: string;
}

/** Directed relationship between two entities */
export interface EntityRelationship {
  fromId: string;
  toId: string;
  /** e.g. "师徒", "位于", "拥有", "仇敌" */
  relationship: string;
  /** Optional strength or extra info */
  metadata?: Record<string, unknown>;
}

/**
 * A (subject, predicate, object) fact with metadata.
 * timestamp/importance/category are used for sorting and selective retrieval;
 * if timestamp is missing, it is filled on merge (from 元数据.时间 or ISO now).
 */
export interface SemanticTriple {
  subject: string;
  predicate: string;
  object: string;
  /** ISO or game-time sortable string (e.g. YYYY-MM-DD-HH-mm); filled on merge if absent */
  timestamp?: string;
  /** 1–10, higher = more important for retrieval; default 5 when missing */
  importance?: number;
  /** e.g. "关系", "行动", "地点", "物品"; used for sorting and filtering */
  category?: string;
}

/** Stored semantic memory (lives in 系统.扩展.语义记忆) */
export interface SemanticMemoryStore {
  triples: SemanticTriple[];
}

/** LLM-generated chunk for semantic_memory in step-2 JSON */
export interface SemanticMemoryOutput {
  triples?: SemanticTriple[];
}
