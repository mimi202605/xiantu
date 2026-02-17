import { readFrom扩展 } from '@/services/gameStateIndexer';
import { deriveFrom社交关系 } from '@/services/memoryRetrievalService';
import { getNpcsAtLocation } from '@/utils/locationUtils';
import type { MingEngramConfig } from '@/types/game';
import { ensureEngramMemory } from './memoryRepository';
import { DEFAULT_ENGRAM_CONFIG, normalizeEngramConfig } from './config';
import { loadEngramVectorStore } from './vectorRepository';
import type { EngramVectorStoreContext } from './types';
import { formatWithBudget, type RetrievalLineCandidate } from './injectionFormatter';
import { cosineSimilarity, embedTexts } from './embeddingService';
import { rerankCandidates } from './rerankService';

export interface UnifiedRetrieveInput {
  saveData: Record<string, unknown>;
  userInput: string;
  playerName?: string;
  locationDesc?: string;
  recentNpcNames?: string[];
  maxTokens?: number;
  maxLines?: number;
  engramConfig?: MingEngramConfig;
  vectorContext?: EngramVectorStoreContext;
  /** 来自 API 管理的 Rerank 端点，优先于 engramConfig.rerank.providerUrl */
  rerankEndpointUrl?: string;
  /** 来自 API 管理的 Rerank 模型，优先于 engramConfig.rerank.model */
  rerankModel?: string;
  /** 来自 API 管理的 Rerank API Key，用于 Authorization: Bearer，避免 401 */
  rerankApiKey?: string;
}

export interface UnifiedRetrieveDebug {
  embeddingRequest?: {
    query: string;
    model?: string;
    provider?: string;
    vectorDimension?: number;
    usedFallback?: boolean;
    responsePreview?: string;
  };
  rerankRequest?: {
    query: string;
    candidatesCount: number;
    topN: number;
    model?: string;
    endpoint?: string;
    responsePreview?: string;
  };
}

export interface UnifiedRetrieveOutput {
  block: string;
  usedNodeIds: string[];
  usedTripleCount: number;
  stats: {
    latencyMs: number;
    vectorCandidates: number;
    graphCandidates: number;
    tripleCandidates: number;
    ruleCandidates: number;
    finalCount: number;
    mode: 'legacy' | 'hybrid';
    embeddingUsed: boolean;
    rerankUsed: boolean;
    tokenEstimate: number;
  };
  /** 调试用：本轮 embedding/rerank 请求与响应摘要，供提示词组装展示 */
  debug?: UnifiedRetrieveDebug;
}

const tokenize = (text: string): string[] =>
  (text || '')
    .toLowerCase()
    .split(/[\s,，。.!?！？;；:：、"'`~\-_/\\()[\]{}<>|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 12);

const normalizeText = (text: unknown): string => (typeof text === 'string' ? text.trim() : '');

const keywordScore = (content: string, terms: string[]): number => {
  if (!terms.length) return 0;
  const lower = content.toLowerCase();
  let hit = 0;
  for (const term of terms) {
    if (lower.includes(term)) hit += 1;
  }
  return hit / terms.length;
};

const recencyScoreFromTimestamp = (timestamp: unknown): number => {
  const now = Date.now();
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const ageHours = Math.max(0, (now - timestamp) / 3600000);
    return 1 / (1 + ageHours / 72);
  }
  if (typeof timestamp === 'string') {
    const t = Date.parse(timestamp);
    if (!Number.isNaN(t)) {
      const ageHours = Math.max(0, (now - t) / 3600000);
      return 1 / (1 + ageHours / 72);
    }
  }
  return 0.2;
};

const compact = (text: string, maxLen = 120): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
};

type ScoredCandidate = RetrievalLineCandidate & {
  baseScore: number;
  vectorScore: number;
};

export async function unifiedRetrieve(input: UnifiedRetrieveInput): Promise<UnifiedRetrieveOutput> {
  const startedAt = Date.now();
  const saveData = (input.saveData ?? {}) as any;
  const engramConfig = normalizeEngramConfig(input.engramConfig ?? DEFAULT_ENGRAM_CONFIG);
  const playerName = input.playerName || saveData?.角色?.身份?.名字 || '玩家';
  const locationDesc = input.locationDesc || saveData?.角色?.位置?.描述 || '';
  const recentNpcNames = Array.isArray(input.recentNpcNames) ? input.recentNpcNames : [];
  const contextSet = new Set<string>(['玩家', playerName, ...recentNpcNames]);
  const terms = tokenize(input.userInput || '');
  const maxTokens = typeof input.maxTokens === 'number' && input.maxTokens > 0 ? input.maxTokens : 550;
  const maxLines = typeof input.maxLines === 'number' && input.maxLines > 0 ? input.maxLines : 35;

  const engramMemory = ensureEngramMemory(saveData?.系统?.扩展?.engramMemory);
  const semanticMemory = readFrom扩展(saveData as Record<string, unknown>).semanticMemory;
  const derived = deriveFrom社交关系(saveData?.社交?.关系, saveData?.角色?.身份);

  const eventCandidates: ScoredCandidate[] = engramMemory.events.map((event) => {
    const summary = normalizeText((event as any).summary);
    const structure = (event as any).structured_kv ?? {};
    const contextBoost =
      (locationDesc && summary.includes(locationDesc) ? 0.35 : 0) +
      (recentNpcNames.some((name) => summary.includes(name)) ? 0.35 : 0);
    const baseScore =
      keywordScore(summary, terms) * 0.45 +
      recencyScoreFromTimestamp((event as any).timestamp) * 0.25 +
      contextBoost +
      (typeof (event as any).significance_score === 'number' ? (event as any).significance_score / 10 : 0.05);
    const timeAnchor = normalizeText(structure.time_anchor);
    return {
      key: `event:${(event as any).id}`,
      section: 'events',
      text: `- ${timeAnchor ? `[${timeAnchor}] ` : ''}${compact(summary)}`,
      score: baseScore,
      baseScore,
      vectorScore: 0,
      nodeId: (event as any).id,
    };
  });

  const tripleCandidates: ScoredCandidate[] = (semanticMemory.triples || []).map((triple: any, index: number) => {
    const subject = normalizeText(triple.subject);
    const predicate = normalizeText(triple.predicate);
    const object = normalizeText(triple.object);
    const text = `${subject} ${predicate} ${object}`.trim();
    const related = contextSet.has(subject) || contextSet.has(object);
    const imp = typeof triple.importance === 'number' ? Math.max(0, Math.min(10, triple.importance)) / 10 : 0.5;
    const baseScore =
      keywordScore(text, terms) * 0.5 +
      (related ? 0.3 : 0) +
      imp * 0.15 +
      recencyScoreFromTimestamp(triple.timestamp) * 0.05;
    return {
      key: `triple:${subject}:${predicate}:${object}:${index}`,
      section: 'triples',
      text: `- ${subject || '未知'} ${predicate || '相关'} ${object || '未知'}`.trim(),
      score: baseScore,
      baseScore,
      vectorScore: 0,
      nodeId: undefined,
    };
  });

  const graphCandidates: ScoredCandidate[] = (derived.relationships || []).map((rel, index) => {
    const from = derived.entities.find((e) => e.id === rel.fromId)?.name || rel.fromId;
    const to = derived.entities.find((e) => e.id === rel.toId)?.name || rel.toId;
    const text = `${from} ${rel.relationship} ${to}`;
    const related = contextSet.has(from) || contextSet.has(to);
    const baseScore = keywordScore(text, terms) * 0.55 + (related ? 0.45 : 0.05);
    return {
      key: `graph:${rel.fromId}:${rel.relationship}:${rel.toId}:${index}`,
      section: 'graph',
      text: `- ${from} --${rel.relationship}--> ${to}`,
      score: baseScore,
      baseScore,
      vectorScore: 0,
    };
  });

  const entityCandidates: ScoredCandidate[] = (engramMemory.entities || []).map((entity, index) => {
    const name = normalizeText((entity as any).name);
    const description = normalizeText((entity as any).description);
    const text = `${name} ${description}`.trim();
    const related = contextSet.has(name);
    const score =
      keywordScore(text, terms) * 0.55 +
      (related ? 0.25 : 0) +
      recencyScoreFromTimestamp((entity as any).last_updated_at) * 0.2;
    return {
      key: `entity:${(entity as any).id || index}`,
      section: 'graph',
      text: `- ${name || '未知实体'}：${description || '无描述'}`,
      score,
      baseScore: score,
      vectorScore: 0,
      nodeId: (entity as any).id,
    };
  });

  const entityById = new Map(
    (engramMemory.entities || []).map((entity) => [String((entity as any).id || ''), entity] as const),
  );
  const relationCandidates: ScoredCandidate[] = (engramMemory.relations || []).map((relation, index) => {
    const fromEntity = entityById.get(String((relation as any).from_id || ''));
    const toEntity = entityById.get(String((relation as any).to_id || ''));
    const fromName = normalizeText((fromEntity as any)?.name || (relation as any).from_id);
    const toName = normalizeText((toEntity as any)?.name || (relation as any).to_id);
    const relationName = normalizeText((relation as any).relation);
    const text = `${fromName} ${relationName} ${toName}`.trim();
    const related = contextSet.has(fromName) || contextSet.has(toName);
    const confidence = typeof (relation as any).confidence === 'number' ? (relation as any).confidence : 0.5;
    const score =
      keywordScore(text, terms) * 0.5 +
      (related ? 0.25 : 0) +
      Math.max(0, Math.min(1, confidence)) * 0.25;
    return {
      key: `relation:${(relation as any).id || index}`,
      section: 'graph',
      text: `- ${fromName || '未知'} --${relationName || '相关'}--> ${toName || '未知'}`,
      score,
      baseScore: score,
      vectorScore: 0,
    };
  });

  const npcsAtLocation = getNpcsAtLocation(saveData as Record<string, unknown>, locationDesc);
  const ruleCandidates: ScoredCandidate[] = npcsAtLocation.map((npcName, index) => {
    const npc = saveData?.社交?.关系?.[npcName];
    const relation = normalizeText(npc?.与玩家关系) || '未知关系';
    const brief = compact(normalizeText(npc?.当前外貌状态) || normalizeText(npc?.当前内心想法) || '状态未知', 40);
    const text = `${npcName} ${relation} ${brief}`;
    const baseScore = keywordScore(text, terms) * 0.35 + (contextSet.has(npcName) ? 0.45 : 0.15) + 0.1;
    return {
      key: `rule:npc:${npcName}:${index}`,
      section: 'rules',
      text: `- ${npcName}：${relation}${brief ? `；${brief}` : ''}`,
      score: baseScore,
      baseScore,
      vectorScore: 0,
    };
  });

  let embeddingUsed = false;
  let vectorCandidates = 0;
  const debug: UnifiedRetrieveDebug = {};
  if (
    engramConfig.embedding.enabled &&
    input.vectorContext &&
    input.userInput.trim().length > 0 &&
    eventCandidates.length > 0
  ) {
    try {
      const vectorStore = await loadEngramVectorStore(input.vectorContext);
      const embedded = await embedTexts([input.userInput], engramConfig);
      const queryVector = embedded.vectors[0] || [];
      embeddingUsed = !embedded.usedFallback;
      debug.embeddingRequest = {
        query: input.userInput.trim(),
        model: engramConfig.embedding.model,
        provider: engramConfig.embedding.provider,
        vectorDimension: queryVector.length,
        usedFallback: embedded.usedFallback,
        responsePreview: `${embedded.vectors.length} vector(s), dim=${queryVector.length}${embedded.usedFallback ? ' (fallback)' : ''}`,
      };

      const minScore = engramConfig.embedding.minScore;
      const vectorScoredEvents = eventCandidates
        .map((candidate) => {
          const nodeId = candidate.nodeId || '';
          const eventVector = vectorStore.eventVectors[nodeId];
          if (!Array.isArray(eventVector) || eventVector.length === 0 || queryVector.length === 0) {
            return { candidate, sim: -1 };
          }
          const sim = cosineSimilarity(queryVector, eventVector);
          return { candidate, sim };
        })
        .filter((item) => item.sim >= minScore)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, engramConfig.embedding.topK);
      const vectorScoredEntities = entityCandidates
        .map((candidate) => {
          const nodeId = candidate.nodeId || '';
          const entityVector = vectorStore.entityVectors[nodeId];
          if (!Array.isArray(entityVector) || entityVector.length === 0 || queryVector.length === 0) {
            return { candidate, sim: -1 };
          }
          const sim = cosineSimilarity(queryVector, entityVector);
          return { candidate, sim };
        })
        .filter((item) => item.sim >= minScore)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, Math.max(5, Math.floor(engramConfig.embedding.topK / 2)));

      const selectedByVector = new Map<string, number>();
      for (const item of vectorScoredEvents) {
        selectedByVector.set(item.candidate.key, item.sim);
      }
      for (const item of vectorScoredEntities) {
        selectedByVector.set(item.candidate.key, item.sim);
      }

      vectorCandidates = vectorScoredEvents.length + vectorScoredEntities.length;
      for (const candidate of eventCandidates) {
        const vectorScore = selectedByVector.get(candidate.key) ?? 0;
        candidate.vectorScore = vectorScore;
      }
      for (const candidate of entityCandidates) {
        const vectorScore = selectedByVector.get(candidate.key) ?? 0;
        candidate.vectorScore = vectorScore;
      }
    } catch (error) {
      console.warn('[Engram] 向量召回失败，回退基础检索:', error);
    }
  }

  for (const candidate of eventCandidates) {
    candidate.score = candidate.baseScore * 0.72 + candidate.vectorScore * 0.55;
  }
  for (const candidate of entityCandidates) {
    candidate.score = candidate.baseScore * 0.75 + candidate.vectorScore * 0.45;
  }

  let allCandidates: ScoredCandidate[] = [
    ...eventCandidates,
    ...tripleCandidates,
    ...graphCandidates,
    ...entityCandidates,
    ...relationCandidates,
    ...ruleCandidates,
  ].sort((a, b) => b.score - a.score);

  let rerankUsed = false;
  if (engramConfig.rerank.enabled && input.userInput.trim().length > 0 && allCandidates.length > 0) {
    const rerankWindow = Math.max(20, engramConfig.rerank.topN * 3);
    const rerankInput = allCandidates.slice(0, rerankWindow).map((candidate) => ({
      key: candidate.key,
      text: candidate.text,
    }));
    const rerank = await rerankCandidates(input.userInput, rerankInput, engramConfig, {
      endpointUrl: input.rerankEndpointUrl,
      model: input.rerankModel,
      apiKey: input.rerankApiKey,
    });
    if (rerank.used) {
      rerankUsed = true;
      const preview = JSON.stringify(rerank.scoreByKey, null, 2);
      debug.rerankRequest = {
        query: input.userInput.trim(),
        candidatesCount: rerankInput.length,
        topN: engramConfig.rerank.topN,
        model: input.rerankModel ?? engramConfig.rerank.model,
        endpoint: input.rerankEndpointUrl ?? engramConfig.rerank.providerUrl,
        responsePreview: preview.length > 2500 ? `${preview.slice(0, 2500)}\n... (truncated)` : preview,
      };
      allCandidates = allCandidates
        .map((candidate) => {
          const rerankScore = rerank.scoreByKey[candidate.key];
          if (typeof rerankScore !== 'number') return candidate;
          return {
            ...candidate,
            score: candidate.score * 0.7 + rerankScore * 0.4,
          };
        })
        .sort((a, b) => b.score - a.score);
    }
  }

  const formatted = formatWithBudget({
    candidates: allCandidates,
    maxTokens,
    maxLines,
  });

  return {
    block: formatted.block,
    usedNodeIds: formatted.usedNodeIds,
    usedTripleCount: formatted.selected.filter((item) => item.section === 'triples').length,
    stats: {
      latencyMs: Date.now() - startedAt,
      vectorCandidates,
      graphCandidates: graphCandidates.length + entityCandidates.length + relationCandidates.length,
      tripleCandidates: tripleCandidates.length,
      ruleCandidates: ruleCandidates.length,
      finalCount: formatted.selected.length,
      mode: 'hybrid',
      embeddingUsed,
      rerankUsed,
      tokenEstimate: formatted.tokenEstimate,
    },
    debug: Object.keys(debug).length > 0 ? debug : undefined,
  };
}
