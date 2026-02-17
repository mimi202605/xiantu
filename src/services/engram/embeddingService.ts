import axios from 'axios';
import { useAPIManagementStore } from '@/stores/apiManagementStore';
import type { MingEngramConfig } from '@/types/game';

const FALLBACK_DIM = 256;

const normalizeBaseUrl = (url: string): string =>
  url.replace(/\/+$/, '').replace(/\/v1$/i, '');

const l2Normalize = (vector: number[]): number[] => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm <= 1e-8) return vector.map(() => 0);
  return vector.map((value) => value / norm);
};

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * Local fallback embedding (deterministic hash bag).
 * This keeps hybrid retrieval functional when external embedding API is unavailable.
 */
export const pseudoEmbed = (text: string, dim = FALLBACK_DIM): number[] => {
  const vector = new Array<number>(dim).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[\s,，。.!?！？;；:：、"'`~\-_/\\()[\]{}<>|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return vector;

  for (const token of tokens) {
    const h = hash(token);
    const idx = h % dim;
    const sign = (h & 1) === 0 ? 1 : -1;
    vector[idx] += sign;
  }
  return l2Normalize(vector);
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na <= 1e-8 || nb <= 1e-8) return 0;
  return dot / Math.sqrt(na * nb);
};

export interface EmbeddingResult {
  vectors: number[][];
  modelUsed: string;
  providerUsed: string;
  usedFallback: boolean;
}

export async function embedTexts(
  texts: string[],
  config: MingEngramConfig,
): Promise<EmbeddingResult> {
  const input = (Array.isArray(texts) ? texts : []).map((text) => (text || '').trim());
  if (input.length === 0) {
    return { vectors: [], modelUsed: config.embedding.model, providerUsed: config.embedding.provider, usedFallback: true };
  }

  const fallbackVectors = input.map((text) => pseudoEmbed(text));

  if (!config.embedding.enabled) {
    return {
      vectors: fallbackVectors,
      modelUsed: config.embedding.model,
      providerUsed: config.embedding.provider,
      usedFallback: true,
    };
  }

  try {
    const apiStore = useAPIManagementStore();
    if (!Array.isArray(apiStore.apiConfigs) || apiStore.apiConfigs.length === 0) {
      apiStore.loadFromStorage();
    }
    const apiConfig = apiStore.getAPIForType('embedding') || apiStore.getAPIForType('main');
    if (!apiConfig || !apiConfig.url) {
      return {
        vectors: fallbackVectors,
        modelUsed: config.embedding.model,
        providerUsed: config.embedding.provider,
        usedFallback: true,
      };
    }

    // 优先使用 API 管理中该 API 配置的 model，其次 Engram 配置中的 model
    const modelName =
      (typeof apiConfig.model === 'string' && apiConfig.model.trim())
        ? apiConfig.model.trim()
        : (typeof config.embedding.model === 'string' && config.embedding.model.trim())
          ? config.embedding.model.trim()
          : '';
    const provider = config.embedding.provider;
    if (provider !== 'ollama' && !apiConfig.apiKey) {
      return {
        vectors: fallbackVectors,
        modelUsed: config.embedding.model,
        providerUsed: config.embedding.provider,
        usedFallback: true,
      };
    }
    const baseUrl = normalizeBaseUrl(apiConfig.url);
    const commonHeaders = {
      'Content-Type': 'application/json',
      ...(apiConfig.apiKey ? { Authorization: `Bearer ${apiConfig.apiKey}` } : {}),
    };

    let vectors: number[][] = [];
    if (provider === 'ollama') {
      const outputs: number[][] = [];
      for (const item of input) {
        const response = await axios.post(
          `${baseUrl}/api/embeddings`,
          {
            model: modelName,
            prompt: item,
          },
          {
            headers: commonHeaders,
            timeout: 120000,
          },
        );
        const vector = Array.isArray(response?.data?.embedding) ? response.data.embedding : [];
        outputs.push(vector);
      }
      vectors = outputs;
    } else if (provider === 'cohere') {
      const response = await axios.post(
        `${baseUrl}/v1/embed`,
        {
          model: modelName,
          texts: input,
          input_type: 'search_document',
        },
        {
          headers: commonHeaders,
          timeout: 120000,
        },
      );
      const embeddings = response?.data?.embeddings;
      if (Array.isArray(embeddings)) {
        vectors = embeddings;
      } else if (Array.isArray(embeddings?.float)) {
        vectors = embeddings.float;
      } else {
        vectors = [];
      }
    } else {
      const response = await axios.post(
        `${baseUrl}/v1/embeddings`,
        {
          model: modelName,
          input,
        },
        {
          headers: commonHeaders,
          timeout: 120000,
        },
      );
      const payload = response?.data;
      const data = Array.isArray(payload?.data) ? payload.data : [];
      vectors = data.map((item: any) => (Array.isArray(item?.embedding) ? item.embedding : []));
    }

    const valid = vectors.length === input.length && vectors.every((vector: number[]) => vector.length > 0);

    if (!valid) {
      return {
        vectors: fallbackVectors,
        modelUsed: modelName || config.embedding.model,
        providerUsed: provider,
        usedFallback: true,
      };
    }

    return {
      vectors: vectors.map((vector: number[]) => l2Normalize(vector)),
      modelUsed: modelName || config.embedding.model,
      providerUsed: provider,
      usedFallback: false,
    };
  } catch (error) {
    console.warn('[Engram] embedding api failed, fallback to pseudo vectors:', error);
    return {
      vectors: fallbackVectors,
      modelUsed: config.embedding.model,
      providerUsed: config.embedding.provider,
      usedFallback: true,
    };
  }
}
