import { loadFromIndexedDB, saveData } from '@/utils/indexedDBManager';
import type { EngramVectorStore, EngramVectorStoreContext } from './types';

const VECTOR_STORE_PREFIX = 'engram_vectors_';

const createEmptyVectorStore = (): EngramVectorStore => ({
  eventVectors: {},
  entityVectors: {},
  model: '',
  dim: 0,
});

export const buildEngramVectorStoreKey = (context: EngramVectorStoreContext): string =>
  `${VECTOR_STORE_PREFIX}${context.characterId}_${context.slotId}`;

export async function loadEngramVectorStore(context: EngramVectorStoreContext): Promise<EngramVectorStore> {
  const key = buildEngramVectorStoreKey(context);
  const raw = await loadFromIndexedDB(key);
  if (!raw || typeof raw !== 'object') return createEmptyVectorStore();

  const value = raw as Partial<EngramVectorStore>;
  return {
    eventVectors: value.eventVectors && typeof value.eventVectors === 'object' ? value.eventVectors : {},
    entityVectors: value.entityVectors && typeof value.entityVectors === 'object' ? value.entityVectors : {},
    model: typeof value.model === 'string' ? value.model : '',
    dim: typeof value.dim === 'number' ? value.dim : 0,
  };
}

export async function saveEngramVectorStore(
  context: EngramVectorStoreContext,
  store: EngramVectorStore,
): Promise<void> {
  const key = buildEngramVectorStoreKey(context);
  await saveData(key, store);
}

export function mergeEventVectors(
  baseStore: EngramVectorStore,
  vectors: Array<{ id: string; vector: number[] }>,
  model: string,
): EngramVectorStore {
  const nextEventVectors: Record<string, number[]> = {
    ...(baseStore?.eventVectors || {}),
  };

  let dim = typeof baseStore?.dim === 'number' ? baseStore.dim : 0;
  for (const item of vectors) {
    if (!item?.id || !Array.isArray(item.vector) || item.vector.length === 0) continue;
    nextEventVectors[item.id] = item.vector;
    dim = Math.max(dim, item.vector.length);
  }

  return {
    eventVectors: nextEventVectors,
    entityVectors: baseStore?.entityVectors || {},
    model: model || baseStore?.model || '',
    dim,
  };
}

export function mergeEntityVectors(
  baseStore: EngramVectorStore,
  vectors: Array<{ id: string; vector: number[] }>,
  model: string,
): EngramVectorStore {
  const nextEntityVectors: Record<string, number[]> = {
    ...(baseStore?.entityVectors || {}),
  };

  let dim = typeof baseStore?.dim === 'number' ? baseStore.dim : 0;
  for (const item of vectors) {
    if (!item?.id || !Array.isArray(item.vector) || item.vector.length === 0) continue;
    nextEntityVectors[item.id] = item.vector;
    dim = Math.max(dim, item.vector.length);
  }

  return {
    eventVectors: baseStore?.eventVectors || {},
    entityVectors: nextEntityVectors,
    model: model || baseStore?.model || '',
    dim,
  };
}
