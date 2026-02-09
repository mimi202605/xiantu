/**
 * @fileoverview 世界心跳 NPC 更新提示词 - 通用版 (ming)
 * 根据当前对话、世界/时间/地图、近期事件与候选 NPC 完整信息，以 NPC 视角生成 位置、当前外貌状态、当前内心想法、在做事项。
 */

import type { SaveData, NpcProfile, GameTime, LocationEntry } from '@/types/game';

export interface WorldHeartbeatPromptInput {
  /** 候选 NPC 名字列表 */
  candidateNpcNames: string[];
  /** 当前存档（用于提取世界/时间/关系/地点） */
  saveData: SaveData;
  /** 触发方式，用于提示语 */
  triggerMode: '周期' | '事件' | '手动';
  /** 若为事件触发，最近事件描述（可选） */
  recentEventSummary?: string;
  /** 近期剧情（最近 5 条隐式中期记忆，用于推演上下文） */
  currentConversation?: string[];
}

const OUTPUT_FORMAT = `
## 输出格式（仅输出一个 JSON 对象）

只输出一个 JSON，不要解释、思维链或代码围栏外的文字。可用 \`\`\`json ... \`\`\` 包裹。

{
  "tavern_commands": [
    { "action": "set", "key": "社交.关系.[NPC名].当前位置", "value": { "描述": "地点描述" } },
    { "action": "set", "key": "社交.关系.[NPC名].当前外貌状态", "value": "简短一句" },
    { "action": "set", "key": "社交.关系.[NPC名].当前内心想法", "value": "简短一句" },
    { "action": "set", "key": "社交.关系.[NPC名].在做事项", "value": "简短一句" }
  ]
}

- 只允许 set 以下路径（且 key 必须对应候选 NPC 名字）：
  - 社交.关系.[NPC名].当前位置（value 为 { 描述: string }）
  - 社交.关系.[NPC名].当前外貌状态（value 为 string）
  - 社交.关系.[NPC名].当前内心想法（value 为 string）
  - 社交.关系.[NPC名].在做事项（value 为 string，简短一句）
- 每个 NPC 可只更新部分字段，不必全部 set；不变化的可不输出。
- 禁止 set 其他路径（如 好感度、记忆、关系 等）。
`.trim();

function formatGameTime(t?: GameTime | null): string {
  if (!t) return '未知';
  const m = String(t.分钟 ?? 0).padStart(2, '0');
  return `${t.年}年${t.月}月${t.日}日 ${String(t.小时 ?? 0).padStart(2, '0')}:${m}`;
}

/** 递归收集地点名称与描述，用于 prompt 中的地图信息 */
function flattenLocationTree(
  entries: (LocationEntry | { 名称?: string; 描述?: string; 内部?: unknown[] })[] | undefined,
  indent = ''
): string[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const lines: string[] = [];
  for (const e of entries) {
    const name = (e as LocationEntry).名称 ?? (e as any).name ?? '?';
    const desc = (e as LocationEntry).描述 ?? (e as any).描述 ?? '';
    lines.push(`${indent}- ${name}${desc ? `：${desc}` : ''}`);
    const inner = (e as LocationEntry).内部 as (LocationEntry & { 内部?: unknown[] })[] | undefined;
    if (Array.isArray(inner) && inner.length > 0) {
      lines.push(...flattenLocationTree(inner, indent + '  '));
    }
  }
  return lines;
}

/** 单个 NPC 的完整信息块（身份、关系、位置、状态、记忆等），便于 LLM 以该 NPC 视角推演 */
function npcFullBlock(npc: NpcProfile & Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`### ${npc.名字}`);
  lines.push(`- 身份/出生：${npc.出生 ? (typeof npc.出生 === 'string' ? npc.出生 : (npc.出生 as any).描述 ?? (npc.出生 as any).名称 ?? '') : '未填'}`);
  lines.push(`- 外貌描述：${(npc.外貌描述 ?? (npc as any).外貌 ?? '').slice(0, 150)}${(npc.外貌描述?.length ?? 0) > 150 ? '…' : ''}`);
  const traits = Array.isArray(npc.性格特征) ? npc.性格特征.join('、') : (npc as any).性格 ?? '';
  if (traits) lines.push(`- 性格特征：${traits}`);
  lines.push(`- 与玩家关系：${npc.与玩家关系 ?? '未知'}`);
  if (npc.类型) lines.push(`- 类型：${npc.类型}`);
  if (npc.势力归属) lines.push(`- 势力归属：${npc.势力归属}`);
  lines.push(`- 当前位置：${npc.当前位置?.描述 ?? '未知'}`);
  lines.push(`- 当前外貌状态：${npc.当前外貌状态 ?? '未填'}`);
  lines.push(`- 当前内心想法：${npc.当前内心想法 ?? '未填'}`);
  lines.push(`- 在做事项：${(npc as any).在做事项 ?? '未填'}`);
  const 历史在做事项 = (npc as any).历史在做事项;
  if (Array.isArray(历史在做事项) && 历史在做事项.length > 0) {
    lines.push(`- 历史在做事项（仅供参考，不输出）：${历史在做事项.slice(0, 10).join(' → ')}${历史在做事项.length > 10 ? ' …' : ''}`);
  }
  const memory = npc.记忆;
  if (Array.isArray(memory) && memory.length > 0) {
    const recent = memory.slice(-3).map((m) => (typeof m === 'string' ? m : (m as any)?.事件 ?? String(m))).join('；');
    lines.push(`- 近期记忆：${recent.slice(0, 200)}${recent.length > 200 ? '…' : ''}`);
  }
  const 记忆总结Raw = npc.记忆总结;
  if (记忆总结Raw != null) {
    const 记忆总结Arr = Array.isArray(记忆总结Raw)
      ? 记忆总结Raw
      : typeof 记忆总结Raw === 'string' && 记忆总结Raw.length > 0
        ? [记忆总结Raw]
        : [];
    if (记忆总结Arr.length > 0) {
      const text = 记忆总结Arr.slice(-2).map((s) => (typeof s === 'string' ? s : String(s))).join('；');
      lines.push(`- 记忆总结：${text.slice(0, 150)}${text.length > 150 ? '…' : ''}`);
    }
  }
  const bottom = npc.人格底线;
  if (bottom && (Array.isArray(bottom) ? bottom.length : (typeof bottom === 'string' && bottom.length))) {
    lines.push(`- 人格底线：${Array.isArray(bottom) ? bottom.join('、') : bottom}`);
  }
  return lines.join('\n');
}

export function buildWorldHeartbeatPrompt(input: WorldHeartbeatPromptInput): string {
  const { candidateNpcNames, saveData, triggerMode, recentEventSummary, currentConversation } = input;
  const anySave = saveData as any;
  const gameTime = anySave?.元数据?.时间 as GameTime | undefined;
  const worldInfo = anySave?.世界?.信息;
  const relations = anySave?.社交?.关系 ?? {};
  const worldName = worldInfo?.世界名称 ?? '当前世界';
  const worldBg = (worldInfo?.世界背景 ?? '').slice(0, 600);
  const worldEra = (worldInfo as any)?.世界纪元;
  const specialSetting = (worldInfo as any)?.特殊设定;
  const timeStr = formatGameTime(gameTime);

  const locationEntries = (worldInfo as any)?.地点信息;
  const locationLines = flattenLocationTree(locationEntries);

  const npcBlocks = candidateNpcNames
    .map((name) => relations[name])
    .filter((n): n is NpcProfile & Record<string, unknown> => n != null && typeof n === 'object')
    .map(npcFullBlock);

  const eventBlock = recentEventSummary
    ? `\n**近期世界事件（可作参考）**：${recentEventSummary}\n`
    : '';

  const contextBlock = [
    `世界：${worldName}；时间：${timeStr}`,
    worldBg ? `世界背景（摘要）：${worldBg.slice(0, 300)}` : null,
    locationLines.length > 0 ? `地点列表：${locationLines.slice(0, 30).map((l) => l.replace(/^[\s-]+/, '').split('：')[0]).join('、')}` : null,
    currentConversation && currentConversation.length > 0
      ? (() => { const s = currentConversation.join(' | '); return `近期剧情（仅供参考，勿喧宾夺主）：${s.slice(0, 400)}${s.length > 400 ? '…' : ''}`; })()
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `
# 任务：世界心跳 - 从 NPC 视角更新其状态

**你的核心任务**：为下列每个 NPC **代入该角色视角**，更新其 当前位置、当前外貌状态、当前内心想法、在做事项。模型注意力应放在「每个 NPC 是谁、正在做什么想什么」上，而不是放在剧情叙述上。

**视角要求**：对每个 NPC，你必须站在**该 NPC 的立场**写出其「当前内心想法」与「在做事项」——即用该角色的认知、动机与口吻，一句话描述他/她此刻的内心想法，以及此刻正在做的事。禁止上帝视角或玩家视角；不写剧情概括，只写该角色自己的状态。

---

## 需要更新状态的 NPC（请逐个代入该角色视角）

${npcBlocks.length ? npcBlocks.join('\n\n') : '（无）'}

---

## 参考信息（仅作时空与地点约束，不主导输出）

${contextBlock}
${eventBlock}

---

## 要求
- 只输出对上述 NPC 的 set 指令，路径限于 当前位置/当前外貌状态/当前内心想法/在做事项。
- **每个 NPC 的 内心想法、在做事项 必须从该 NPC 本人视角写出**，符合其人设与关系。
- 每条 value 简短一句；位置描述须与已知地点一致或合理。
- 若某 NPC 无需变化可不输出；不要编造候选列表外的 NPC。

${OUTPUT_FORMAT}
`.trim();
}
