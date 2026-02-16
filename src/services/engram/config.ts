import type { MingEngramConfig } from '@/types/game';

export const DEFAULT_ENGRAM_CONFIG: MingEngramConfig = {
  enabled: false,
  retrievalMode: 'legacy',
  embedding: {
    enabled: false,
    provider: 'openai',
    model: 'text-embedding-3-small',
    topK: 20,
    minScore: 0.3,
  },
  rerank: {
    enabled: false,
    providerUrl: '',
    model: '',
    topN: 10,
  },
  trim: {
    enabled: true,
    trigger: 'count',
    tokenLimit: 6000,
    countLimit: 120,
    keepRecent: 20,
  },
  debug: false,
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

export function normalizeEngramConfig(raw: unknown): MingEngramConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ENGRAM_CONFIG };

  const value = raw as Partial<MingEngramConfig>;
  const embedding = (value.embedding ?? {}) as Partial<MingEngramConfig['embedding']>;
  const rerank = (value.rerank ?? {}) as Partial<MingEngramConfig['rerank']>;
  const trim = (value.trim ?? {}) as Partial<MingEngramConfig['trim']>;

  return {
    enabled: value.enabled === true,
    retrievalMode: value.retrievalMode === 'hybrid' ? 'hybrid' : 'legacy',
    embedding: {
      enabled: embedding.enabled === true,
      provider:
        embedding.provider === 'openai' ||
        embedding.provider === 'ollama' ||
        embedding.provider === 'custom' ||
        embedding.provider === 'vllm' ||
        embedding.provider === 'cohere' ||
        embedding.provider === 'jina' ||
        embedding.provider === 'voyage'
          ? embedding.provider
          : DEFAULT_ENGRAM_CONFIG.embedding.provider,
      model:
        typeof embedding.model === 'string' && embedding.model.trim().length > 0
          ? embedding.model
          : DEFAULT_ENGRAM_CONFIG.embedding.model,
      topK: clamp(embedding.topK, 1, 200, DEFAULT_ENGRAM_CONFIG.embedding.topK),
      minScore: clamp(embedding.minScore, 0, 1, DEFAULT_ENGRAM_CONFIG.embedding.minScore),
    },
    rerank: {
      enabled: rerank.enabled === true,
      providerUrl: typeof rerank.providerUrl === 'string' ? rerank.providerUrl : '',
      model: typeof rerank.model === 'string' ? rerank.model : '',
      topN: clamp(rerank.topN, 1, 100, DEFAULT_ENGRAM_CONFIG.rerank.topN),
    },
    trim: {
      enabled: trim.enabled !== false,
      trigger: trim.trigger === 'token' ? 'token' : 'count',
      tokenLimit: clamp(trim.tokenLimit, 200, 200000, DEFAULT_ENGRAM_CONFIG.trim.tokenLimit),
      countLimit: clamp(trim.countLimit, 10, 20000, DEFAULT_ENGRAM_CONFIG.trim.countLimit),
      keepRecent: clamp(trim.keepRecent, 1, 500, DEFAULT_ENGRAM_CONFIG.trim.keepRecent),
    },
    debug: value.debug === true,
  };
}

export function loadEngramConfigFromStorage(storageKey = 'dad_game_settings'): MingEngramConfig {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return normalizeEngramConfig(DEFAULT_ENGRAM_CONFIG);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeEngramConfig(parsed?.engram);
  } catch {
    return normalizeEngramConfig(DEFAULT_ENGRAM_CONFIG);
  }
}
