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
