import axios from 'axios';
import type { MingEngramConfig } from '@/types/game';

export interface RerankCandidateInput {
  key: string;
  text: string;
}

export interface RerankResult {
  scoreByKey: Record<string, number>;
  used: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeScore = (raw: unknown): number | null => {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
  if (raw > 1) return clamp01(raw / 10);
  if (raw < 0) return 0;
  return raw;
};

export interface RerankOptions {
  /** 优先使用：来自 API 管理分配的端点，未传时回退到 config.rerank.providerUrl */
  endpointUrl?: string;
  /** 优先使用：来自 API 管理分配的 model，未传时回退到 config.rerank.model */
  model?: string;
  /** API Key，用于 Authorization: Bearer <apiKey>，避免 401 */
  apiKey?: string;
}

export async function rerankCandidates(
  query: string,
  candidates: RerankCandidateInput[],
  config: MingEngramConfig,
  options?: RerankOptions,
): Promise<RerankResult> {
  const fromApi = typeof options?.endpointUrl === 'string' ? options.endpointUrl.trim() : '';
  const fromConfig = typeof config.rerank.providerUrl === 'string' ? config.rerank.providerUrl.trim() : '';
  const providerUrl = fromApi || fromConfig;
  const modelFromOptions = typeof options?.model === 'string' ? options.model.trim() : '';
  const modelFromConfig = typeof config.rerank.model === 'string' ? config.rerank.model : '';
  const model = modelFromOptions || modelFromConfig;
  const topN = typeof config.rerank.topN === 'number' && Number.isFinite(config.rerank.topN) ? config.rerank.topN : 10;

  if (!config.rerank.enabled || !providerUrl || candidates.length === 0) {
    return { scoreByKey: {}, used: false };
  }

  const endpoint = providerUrl;
  const apiKey = typeof options?.apiKey === 'string' ? options.apiKey.trim() : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await axios.post(
      endpoint,
      {
        model: model || undefined,
        query,
        documents: candidates.map((candidate) => candidate.text),
        top_n: topN,
      },
      {
        headers,
        timeout: 60000,
      },
    );

    const payload = response?.data;
    const results = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.data?.results)
        ? payload.data.results
        : [];

    const scoreByKey: Record<string, number> = {};
    for (const item of results) {
      const index = typeof item?.index === 'number' ? item.index : -1;
      if (index < 0 || index >= candidates.length) continue;
      const score = normalizeScore(item?.relevance_score ?? item?.score);
      if (score == null) continue;
      scoreByKey[candidates[index].key] = score;
    }

    return {
      scoreByKey,
      used: Object.keys(scoreByKey).length > 0,
    };
  } catch (error) {
    console.warn('[Engram] rerank service failed, fallback to base score:', error);
    return { scoreByKey: {}, used: false };
  }
}
