export type RetrievalSection = 'events' | 'triples' | 'graph' | 'rules';

export interface RetrievalLineCandidate {
  key: string;
  section: RetrievalSection;
  text: string;
  score: number;
  nodeId?: string;
  tokenCost?: number;
}

const SECTION_TITLE: Record<RetrievalSection, string> = {
  events: '# 事件记忆',
  triples: '# 语义记忆',
  graph: '# 关系图谱',
  rules: '# 场景规则',
};

const estimateTokens = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

export interface FormatWithBudgetInput {
  candidates: RetrievalLineCandidate[];
  maxTokens: number;
  maxLines: number;
}

export interface FormatWithBudgetOutput {
  block: string;
  usedNodeIds: string[];
  selected: RetrievalLineCandidate[];
  tokenEstimate: number;
}

export function formatWithBudget(input: FormatWithBudgetInput): FormatWithBudgetOutput {
  const { candidates, maxTokens, maxLines } = input;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { block: '', usedNodeIds: [], selected: [], tokenEstimate: 0 };
  }

  const selected: RetrievalLineCandidate[] = [];
  const seen = new Set<string>();
  let usedTokens = 0;
  let usedLines = 0;

  for (const candidate of candidates) {
    const key = candidate.key || candidate.text;
    if (!key || seen.has(key)) continue;
    const tokenCost = candidate.tokenCost ?? estimateTokens(candidate.text);
    if (usedLines >= maxLines || usedTokens + tokenCost > maxTokens) continue;
    seen.add(key);
    selected.push({ ...candidate, tokenCost });
    usedLines += 1;
    usedTokens += tokenCost;
  }

  const grouped: Record<RetrievalSection, string[]> = {
    events: [],
    triples: [],
    graph: [],
    rules: [],
  };
  const usedNodeIds: string[] = [];

  for (const item of selected) {
    grouped[item.section].push(item.text);
    if (item.nodeId) usedNodeIds.push(item.nodeId);
  }

  const parts: string[] = [];
  (['events', 'triples', 'graph', 'rules'] as RetrievalSection[]).forEach((section) => {
    const lines = grouped[section];
    if (!lines.length) return;
    parts.push(SECTION_TITLE[section]);
    parts.push(...lines);
    parts.push('');
  });

  const block = parts.join('\n').trim();
  return { block, usedNodeIds, selected, tokenEstimate: usedTokens };
}
