import type {
  MingEngramConfig,
  MingEngramMemory,
  MingEngramMeta,
  MingEntityNode,
  MingEventNode,
} from '@/types/game';

export type {
  MingEngramConfig,
  MingEngramMemory,
  MingEngramMeta,
  MingEntityNode,
  MingEventNode,
};

export interface EngramVectorStore {
  eventVectors: Record<string, number[]>;
  entityVectors: Record<string, number[]>;
  model: string;
  dim: number;
}

export interface EngramVectorStoreContext {
  characterId: string;
  slotId: string;
}
