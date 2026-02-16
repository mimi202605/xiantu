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

export async function rerankCandidates(
  query: string,
  candidates: RerankCandidateInput[],
  config: MingEngramConfig,
): Promise<RerankResult> {
  const providerUrl = typeof config.rerank.providerUrl === 'string' ? config.rerank.providerUrl.trim() : '';
  const model = typeof config.rerank.model === 'string' ? config.rerank.model : '';
  const topN = typeof config.rerank.topN === 'number' && Number.isFinite(config.rerank.topN) ? config.rerank.topN : 10;

  if (!config.rerank.enabled || !providerUrl || candidates.length === 0) {
    return { scoreByKey: {}, used: false };
  }

  const endpoint = providerUrl;
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
        headers: {
          'Content-Type': 'application/json',
        },
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
