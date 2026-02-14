import type { GameTime, GameEvent, SaveData, EventSystem } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';
import { isTavernEnv } from '@/utils/tavern';
import { TextProcessor } from './TextProcessor';
import { cloneDeep } from 'lodash';
import { useCharacterStore } from '@/stores/characterStore';
import { runSingleHeartbeat } from '@/services/worldHeartbeatService';

export class WorldEventManager {
  private static randomIntInclusive(min: number, max: number): number {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  private static compareGameTime(a: GameTime, b: GameTime): number {
    const fields: Array<keyof GameTime> = ['年', '月', '日', '小时', '分钟'];
    for (const f of fields) {
      const av = Number(a?.[f] ?? 0);
      const bv = Number(b?.[f] ?? 0);
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  }

  private static addYears(time: GameTime, years: number): GameTime {
    return { ...time, 年: Number(time.年 ?? 0) + years };
  }

  private static scheduleNextEventTime(now: GameTime, minYears: number, maxYears: number): GameTime {
    const years = this.randomIntInclusive(minYears, maxYears);
    return this.addYears(now, years);
  }

  private static normalizeEventConfig(config: any): { enabled: boolean; minYears: number; maxYears: number; customPrompt: string } {
    const enabled = config?.启用随机事件 !== false;
    const minYears = Math.max(1, Number(config?.最小间隔年 ?? 1));
    const maxYears = Math.max(minYears, Number(config?.最大间隔年 ?? 10));
    const customPrompt = String(config?.事件提示词 ?? '').trim();
    return { enabled, minYears, maxYears, customPrompt };
  }

  public static async maybeTriggerScheduledWorldEvent(args: {
    v3: any;
    stateForAI: any;
    shortTermMemoryForPrompt: string[];
  }): Promise<void> {
    const { v3, stateForAI, shortTermMemoryForPrompt } = args;

    const now: GameTime | null = v3?.元数据?.时间 ?? null;
    if (!now) return;

    const eventSystem = (v3?.社交?.事件 ?? null) as EventSystem | null;
    if (!eventSystem || typeof eventSystem !== 'object') return;

    const { enabled, minYears, maxYears, customPrompt } = this.normalizeEventConfig((eventSystem as any).配置);
    if (!enabled) return;

    const next = (eventSystem as any).下次事件时间 as GameTime | null;
    if (!next) {
      const scheduled = this.scheduleNextEventTime(now, minYears, maxYears);
      (eventSystem as any).下次事件时间 = scheduled;
      if (stateForAI?.社交?.事件) stateForAI.社交.事件.下次事件时间 = scheduled;
      const gameStateStore = useGameStateStore();
      if ((gameStateStore as any).eventSystem) {
        (gameStateStore as any).eventSystem.下次事件时间 = scheduled;
      }
      return;
    }

    if (this.compareGameTime(now, next) < 0) return;

    try {
      const { generateWorldEvent, generateSpecialNpcEvent } = await import('@/utils/generators/eventGenerators');
      const gameStateStore = useGameStateStore();

      // 酒馆端专属：随机触发“特殊NPC登场”事件（不会在网页端触发）
      let npcToAdd: any | null = null;
      let generated: { event: GameEvent; prompt_addition: string; npcProfile?: unknown } | null =
        isTavernEnv() && Math.random() < 0.2
          ? await generateSpecialNpcEvent({ saveData: v3 as SaveData, now, customPrompt })
          : null;

      if (generated && (generated as any).npcProfile) {
        npcToAdd = (generated as any).npcProfile;
      } else {
        generated = await generateWorldEvent({ saveData: v3 as SaveData, now, customPrompt });
      }
      const scheduled = this.scheduleNextEventTime(now, minYears, maxYears);

      if (!generated) {
        (eventSystem as any).下次事件时间 = scheduled;
        if (stateForAI?.社交?.事件) stateForAI.社交.事件.下次事件时间 = scheduled;
        if ((gameStateStore as any).eventSystem) {
          (gameStateStore as any).eventSystem.下次事件时间 = scheduled;
        }
        return;
      }

      // 若本次事件引入了特殊NPC，则写入人物关系（同时更新 stateForAI 与 store，保证提示词/存档同步）
      if (npcToAdd && npcToAdd.名字) {
        // 确保新 NPC 有 关系 字段（用于 游戏变量 / 人物关系->原始数据 展示）
        (npcToAdd as any).关系 = (npcToAdd as any).关系 && typeof (npcToAdd as any).关系 === 'object' ? (npcToAdd as any).关系 : {};
        // v3 写入（用于后续提示词 stateForAI 继续携带）
        if (!v3.社交) v3.社交 = {};
        if (!v3.社交.关系 || typeof v3.社交.关系 !== 'object') v3.社交.关系 = {};
        if (!v3.社交.关系[npcToAdd.名字]) {
          v3.社交.关系[npcToAdd.名字] = npcToAdd;
        }

        if (stateForAI?.社交) {
          if (!stateForAI.社交.关系 || typeof stateForAI.社交.关系 !== 'object') stateForAI.社交.关系 = {};
          if (!stateForAI.社交.关系[npcToAdd.名字]) {
            stateForAI.社交.关系[npcToAdd.名字] = npcToAdd;
          }
        }

        const current = (gameStateStore.relationships && typeof gameStateStore.relationships === 'object')
          ? gameStateStore.relationships
          : {};
        if (!current[npcToAdd.名字]) {
          gameStateStore.updateState('relationships', { ...current, [npcToAdd.名字]: npcToAdd });
        }
      }

      const event: GameEvent = { ...generated.event, 发生时间: now, 事件来源: generated.event.事件来源 || '随机' };

      if (!Array.isArray((eventSystem as any).事件记录)) (eventSystem as any).事件记录 = [];
      (eventSystem as any).事件记录.push(event);
      (eventSystem as any).下次事件时间 = scheduled;

      if (stateForAI?.社交?.事件) {
        if (!Array.isArray(stateForAI.社交.事件.事件记录)) stateForAI.社交.事件.事件记录 = [];
        stateForAI.社交.事件.事件记录.push(event);
        stateForAI.社交.事件.下次事件时间 = scheduled;
      }

      if ((gameStateStore as any).eventSystem) {
        const storeEventSystem = (gameStateStore as any).eventSystem as any;
        if (!Array.isArray(storeEventSystem.事件记录)) storeEventSystem.事件记录 = [];
        storeEventSystem.事件记录.push(event);
        storeEventSystem.下次事件时间 = scheduled;
      }

      // 把事件文本写入“短期记忆”，并作为本回合注入文本，保证主游戏流程可承接“刚刚发生”的事件
      const memoryEntry = `${TextProcessor.formatGameTime(now)}【世界事件】${generated.prompt_addition}`;
      shortTermMemoryForPrompt.push(memoryEntry);

      // 同步落盘：将事件快照写入存档短期记忆（否则下回合不会带上这段“刚刚发生”的承接文本）
      if (!v3.社交) v3.社交 = {};
      if (!v3.社交.记忆 || typeof v3.社交.记忆 !== 'object') v3.社交.记忆 = { 短期记忆: [], 中期记忆: [], 长期记忆: [] };
      if (!Array.isArray(v3.社交.记忆.短期记忆)) v3.社交.记忆.短期记忆 = [];
      v3.社交.记忆.短期记忆.push(memoryEntry);

      if (gameStateStore.memory && typeof gameStateStore.memory === 'object') {
        const nextMemory = cloneDeep(gameStateStore.memory) as any;
        if (!Array.isArray(nextMemory.短期记忆)) nextMemory.短期记忆 = [];
        nextMemory.短期记忆.push(memoryEntry);
        gameStateStore.updateState('memory', nextMemory);
      }

      // [MING] 世界事件发生后若启用心跳，执行一次事件驱动心跳
      const 心跳 = (v3 as any).世界?.状态?.心跳;
      if (心跳 && typeof 心跳 === 'object' && 心跳.启用 === true) {
        try {
          await runSingleHeartbeat(v3 as SaveData, { triggerMode: '事件', event });
        } catch (heartbeatErr) {
          console.warn('[世界事件] 事件驱动心跳失败:', heartbeatErr);
        }
      }

      // 酒馆端：若触发了“特殊NPC登场”，立刻存档一次，确保人物关系与事件快照不丢失
      if (npcToAdd && npcToAdd.名字 && isTavernEnv()) {
        try {
          const characterStore = useCharacterStore();
          await characterStore.saveCurrentGame();
        } catch (e) {
          console.warn('[世界事件] 特殊NPC触发后自动存档失败:', e);
        }
      }
    } catch (e) {
      console.warn('[世界事件] 调度/生成失败:', e);
    }
  }
}
