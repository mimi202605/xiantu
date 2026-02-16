import { readFrom扩展 } from '@/services/gameStateIndexer';
import { deriveFrom社交关系 } from '@/services/memoryRetrievalService';
import { getNpcsAtLocation } from '@/utils/locationUtils';
import { ensureEngramMemory } from './memoryRepository';
import { formatWithBudget, type RetrievalLineCandidate } from './injectionFormatter';

export interface UnifiedRetrieveInput {
  saveData: Record<string, unknown>;
  userInput: string;
  playerName?: string;
  locationDesc?: string;
  recentNpcNames?: string[];
  maxTokens?: number;
  maxLines?: number;
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

export async function unifiedRetrieve(input: UnifiedRetrieveInput): Promise<UnifiedRetrieveOutput> {
  const startedAt = Date.now();
  const saveData = (input.saveData ?? {}) as any;
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

  const eventCandidates: RetrievalLineCandidate[] = engramMemory.events.map((event) => {
    const summary = normalizeText((event as any).summary);
    const structure = (event as any).structured_kv ?? {};
    const contextBoost =
      (locationDesc && summary.includes(locationDesc) ? 0.35 : 0) +
      (recentNpcNames.some((name) => summary.includes(name)) ? 0.35 : 0);
    const score =
      keywordScore(summary, terms) * 0.45 +
      recencyScoreFromTimestamp((event as any).timestamp) * 0.25 +
      contextBoost +
      (typeof (event as any).significance_score === 'number' ? (event as any).significance_score / 10 : 0.05);
    const timeAnchor = normalizeText(structure.time_anchor);
    return {
      key: `event:${(event as any).id}`,
      section: 'events',
      text: `- ${timeAnchor ? `[${timeAnchor}] ` : ''}${compact(summary)}`,
      score,
      nodeId: (event as any).id,
    };
  });

  const tripleCandidates: RetrievalLineCandidate[] = (semanticMemory.triples || []).map((triple: any, index: number) => {
    const subject = normalizeText(triple.subject);
    const predicate = normalizeText(triple.predicate);
    const object = normalizeText(triple.object);
    const text = `${subject} ${predicate} ${object}`.trim();
    const related = contextSet.has(subject) || contextSet.has(object);
    const imp = typeof triple.importance === 'number' ? Math.max(0, Math.min(10, triple.importance)) / 10 : 0.5;
    const score =
      keywordScore(text, terms) * 0.5 +
      (related ? 0.3 : 0) +
      imp * 0.15 +
      recencyScoreFromTimestamp(triple.timestamp) * 0.05;
    return {
      key: `triple:${subject}:${predicate}:${object}:${index}`,
      section: 'triples',
      text: `- ${subject || '未知'} ${predicate || '相关'} ${object || '未知'}`.trim(),
      score,
      nodeId: undefined,
    };
  });

  const graphCandidates: RetrievalLineCandidate[] = (derived.relationships || []).map((rel, index) => {
    const from = derived.entities.find((e) => e.id === rel.fromId)?.name || rel.fromId;
    const to = derived.entities.find((e) => e.id === rel.toId)?.name || rel.toId;
    const text = `${from} ${rel.relationship} ${to}`;
    const related = contextSet.has(from) || contextSet.has(to);
    const score = keywordScore(text, terms) * 0.55 + (related ? 0.45 : 0.05);
    return {
      key: `graph:${rel.fromId}:${rel.relationship}:${rel.toId}:${index}`,
      section: 'graph',
      text: `- ${from} --${rel.relationship}--> ${to}`,
      score,
    };
  });

  const npcsAtLocation = getNpcsAtLocation(saveData as Record<string, unknown>, locationDesc);
  const ruleCandidates: RetrievalLineCandidate[] = npcsAtLocation.map((npcName, index) => {
    const npc = saveData?.社交?.关系?.[npcName];
    const relation = normalizeText(npc?.与玩家关系) || '未知关系';
    const brief = compact(normalizeText(npc?.当前外貌状态) || normalizeText(npc?.当前内心想法) || '状态未知', 40);
    const text = `${npcName} ${relation} ${brief}`;
    const score = keywordScore(text, terms) * 0.35 + (contextSet.has(npcName) ? 0.45 : 0.15) + 0.1;
    return {
      key: `rule:npc:${npcName}:${index}`,
      section: 'rules',
      text: `- ${npcName}：${relation}${brief ? `；${brief}` : ''}`,
      score,
    };
  });

  const allCandidates = [
    ...eventCandidates,
    ...tripleCandidates,
    ...graphCandidates,
    ...ruleCandidates,
  ].sort((a, b) => b.score - a.score);

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
      vectorCandidates: 0,
      graphCandidates: graphCandidates.length,
      tripleCandidates: tripleCandidates.length,
      ruleCandidates: ruleCandidates.length + eventCandidates.length,
      finalCount: formatted.selected.length,
      mode: 'hybrid',
      embeddingUsed: false,
      rerankUsed: false,
      tokenEstimate: formatted.tokenEstimate,
    },
  };
}
