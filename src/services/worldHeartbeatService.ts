/**
 * 世界心跳服务：候选选择、单次心跳执行（快照 → AI → 应用命令 → 记录）。
 * 注意：应用命令通过 AIBidirectionalSystem.applyCommandsOnly，绝不写入 上次主回合更新回合。
 */

import { cloneDeep, get } from 'lodash';
import type { SaveData, NpcProfile, GameEvent, HeartbeatRecord, HeartbeatUpdateEntry, WorldHeartbeatConfig } from '@/types/game';
import { buildWorldHeartbeatPrompt } from '@/utils/prompts/tasks/worldHeartbeatPromptsMing';
import { AIBidirectionalSystem } from '@/utils/AIBidirectionalSystem';
import { calibrateNpcLocationSync } from '@/utils/locationUtils';
import { aiService } from '@/services/aiService';
import { usePromptAssemblyStore } from '@/stores/promptAssemblyStore';
import { useUIStore } from '@/stores/uiStore';

const ALLOWED_HEARTBEAT_KEYS = [
  '当前位置',
  '当前外貌状态',
  '当前内心想法',
  '在做事项',
];

function formatHeartbeatTime(saveData: SaveData): string {
  const t = (saveData as any).元数据?.时间;
  if (!t) return new Date().toISOString();
  const 分钟 = String(t.分钟 ?? 0).padStart(2, '0');
  return `${t.年}-${String(t.月).padStart(2, '0')}-${String(t.日).padStart(2, '0')} ${String(t.小时 ?? 0).padStart(2, '0')}:${分钟}`;
}

/**
 * 选择参与本次心跳的 NPC 名字列表。
 * 排除：心跳锁定、超过遗忘回合数未主回合更新的。
 * 周期/手动：简化规则（重点 + 实时关注 优先，有 与玩家关系 的也算）。
 * 事件：事件.相关人物 + 主角关系网（社交.关系）+ 关注 NPC；不更新仅普通且与事件/主角无关的。
 */
export function selectHeartbeatCandidates(
  saveData: SaveData,
  options: {
    mode: 'period' | 'event' | 'manual';
    event?: GameEvent;
  }
): string[] {
  const anySave = saveData as any;
  const 关系 = anySave?.社交?.关系 ?? {};
  const 心跳 = anySave?.世界?.状态?.心跳 as WorldHeartbeatConfig | undefined;
  const 回合序号 = anySave?.元数据?.回合序号 ?? 0;
  const 遗忘回合数 = 心跳?.遗忘回合数 ?? 10;

  const allNames = Object.keys(关系).filter((name) => {
    const npc = 关系[name];
    if (!npc || typeof npc !== 'object') return false;
    if ((npc as any).心跳锁定 === true) return false;
    const lastMain = (npc as any).上次主回合更新回合;
    const gap = 回合序号 - (typeof lastMain === 'number' ? lastMain : 0);
    if (gap > 遗忘回合数) return false;
    return true;
  });

  if (options.mode === 'event' && options.event?.相关人物?.length) {
    const related = new Set(options.event.相关人物);
    return allNames.filter((name) => {
      const npc = 关系[name] as any;
      if (related.has(name)) return true;
      if (npc?.实时关注 === true) return true;
      if (npc?.类型 === '重点') return true;
      return false;
    });
  }

  // period / manual: 重点 + 关注 + 与玩家关系 非路人
  return allNames.filter((name) => {
    const npc = 关系[name] as any;
    if (npc?.类型 === '重点') return true;
    if (npc?.实时关注 === true) return true;
    if (npc?.与玩家关系 && npc.与玩家关系 !== '路人') return true;
    return false;
  });
}

/**
 * 执行单次世界心跳：快照 → 调 AI → 仅应用允许的 set → 校准地点 → 写记录与历史。
 */
export async function runSingleHeartbeat(
  saveData: SaveData,
  options: {
    triggerMode: '周期' | '事件' | '手动';
    event?: GameEvent;
    candidateNames?: string[];
  }
): Promise<{ saveData: SaveData; record: HeartbeatRecord }> {
  const anySave = saveData as any;
  const 关系 = anySave.社交?.关系 ?? {};
  const 心跳 = anySave.世界?.状态?.心跳 as WorldHeartbeatConfig | undefined;
  const 回合序号 = anySave.元数据?.回合序号 ?? 0;
  const candidates = options.candidateNames ?? selectHeartbeatCandidates(saveData, {
    mode: options.triggerMode === '事件' ? 'event' : 'period',
    event: options.event,
  });

  if (candidates.length === 0) {
    const timeStr = formatHeartbeatTime(saveData);
    const record: HeartbeatRecord = {
      时间: timeStr,
      回合序号,
      触发方式: options.triggerMode,
      相关事件ID: options.event?.事件ID,
      更新列表: [],
      快照: {},
    };
    if (心跳 && options.triggerMode === '事件') {
      (record as any).相关事件ID = options.event?.事件ID;
    }
    return { saveData, record };
  }

  const snapshot: Record<string, NpcProfile> = {};
  for (const name of candidates) {
    const npc = 关系[name];
    if (npc && typeof npc === 'object') snapshot[name] = cloneDeep(npc) as NpcProfile;
  }

  const recentEventSummary = options.event
    ? `${options.event.事件名称 || ''}（${options.event.事件类型 || ''}）：${(options.event.事件描述 || '').slice(0, 200)}；相关人物：${(options.event.相关人物 ?? []).join('、')}`
    : undefined;

  const implicitMidTerm = anySave?.社交?.记忆?.隐式中期记忆;
  const currentConversation = Array.isArray(implicitMidTerm)
    ? implicitMidTerm.slice(-5).map((e: any) =>
        typeof e === 'string' ? e : (e.事件时间 ? `[${e.事件时间}] ` : '') + (e.记忆主体 || '')
      )
    : undefined;

  const prompt = buildWorldHeartbeatPrompt({
    candidateNpcNames: candidates,
    saveData,
    triggerMode: options.triggerMode,
    recentEventSummary,
    currentConversation,
  });

  if (useUIStore().debugMode) {
    const formatHint = '你只输出一个 JSON 对象，不要任何解释或思维链。仅包含 tavern_commands 数组。';
    usePromptAssemblyStore().record({
      fullPrompt: `${formatHint}\n\n---\n\n${prompt}`,
      modules: [
        {
          key: 'worldHeartbeat',
          构成: '世界心跳 NPC 状态推演（任务说明 + 参考信息 + 待更新 NPC 完整信息 + 要求 + 输出格式）',
          生成原因: `周期/事件/手动触发（本次：${options.triggerMode}）`,
          flow引用: '世界心跳',
          content: prompt,
        },
      ],
      flowName: '世界心跳',
      timestamp: Date.now(),
      apiCallDescription: '世界心跳 API：role: user = 输出格式说明；role: user = 心跳 prompt',
    });
  }

  let res: string | Record<string, unknown> | null = null;
  try {
    res = await aiService.generateRaw({
      ordered_prompts: [
        { role: 'user', content: '你只输出一个 JSON 对象，不要任何解释或思维链。仅包含 tavern_commands 数组。' },
        { role: 'user', content: prompt },
      ],
      should_stream: false,
      usageType: 'world_heartbeat',
    }) as string | Record<string, unknown> | null;
  } catch (e) {
    console.error('[世界心跳] AI 调用失败:', e);
    const timeStr = formatHeartbeatTime(saveData);
    return {
      saveData,
      record: {
        时间: timeStr,
        回合序号,
        触发方式: options.triggerMode,
        更新列表: [],
        快照: snapshot,
      },
    };
  }

  // 与主流程一致：用 AIBidirectionalSystem 从响应中提取 tavern_commands（支持字符串或完整 API 响应对象）
  const commands = AIBidirectionalSystem.extractTavernCommandsFromResponse(res);

  const allowedCommands = commands.filter((cmd) => {
    if (!cmd || cmd.action !== 'set' || typeof cmd.key !== 'string' || !cmd.key.startsWith('社交.关系.')) return false;
    const parts = cmd.key.split('.');
    if (parts.length < 4) return false;
    const npcName = parts[2];
    const field = parts[3];
    if (!candidates.includes(npcName)) return false;
    if (!ALLOWED_HEARTBEAT_KEYS.includes(field)) return false;
    return true;
  });

  AIBidirectionalSystem.applyCommandsOnly(saveData, allowedCommands);

  try {
    calibrateNpcLocationSync(saveData as Record<string, unknown>);
  } catch (e) {
    console.warn('[世界心跳] 地点-NPC 校准失败:', e);
  }

  const npcCommands = new Map<string, string[]>();
  for (const c of allowedCommands) {
    const parts = c.key.split('.');
    if (parts.length >= 4) {
      const name = parts[2];
      const field = parts[3];
      const label = field === '当前位置' ? '位置' : field === '当前外貌状态' ? '状态' : field === '当前内心想法' ? '内心想法' : field === '在做事项' ? '在做事项' : field;
      if (!npcCommands.has(name)) npcCommands.set(name, []);
      npcCommands.get(name)!.push(label);
    }
  }
  const updatedNpcNames = new Set(allowedCommands.map((c) => c.key.split('.')[2]));
  const trunc = (s: string, len: number) => (s.length <= len ? s : s.slice(0, len) + '…');

  const updateList: HeartbeatUpdateEntry[] = Array.from(updatedNpcNames).map((npc名字) => {
    const before = snapshot[npc名字];
    const after = get(saveData, `社交.关系.${npc名字}`) as NpcProfile | undefined;
    const parts: string[] = [];
    if (before?.当前位置?.描述 !== after?.当前位置?.描述 && after?.当前位置?.描述) {
      parts.push(`位置：${trunc(after.当前位置.描述, 28)}`);
    }
    if (before?.当前外貌状态 !== (after as any)?.当前外貌状态 && (after as any)?.当前外貌状态) {
      parts.push(`状态：${trunc(String((after as any).当前外貌状态), 28)}`);
    }
    if (before?.当前内心想法 !== (after as any)?.当前内心想法 && (after as any)?.当前内心想法) {
      parts.push(`内心想法：${trunc(String((after as any).当前内心想法), 28)}`);
    }
    if ((before as any)?.在做事项 !== (after as any)?.在做事项 && (after as any)?.在做事项) {
      parts.push(`在做事项：${trunc(String((after as any).在做事项), 28)}`);
    }
    const executed = npcCommands.get(npc名字) || [];
    const 更新摘要 =
      parts.length > 0
        ? parts.join('；')
        : executed.length > 0
          ? `已执行：${executed.join('、')}（内容与旧值一致）`
          : '—';
    return {
      npc名字,
      更新摘要,
      更新前: before ? { 当前位置: before.当前位置, 当前外貌状态: before.当前外貌状态, 当前内心想法: before.当前内心想法, 在做事项: (before as any).在做事项 } : undefined,
      更新后: after ? { 当前位置: after.当前位置, 当前外貌状态: after.当前外貌状态, 当前内心想法: after.当前内心想法, 在做事项: (after as any).在做事项 } : undefined,
    };
  });

  const timeStr = formatHeartbeatTime(saveData);
  const record: HeartbeatRecord = {
    时间: timeStr,
    回合序号,
    触发方式: options.triggerMode,
    相关事件ID: options.event?.事件ID,
    更新列表: updateList,
    快照: snapshot,
  };

  if (心跳 && typeof 心跳 === 'object') {
    const hist = Array.isArray(心跳.历史) ? 心跳.历史 : [];
    if (!Array.isArray(心跳.历史)) (心跳 as any).历史 = hist;
    hist.push(record);
    const maxLen = Math.max(1, 心跳.历史条数 ?? 10);
    if (hist.length > maxLen) (心跳 as any).历史 = hist.slice(-maxLen);
    // 周期触发时记录「刚结束的回合」；事件/手动记录当前回合
    (心跳 as any).上次心跳回合序号 = options.triggerMode === '周期' ? Math.max(0, 回合序号 - 1) : 回合序号;
  }

  // 执行 NPC 维护（降级不活跃重点 NPC）
  runNpcMaintenance(saveData);

  return { saveData, record };
}

/**
 * 运行 NPC 维护任务：降级不活跃的重点 NPC、清理无效数据等。
 * 此操作不产生回溯记录，直接修改 saveData。
 */
export function runNpcMaintenance(saveData: SaveData): { demotedCount: number; demotedNames: string[] } {
  const anySave = saveData as any;
  const relationships = anySave.社交?.关系 as Record<string, NpcProfile> | undefined;
  if (!relationships) return { demotedCount: 0, demotedNames: [] };

  const config = (saveData as any).系统?.配置;
  const threshold = typeof config?.npcDemotionThreshold === 'number' ? config.npcDemotionThreshold : 5;
  const currentTurn = anySave.元数据?.回合序号 ?? 0;

  const demotedNames: string[] = [];

  for (const [name, npc] of Object.entries(relationships)) {
    // 缺省类型视为重点
    const type = npc.类型 || '重点';

    // 仅处理重点 NPC
    if (type !== '重点') continue;

    // 实时关注的 NPC 不降级
    if (npc.实时关注 === true) continue;

    const lastUpdate = npc.上次主回合更新回合;
    // 如果从未更新过（undefined），暂不降级，或者视为很久没更新？
    // 策略：新生成的 NPC 上次更新回合可能是 undefined，给予保护期？
    // 假设 undefined = 0，如果当前回合 < threshold 则不降级（开局保护）
    // 或者：只有明确有 lastUpdate 且超时的才降级。
    // 稳妥起见：if lastUpdate is undefined, do not demote yet (let them be active once).
    if (typeof lastUpdate !== 'number') continue;

    if (currentTurn - lastUpdate > threshold) {
      npc.类型 = '普通';
      demotedNames.push(name);
    }
  }

  if (demotedNames.length > 0) {
    console.log(`[NPC维护] 降级了 ${demotedNames.length} 个不活跃重点 NPC: ${demotedNames.join('、')}`);
  }

  return { demotedCount: demotedNames.length, demotedNames };
}
