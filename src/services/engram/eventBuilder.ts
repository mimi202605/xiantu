import type { GM_Response } from '@/types/AIGameMaster';
import type { GameTime, MingEventNode, SaveData } from '@/types/game';
import { sanitizeAITextForDisplay } from '@/utils/textSanitizer';

const formatGameTime = (time?: GameTime): string => {
  if (!time) return '';
  const minute = String(time.分钟 ?? 0).padStart(2, '0');
  return `仙道${time.年}年${time.月}月${time.日}日 ${String(time.小时).padStart(2, '0')}:${minute}`;
};

const toSentence = (text: string, max = 40): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '事件';
  const endIdx = clean.search(/[。！？.!?]/);
  const first = endIdx > 0 ? clean.slice(0, endIdx) : clean;
  return first.length > max ? `${first.slice(0, max)}…` : first;
};

const buildBurnedSummary = (
  rawSummary: string,
  meta: Pick<MingEventNode['structured_kv'], 'event' | 'causality' | 'logic' | 'time_anchor' | 'location' | 'role'>,
): string => {
  const titleSuffixParts: string[] = [];
  if (meta.causality) titleSuffixParts.push(meta.causality);
  if (Array.isArray(meta.logic) && meta.logic.length > 0) titleSuffixParts.push(meta.logic.join(', '));
  const titleSuffix = titleSuffixParts.length > 0 ? `(${titleSuffixParts.join(' | ')})` : '';
  const titleLine = meta.event ? `${meta.event}${titleSuffix}:\n` : '';

  const metaParts: string[] = [];
  if (meta.time_anchor) metaParts.push(meta.time_anchor);
  if (Array.isArray(meta.location) && meta.location.length > 0) metaParts.push(meta.location.join(', '));
  if (Array.isArray(meta.role) && meta.role.length > 0) metaParts.push(meta.role.join(', '));
  const metaLine = metaParts.length > 0 ? `(${metaParts.join(' | ')}) ` : '';

  const summary = rawSummary.trim() || '[Summary Missing]';
  return `${titleLine}${metaLine}${summary}`.trim();
};

const createEventId = (): string => `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export interface BuildEventsInput {
  response: GM_Response;
  saveData: SaveData | Record<string, unknown>;
}

/**
 * Build MingEventNode(s) from GM response.
 * Phase-1 implementation intentionally keeps this lightweight and non-blocking.
 */
export function buildEventsFromResponse(input: BuildEventsInput): MingEventNode[] {
  const response = input.response;
  const save = input.saveData as any;
  const text = sanitizeAITextForDisplay(response?.text ?? '').trim();
  if (!text) return [];

  const time_anchor = formatGameTime(save?.元数据?.时间);
  const locationDesc = save?.角色?.位置?.描述;
  const location = typeof locationDesc === 'string' && locationDesc.trim().length > 0 ? [locationDesc.trim()] : [];

  const implicit = response.mid_term_memory;
  const roles =
    implicit && typeof implicit === 'object' && Array.isArray((implicit as any).相关角色)
      ? ((implicit as any).相关角色 as string[]).filter((name) => typeof name === 'string' && name.trim().length > 0)
      : [];

  const eventTitle = toSentence(text, 48);
  const logic: string[] = [];
  const causality = '承接';

  const burnedSummary = buildBurnedSummary(text, {
    event: eventTitle,
    causality,
    logic,
    time_anchor,
    location,
    role: roles,
  });

  const eventNode: MingEventNode = {
    id: createEventId(),
    summary: burnedSummary,
    structured_kv: {
      time_anchor,
      role: roles,
      location,
      event: eventTitle,
      logic,
      causality,
    },
    is_embedded: false,
    is_archived: false,
    significance_score: 0.5,
    level: 0,
    source_range: { start_index: 0, end_index: 0 },
    timestamp: Date.now(),
  };

  return [eventNode];
}
