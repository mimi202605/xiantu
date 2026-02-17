/**
 * AIBidirectionalSystem
 * 核心功能：
 * 1. 接收用户输入，构建Prompt，调用AI生成响应
 * 2. 解析AI响应，执行AI返回的指令
 * 3. 更新并返回游戏状态
 */
import { set, get, unset, cloneDeep } from 'lodash';
import { getTavernHelper, isTavernEnv } from '@/utils/tavern';
import { toast } from './toast';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useCharacterStore } from '@/stores/characterStore'; // 导入角色商店
import { useUIStore } from '@/stores/uiStore';
import type { GM_Response } from '@/types/AIGameMaster';
import type { CharacterProfile, StateChangeLog, SaveData, GameTime, StateChange, GameMessage, StatusEffect, EventSystem, GameEvent } from '@/types/game';
// [MING] Removed mastered skills calculator
// import { updateMasteredSkills } from './masteredSkillsCalculator';
import { assembleSystemPrompt } from './prompts/promptAssembler';
import { usePromptAssemblyStore } from '@/stores/promptAssemblyStore';

// [MING] Stub for removed mastered skills calculator
function updateMasteredSkills(_store: any): void { /* no-op */ }
import { getPrompt } from '@/services/defaultPrompts';
import { normalizeGameTime } from './time';
import { updateStatusEffects } from './statusEffectManager';
import { sanitizeAITextForDisplay } from '@/utils/textSanitizer';
import { validateAndRepairNpcProfile } from '@/utils/dataValidation';
import { stripNsfwContentMing } from '@/utils/prompts/definitions/ming/dataDefinitionsMing';
import { isSaveDataV3, migrateSaveDataToLatest } from './saveMigration';
import { mergeInto扩展 } from '@/services/gameStateIndexer';
import { retrieve as memoryRetrieve } from '@/services/memoryRetrievalService';
import { getNpcsAtLocation, onPlayerLeaveLocation, appendNpcsToLocation, findLocationInTree, calibrateNpcLocationSync } from '@/utils/locationUtils';
import { buildLocationNpcGenerationPrompt } from '@/utils/prompts/tasks/locationNpcGenerationPromptsMing';
import { getMidTermContent, formatMidTermEntryForPrompt } from '@/utils/memoryHelpers';
import { aiService } from '@/services/aiService';
import {
  appendEngramEvents,
  buildEntitiesFromEvents,
  buildEventsFromResponse,
  buildRelationsFromEvents,
  embedTexts,
  loadEngramConfigFromStorage,
  mergeEntityVectors,
  loadEngramVectorStore,
  mergeEventVectors,
  readEngramMemoryFromSaveData,
  saveEngramVectorStore,
  trimEngramMemory,
  unifiedRetrieve,
  upsertEngramEntities,
  upsertEngramRelations,
  writeEngramMemoryToSaveData,
} from '@/services/engram';
import type { LocationEntry, NpcProfile, ImplicitMidTermEntry } from '@/types/game';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergePlainObjectsReplacingArrays(base: PlainObject, patch: PlainObject): PlainObject {
  const merged = cloneDeep(base) as PlainObject;
  applyPlainObjectPatchReplacingArrays(merged, patch);
  return merged;
}

function applyPlainObjectPatchReplacingArrays(target: PlainObject, patch: PlainObject): void {
  for (const [key, patchValue] of Object.entries(patch)) {
    const targetValue = (target as any)[key];
    if (isPlainObject(targetValue) && isPlainObject(patchValue)) {
      applyPlainObjectPatchReplacingArrays(targetValue, patchValue);
      continue;
    }
    (target as any)[key] = cloneDeep(patchValue);
  }
}

export interface ProcessOptions {
  onStreamChunk?: (chunk: string) => void;
  onStreamComplete?: () => void;
  onProgressUpdate?: (progress: string) => void;
  onStateChange?: (newState: PlainObject) => void;
  useStreaming?: boolean;
  generateMode?: 'generate' | 'generateRaw'; // 生成模式：generate（标准）或 generateRaw（纯净）
  splitResponseGeneration?: boolean;
  shouldAbort?: () => boolean;
}

/**
 * 记忆总结选项
 */
export interface MemorySummaryOptions {
  /**
   * 是否使用Raw模式（默认true）
   *
   * **Raw模式 vs 标准模式：**
   * - ✅ Raw模式（推荐用于总结）：
   *   - 只发送总结提示词，不包含角色卡、世界观等预设
   *   - 不受其他提示词干扰，更符合真实内容
   *   - 适用场景：记忆总结、NPC总结、纯文本提取
   *
   * - ⚠️ 标准模式（容易污染）：
   *   - 包含完整的系统提示词（角色卡、世界观、规则等）
   *   - 容易受到预设提示词污染，可能偏离原始内容
   *   - 适用场景：正常游戏对话、需要遵守世界观的生成
   */
  useRawMode?: boolean;

  /**
   * 是否使用流式传输（默认false）
   *
   * **流式 vs 非流式：**
   * - ⚡ 流式传输（更快）：
   *   - 实时显示生成过程，用户体验更好
   *   - 响应更快，无需等待完整生成
   *   - 适用场景：长文本生成、需要实时反馈的场景
   *
   * - 🛡️ 非流式传输（更稳定，推荐用于总结）：
   *   - 一次性返回完整结果，更稳定可靠
   *   - 避免流式传输可能的中断问题
   *   - 适用场景：后台任务、自动总结、批量处理
   */
  useStreaming?: boolean;
}

class AIBidirectionalSystemClass {
  private static instance: AIBidirectionalSystemClass | null = null;
  private stateHistory: StateChangeLog[] = [];
  private isSummarizing = false; // 防止并发长期总结
  private isRefining = false; // 防止并发中期精炼

  private compareGameTime(a: GameTime, b: GameTime): number {
    const fields: Array<keyof GameTime> = ['年', '月', '日', '小时', '分钟'];
    for (const f of fields) {
      const av = Number(a?.[f] ?? 0);
      const bv = Number(b?.[f] ?? 0);
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  }

  private addYears(time: GameTime, years: number): GameTime {
    return { ...time, 年: Number(time.年 ?? 0) + years };
  }

  private randomIntInclusive(min: number, max: number): number {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  private normalizeEventConfig(config: any): { enabled: boolean; minYears: number; maxYears: number; customPrompt: string } {
    const enabled = config?.启用随机事件 !== false;
    const minYears = Math.max(1, Number(config?.最小间隔年 ?? 1));
    const maxYears = Math.max(minYears, Number(config?.最大间隔年 ?? 10));
    const customPrompt = String(config?.事件提示词 ?? '').trim();
    return { enabled, minYears, maxYears, customPrompt };
  }

  private scheduleNextEventTime(now: GameTime, minYears: number, maxYears: number): GameTime {
    const years = this.randomIntInclusive(minYears, maxYears);
    return this.addYears(now, years);
  }

  private async maybeTriggerScheduledWorldEvent(args: {
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
      const memoryEntry = `${this._formatGameTime(now)}【世界事件】${generated.prompt_addition}`;
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
          const { runSingleHeartbeat } = await import('@/services/worldHeartbeatService');
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

  private extractNarrativeText(raw: string): string {
    // 🔥 移除思维链标签（兜底保护）
    // 支持多种变体：<thinking>, <antThinking>, <ant-thinking>, <reasoning>, <thought> 等
    const cleaned = String(raw || '')
      .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<\/?reasoning>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<\/?thought>/gi, '')
      .trim();

    if (!cleaned) return '';

    // 如果是JSON格式，提取text字段
    if (cleaned.startsWith('{') || cleaned.includes('```')) {
      try {
        const parsed = this.parseAIResponse(cleaned);
        return parsed?.text?.trim() || '';
      } catch {
        // JSON解析失败，尝试提取代码块
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (codeBlockMatch?.[1]) {
          try {
            const obj = JSON.parse(codeBlockMatch[1].trim()) as Record<string, unknown>;
            return String(obj.text || obj.叙事文本 || obj.narrative || '').trim();
          } catch {
            // 代码块内容本身就是文本
            return codeBlockMatch[1].trim();
          }
        }
      }
    }

    return cleaned;
  }

  private sanitizeActionOptionsForDisplay(options: unknown): string[] {
    if (!Array.isArray(options)) return [];
    return options
      .filter((opt) => typeof opt === 'string')
      .map((opt) => sanitizeAITextForDisplay(opt).trim())
      .filter((opt) => opt.length > 0);
  }

  /**
   * 文本优化：调用AI对生成的文本进行润色
   * @param text 原始文本
   * @param onProgressUpdate 进度回调
   * @returns 优化后的文本，失败时返回原文本
   */
  private async optimizeText(
    text: string,
    onProgressUpdate?: (progress: string) => void
  ): Promise<string> {
    // 检查功能是否启用
    const { useAPIManagementStore } = await import('@/stores/apiManagementStore');
    const apiStore = useAPIManagementStore();

    if (!apiStore.isFunctionEnabled('text_optimization')) {
      return text;
    }

    // 检查是否有可用的API配置
    const apiConfig = apiStore.getAPIForType('text_optimization');
    if (!apiConfig) {
      console.warn('[文本优化] 未配置text_optimization API，跳过优化');
      return text;
    }

    onProgressUpdate?.('正在优化文本…');

    try {
      const textOptPrompt = await getPrompt('textOptimization');

      const optimizedText = await aiService.generateRaw({
        ordered_prompts: [
          { role: 'system', content: textOptPrompt },
          { role: 'user', content: `请优化以下文本：\n\n${text}` }
        ],
        should_stream: false,
        generation_id: `text_optimization_${Date.now()}`,
        usageType: 'text_optimization',
      });

      const result = String(optimizedText).trim();
      if (result && result.length > 0) {
        console.log('[文本优化] 优化完成，原长度:', text.length, '新长度:', result.length);
        return result;
      }

      console.warn('[文本优化] 优化结果为空，使用原文本');
      return text;
    } catch (error) {
      console.error('[文本优化] 优化失败:', error);
      return text;
    }
  }

  private constructor() {}

  public static getInstance(): AIBidirectionalSystemClass {
    if (!this.instance) this.instance = new AIBidirectionalSystemClass();
    return this.instance;
  }

  /**
   * 处理玩家行动 - 简化版流程
   * 1. 调用AI生成响应
   * 2. 执行指令
   * 3. 返回结果
   */
  public async processPlayerAction(
    userMessage: string,
    character: CharacterProfile,
    options?: ProcessOptions & { generation_id?: string }
  ): Promise<GM_Response | null> {
    console.log('[AI双向系统] processPlayerAction 接收到的options:', {
      hasOnStreamChunk: !!options?.onStreamChunk,
      useStreaming: options?.useStreaming,
      splitResponseGeneration: options?.splitResponseGeneration
    });
    const gameStateStore = useGameStateStore();
    const characterStore = useCharacterStore();
    const tavernHelper = getTavernHelper();
    const uiStore = useUIStore();
    const shouldAbort = () => options?.shouldAbort?.() ?? false;

    // 检查AI服务可用性（酒馆或自定义API）
    if (!tavernHelper) {
      const availability = aiService.checkAvailability();
      if (!availability.available) {
        throw new Error(availability.message);
      }
    }

    // 生成唯一的generation_id，如果未提供
    const generationId = options?.generation_id || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. 获取当前存档数据
    options?.onProgressUpdate?.('获取存档数据…');
    const saveData = gameStateStore.toSaveData();
    if (!saveData) {
      // 🔥 特殊处理联机模式：检查是否是联机模式导致的数据不完整
      const onlineState = gameStateStore.onlineState as any;
      if (onlineState?.模式 === '联机') {
        // 联机模式下数据不完整,给出更详细的错误信息
        console.error('[AI双向系统-联机模式] 游戏数据不完整，无法进行AI推演');
        console.error('[AI双向系统-联机模式] 请确保：');
        console.error('  1. 已经成功穿越到目标世界');
        console.error('  2. 角色数据已正确加载');
        console.error('  3. 世界数据已从服务器同步');
        throw new Error('联机模式下游戏数据不完整，无法进行AI推演。请返回主世界或重新穿越。');
      }
      throw new Error('无法获取存档数据，请确保角色已加载');
    }

    // 2. 准备AI上下文
    options?.onProgressUpdate?.('构建提示词并请求AI生成…');
    let gmResponse: GM_Response = { text: '', mid_term_memory: '', tavern_commands: [], action_options: [] };
    try {
      const v3 = isSaveDataV3(saveData) ? (saveData as any) : migrateSaveDataToLatest(saveData).migrated;

      // 发送给 AI 的状态：严格使用 V3 五域结构（命令 key 也必须按此结构输出）
      const stateForAI = cloneDeep(v3);
      if (stateForAI.社交?.记忆) {
        // 移除短期和隐式中期记忆，以优化AI上下文（短期记忆单独发送）
        delete stateForAI.社交.记忆.短期记忆;
        delete stateForAI.社交.记忆.隐式中期记忆;
      }
      // 移除叙事历史，避免与短期记忆重复/爆token
      if (stateForAI.系统?.历史?.叙事) {
        delete stateForAI.系统.历史.叙事;
      }

      // [MING] 移除世界心跳数据（含历史快照），避免 prompt 爆炸
      if (stateForAI.世界?.状态?.心跳) {
        delete stateForAI.世界.状态.心跳;
      }

      // [MING] 向量记忆已移除 - 使用简化的全量记忆模式
      // eslint-disable-next-line prefer-const
      let vectorMemorySection = '';
      // Vector memory service removed in Ming version - using standard memory only

      // [MING] 语义记忆按关联 NPC 与重要程度发送：收集关联 NPC 的 key 与名字，便于与 triple 的 subject/object 匹配
      const playerLocDesc = (stateForAI.角色?.位置 as any)?.描述;
      const 关系 = stateForAI.社交?.关系 || {};
      const importantNpcIdentifiers: string[] = [];
      for (const [k, npc] of Object.entries(关系)) {
        if ((npc as any)?.类型 === '普通') continue;
        importantNpcIdentifiers.push(k);
        const 名字 = (npc as any)?.名字;
        if (名字 && typeof 名字 === 'string' && 名字.trim() && 名字 !== k) importantNpcIdentifiers.push(名字.trim());
      }
      const npcsAtLocation = getNpcsAtLocation(stateForAI as Record<string, unknown>, playerLocDesc);
      const recentNpcNames = [...new Set([...importantNpcIdentifiers, ...npcsAtLocation])].slice(0, 20);

      const engramConfig = loadEngramConfigFromStorage();
      const retrievalMode: 'legacy' | 'hybrid' =
        engramConfig.enabled && engramConfig.retrievalMode === 'hybrid' ? 'hybrid' : 'legacy';
      const activeSave = characterStore.rootState?.当前激活存档;
      const vectorContext =
        activeSave?.角色ID && activeSave?.存档槽位
          ? {
              characterId: activeSave.角色ID,
              slotId: activeSave.存档槽位,
            }
          : undefined;
      let retrievalBlock = '';
      let hybridRetrievalStats: Record<string, unknown> | null = null;
      try {
        if (retrievalMode === 'hybrid') {
          const { useAPIManagementStore } = await import('@/stores/apiManagementStore');
          const apiStore = useAPIManagementStore();
          const rerankApi = apiStore.getAPIForType('rerank');
          const rerankEndpointUrl = apiStore.getRerankEndpointUrl()?.trim() || undefined;
          const rerankModel = rerankApi?.model?.trim() || undefined;
          const unified = await unifiedRetrieve({
            saveData: stateForAI as Record<string, unknown>,
            userInput: userMessage,
            playerName: (stateForAI.角色?.身份 as any)?.名字,
            locationDesc: playerLocDesc,
            recentNpcNames,
            maxTokens: 550,
            maxLines: 35,
            engramConfig,
            vectorContext,
            rerankEndpointUrl,
            rerankModel,
          });
          retrievalBlock = unified.block;
          hybridRetrievalStats = unified.stats as unknown as Record<string, unknown>;
          if (engramConfig.debug) {
            console.log('[Engram][Hybrid][Stats]', unified.stats);
          }
        } else {
          retrievalBlock = memoryRetrieve(stateForAI as Record<string, unknown>, {
            playerName: (stateForAI.角色?.身份 as any)?.名字,
            locationDesc: playerLocDesc,
            recentNpcNames,
            maxLines: 35,
          });
        }
      } catch (e) {
        console.warn('[AI双向系统] 语义记忆检索失败:', e);
      }

      // 不注入隐式中期记忆：与短期记忆重叠，AI 仅接收 短期记忆(5条) + 中期记忆 + 长期记忆，避免重复

      if (retrievalMode === 'legacy' && npcsAtLocation.length > 0) {
        const npcSummaries = npcsAtLocation
          .map((name) => {
            const npc = (stateForAI.社交?.关系 as any)?.[name];
            if (!npc) return null;
            return `- ${name}：${npc.与玩家关系 || '路人'}，${npc.当前外貌状态 || ''}`;
          })
          .filter((s): s is string => s != null);
        if (npcSummaries.length > 0) {
          retrievalBlock += `\n# 当前地点人物\n${npcSummaries.join('\n')}`;
        }
      }

      // 保存短期记忆用于单独发送
      const shortTermMemory = v3?.社交?.记忆?.短期记忆 || [];

      // --- 角色核心状态速览 ---
      const attributes = stateForAI.角色?.属性;
      const character = stateForAI.角色?.身份;
      const formatTalentsForPrompt = (talents: any): string => {
        if (!talents) return '无';
        if (typeof talents === 'string') return talents;
        if (Array.isArray(talents)) {
          return talents.map(t => {
            if (typeof t === 'string') return t;
            if (typeof t === 'object' && t !== null) {
              return t.name || t.名称 || '';
            }
            return '';
          }).filter(Boolean).join(', ') || '无';
        }
        return '未知格式';
      };

      let coreStatusSummary = '# 角色核心状态速览\n';
      if (attributes) {
        const hp = attributes.体力 ?? attributes.气血;
        const mp = attributes.精力 ?? attributes.灵气;
        coreStatusSummary += `\n- 生命: 体力${hp?.当前}/${hp?.上限} 精力${mp?.当前}/${mp?.上限} 寿元${attributes.寿命?.当前}/${attributes.寿命?.上限}`;
        const insight = attributes.洞察力 ?? attributes.神识;
        if (insight?.当前 != null) coreStatusSummary += ` 洞察力${insight.当前}/${insight.上限}`;

        const realm = attributes.地位 ?? attributes.境界;
        if (realm) {
          coreStatusSummary += `\n- 地位: ${realm.名称}-${realm.阶段} (${realm.当前进度}/${realm.下一级所需})`;
        }

        if (attributes.声望) {
          coreStatusSummary += `\n- 声望: ${attributes.声望}`;
        }

        const effects = (stateForAI.角色?.效果 ?? []) as StatusEffect[];
        if (Array.isArray(effects) && effects.length > 0) {
          coreStatusSummary += `\n- 效果: ${effects
            .filter((e: StatusEffect) => e && typeof e === 'object' && e.状态名称)
            .map((e: StatusEffect) => e.状态名称)
            .join(', ')}`;
        }
      }
      if (character?.天赋) {
        coreStatusSummary += `\n- 天赋: ${formatTalentsForPrompt(character.天赋)}`;
      }

      // 🍀 前端计算幸运点（基于气运和随机数，AI不知道具体骰子点数）
      const innate = (character?.先天六维属性 ?? character?.先天六司) || {};
      const acquired = (character?.后天六维属性 ?? character?.后天六司) || {};
      // 气运范围 0-10，先天+后天
      const fortune = Math.min(10, Math.max(0, (innate.气运 || 5) + (acquired.气运 || 0)));

      // 幸运点计算逻辑（气运 0-10）
      // 设计目标：
      // - 气运 0：范围 -10 到 +5，期望值约 -2.5
      // - 气运 5：范围 -8 到 +10，期望值约 +1
      // - 气运 10：范围 -5 到 +15，期望值约 +5

      // 基础随机：-10 到 +5 的波动（15个档位）
      const baseRandom = Math.floor(Math.random() * 16) - 10;

      // 气运提升上限：每点气运增加 1 点上限
      const fortuneUpperBonus = Math.floor(Math.random() * (fortune + 1));

      // 气运减少下限惩罚：每点气运减少 0.5 点下限惩罚（向上取整）
      const fortuneLowerBonus = Math.ceil(fortune * 0.5);

      // 最终幸运点 = 基础随机 + 气运上限加成 + 气运下限保护
      const luckyPoints = baseRandom + fortuneUpperBonus + fortuneLowerBonus;

      // 计算灵气浓度的环境修正（如果有位置信息）
      const currentLocation = stateForAI.角色?.位置;
      const spiritDensity = currentLocation?.灵气浓度 || 50; // 默认50

      // 🔥 结构化判定数据（直接传给AI使用，无需AI自己计算）
      const judgmentData = {
        幸运点: luckyPoints,
        气运值: fortune,
        环境: {
          灵气浓度: spiritDensity,
          修炼修正: Math.round((spiritDensity - 50) / 10),  // 修炼突破用
          炼制修正: Math.round((spiritDensity - 50) / 15),  // 炼丹炼器用
          战斗修正: Math.round((spiritDensity - 50) / 20)   // 战斗用
        }
      };

      coreStatusSummary += `\n\n# 本回合判定数据（前端已计算）
**幸运点**: ${luckyPoints >= 0 ? '+' : ''}${luckyPoints}
**环境修正**:
  - 灵气浓度: ${spiritDensity}
  - 修炼/突破: ${judgmentData.环境.修炼修正 >= 0 ? '+' : ''}${judgmentData.环境.修炼修正}
  - 炼丹/炼器: ${judgmentData.环境.炼制修正 >= 0 ? '+' : ''}${judgmentData.环境.炼制修正}
  - 战斗施法: ${judgmentData.环境.战斗修正 >= 0 ? '+' : ''}${judgmentData.环境.战斗修正}

⚠️ **重要**：判定时直接使用以上数值，不要自己计算！
- 幸运点固定为: ${luckyPoints >= 0 ? '+' : ''}${luckyPoints}
- 环境修正根据判定类型选择对应的值`;
      // --- 结束 ---

      // 世界背景/世界描述/世界观 在存档中常为同源内容，API 只需发送一份，其余用引用避免重复
      const WORLD_DESCRIPTION_REF = '（世界观与背景描述见本段 世界.信息.世界背景）';
      const normalizeWorldForPrompt = (世界: unknown): unknown => {
        if (!世界 || typeof 世界 !== 'object') return 世界;
        const cloned = cloneDeep(世界) as Record<string, unknown>;
        const 信息 = cloned.信息 as Record<string, unknown> | undefined;
        if (信息 && typeof 信息 === 'object') {
          const 信息Copy = { ...信息 };
          // 统一只保留 世界背景 作为正文，避免 世界描述/世界观 重复发送相同内容
          if ('世界背景' in 信息Copy || '世界描述' in 信息Copy || '世界观' in 信息Copy) {
            信息Copy.世界描述 = WORLD_DESCRIPTION_REF;
            信息Copy.世界观 = WORLD_DESCRIPTION_REF;
          }
          cloned.信息 = 信息Copy;
        }
        return cloned;
      };

      // 角色.身份.世界 来自创角所选世界，其 description 与 世界.信息.世界背景 同源，发 API 时只保留引用
      const normalizeIdentityForPrompt = (身份: unknown): unknown => {
        if (!身份 || typeof 身份 !== 'object') return 身份;
        const cloned = cloneDeep(身份) as Record<string, unknown>;
        const 世界 = cloned.世界 as Record<string, unknown> | undefined;
        if (世界 && typeof 世界 === 'object' && ('description' in 世界 || '描述' in 世界)) {
          cloned.世界 = { ...世界, description: WORLD_DESCRIPTION_REF, 描述: WORLD_DESCRIPTION_REF };
        }
        return cloned;
      };

      // 🔥 构建精简版存档数据（用于叙事判定，减少token消耗）
      // 无论单步还是分步模式，都使用精简版存档
      const buildNarrativeState = (): Record<string, unknown> => {
        // 过滤 NPC：仅保留 重点NPC、实时关注NPC 或 当前位置NPC
        const filterRelationships = (relationships: Record<string, NpcProfile> | undefined) => {
          if (!relationships) return {};
          const filtered: Record<string, NpcProfile> = {};
          const playerLocationDesc = stateForAI.角色?.位置?.描述;

          for (const [name, npc] of Object.entries(relationships)) {
             // 缺省视为重点
            const type = npc.类型 || '重点';
            const isImportant = type === '重点';
            const isTracked = npc.实时关注 === true;
            const isLocal = npc.当前位置?.描述 === playerLocationDesc;

            if (isImportant || isTracked || isLocal) {
              filtered[name] = npc;
            }
          }
          return filtered;
        };

        return {
          元数据: { 时间: stateForAI.元数据?.时间 },
          角色: {
            身份: normalizeIdentityForPrompt(stateForAI.角色?.身份),
            属性: stateForAI.角色?.属性,
            位置: stateForAI.角色?.位置,
            效果: stateForAI.角色?.效果,
            身体: stateForAI.角色?.身体,
            背包: stateForAI.角色?.背包,
            // 装备/功法/修炼/技能 已退役，不再注入叙事判定
          },
          社交: {
            关系: filterRelationships(stateForAI.社交?.关系),
            任务: stateForAI.社交?.任务,
            事件: stateForAI.社交?.事件,
            记忆: {
              中期记忆: (stateForAI.社交?.记忆?.中期记忆 || []).map(formatMidTermEntryForPrompt),
              长期记忆: stateForAI.社交?.记忆?.长期记忆,
            },
          },
          世界: normalizeWorldForPrompt(stateForAI.世界),
        };
      };

      const stateJsonString = JSON.stringify(buildNarrativeState());

      const activePrompts: string[] = [];
      if (uiStore.enableActionOptions) {
        activePrompts.push('actionOptions');
      }

      // 🔥 世界事件规则始终注入（用于“世界会变化”的叙事一致性）
      activePrompts.push('eventSystem');

      // 🔥 固定随机事件：若已到触发时间，则先生成"刚刚发生"的事件并注入短期记忆
      const shortTermMemoryForPrompt = Array.isArray(shortTermMemory) ? [...shortTermMemory] : [];
      await this.maybeTriggerScheduledWorldEvent({ v3, stateForAI, shortTermMemoryForPrompt });

      const assemblyModules: Array<{ key: string; 构成: string; 生成原因: string; content: string }> = [];
      const shouldRecordAssembly = uiStore.debugMode;
      const assembledPrompt = await assembleSystemPrompt(
        activePrompts,
        uiStore.actionOptionsPrompt,
        stateForAI,
        shouldRecordAssembly ? { onSection: (m) => assemblyModules.push(m) } : undefined
      );

      // 🌐 构建穿越状态提示（直接写入主提示词，确保AI一定能看到）
      const onlineState = stateForAI?.系统?.联机;
      const travelTargetForPrompt = onlineState?.穿越目标;
      let travelStatusPrompt = '';
      if (onlineState?.模式 === '联机' && onlineState?.房间ID) {
        const ownerName = travelTargetForPrompt?.主人用户名 || '世界主人';
        const worldName = stateForAI?.世界?.信息?.世界名称 || '异世界';
        const ownerProfile = travelTargetForPrompt?.世界主人档案;
        const ownerCharName = ownerProfile?.名字 || ownerName;
        const playerLocation = stateForAI?.角色?.位置;
        const ownerLocation = travelTargetForPrompt?.世界主人位置;
        const offlinePrompt = travelTargetForPrompt?.离线代理提示词;

        // 构建世界主人详细信息
        let ownerDetailInfo = `- 名字：${ownerCharName}`;
        const ownerRealm = ownerProfile?.地位 ?? ownerProfile?.境界;
        if (ownerRealm) ownerDetailInfo += `\n- 地位：${typeof ownerRealm === 'object' ? (ownerRealm as any).名称 : ownerRealm}`;
        if (ownerProfile?.门派) ownerDetailInfo += `\n- 门派：${ownerProfile.门派}`;
        if (ownerProfile?.性别) ownerDetailInfo += `\n- 性别：${ownerProfile.性别}`;
        if (ownerProfile?.种族) ownerDetailInfo += `\n- 种族：${ownerProfile.种族}`;
        const ownerHp = ownerProfile?.体力 ?? ownerProfile?.气血;
        const ownerMp = ownerProfile?.精力 ?? ownerProfile?.灵气;
        if (ownerHp) ownerDetailInfo += `\n- 体力：${JSON.stringify(ownerHp)}`;
        if (ownerMp) ownerDetailInfo += `\n- 精力：${JSON.stringify(ownerMp)}`;
        const ownerInsight = ownerProfile?.洞察力 ?? ownerProfile?.神识;
        if (ownerInsight) ownerDetailInfo += `\n- 洞察力：${JSON.stringify(ownerInsight)}`;
        if (ownerLocation) {
          const ox = ownerLocation.x ?? ownerLocation.坐标?.x;
          const oy = ownerLocation.y ?? ownerLocation.坐标?.y;
          if (ox != null && oy != null) {
            ownerDetailInfo += `\n- 位置坐标：(${ox}, ${oy})`;
          }
          if (ownerLocation.描述) ownerDetailInfo += `\n- 位置描述：${ownerLocation.描述}`;
        }

        travelStatusPrompt = `
# ⚠️⚠️⚠️ 【极重要：联机穿越状态 - 必读】⚠️⚠️⚠️

## 当前状态
玩家已经**穿越时空**，来到了「${ownerName}」的世界「${worldName}」。
这是一个**完全陌生的异世界**，不是玩家原来的世界！

## 世界主人详细信息（用于AI代理）
${ownerDetailInfo}
${offlinePrompt ? `\n### 世界主人性格/行为提示词\n${offlinePrompt}` : ''}

## 玩家当前位置
- 位置描述：${playerLocation?.描述 || '未知'}
- 坐标：(${playerLocation?.x ?? '未知'}, ${playerLocation?.y ?? '未知'})

## 🎯 世界主人是真实存在的角色（极重要！）
世界主人「${ownerCharName}」是这个世界中**真实存在的修士/角色**，玩家可以：
- **寻找世界主人**：根据上述位置信息，玩家可以前往寻找
- **与世界主人互动**：对话、切磋、交易、结交等
- **遭遇世界主人**：在世界主人所在位置附近活动时可能偶遇

## AI代理规则（当玩家遇到或寻找世界主人时）
你需要**代理扮演**世界主人「${ownerCharName}」这个角色：
- 使用世界主人的属性值进行战斗/切磋判定
- 根据性格提示词决定世界主人的行为和态度
- 世界主人对入侵者（玩家）的态度取决于性格，可能友好、中立或敌对
- 世界主人有自己的日常活动（修炼、巡视、采药等），不会一直待在原地

## 核心规则（必须遵守）
1. **所有NPC都不认识玩家** - 玩家是外来者
2. **不要使用原世界的任何设定** - 当前世界信息已完全切换
3. **NPC初始态度**：警惕/好奇/中立（取决于NPC性格）
4. **描述要体现陌生感** - 玩家对这个世界一无所知
5. **世界主人可被找到** - 玩家想寻找世界主人时，引导其前往世界主人位置
`;
      }

      const systemPrompt = `
${assembledPrompt}
${travelStatusPrompt}
${coreStatusSummary}
${vectorMemorySection ? `\n${vectorMemorySection}\n` : ''}
${retrievalBlock ? `\n# 统一记忆检索\n${retrievalBlock}\n` : ''}
# 游戏状态
你正在修仙世界《仙途》中扮演GM。以下是当前完整游戏存档(JSON格式):
${stateJsonString}
`.trim();

      // 调试可视化：记录完整 system 提示词、提示词模组、数据模组（含游戏状态/语义记忆等）、以及 assistant 短期记忆
      if (shouldRecordAssembly && assemblyModules.length > 0) {
        const promptAssemblyStore = usePromptAssemblyStore();
        const dataModules: Array<{ key: string; 构成: string; 生成原因: string; flow引用: string; content: string }> = [
          { key: 'coreStatusSummary', 构成: '角色核心状态速览', 生成原因: '上下文', flow引用: '主回合', content: coreStatusSummary },
          { key: 'semanticAndEntities', 构成: `统一记忆检索(${retrievalMode})`, 生成原因: '按关联NPC与重要程度', flow引用: '主回合', content: retrievalBlock || '(空)' },
          { key: 'stateJson', 构成: '游戏状态JSON（含中期记忆、长期记忆）', 生成原因: '完整存档', flow引用: '主回合', content: stateJsonString }
        ];
        if (engramConfig.debug && hybridRetrievalStats) {
          dataModules.push({
            key: 'engramHybridStats',
            构成: 'Engram Hybrid 检索统计',
            生成原因: '调试',
            flow引用: '主回合',
            content: JSON.stringify(hybridRetrievalStats, null, 2),
          });
        }
        if (travelStatusPrompt) {
          dataModules.push({ key: 'travelStatus', 构成: '联机穿越状态', 生成原因: '穿越场景', flow引用: '主回合', content: travelStatusPrompt });
        }
        const memoryToSendForRecord = (typeof shortTermMemoryForPrompt !== 'undefined' ? shortTermMemoryForPrompt : shortTermMemory) as string[];
        const memoryContentRecord = memoryToSendForRecord.length > 0
          ? `# 【最近事件】\n${memoryToSendForRecord.join('\n')}。根据这刚刚发生的文本事件，合理生成下一次文本信息，要保证衔接流畅、不断层，符合上文的文本信息`
          : undefined;
        promptAssemblyStore.record({
          fullPrompt: systemPrompt,
          modules: assemblyModules.map((m) => ({ ...m, flow引用: '主回合' })),
          dataModules,
          flowName: '主回合',
          timestamp: Date.now(),
          memoryContent: memoryContentRecord
        });
      }

      const userActionForAI = (userMessage && userMessage.toString().trim()) || '继续当前活动';
      console.log('[AI双向系统] 用户输入 userMessage:', userMessage);
      console.log('[AI双向系统] 处理后 userActionForAI:', userActionForAI);

      // 构建注入消息列表
      const injects: Array<{ content: string; role: 'system' | 'assistant' | 'user'; depth: number; position: 'in_chat' | 'none' }> = [
        {
          content: systemPrompt,
          role: 'system',
          depth: 4,
          position: 'in_chat',
        }
      ];

      // 如果有短期记忆，作为独立的 assistant 消息发送
      const memoryToSend = (typeof shortTermMemoryForPrompt !== 'undefined' ? shortTermMemoryForPrompt : shortTermMemory) as string[];
      if (memoryToSend.length > 0) {
        injects.push({
          content: `# 【最近事件】\n${memoryToSend.join('\n')}。根据这刚刚发生的文本事件，合理生成下一次文本信息，要保证衔接流畅、不断层，符合上文的文本信息`,
          role: 'assistant',
          depth: 2,
          position: 'in_chat',
        });
      }

      // 🔥 添加 CoT 提示词（仅在启用系统CoT时注入）
      if (uiStore.useSystemCot) {
        const cotPrompt = await getPrompt('cotCore');
        injects.push({
          content: cotPrompt.replace('{{用户输入}}', userActionForAI),
          role: 'system',
          depth: 1,
          position: 'in_chat',
        });
      }

      // 🌐 添加离线代理提示词（穿越到其他玩家世界时）
      const travelTarget = stateForAI?.系统?.联机?.穿越目标;

      // 🌐 联机穿越：注入"穿越场景"提示，确保叙事从对方世界续写
      const onlineSessionId = stateForAI?.系统?.联机?.房间ID;
      if (onlineSessionId && travelTarget?.世界ID) {
        const ownerName = travelTarget?.主人用户名 || '世界主人';
        const ownerLoc = travelTarget?.世界主人位置?.描述 || '';
        const ownerProfile = travelTarget?.世界主人档案;
        const entryHint = ownerLoc ? `\n- 世界主人「${ownerName}」当前位置：${ownerLoc}（可以前往寻找）` : '';

        // 构建世界主人信息
        let ownerInfoText = '';
        if (ownerProfile) {
          const parts = [];
          if (ownerProfile.名字) parts.push(`名字：${ownerProfile.名字}`);
          const realm = ownerProfile.地位 ?? ownerProfile.境界;
          if (realm) parts.push(`地位：${typeof realm === 'object' ? (realm as any).名称 : realm}`);
          if (ownerProfile.种族) parts.push(`种族：${ownerProfile.种族}`);
          if (parts.length > 0) {
            ownerInfoText = `\n- 世界主人基本信息：${parts.join('，')}`;
          }
        }

        injects.push({
          content: `# 【联机穿越 - 入侵者身份】
你当前处于联机穿越/入侵状态（会话ID：${onlineSessionId}），已进入「${ownerName}」的世界。

## ⚠️ 核心设定：你是入侵者
- 你通过神秘的空间裂隙/虚空通道穿越到了这个世界
- 这是**别人的世界**，不是你的主世界
- 世界主人「${ownerName}」是这个世界的主人，**真实存在于世界中**${ownerInfoText}${entryHint}

## 🎯 世界主人可以被找到！
- 世界主人「${ownerName}」是一个**真实存在的角色**，不是虚无的概念
- 玩家可以**主动寻找**世界主人，前往其所在位置
- 当玩家表示想找世界主人时，**引导玩家前往世界主人的位置**
- 遇到世界主人时，由你（AI）代理扮演世界主人与玩家互动

## 🎭 NPC反应规则（重要！）
1. **所有NPC都不认识你**：你对他们来说是完全陌生的外来者
2. **凭空出现会引起注意**：
   - 如果你出现在有NPC的地方，他们会**惊讶/警惕**
   - 修士会感知到空间波动，凡人会觉得你"不知从哪冒出来的"
   - 高地位角色可能会察觉你身上的"异界气息"
3. **NPC内心戏要充足**：
   - 描写NPC看到陌生人突然出现时的心理活动
   - 根据NPC性格决定反应：警惕、好奇、敌意、友善等
4. **不要假设任何既有关系**：
   - 不要继承世界主人与NPC的好感度或互动历史
   - 你需要从零开始与这个世界的NPC建立关系

## 📝 叙事要求
- 体现"异乡人"的陌生感和新鲜感
- 描写你对这个陌生世界的观察和感受
- NPC的反应要自然合理，符合"突然看到陌生人"的情境
- 如果是首次穿越，要描写穿越的过程（空间扭曲、虚空通道等）`,
          role: 'system',
          depth: 3,
          position: 'in_chat',
        });
      }

      if (travelTarget?.离线代理提示词) {
        const ownerInfo = travelTarget.角色信息;
        let agentPrompt = `# 【离线玩家代理】\n你正在扮演另一位玩家的角色。`;
        if (ownerInfo) {
          agentPrompt += `\n该角色信息：`;
          if (ownerInfo.name) agentPrompt += `\n- 名称：${ownerInfo.name}`;
          if (ownerInfo.cultivation_level) agentPrompt += `\n- 地位：${ownerInfo.cultivation_level}`;
          // [MING] 宗门已移除
          if (ownerInfo.personality) agentPrompt += `\n- 性格：${ownerInfo.personality}`;
        }
        agentPrompt += `\n\n该玩家设定的行为指南：\n${travelTarget.离线代理提示词}`;
        agentPrompt += `\n\n请根据以上设定来扮演这位离线玩家的角色，与当前玩家互动。`;

        injects.push({
          content: agentPrompt,
          role: 'system',
          depth: 2,
          position: 'in_chat',
        });
      }

      const finalUserInput = userActionForAI;

      // 🛡️ 添加assistant角色的占位消息（防止输入截断）
      // 原理：如果最后一条消息是assistant角色，某些模型不会审核输入
      injects.push({
        content: '</input>',
        role: 'assistant',
        depth: 0,
        position: 'in_chat',
      });

      // 🔥 [流式传输修复] 优先使用配置中的streaming设置
      const aiConfig = aiService.getConfig();
      const useStreaming = options?.useStreaming ?? aiConfig.streaming ?? true;

      const isSplitEnabled = (() => {
        if (typeof options?.splitResponseGeneration === 'boolean') return options.splitResponseGeneration;
        try {
          const raw = localStorage.getItem('dad_game_settings');
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          return parsed?.splitResponseGeneration === true;
        } catch {
          return false;
        }
      })();

      let response = '';

      // 🔥 获取 API 管理配置，判断是否真正需要分步生成
      const { useAPIManagementStore } = await import('@/stores/apiManagementStore');
      const apiStore = useAPIManagementStore();
      const enableCot = apiStore.aiGenerationSettings.enableSystemCoT;
      const cotApiConfig = apiStore.getAPIForType('cot');
      const instructionApiConfig = apiStore.getAPIForType('instruction_generation');
      // 判断是否有独立的 COT API 配置
      const hasCotApi = enableCot && cotApiConfig && cotApiConfig.id !== 'default';
      // 判断是否有独立的指令生成 API 配置
      const hasInstructionApi = instructionApiConfig && instructionApiConfig.id !== 'default';

      // 🔥 分步生成：只根据开关按钮判断，同一个API也可以分步（减少单次输出压力）
      const shouldActuallySplit = isSplitEnabled;

      if (shouldActuallySplit) {
        // 🔥 分步生成第1步直接复用 buildNarrativeState（已在上方定义）
        const buildNarrativeStateForStep1 = (): string => JSON.stringify(buildNarrativeState());

        type SectionCollector = (m: { key: string; 构成: string; 生成原因: string; flow引用: string; content: string }) => void;

        const buildSplitSystemPrompt = async (step: 1 | 2, opts?: { flowName: string; onSection?: SectionCollector }): Promise<string> => {
          const tavernEnv = !!tavernHelper;
          const flowRef = opts?.flowName ?? (step === 1 ? '分步第1步' : '分步第2步');
          const push = opts?.onSection;
          const retrievalContextBlock = retrievalBlock ? `\n# 统一记忆检索\n${retrievalBlock}\n` : '';

          if (step === 1) {
            // 第1步：只输出正文纯文本，不需要JSON格式和指令相关的提示词
            const stepRules = (await getPrompt('splitGenerationStep1')).trim();
            const worldStandardsPrompt = await getPrompt('worldStandards');
            const textFormatsPrompt = await getPrompt('textFormatRules');
            const narrativeStateJson = buildNarrativeStateForStep1();
            const statusBlock = `${coreStatusSummary}${vectorMemorySection ? `\n${vectorMemorySection}\n` : ''}${retrievalContextBlock}`;
            push?.({ key: 'splitGenerationStep1', 构成: '分步正文规则', 生成原因: '第1步仅输出正文', flow引用: flowRef, content: stepRules });
            push?.({ key: 'textFormatRules', 构成: '判定系统', 生成原因: '战斗/探索等场景必须使用判定', flow引用: flowRef, content: textFormatsPrompt });
            push?.({ key: 'worldStandards', 构成: '世界观设定', 生成原因: '叙事风格一致', flow引用: flowRef, content: worldStandardsPrompt });
            push?.({ key: 'statusSummary', 构成: '状态摘要与记忆', 生成原因: '上下文注入', flow引用: flowRef, content: statusBlock });
            push?.({ key: 'narrativeState', 构成: '当前游戏状态JSON', 生成原因: '叙事判定用', flow引用: flowRef, content: `# 当前游戏状态（用于叙事判定，无需输出指令）\n${narrativeStateJson}` });
            return `
${stepRules}

---

# 判定系统（战斗/修炼/探索等场景必须使用）
${textFormatsPrompt}

---

# 世界观设定
${worldStandardsPrompt}

---

${statusBlock}
# 当前游戏状态（用于叙事判定，无需输出指令）
${narrativeStateJson}
`.trim();
          }

          // 第2步：COT + 指令生成（合并），需要结构与业务规则
          // 注意：不要注入 coreOutputRules（它会要求输出 text，和第2步“禁止text”冲突）
          const [businessRulesPrompt, dataDefinitionsPrompt, textFormatsPrompt, worldStandardsPrompt] = await Promise.all([
            getPrompt('businessRules'),
            getPrompt('dataDefinitions'),
            getPrompt('textFormatRules'),
            getPrompt('worldStandards')
          ]);

          const sanitizedDataDefinitionsPrompt = tavernEnv ? dataDefinitionsPrompt : stripNsfwContentMing(dataDefinitionsPrompt);
          const sanitizedBusinessRulesPrompt = tavernEnv ? businessRulesPrompt : stripNsfwContentMing(businessRulesPrompt);

          const stepRules = (await getPrompt('splitGenerationStep2')).trim();
          const cotPrompt = enableCot ? await getPrompt('cotCore') : '';
          const sections: string[] = [stepRules];

          push?.({ key: 'splitGenerationStep2', 构成: '分步指令规则', 生成原因: '第2步输出指令与选项', flow引用: flowRef, content: stepRules });

          if (enableCot && cotPrompt) {
            const cotBlock = `
# 思维链分析（先分析再生成指令）
根据第1步正文内容，分析：
1. 场景变化（位置、时间、环境）
2. NPC状态变化（出场、互动、好感度）
3. 玩家状态变化（体力、精力、效果）
4. 物品/金钱变化
5. 进度变化

${cotPrompt}
`.trim();
            sections.push(cotBlock);
            push?.({ key: 'cotCore', 构成: '思维链分析', 生成原因: '先分析再生成指令', flow引用: flowRef, content: cotBlock });
          }

          sections.push(sanitizedBusinessRulesPrompt, sanitizedDataDefinitionsPrompt, textFormatsPrompt, worldStandardsPrompt);
          push?.({ key: 'businessRules', 构成: '核心规则', 生成原因: '业务规则', flow引用: flowRef, content: sanitizedBusinessRulesPrompt });
          push?.({ key: 'dataDefinitions', 构成: '数据结构', 生成原因: '指令 key 规范', flow引用: flowRef, content: sanitizedDataDefinitionsPrompt });
          push?.({ key: 'textFormatRules', 构成: '文本格式', 生成原因: '判定与命名', flow引用: flowRef, content: textFormatsPrompt });
          push?.({ key: 'worldStandards', 构成: '世界标准', 生成原因: '地位与品质', flow引用: flowRef, content: worldStandardsPrompt });

          if (uiStore.enableActionOptions) {
            const actionOptionsPrompt = await getPrompt('actionOptions');
            const customPromptSection = uiStore.actionOptionsPrompt
              ? `**用户自定义要求**：${uiStore.actionOptionsPrompt}\n\n请严格按以上要求生成行动选项。`
              : '（无特殊要求，按默认规则生成）';
            const actionContent = actionOptionsPrompt.replace('{{CUSTOM_ACTION_PROMPT}}', customPromptSection);
            sections.push(actionContent);
            push?.({ key: 'actionOptions', 构成: '行动选项', 生成原因: '生成玩家可选行动', flow引用: flowRef, content: actionContent });
          }

          const eventRules = await getPrompt('eventSystemRules');
          sections.push(eventRules);
          push?.({ key: 'eventSystemRules', 构成: '世界事件规则', 生成原因: '事件演变与影响', flow引用: flowRef, content: eventRules });

          const assembled = sections.join('\n\n---\n\n');
          push?.({ key: 'statusSummary', 构成: '状态摘要', 生成原因: '上下文', flow引用: flowRef, content: `${coreStatusSummary}${retrievalContextBlock}` });
          push?.({ key: 'stateJson', 构成: '游戏状态JSON', 生成原因: '完整存档供指令生成', flow引用: flowRef, content: `# 游戏状态（JSON）\n${stateJsonString}` });

          return `
${assembled}

${coreStatusSummary}
${retrievalContextBlock}

# 游戏状态（JSON）
${stateJsonString}
`.trim();
        };

        const buildSplitInjects = (systemPrompt: string, includeShortTermMemory: boolean = false) => {
          const splitInjects: Array<{ content: string; role: 'system' | 'assistant' | 'user'; depth: number; position: 'in_chat' | 'none' }> = [
            { content: systemPrompt, role: 'system', depth: 4, position: 'in_chat' }
          ];
          // 🔥 只在第1步注入短期记忆，避免重复
          const memoryToSend = (typeof shortTermMemoryForPrompt !== 'undefined' ? shortTermMemoryForPrompt : shortTermMemory) as string[];
          if (includeShortTermMemory && memoryToSend.length > 0) {
            splitInjects.push({
              content: `# 【最近事件】\n${memoryToSend.join('\n')}。根据这刚刚发生的文本事件，合理生成下一次文本信息，要保证衔接流畅、不断层，符合上文的文本信息`,
              role: 'assistant',
              depth: 2,
              position: 'in_chat',
            });
          }
          splitInjects.push({ content: '</input>', role: 'assistant', depth: 0, position: 'in_chat' });
          return splitInjects;
        };

        type SplitUsageType = 'main' | 'instruction_generation';
        const generateOnce = async (args: { user_input: string; should_stream: boolean; generation_id: string; injects: any; usageType?: SplitUsageType; onStreamChunk?: (chunk: string) => void; }) => {
          // 始终通过 aiService.generate 调用，让它根据 usageType 决定使用独立 API 还是酒馆代理
          return await aiService.generate({
            user_input: args.user_input,
            should_stream: args.should_stream,
            generation_id: args.generation_id,
            usageType: args.usageType || 'main',
            injects: args.injects,
            onStreamChunk: args.onStreamChunk,
          });
        };

        // ========== 第1步：正文生成（失败重试1次） ==========
        options?.onProgressUpdate?.('分步生成：第1步（正文）…');
        const step1Modules: Array<{ key: string; 构成: string; 生成原因: string; flow引用: string; content: string }> = [];
        const systemPromptStep1 = await buildSplitSystemPrompt(1, uiStore.debugMode ? { flowName: '分步第1步', onSection: (m) => step1Modules.push(m) } : undefined);
        if (uiStore.debugMode && step1Modules.length > 0) {
          const memoryToSendForRecord = (typeof shortTermMemoryForPrompt !== 'undefined' ? shortTermMemoryForPrompt : shortTermMemory) as string[];
          const memoryContentStep1 = memoryToSendForRecord.length > 0
            ? `# 【最近事件】\n${memoryToSendForRecord.join('\n')}。根据这刚刚发生的文本事件，合理生成下一次文本信息，要保证衔接流畅、不断层，符合上文的文本信息`
            : undefined;
          usePromptAssemblyStore().record({
            fullPrompt: systemPromptStep1,
            modules: step1Modules,
            flowName: '分步第1步',
            timestamp: Date.now(),
            memoryContent: memoryContentStep1,
            apiCallDescription: '第1次 API：role: system = 分步第1步；role: assistant = 记忆（如有）；role: user = 玩家输入'
          });
        }
        const injectsStep1 = buildSplitInjects(systemPromptStep1, true);
        let step1Text = '';
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) options?.onProgressUpdate?.('分步生成：第1步重试…');
            const step1Raw = await generateOnce({
              user_input: finalUserInput,
              should_stream: useStreaming,
              generation_id: `${generationId}_step1_${attempt}`,
              injects: injectsStep1 as any,
              usageType: 'main',
              onStreamChunk: options?.onStreamChunk,
            });
            step1Text = this.extractNarrativeText(String(step1Raw));
            if (step1Text.trim().length > 0) break;
            step1Text = '';
          } catch (e) {
            console.warn(`[分步生成] 第1步第${attempt}次失败:`, e);
          }
        }

        // ========== 第2步：指令生成（COT已合并到提示词中，可选开启） ==========
        options?.onProgressUpdate?.('分步生成：第2步（指令生成）…');
        const step2Modules: Array<{ key: string; 构成: string; 生成原因: string; flow引用: string; content: string }> = [];
        const systemPromptStep2 = await buildSplitSystemPrompt(2, uiStore.debugMode ? { flowName: '分步第2步', onSection: (m) => step2Modules.push(m) } : undefined);
        if (uiStore.debugMode && step2Modules.length > 0) {
          usePromptAssemblyStore().record({
            fullPrompt: systemPromptStep2,
            modules: step2Modules,
            flowName: '分步第2步',
            timestamp: Date.now(),
            apiCallDescription: '第2次 API：role: system = 分步第2步；role: user = 玩家输入 + 第1步返回正文'
          });
        }
        const injectsStep2 = buildSplitInjects(systemPromptStep2, false);

        const step2UserInput = `
【用户本次操作】
${finalUserInput}

【第1步正文】
${step1Text}

请按"分步生成（第2步）"规则输出 JSON。
`.trim();

        // 🔥 第2步指令生成：根据设置决定是否使用流式传输，失败重试1次
        const step2Streaming = apiStore.aiGenerationSettings.splitStep2Streaming;
        let parsedStep2: GM_Response | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) options?.onProgressUpdate?.(`分步生成：第2步重试…`);
            const step2Response = await generateOnce({
              user_input: step2UserInput,
              should_stream: step2Streaming,
              generation_id: `${generationId}_step2_${attempt}`,
              injects: injectsStep2 as any,
              usageType: hasInstructionApi ? 'instruction_generation' : 'main',
              onStreamChunk: undefined,
            });
            parsedStep2 = this.parseAIResponse(String(step2Response));
            if (parsedStep2.tavern_commands && parsedStep2.tavern_commands.length > 0) break;
            parsedStep2 = null;
          } catch (e) {
            console.warn(`[分步生成] 第2步第${attempt}次失败:`, e);
          }
        }
        if (!parsedStep2) {
          parsedStep2 = { text: '', mid_term_memory: '', tavern_commands: [], action_options: [] } as GM_Response;
        }

        gmResponse = {
          text: step1Text,
          mid_term_memory: parsedStep2.mid_term_memory || '',
          tavern_commands: parsedStep2.tavern_commands || [],
          action_options: uiStore.enableActionOptions ? this.sanitizeActionOptionsForDisplay(parsedStep2.action_options || []) : [],
          semantic_memory: (parsedStep2 as any).semantic_memory,
        };
      } else if (tavernHelper) {
        // 酒馆模式
        response = await tavernHelper.generate({
          user_input: finalUserInput,
          should_stream: useStreaming,
          generation_id: generationId,
          usageType: 'main',
          injects: injects as any,
        });
      } else {
        // 自定义API模式
        response = await aiService.generate({
          user_input: finalUserInput,
          should_stream: useStreaming,
          generation_id: generationId,
          usageType: 'main',
          injects: injects as any,
          onStreamChunk: options?.onStreamChunk,
        });
      }

      // 流式传输通过事件系统在 MainGamePanel 中处理
      // 这里只需要解析最终响应
      if (!isSplitEnabled) {
        try {
          gmResponse = this.parseAIResponse(response);
        } catch (parseError) {
        console.error('[AI双向系统] 响应解析失败，尝试容错处理:', parseError);

        // 容错策略：尝试多种方式提取文本内容
        const responseText = String(response).trim();
        let extractedText = '';
        let extractedMemory = '';
        let extractedCommands: any[] = [];
        let extractedActionOptions: string[] = [];

        // 1. 尝试提取JSON代码块（```json ... ```）
        const jsonBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
          try {
            const jsonObj = JSON.parse(jsonBlockMatch[1].trim());
            extractedText = jsonObj.text || jsonObj.叙事文本 || jsonObj.narrative || '';
            extractedMemory = jsonObj.mid_term_memory || jsonObj.中期记忆 || '';
            extractedCommands = jsonObj.tavern_commands || jsonObj.指令 || [];
            extractedActionOptions = jsonObj.action_options || [];
          } catch (e) {
            console.warn('[AI双向系统] JSON代码块解析失败:', e);
          }
        }

        // 2. 如果没有提取到，尝试直接JSON解析
        if (!extractedText) {
          try {
            const jsonObj = JSON.parse(responseText);
            extractedText = jsonObj.text || jsonObj.叙事文本 || jsonObj.narrative || '';
            extractedMemory = jsonObj.mid_term_memory || jsonObj.中期记忆 || '';
            extractedCommands = jsonObj.tavern_commands || jsonObj.指令 || [];
            extractedActionOptions = jsonObj.action_options || [];
          } catch {
            // 3. 尝试提取JSON中的text字段（使用正则）
            const textMatch = responseText.match(/"(?:text|叙事文本|narrative)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (textMatch && textMatch[1]) {
              extractedText = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            } else {
              // 4. 尝试查找大括号包裹的JSON
              const jsonMatch = responseText.match(/\{[\s\S]*"text"[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const jsonObj = JSON.parse(jsonMatch[0]);
                  extractedText = jsonObj.text || '';
                  extractedMemory = jsonObj.mid_term_memory || '';
                  extractedCommands = jsonObj.tavern_commands || [];
                  extractedActionOptions = jsonObj.action_options || [];
                } catch {
                  // 5. 最后降级：使用整个响应作为文本
                  extractedText = responseText;
                }
              }
            }
          }
        }

        // 🔥 确保 action_options 不为空
        if (!extractedActionOptions || extractedActionOptions.length === 0) {
          console.warn('[AI双向系统] ⚠️ 容错模式：action_options为空，使用默认选项');
          extractedActionOptions = [
            '继续当前活动',
            '观察周围环境',
            '与附近的人交谈',
            '查看自身状态',
            '稍作休息调整'
          ];
        }

        gmResponse = {
          text: extractedText,
          mid_term_memory: extractedMemory,
          tavern_commands: extractedCommands,
          action_options: this.sanitizeActionOptionsForDisplay(extractedActionOptions)
        };
        console.warn('[AI双向系统] 使用容错模式提取内容 - 文本长度:', extractedText.length, '记忆:', extractedMemory.length, '指令数:', extractedCommands.length, '行动选项:', extractedActionOptions.length);
      }
      }

      // 🔥 文本优化：如果启用，对生成的文本进行润色
      if (shouldAbort()) {
        console.log('[AI System] Abort detected, skip text optimization and command execution');
        return gmResponse;
      }
      if (gmResponse && gmResponse.text) {
        gmResponse.text = await this.optimizeText(gmResponse.text, options?.onProgressUpdate);
      }

      if (shouldAbort()) {
        console.log('[AI System] Abort detected, skip command execution');
        return gmResponse;
      }
      if (!gmResponse || !gmResponse.text || gmResponse.text.trim() === '') {
        console.error('[AI双向系统] AI响应为空，原始响应:', String(response).substring(0, 200));
        throw new Error('AI响应为空或格式错误');
      }

      // 流式传输完成后调用回调
      if (useStreaming && options?.onStreamComplete) {
        options.onStreamComplete();
      }
    } catch (error) {
      console.error('[AI双向系统] AI生成失败:', error);
      gmResponse = {
        text: '（AI生成失败）',
        mid_term_memory: '',
        tavern_commands: [],
        action_options: ['重试当前操作', '查看自身状态', '稍作休息']
      };
    }

    // 3. 执行AI指令
    options?.onProgressUpdate?.('执行AI指令…');
    if (shouldAbort()) {
      console.log('[AI System] Abort detected, skip command execution');
      return gmResponse;
    }
    try {
      // 🔥 使用 v3 而不是原始 saveData，因为 maybeTriggerScheduledWorldEvent 可能已修改了 v3（如下次事件时间）
      const dataForProcessing = isSaveDataV3(saveData) ? saveData : migrateSaveDataToLatest(saveData).migrated;
      const { saveData: updatedSaveData } = await this.processGmResponse(gmResponse, dataForProcessing as SaveData, false, options?.shouldAbort);
      if (options?.onStateChange) {
        options.onStateChange(updatedSaveData as unknown as PlainObject);
      }

      // [MING] 主回合成功后：若启用心跳且到达周期，执行周期心跳并同步存档
      const 世界状态 = (updatedSaveData as any)?.世界?.状态;
      const 心跳 = 世界状态?.心跳;
      const 回合序号 = (updatedSaveData as any)?.元数据?.回合序号 ?? 0;
      const 上次心跳 = 心跳?.上次心跳回合序号 ?? -1;
      const 周期数值 = 心跳?.周期数值 ?? 5;
      const currentRoundJustEnded = Math.max(0, 回合序号 - 1);
      const gap = currentRoundJustEnded - 上次心跳;
      // 启用按 truthy 判断，兼容 boolean true 与字符串 "true" 等（避免修复/序列化导致类型变化不触发）
      const 启用中 = 心跳 && (心跳.启用 === true || 心跳.启用 === 'true' || 心跳.启用 === 1);
      const shouldRun = 启用中 && gap >= 周期数值;
      console.log('[世界心跳] 周期判定', {
        启用: 心跳?.启用,
        启用类型: 心跳 ? typeof 心跳.启用 : '-',
        回合序号,
        上次心跳回合序号: 上次心跳,
        周期数值,
        本回合刚结束: currentRoundJustEnded,
        间隔: gap,
        需间隔: 周期数值,
        触发: shouldRun ? '是' : '否',
        原因: !心跳 ? '无心跳配置' : !启用中 ? '未启用心跳' : gap < 周期数值 ? `未达周期(差${周期数值 - gap}回合)` : '已达周期',
      });
      if (shouldRun) {
        try {
          const { runSingleHeartbeat } = await import('@/services/worldHeartbeatService');
          await runSingleHeartbeat(updatedSaveData as SaveData, { triggerMode: '周期' });
          const gameStateStore = useGameStateStore();
          gameStateStore.loadFromSaveData(updatedSaveData as SaveData);
          const characterStore = useCharacterStore();
          await characterStore.saveCurrentGame();
          console.log('[世界心跳] 周期心跳已执行并保存');
        } catch (heartbeatErr) {
          console.warn('[AI双向系统] 周期心跳执行失败:', heartbeatErr);
        }
      }

      // 🌐 联机穿越：每回合追加一条“被入侵者视角”的简短入侵日志到服务器
      // [MING] Online travel removed - local only mode
      return gmResponse;
    } catch (error) {
      console.error('[AI双向系统] 指令执行失败:', error);
      return gmResponse;
    }
  }

  public async generateInitialMessage(
    systemPrompt: string,
    userPrompt: string,
    options?: ProcessOptions
  ): Promise<GM_Response> {
    const tavernHelper = getTavernHelper();
    const uiStore = useUIStore();

    // 检查AI服务可用性（酒馆或自定义API）
    if (!tavernHelper) {
      const availability = aiService.checkAvailability();
      if (!availability.available) {
        throw new Error(availability.message);
      }
    }

    options?.onProgressUpdate?.('构建提示词并请求AI生成…');
    let gmResponse: GM_Response;
    try {
      // 🔥 [流式传输修复] 优先使用配置中的streaming设置
      const aiConfig = aiService.getConfig();
      const useStreaming = options?.useStreaming ?? aiConfig.streaming ?? true;
      const generateMode = options?.generateMode || 'generate'; // 默认使用 generate 模式
      const isSplitEnabled = (() => {
        if (typeof options?.splitResponseGeneration === 'boolean') return options.splitResponseGeneration;
        try {
          const raw = localStorage.getItem('dad_game_settings');
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          return parsed?.splitResponseGeneration === true;
        } catch {
          return false;
        }
      })();

      let response = '';

      // 🔥 获取 API 管理配置，判断是否真正需要分步生成
      const { useAPIManagementStore } = await import('@/stores/apiManagementStore');
      const apiStore = useAPIManagementStore();
      const enableCot = apiStore.aiGenerationSettings.enableSystemCoT;
      const instructionApiConfig = apiStore.getAPIForType('instruction_generation');
      // 判断是否有独立的指令生成 API 配置
      const hasInstructionApi = instructionApiConfig && instructionApiConfig.id !== 'default';

      // 🔥 开局分步生成：只根据开关按钮判断，固定用主API分步
      const shouldActuallySplit = isSplitEnabled;

      if (shouldActuallySplit) {

        type InitSectionCollector = (m: { key: string; 构成: string; 生成原因: string; flow引用: string; content: string }) => void;

        const buildInitialSplitSystemPrompt = async (step: 1 | 2, opts?: { flowName: string; onSection?: InitSectionCollector }): Promise<string> => {
          const flowRef = opts?.flowName ?? (step === 1 ? '开局第1步' : '开局第2步');
          const push = opts?.onSection;

          if (step === 1) {
            const stepRules = (await getPrompt('splitInitStep1')).trim();
            const worldStandardsPrompt = await getPrompt('worldStandards');
            const roleBlock = `# 角色设定\n${userPrompt}`;
            push?.({ key: 'splitInitStep1', 构成: '开局正文规则', 生成原因: '开局第1步仅输出正文', flow引用: flowRef, content: stepRules });
            push?.({ key: 'worldStandards', 构成: '世界观设定', 生成原因: '叙事风格一致', flow引用: flowRef, content: worldStandardsPrompt });
            push?.({ key: 'userPrompt', 构成: '角色设定', 生成原因: '玩家选择摘要', flow引用: flowRef, content: roleBlock });
            return `
${stepRules}

---

# 世界观设定
${worldStandardsPrompt}

---

# 角色设定
${userPrompt}
            `.trim();
          }

          // 第2步：指令生成（合并）。不要拼接完整 systemPrompt（它包含 text 输出规则，会和“禁止text”冲突）
          const tavernEnv = !!tavernHelper;
          const stepRules = (await getPrompt('splitInitStep2')).trim();
          const cotPrompt = enableCot ? await getPrompt('cotCore') : '';
          const [businessRulesPrompt, dataDefinitionsPrompt, textFormatsPrompt, worldStandardsPrompt] = await Promise.all([
            getPrompt('businessRules'),
            getPrompt('dataDefinitions'),
            getPrompt('textFormatRules'),
            getPrompt('worldStandards')
          ]);
          const sanitizedDataDefinitionsPrompt = tavernEnv ? dataDefinitionsPrompt : stripNsfwContentMing(dataDefinitionsPrompt);
          const sanitizedBusinessRulesPrompt = tavernEnv ? businessRulesPrompt : stripNsfwContentMing(businessRulesPrompt);

          const sections: string[] = [stepRules];

          push?.({ key: 'splitInitStep2', 构成: '开局指令规则', 生成原因: '开局第2步输出指令与选项', flow引用: flowRef, content: stepRules });

          if (enableCot && cotPrompt) {
            const cotBlock = `
# 思维链分析（先分析再生成指令）
根据第1步正文内容，分析：
1. 初始场景设定（位置、时间、环境）
2. 出场NPC的状态
3. 玩家初始状态
4. 可能的发展方向

${cotPrompt}`.trim();
            sections.push(cotBlock);
            push?.({ key: 'cotCore', 构成: '思维链分析', 生成原因: '先分析再生成指令', flow引用: flowRef, content: cotBlock });
          }

          sections.push(sanitizedBusinessRulesPrompt, sanitizedDataDefinitionsPrompt, textFormatsPrompt, worldStandardsPrompt);
          push?.({ key: 'businessRules', 构成: '核心规则', 生成原因: '业务规则', flow引用: flowRef, content: sanitizedBusinessRulesPrompt });
          push?.({ key: 'dataDefinitions', 构成: '数据结构', 生成原因: '指令 key 规范', flow引用: flowRef, content: sanitizedDataDefinitionsPrompt });
          push?.({ key: 'textFormatRules', 构成: '文本格式', 生成原因: '判定与命名', flow引用: flowRef, content: textFormatsPrompt });
          push?.({ key: 'worldStandards', 构成: '世界标准', 生成原因: '地位与品质', flow引用: flowRef, content: worldStandardsPrompt });

          return sections.map(s => s.trim()).filter(Boolean).join('\n\n---\n\n').trim();
        };

        type InitialSplitUsageType = 'main' | 'instruction_generation';
        const generateOnce = async (args: { step: 1 | 2; system: string; user: string; should_stream: boolean; usageType?: InitialSplitUsageType; onStreamChunk?: (chunk: string) => void; }): Promise<string> => {
          const generationId = `initial_message_split_step${args.step}_${Date.now()}`;
          const usageType = args.usageType || 'main';

          // 始终通过 aiService 调用，让它根据 usageType 决定使用独立 API 还是酒馆代理
          if (generateMode === 'generateRaw') {
            return await aiService.generateRaw({
              ordered_prompts: [
                { role: 'system', content: args.system },
                { role: 'user', content: args.user }
              ],
              should_stream: args.should_stream,
              generation_id: generationId,
              usageType,
              onStreamChunk: args.onStreamChunk,
            });
          }

          const injects: Array<{ content: string; role: 'system' | 'assistant' | 'user'; depth: number; position: 'in_chat' | 'none' }> = [
            { content: args.system, role: 'user', depth: 4, position: 'in_chat' }
          ];
          return await aiService.generate({
            user_input: args.user,
            should_stream: args.should_stream,
            generation_id: generationId,
            usageType,
            injects: injects as any,
            onStreamChunk: args.onStreamChunk,
          });
        };

        // ========== 第1步：开局正文生成 ==========
        options?.onProgressUpdate?.('分步生成：第1步（开局正文）…');
        const initStep1Modules: Array<{ key: string; 构成: string; 生成原因: string; flow引用: string; content: string }> = [];
        const initSystemStep1 = await buildInitialSplitSystemPrompt(1, uiStore.debugMode ? { flowName: '开局第1步', onSection: (m) => initStep1Modules.push(m) } : undefined);
        if (uiStore.debugMode && initStep1Modules.length > 0) {
          usePromptAssemblyStore().record({
            fullPrompt: initSystemStep1,
            modules: initStep1Modules,
            flowName: '开局第1步',
            timestamp: Date.now(),
            apiCallDescription: '第1次 API：role: system = 开局第1步；role: user = 角色设定'
          });
        }
        const step1Raw = await generateOnce({
          step: 1,
          system: initSystemStep1,
          user: userPrompt,
          should_stream: useStreaming,
          usageType: 'main',
          onStreamChunk: options?.onStreamChunk,
        });

        const step1Text = this.extractNarrativeText(String(step1Raw));

        if (useStreaming && options?.onStreamComplete) {
          options.onStreamComplete();
        }

        // ========== 第2步：COT + 指令生成（合并） ==========
        options?.onProgressUpdate?.('分步生成：第2步（思维链+指令生成）…');

        const initStep2Modules: Array<{ key: string; 构成: string; 生成原因: string; flow引用: string; content: string }> = [];
        const initSystemStep2 = await buildInitialSplitSystemPrompt(2, uiStore.debugMode ? { flowName: '开局第2步', onSection: (m) => initStep2Modules.push(m) } : undefined);
        if (uiStore.debugMode && initStep2Modules.length > 0) {
          usePromptAssemblyStore().record({
            fullPrompt: initSystemStep2,
            modules: initStep2Modules,
            flowName: '开局第2步',
            timestamp: Date.now(),
            apiCallDescription: '第2次 API：role: system = 开局第2步；role: user = 开局用户提示 + 第1步正文'
          });
        }

        const step2UserPrompt = `
【开局用户提示】
${userPrompt}

【第1步正文】
${step1Text}

请按"分步生成（开局-第2步）"规则输出 JSON。
        `.trim();

        // 🔥 第2步指令生成：根据设置决定是否使用流式传输，失败重试1次
        const step2StreamingInitial = apiStore.aiGenerationSettings.splitStep2Streaming;
        options?.onProgressUpdate?.('分步生成：第2步（指令生成）…');
        let parsedStep2: GM_Response | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) options?.onProgressUpdate?.(`分步生成：第2步重试…`);
            const step2Response = await generateOnce({
              step: 2,
              system: initSystemStep2,
              user: step2UserPrompt,
              should_stream: step2StreamingInitial,
              usageType: hasInstructionApi ? 'instruction_generation' : 'main',
              onStreamChunk: undefined,
            });
            parsedStep2 = this.parseAIResponse(String(step2Response));
            if (parsedStep2.tavern_commands && parsedStep2.tavern_commands.length > 0) break;
            parsedStep2 = null;
          } catch (e) {
            console.warn(`[分步生成-开局] 第2步第${attempt}次失败:`, e);
          }
        }
        if (!parsedStep2) {
          parsedStep2 = { text: '', mid_term_memory: '', tavern_commands: [], action_options: [] } as GM_Response;
        }

        const defaultInitialActionOptions = [
          '四处走动熟悉环境',
          '查看自身状态',
          '与附近的人交谈',
          '寻找修炼之地',
          '打听周围消息'
        ];

        gmResponse = {
          text: step1Text,
          mid_term_memory: parsedStep2.mid_term_memory || '',
          tavern_commands: parsedStep2.tavern_commands || [],
          action_options: uiStore.enableActionOptions
            ? this.sanitizeActionOptionsForDisplay(parsedStep2.action_options?.length ? parsedStep2.action_options : defaultInitialActionOptions)
            : [],
          semantic_memory: (parsedStep2 as any).semantic_memory,
        };

        // 🔥 文本优化：如果启用，对生成的文本进行润色（分步模式）
        gmResponse.text = await this.optimizeText(gmResponse.text, options?.onProgressUpdate);
      } else if (tavernHelper) {
        // 酒馆模式
        if (generateMode === 'generateRaw') {
          // 🔥 使用 generateRaw 模式：纯净生成，不使用角色卡预设
          console.log('[AI双向系统] 酒馆模式 - 使用 generateRaw 模式生成初始消息');
          response = String(await tavernHelper.generateRaw({
            ordered_prompts: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            should_stream: useStreaming,
            generation_id: `initial_message_raw_${Date.now()}`,
            usageType: 'main',
          }));
        } else {
          // 🔥 使用标准 generate 模式：包含角色卡预设和聊天历史
          console.log('[AI双向系统] 酒馆模式 - 使用 generate 模式生成初始消息');
          const injects: Array<{ content: string; role: 'system' | 'assistant' | 'user'; depth: number; position: 'in_chat' | 'none' }> = [
            {
              content: systemPrompt,
              role: 'user',
              depth: 4,
              position: 'in_chat',
            }
          ];

          response = await tavernHelper.generate({
            user_input: userPrompt,
            should_stream: useStreaming,
            generation_id: `initial_message_${Date.now()}`,
            usageType: 'main',
            injects,
          });
        }
      } else {
        // 自定义API模式
        if (generateMode === 'generateRaw') {
          console.log('[AI双向系统] 自定义API模式 - 使用 generateRaw 模式生成初始消息');
          response = await aiService.generateRaw({
            ordered_prompts: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            should_stream: useStreaming,
            generation_id: `initial_message_raw_${Date.now()}`,
            usageType: 'main',
            onStreamChunk: options?.onStreamChunk,
          });
        } else {
          console.log('[AI双向系统] 自定义API模式 - 使用 generate 模式生成初始消息');
          const injects: Array<{ content: string; role: 'system' | 'assistant' | 'user'; depth: number; position: 'in_chat' | 'none' }> = [
            {
              content: systemPrompt,
              role: 'user',
              depth: 4,
              position: 'in_chat',
            }
          ];

          response = await aiService.generate({
            user_input: userPrompt,
            should_stream: useStreaming,
            generation_id: `initial_message_${Date.now()}`,
            usageType: 'main',
            injects: injects as any,
            onStreamChunk: options?.onStreamChunk,
          });
        }
      }

      // 🔥 非分步模式才需要解析response（分步模式已在上面设置了gmResponse）
      if (!shouldActuallySplit) {
        // 🔥 调试日志：检查酒馆/API返回的原始响应
        console.log('[AI双向系统] 原始响应类型:', typeof response);
        console.log('[AI双向系统] 原始响应长度:', String(response).length);
        console.log('[AI双向系统] 原始响应前500字符:', String(response).substring(0, 500));

        // 🔥 检测空响应并给出更明确的错误提示
        if (!response || String(response).trim().length === 0) {
          throw new Error('AI返回了空响应。可能原因：1) 模型使用了reasoning_content字段而非content字段（如Gemini 3 Pro）；2) API配置错误；3) 网络问题。建议：在酒馆设置中关闭流式传输，或更换模型。');
        }

        // 流式传输通过事件系统在调用方处理
        try {
          gmResponse = this.parseAIResponse(String(response));
        } catch (parseError) {
          console.error('[AI双向系统] 初始消息解析失败，尝试容错处理:', parseError);

          // 容错策略：尝试多种方式提取文本内容
          const responseText = String(response).trim();
          let extractedText = '';
          let extractedMemory = '';
          let extractedCommands: any[] = [];

          // 1. 尝试提取JSON代码块（结尾```可选）
          const jsonBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?(?:```|$)/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            try {
              const jsonObj = JSON.parse(jsonBlockMatch[1].trim());
              extractedText = jsonObj.text || jsonObj.叙事文本 || jsonObj.narrative || '';
              extractedMemory = jsonObj.mid_term_memory || jsonObj.中期记忆 || '';
              extractedCommands = jsonObj.tavern_commands || jsonObj.指令 || [];
            } catch (e) {
              console.warn('[AI双向系统] JSON代码块解析失败:', e);
            }
          }

          // 2. 如果没有提取到，尝试直接JSON解析
          if (!extractedText) {
            try {
              const jsonObj = JSON.parse(responseText);
              extractedText = jsonObj.text || jsonObj.叙事文本 || jsonObj.narrative || '';
              extractedMemory = jsonObj.mid_term_memory || jsonObj.中期记忆 || '';
              extractedCommands = jsonObj.tavern_commands || jsonObj.指令 || [];
            } catch {
              // 3. 尝试提取JSON中的text字段（使用正则）
              const textMatch = responseText.match(/"(?:text|叙事文本|narrative)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
              if (textMatch && textMatch[1]) {
                extractedText = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              } else {
                // 4. 尝试查找大括号包裹的JSON
                const jsonMatch = responseText.match(/\{[\s\S]*"text"[\s\S]*\}/);
                if (jsonMatch) {
                  try {
                    const jsonObj = JSON.parse(jsonMatch[0]);
                    extractedText = jsonObj.text || '';
                    extractedMemory = jsonObj.mid_term_memory || '';
                    extractedCommands = jsonObj.tavern_commands || [];
                  } catch {
                    // 5. 最后降级：使用整个响应作为文本
                    extractedText = responseText;
                  }
                }
              }
            }
          }

          // 🔥 初始消息也需要 action_options
          let extractedActionOptions: string[] = [];
          // 尝试从已解析的JSON中提取
          try {
            const jsonBlockMatch2 = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?(?:```|$)/);
            if (jsonBlockMatch2 && jsonBlockMatch2[1]) {
              const jsonObj = JSON.parse(jsonBlockMatch2[1].trim());
              extractedActionOptions = jsonObj.action_options || [];
            }
          } catch { /* 忽略 */ }

          // 确保不为空
          if (!extractedActionOptions || extractedActionOptions.length === 0) {
            console.warn('[AI双向系统] ⚠️ 初始消息：action_options为空，使用默认选项');
            extractedActionOptions = [
              '四处走动熟悉环境',
              '查看自身状态',
              '与附近的人交谈',
              '寻找修炼之地',
              '打听周围消息'
            ];
          }

          gmResponse = {
            text: extractedText,
            mid_term_memory: extractedMemory,
            tavern_commands: extractedCommands,
            action_options: this.sanitizeActionOptionsForDisplay(extractedActionOptions)
          };
          console.warn('[AI双向系统] 使用容错模式提取初始消息 - 文本长度:', extractedText.length, '记忆:', extractedMemory.length, '指令数:', extractedCommands.length, '行动选项:', extractedActionOptions.length);
        }

        if (!gmResponse || !gmResponse.text) {
          throw new Error('AI响应解析失败或为空');
        }

        // 🔥 文本优化：如果启用，对生成的文本进行润色（非分步模式）
        gmResponse.text = await this.optimizeText(gmResponse.text, options?.onProgressUpdate);
      }

      // 流式传输完成后调用回调
      if (useStreaming && options?.onStreamComplete) {
        options.onStreamComplete();
      }

      // 最终验证：确保gmResponse已设置
      if (!gmResponse! || !gmResponse!.text) {
        throw new Error('AI响应解析失败或为空');
      }

      return gmResponse!;
    } catch (error) {
      console.error('[AI双向系统] 初始消息生成失败:', error);
      throw new Error(`初始消息生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private _getMinutes(gameTime: GameTime): number {
    return gameTime.分钟 ?? 0;
  }
  private _formatGameTime(gameTime: GameTime | undefined): string {
    if (!gameTime) return '【仙历元年】';
    const minutes = this._getMinutes(gameTime);
    return `【仙道${gameTime.年}年${gameTime.月}月${gameTime.日}日 ${String(gameTime.小时).padStart(2, '0')}:${String(minutes).padStart(2, '0')}】`;
  }
  public async processGmResponse(
    response: GM_Response,
    currentSaveData: SaveData,
    isInitialization = false,
    shouldAbort?: () => boolean
  ): Promise<{ saveData: SaveData; stateChanges: StateChangeLog }> {
    const abortRequested = () => shouldAbort?.() ?? false;
    if (abortRequested()) {
      console.log('[AI System] Abort detected, skip command processing');
      return { saveData: currentSaveData, stateChanges: { changes: [], timestamp: new Date().toISOString() } };
    }
    // 🔥 先修复数据格式，确保所有字段正确
    const { repairSaveData } = await import('./dataRepair');
    const repairedData = repairSaveData(currentSaveData);
    const saveData = cloneDeep(repairedData);
    const changes: StateChange[] = [];

    // 确保叙事历史数组存在（V3：系统.历史.叙事）
    if (!(saveData as any).系统) (saveData as any).系统 = {};
    if (!(saveData as any).系统.历史) (saveData as any).系统.历史 = { 叙事: [] };
    if (!Array.isArray((saveData as any).系统.历史.叙事)) (saveData as any).系统.历史.叙事 = [];

    // 处理text：添加到叙事历史和短期记忆
    if (response.text?.trim()) {
      const timePrefix = this._formatGameTime((saveData as any).元数据?.时间);
      const textContent = sanitizeAITextForDisplay(response.text).trim();

      // 1. 添加到叙事历史（用于UI显示）
      const newNarrative = {
        type: 'gm' as const,
        role: 'assistant' as const,
        content: `${timePrefix}${textContent}`,
        time: timePrefix,
        actionOptions: this.sanitizeActionOptionsForDisplay(response.action_options || [])
      };
      (saveData as any).系统.历史.叙事.push(newNarrative);
      changes.push({
        key: `系统.历史.叙事[${(saveData as any).系统.历史.叙事.length - 1}]`,
        action: 'push',
        oldValue: undefined,
        newValue: cloneDeep(newNarrative)
      });

      // 2. 添加到短期记忆（用于AI上下文）
      if (!(saveData as any).社交) (saveData as any).社交 = {};
      if (!(saveData as any).社交.记忆) (saveData as any).社交.记忆 = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
      if (!Array.isArray((saveData as any).社交.记忆.短期记忆)) (saveData as any).社交.记忆.短期记忆 = [];
      (saveData as any).社交.记忆.短期记忆.push(`${timePrefix}${textContent}`);
    }

    // 处理 mid_term_memory：规范为隐性格式并添加到隐式中期记忆
    const rawMem = response.mid_term_memory;
    const hasContent = rawMem !== undefined && rawMem !== null &&
      (typeof rawMem === 'string' ? (rawMem as string).trim() : (rawMem as ImplicitMidTermEntry).记忆主体);
    if (hasContent) {
      if (!(saveData as any).社交) (saveData as any).社交 = {};
      if (!(saveData as any).社交.记忆) (saveData as any).社交.记忆 = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
      if (!Array.isArray((saveData as any).社交.记忆.隐式中期记忆)) (saveData as any).社交.记忆.隐式中期记忆 = [];
      const timePrefix = this._formatGameTime((saveData as any).元数据?.时间);
      let entry: ImplicitMidTermEntry;
      if (typeof rawMem === 'object' && rawMem !== null && typeof (rawMem as ImplicitMidTermEntry).记忆主体 === 'string') {
        const o = rawMem as ImplicitMidTermEntry;
        entry = {
          相关角色: Array.isArray(o.相关角色) ? o.相关角色 : [],
          事件时间: typeof o.事件时间 === 'string' ? o.事件时间 : timePrefix,
          记忆主体: sanitizeAITextForDisplay(o.记忆主体).trim()
        };
      } else {
        const text = sanitizeAITextForDisplay(String(rawMem)).trim();
        entry = { 相关角色: [], 事件时间: timePrefix, 记忆主体: text };
      }
      if (entry.记忆主体) (saveData as any).社交.记忆.隐式中期记忆.push(entry);
    }

    // [Engram] 写入事件/实体记忆，并按配置执行向量化与trim
    try {
      const newEvents = buildEventsFromResponse({
        response,
        saveData: saveData as SaveData,
      });
      if (newEvents.length > 0) {
        const currentEngram = readEngramMemoryFromSaveData(saveData as Record<string, unknown>);
        const engramConfig = loadEngramConfigFromStorage();
        let nextEngram = appendEngramEvents(currentEngram, newEvents);

        // [Engram] phase-3: 基于事件与当前上下文提取实体，持续补全实体图谱
        const extractedEntities = buildEntitiesFromEvents({
          events: newEvents,
          saveData: saveData as SaveData,
        });
        if (extractedEntities.length > 0) {
          nextEngram = upsertEngramEntities(nextEngram, extractedEntities);
        }
        const extractedRelations = buildRelationsFromEvents({
          events: newEvents,
          entities: nextEngram.entities,
          saveData: saveData as SaveData,
        });
        if (extractedRelations.length > 0) {
          nextEngram = upsertEngramRelations(nextEngram, extractedRelations);
        }

        // [Engram] trim policy（仅在启用时生效）
        nextEngram = trimEngramMemory(nextEngram, engramConfig.trim);

        changes.push({
          key: '系统.扩展.engramMemory.events',
          action: 'append',
          oldValue: currentEngram.events.length,
          newValue: nextEngram.events.length,
        });
        if (extractedEntities.length > 0) {
          changes.push({
            key: '系统.扩展.engramMemory.entities',
            action: 'upsert',
            oldValue: currentEngram.entities.length,
            newValue: nextEngram.entities.length,
          });
        }
        if (extractedRelations.length > 0) {
          changes.push({
            key: '系统.扩展.engramMemory.relations',
            action: 'upsert',
            oldValue: currentEngram.relations.length,
            newValue: nextEngram.relations.length,
          });
        }

        // [Engram] phase-2: 事件向量写入（失败不影响主流程）
        if (engramConfig.enabled && engramConfig.retrievalMode === 'hybrid' && engramConfig.embedding.enabled) {
          const characterStore = useCharacterStore();
          const activeSave = characterStore.rootState?.当前激活存档;
          if (activeSave?.角色ID && activeSave?.存档槽位) {
            const vectorContext = {
              characterId: activeSave.角色ID,
              slotId: activeSave.存档槽位,
            };
            const eventEmbedInput = newEvents.map((event) => {
              const summary = typeof (event as any).summary === 'string' ? (event as any).summary : '';
              return summary.trim() || JSON.stringify((event as any).structured_kv || {});
            });
            const entityEmbedInput = extractedEntities.map((entity) => {
              const name = typeof (entity as any).name === 'string' ? (entity as any).name.trim() : '';
              const description = typeof (entity as any).description === 'string' ? (entity as any).description.trim() : '';
              return `${name} ${description}`.trim() || JSON.stringify((entity as any).profile || {});
            });
            const embedded = await embedTexts([...eventEmbedInput, ...entityEmbedInput], engramConfig);
            const eventVectorPairs = newEvents
              .map((event, index) => ({
                id: (event as any).id as string,
                vector: embedded.vectors[index] || [],
              }))
              .filter((item) => item.id && Array.isArray(item.vector) && item.vector.length > 0);
            const entityVectorPairs = extractedEntities
              .map((entity, index) => ({
                id: (entity as any).id as string,
                vector: embedded.vectors[eventEmbedInput.length + index] || [],
              }))
              .filter((item) => item.id && Array.isArray(item.vector) && item.vector.length > 0);

            if (eventVectorPairs.length > 0 || entityVectorPairs.length > 0) {
              const vectorizedIds = new Set(eventVectorPairs.map((item) => item.id));
              const vectorizedEntityIds = new Set(entityVectorPairs.map((item) => item.id));
              nextEngram = {
                ...nextEngram,
                events: nextEngram.events.map((event) =>
                  vectorizedIds.has((event as any).id)
                    ? {
                        ...event,
                        is_embedded: true,
                      }
                    : event,
                ),
                entities: nextEngram.entities.map((entity) =>
                  vectorizedEntityIds.has((entity as any).id)
                    ? {
                        ...entity,
                        is_embedded: true,
                      }
                    : entity,
                ),
                meta: {
                  ...nextEngram.meta,
                  embedding_model: embedded.modelUsed || nextEngram.meta.embedding_model,
                  vector_dim:
                    eventVectorPairs[0]?.vector?.length ||
                    entityVectorPairs[0]?.vector?.length ||
                    nextEngram.meta.vector_dim,
                },
              };

              const currentVectorStore = await loadEngramVectorStore(vectorContext);
              const withEventVectors = mergeEventVectors(currentVectorStore, eventVectorPairs, embedded.modelUsed);
              const nextVectorStore = mergeEntityVectors(withEventVectors, entityVectorPairs, embedded.modelUsed);
              await saveEngramVectorStore(vectorContext, nextVectorStore);
              changes.push({
                key: '系统.扩展.engramMemory.meta.vectorizedEvents',
                action: 'replace',
                oldValue: currentVectorStore.eventVectors ? Object.keys(currentVectorStore.eventVectors).length : 0,
                newValue: Object.keys(nextVectorStore.eventVectors || {}).length,
              });
              changes.push({
                key: '系统.扩展.engramMemory.meta.vectorizedEntities',
                action: 'replace',
                oldValue: currentVectorStore.entityVectors ? Object.keys(currentVectorStore.entityVectors).length : 0,
                newValue: Object.keys(nextVectorStore.entityVectors || {}).length,
              });
            }
          }
        }

        writeEngramMemoryToSaveData(saveData as Record<string, unknown>, nextEngram);
      }
    } catch (error) {
      console.warn('[AI双向系统] 写入 Engram EventNode 失败（已忽略，不影响主流程）:', error);
    }

    // 🔥 检查短期记忆是否超限，超限则删除最旧的短期记忆，并将对应的隐式中期记忆转化为正式中期记忆
    // 从 localStorage 读取短期记忆上限配置
    let SHORT_TERM_LIMIT = 5; // 默认值
    try {
      const memorySettings = localStorage.getItem('memory-settings');
      if (memorySettings) {
        const settings = JSON.parse(memorySettings);
        const limit = typeof settings.shortTermLimit === 'number' && settings.shortTermLimit > 0
          ? settings.shortTermLimit
          : (typeof settings.maxShortTerm === 'number' && settings.maxShortTerm > 0 ? settings.maxShortTerm : null);
        if (limit) SHORT_TERM_LIMIT = limit;
      }
    } catch (error) {
      console.warn('[AI双向系统] 读取记忆配置失败，使用默认值:', error);
    }

    while ((saveData as any).社交?.记忆?.短期记忆 && (saveData as any).社交.记忆.短期记忆.length > SHORT_TERM_LIMIT) {
      // 删除最旧的短期记忆（第一个）
      (saveData as any).社交.记忆.短期记忆.shift();
      console.log(`[AI双向系统] 短期记忆超过上限（${SHORT_TERM_LIMIT}条），已删除最旧的短期记忆。当前短期记忆数量: ${(saveData as any).社交.记忆.短期记忆.length}`);

      // 将对应的隐式中期记忆转化为正式中期记忆
      if ((saveData as any).社交.记忆.隐式中期记忆 && (saveData as any).社交.记忆.隐式中期记忆.length > 0) {
        const implicitMidTerm = (saveData as any).社交.记忆.隐式中期记忆.shift();
        if (implicitMidTerm) {
          if (!Array.isArray((saveData as any).社交.记忆.中期记忆)) (saveData as any).社交.记忆.中期记忆 = [];
          (saveData as any).社交.记忆.中期记忆.push(implicitMidTerm);
          console.log(`[AI双向系统] 已将隐式中期记忆转化为正式中期记忆。当前中期记忆数量: ${(saveData as any).社交.记忆.中期记忆.length}`);
        }
      }
    }

    // 🔥 叙事历史存储在IndexedDB中，不限制条数
    // 叙事历史只用于UI显示和导出小说，不需要发送给AI（已在第122行移除）

    // 检查是否达到精炼/长期总结阈值（二选一，不重复触发）
    try {
      const memorySettings = JSON.parse(localStorage.getItem('memory-settings') || '{}');
      const midTermRefineTrigger = memorySettings.midTermRefineTrigger ?? 25;
      const longTermTrigger = memorySettings.longTermTrigger ?? 50;
      const midTermCount = (saveData as any).社交?.记忆?.中期记忆?.length ?? 0;
      if (midTermCount >= longTermTrigger) {
        this.triggerMemorySummary().catch(error => {
          console.error('[AI双向系统] 自动长期总结在后台失败:', error);
        });
      } else if (midTermCount >= midTermRefineTrigger) {
        this.triggerMidTermRefine().catch(error => {
          console.error('[AI双向系统] 自动中期精炼在后台失败:', error);
        });
      }
    } catch (error) {
      console.warn('[AI双向系统] 检查记忆阈值时出错:', error);
    }

    // [MING] 合并 semantic_memory 到 系统.扩展（game_entities 已移除，关系图由 社交.关系 派生）
    mergeInto扩展(saveData as Record<string, unknown>, {
      semantic_memory: (response as any).semantic_memory,
    });

    if (!response.tavern_commands?.length) {
      return { saveData, stateChanges: { changes, timestamp: new Date().toISOString() } };
    }

    // 🔥 新增：预处理指令以修复常见的AI错误
    const preprocessedCommands = this._preprocessCommands(response.tavern_commands);

    // 🔥 步骤1：验证并清理指令格式
    const { validateCommands, cleanCommands } = await import('./commandValidator');
    const validation = validateCommands(preprocessedCommands);

    // 🔥 步骤2：验证指令值的格式，过滤掉格式错误的指令
    const { validateAndRepairCommandValue } = await import('./commandValueValidator');
    const validCommands: any[] = [];
    const rejectedCommands: Array<{ command: any; errors: string[] }> = [];

    preprocessedCommands.forEach((cmd, index) => {
      const valueValidation = validateAndRepairCommandValue(cmd);
      if (!valueValidation.valid) {
        console.error(`[AI双向系统] ❌ 拒绝执行指令[${index}]，格式错误:`, valueValidation.errors);
        rejectedCommands.push({
          command: cmd,
          errors: valueValidation.errors
        });
      } else {
        validCommands.push(cmd);
      }
    });

    // 记录被拒绝的指令
    if (rejectedCommands.length > 0) {
      console.error(`[AI双向系统] 共拒绝 ${rejectedCommands.length} 条格式错误的指令`);
      rejectedCommands.forEach(({ command, errors }) => {
        changes.unshift({
          key: '❌ 格式错误（已拒绝）',
          action: 'validation_error',
          oldValue: undefined,
          newValue: {
            command: JSON.stringify(command, null, 2),
            errors: errors
          }
        });
      });
    }

    if (!validation.valid) {
      console.error('[AI双向系统] 指令格式验证失败:', validation.errors);
      validation.errors.forEach(err => console.error(`  - ${err}`));

      // 将验证错误添加到changes数组顶部
      if (validation.invalidCommands && validation.invalidCommands.length > 0) {
        validation.invalidCommands.forEach(({ command, errors }) => {
          changes.unshift({
            key: '❌ 错误指令',
            action: 'validation_error',
            oldValue: undefined,
            newValue: {
              command: JSON.stringify(command, null, 2),
              errors: errors
            }
          });
        });
      }
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warn => console.warn(`[AI双向系统] ${warn}`));
    }

    // 🔥 步骤3：清理指令，移除多余字段（只处理通过验证的指令）
    const cleanedCommands = cleanCommands(validCommands);

    // 🔥 步骤4：对指令排序，确保 set 上限的操作先于 set/add 当前值的操作
    // 这样突破时先改上限再改当前值，避免当前值被错误限制
    const sortedCommands = [...cleanedCommands].sort((a, b) => {
      const isASetMax = a.action === 'set' && a.key.endsWith('.上限');
      const isBSetMax = b.action === 'set' && b.key.endsWith('.上限');
      if (isASetMax && !isBSetMax) return -1;
      if (!isASetMax && isBSetMax) return 1;
      return 0;
    });

    console.log(`[AI双向系统] 执行 ${sortedCommands.length} 条有效指令，拒绝 ${rejectedCommands.length} 条无效指令`);

    // 命令执行前记录旧位置，用于判定是否发生地点变更（同一地点不重复生成路人 NPC）
    const oldLocDesc = ((saveData as any).角色?.位置 as { 描述?: string } | undefined)?.描述 ?? '';

    for (const command of sortedCommands) {
      if (abortRequested()) {
        console.log('[AI System] Abort detected, stop command execution loop');
        break;
      }
      try {
        const oldValue = get(saveData, command.key);
        this.executeCommand(command, saveData);
        const newValue = get(saveData, command.key);
        changes.push({
          key: command.key,
          action: command.action,
          oldValue: this._summarizeValueForChangeLog(command.key, oldValue, command.action),
          newValue: this._summarizeValueForChangeLog(command.key, newValue, command.action)
        });
      } catch (error) {
        console.error(`[AI双向系统] 指令执行失败:`, command, error);
      }
    }

    // [MING] 主回合专用：被本批命令更新的 NPC 写入 上次主回合更新回合（仅主回合，心跳应用命令不经过此处）
    if (!isInitialization) {
      const currentRound = (saveData as any).元数据?.回合序号 ?? 0;
      const npcsUpdatedByCommands = new Set<string>();
      for (const cmd of sortedCommands) {
        if (!cmd.key.startsWith('社交.关系.')) continue;
        const parts = cmd.key.split('.');
        if (parts.length < 3) continue;
        npcsUpdatedByCommands.add(parts[2]);
      }
      for (const npcName of npcsUpdatedByCommands) {
        const rel = (saveData as any).社交?.关系;
        if (rel && typeof rel === 'object' && rel[npcName] && typeof rel[npcName] === 'object') {
          set(saveData, `社交.关系.${npcName}.上次主回合更新回合`, currentRound);
        }
      }
      // 主回合成功结束：回合序号 +1（写回存档时生效）
      if (!(saveData as any).元数据) (saveData as any).元数据 = {};
      (saveData as any).元数据.回合序号 = currentRound + 1;
    }

    // 地点路人 NPC 生成：仅当玩家**移动到新地点**时生成路人 NPC；同一地点不重复生成
    const locationSetInBatch = sortedCommands.some((c) => c.key === '角色.位置');
    if (!isInitialization && locationSetInBatch && (saveData as any).角色?.位置?.描述) {
      const newDesc = String((saveData as any).角色.位置.描述 || '').trim();
      if (newDesc && oldLocDesc !== newDesc) {
        try {
          await this._generateLocationNpcs(saveData as SaveData, newDesc);
        } catch (e) {
          console.warn('[AI双向系统] 地点路人 NPC 生成失败:', e);
        }
      }
    }

    // 普通 NPC 升级逻辑：与 NPC 互动后，若该 NPC 为普通则升级为重点
    const npcInteractionPaths = ['记忆', '好感度', '当前外貌状态', '当前内心想法', '在做事项', '关系'];
    const upgradedNpcs = new Set<string>();
    for (const cmd of sortedCommands) {
      if (!cmd.key.startsWith('社交.关系.')) continue;
      const parts = cmd.key.split('.');
      if (parts.length < 3) continue;
      const npcName = parts[2];
      const isInteraction =
        (cmd.action === 'push' && (parts[3] === '记忆' || parts[3] === '记忆总结')) ||
        (cmd.action === 'add' && parts[3] === '好感度') ||
        (cmd.action === 'set' && npcInteractionPaths.includes(parts[3]));
      if (!isInteraction) continue;
      const npc = get(saveData, `社交.关系.${npcName}`);
      if (npc && typeof npc === 'object' && (npc as any).类型 === '普通') {
        upgradedNpcs.add(npcName);
      }
    }
    for (const npcName of upgradedNpcs) {
      set(saveData, `社交.关系.${npcName}.类型`, '重点');
      changes.push({
        key: `社交.关系.${npcName}.类型`,
        action: 'set',
        oldValue: '普通',
        newValue: '重点'
      });
      console.log(`[AI双向系统] 普通 NPC "${npcName}" 因互动升级为重点`);
    }

    updateMasteredSkills(saveData);

    // 校准 关系[npc].当前位置 与 世界.信息.地点信息[地点].地点NPC 双向一致（API 不一定同时写入两项）
    try {
      calibrateNpcLocationSync(saveData as Record<string, unknown>);
    } catch (e) {
      console.warn('[AI双向系统] 地点-NPC 校准失败:', e);
    }

    if ((saveData as any).元数据?.时间) {
      (saveData as any).元数据.时间 = normalizeGameTime((saveData as any).元数据.时间);
    }

    // 每次AI响应后，检查并移除过期的状态效果
    const { removedEffects } = updateStatusEffects(saveData);
    if (removedEffects.length > 0) {
      console.log(`[AI双向系统] Pinia状态更新前: 移除了 ${removedEffects.length} 个过期效果: ${removedEffects.join(', ')}`);
    }

    // 🔥 将状态变更添加到最新的叙事记录中
    const stateChangesLog: StateChangeLog = { changes, timestamp: new Date().toISOString() };
    if ((saveData as any).系统?.历史?.叙事 && (saveData as any).系统.历史.叙事.length > 0) {
      const latestNarrative = (saveData as any).系统.历史.叙事[(saveData as any).系统.历史.叙事.length - 1];
      (latestNarrative as any).stateChanges = stateChangesLog;
    }

    // [MING] 确保无论心跳是否开启，每回合都执行一次 NPC 维护（降级不活跃重点NPC）
    // 放在最后执行，以免影响本回合的交互逻辑
    if (!isInitialization) {
      const { runNpcMaintenance } = await import('@/services/worldHeartbeatService');
      runNpcMaintenance(saveData as SaveData);
    }

    if (!isInitialization) {
      const gameStateStore = useGameStateStore();
      gameStateStore.loadFromSaveData(saveData);
    }

    return { saveData, stateChanges: stateChangesLog };
  }


  /**
   * 触发记忆总结（公开方法，带锁）
   * 无论是自动还是手动，都通过此方法执行，以防止竞态条件。
   *
   * @param options - 总结选项，详见 MemorySummaryOptions 接口说明
   *
   * @example
   * // 默认配置（推荐）：Raw模式 + 非流式
   * await AIBidirectionalSystem.triggerMemorySummary();
   *
   * @example
   * // 标准模式 + 流式传输
   * await AIBidirectionalSystem.triggerMemorySummary({
   *   useRawMode: false,
   *   useStreaming: true
   * });
   */
  public async triggerMemorySummary(options?: MemorySummaryOptions): Promise<void> {
    if (this.isSummarizing) {
      toast.warning('已有一个总结任务正在进行中，请稍候...');
      console.log('[AI双向系统] 检测到已有总结任务在运行，本次触发被跳过。');
      return;
    }

    this.isSummarizing = true;
    console.log('[AI双向系统] 开始记忆总结流程...');
    toast.loading('正在调用AI总结中期记忆...', { id: 'memory-summary' });

    try {
      const gameStateStore = useGameStateStore();
      const characterStore = useCharacterStore();
      const saveData = gameStateStore.toSaveData();

      if (!saveData || !(saveData as any).社交?.记忆) {
        throw new Error('无法获取存档数据或记忆模块');
      }

      // 1. 从 localStorage 读取最新配置（长期总结专用）
      const settings = JSON.parse(localStorage.getItem('memory-settings') || '{}');
      const longTermTrigger = settings.longTermTrigger ?? 50;
      const midTermKeep = typeof settings.midTermKeep === 'number' ? settings.midTermKeep : -1;
      const longTermSummarizeCount = typeof settings.longTermSummarizeCount === 'number' && settings.longTermSummarizeCount > 0 ? settings.longTermSummarizeCount : 50;
      const longTermFormat = settings.longTermFormat || '';

      // 2. 再次检查是否需要总结
      const midTermMemories = (saveData as any).社交.记忆.中期记忆 || [];

      if (midTermMemories.length < longTermTrigger) {
        console.log(`[AI双向系统] 中期记忆数量(${midTermMemories.length})未达到长期总结阈值(${longTermTrigger})，取消总结。`);
        toast.info(`中期记忆未达到长期总结阈值(${longTermTrigger}条)，已取消总结`, { id: 'memory-summary' });
        return;
      }

      // 3. 确定要总结的数量与保留的中期记忆
      // midTermKeep === -1：不删减，只取最旧 longTermSummarizeCount 条生成 1 条长期，中期记忆整体保留
      // midTermKeep >= 0：取最旧 (length - midTermKeep) 条总结，保留最新 midTermKeep 条
      let numToSummarize: number;
      let memoriesToKeep: any[];
      if (midTermKeep < 0) {
        numToSummarize = Math.min(midTermMemories.length, longTermSummarizeCount);
        memoriesToKeep = midTermMemories; // 不删减，原样保留
      } else {
        numToSummarize = midTermMemories.length - midTermKeep;
        if (numToSummarize <= 0) {
          toast.error('记忆配置错误：长期总结时保留数量不能大于等于当前中期条数', { id: 'memory-summary' });
          return;
        }
        memoriesToKeep = midTermMemories.slice(numToSummarize);
      }

      const memoriesToSummarize = midTermMemories.slice(0, numToSummarize);
      const memoriesText = memoriesToSummarize
        .map((m: any, i: number) => `${i + 1}. ${formatMidTermEntryForPrompt(m)}`)
        .join('\n');

      console.log(`[AI双向系统] 准备长期总结：从${midTermMemories.length}条中期记忆中，用最旧${numToSummarize}条生成1条长期；保留中期条数=${midTermKeep < 0 ? '不删减' : memoriesToKeep.length}`);
      console.log(`[AI双向系统] 配置：长期触发=${longTermTrigger}, 保留数量=${midTermKeep}, 本次参与总结=${numToSummarize}`);

      // 4. 使用世界观进化提示词（中期→长期）
      const worldviewPrompt = await getPrompt('worldviewEvolution');
      const userPrompt = worldviewPrompt.replace('{{记忆内容}}', memoriesText);

      // 5. 调用 AI
      const tavernHelper = getTavernHelper();

      // 从aiService读取通用配置（流式等）
      const aiConfig = aiService.getConfig();
      const useStreaming = aiConfig.streaming !== false;

      // 记忆总结模式：从 API管理 的“功能分配 -> 模式”读取（酒馆端有效）
      let useRawMode = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useAPIManagementStore } = require('@/stores/apiManagementStore');
        const apiStore = useAPIManagementStore();
        useRawMode = apiStore.getFunctionMode('memory_summary') === 'raw';
      } catch {
        // 兼容旧配置
        useRawMode = aiConfig.memorySummaryMode === 'raw';
      }

      // 检查AI服务可用性
      if (!tavernHelper) {
        const availability = aiService.checkAvailability();
        if (!availability.available) {
          throw new Error(availability.message);
        }
      }

      // 🔥 获取精简版游戏存档数据（只包含记忆总结需要的信息）
      const simplifiedSaveData = this._extractEssentialDataForSummary(saveData);
      const saveDataJson = JSON.stringify(simplifiedSaveData, null, 2);

      console.log(`[AI双向系统] 世界观进化: ${useRawMode ? 'Raw' : '标准'}, 传输方式: ${useStreaming ? '流式' : '非流式'}`);

      let response: string;

      if (tavernHelper) {
        // 酒馆模式
        if (useRawMode) {
          // Raw模式：使用自定义提示词
          const rawResponse = await tavernHelper.generateRaw({
            ordered_prompts: [
              { role: 'system', content: `【游戏存档数据】（供参考）：\n${saveDataJson}` },
              { role: 'user', content: userPrompt },
              { role: 'user', content: ['Continue.', 'Proceed.', 'Next.', 'Go on.', 'Resume.'][Math.floor(Math.random() * 5)] },
              { role: 'assistant', content: '</input>' }
            ],
            should_stream: useStreaming,
            usageType: 'memory_summary'
          });
          response = String(rawResponse);
        } else {
          // 标准模式：使用自定义提示词
          const systemPromptCombined = `${worldviewPrompt}

【游戏存档数据】（供参考）：
${saveDataJson}`;

          const standardResponse = await tavernHelper.generate({
            user_input: userPrompt,
            should_stream: useStreaming,
            generation_id: `memory_summary_${Date.now()}`,
            usageType: 'memory_summary',
            injects: [
              {
                content: systemPromptCombined,
                role: 'system',
                depth: 4,  // 插入到较深位置，确保在用户输入之前
                position: 'in_chat'
              },
              // 🛡️ 添加assistant角色的占位消息（防止输入截断）
              {
                content: '</input>',
                role: 'assistant',
                depth: 0,  // 插入到最新位置
                position: 'in_chat'
              }
            ]
          });
          response = String(standardResponse);
        }
      } else {
        // 自定义API模式
        if (useRawMode) {
          console.log('[AI双向系统] 自定义API模式 - Raw模式记忆总结');
          response = await aiService.generateRaw({
            ordered_prompts: [
              { role: 'system', content: `【游戏存档数据】（供参考）：\n${saveDataJson}` },
              { role: 'user', content: userPrompt },
              { role: 'user', content: ['Continue.', 'Proceed.', 'Next.', 'Go on.', 'Resume.'][Math.floor(Math.random() * 5)] }
            ],
            should_stream: useStreaming,
            usageType: 'memory_summary'
          });
        } else {
          console.log('[AI双向系统] 自定义API模式 - 标准模式记忆总结');
          const systemPromptCombined = `${worldviewPrompt}

【游戏存档数据】（供参考）：
${saveDataJson}`;

          response = await aiService.generate({
            user_input: userPrompt,
            should_stream: useStreaming,
            generation_id: `memory_summary_${Date.now()}`,
            usageType: 'memory_summary',
            injects: [
              {
                content: systemPromptCombined,
                role: 'system',
                depth: 4,
                position: 'in_chat'
              }
            ] as any
          });
        }
      }

      // 解析响应（与NPC记忆总结相同的方式）
      let summaryText: string;
      const responseText = String(response).trim();

      const jsonBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch?.[1]) {
        try {
          summaryText = JSON.parse(jsonBlockMatch[1].trim()).text?.trim() || '';
        } catch {
          summaryText = '';
        }
      } else {
        try {
          summaryText = JSON.parse(responseText).text?.trim() || '';
        } catch {
          summaryText = responseText.trim();
        }
      }

      if (!summaryText || summaryText.length === 0) {
        throw new Error('AI返回了空的总结结果');
      }

      console.log('[AI双向系统] 总结文本长度:', summaryText.length, '预览:', summaryText.substring(0, 100));

      // 6. 更新游戏状态
      // 长期记忆不需要时间前缀和【记忆总结】标签，直接存储总结内容
      const newLongTermMemory = summaryText;

      // 确保 memory 对象存在
      if (!gameStateStore.memory) {
        gameStateStore.memory = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
      }

      gameStateStore.memory.长期记忆.push(newLongTermMemory);
      if (midTermKeep >= 0) {
        gameStateStore.memory.中期记忆 = memoriesToKeep;
      }
      // midTermKeep < 0 时不修改中期记忆（不删减）

      // 7. 保存到存档
      await characterStore.saveCurrentGame();

      console.log(`[AI双向系统] ✅ 长期总结完成：${numToSummarize}条参与总结 -> 1条长期记忆。中期${midTermKeep < 0 ? '未删减' : `保留${memoriesToKeep.length}条`}`);
      toast.success(`成功总结 ${numToSummarize} 条记忆！`, { id: 'memory-summary' });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      console.error('[AI双向系统] 记忆总结失败:', error);
      toast.error(`记忆总结失败: ${errorMsg}`, { id: 'memory-summary' });
    } finally {
      this.isSummarizing = false;
      console.log('[AI双向系统] 记忆总结流程结束，已释放锁。');
    }
  }

  /**
   * 触发中期记忆精炼：条数达阈值时去重合并，精炼结果整体替代中期记忆
   */
  public async triggerMidTermRefine(): Promise<void> {
    if (this.isRefining) {
      toast.warning('已有精炼任务在进行中，请稍候...');
      return;
    }
    if (this.isSummarizing) {
      console.log('[AI双向系统] 长期总结进行中，跳过本次精炼');
      return;
    }
    this.isRefining = true;
    toast.loading('正在精炼中期记忆...', { id: 'memory-refine' });
    try {
      const gameStateStore = useGameStateStore();
      const characterStore = useCharacterStore();
      const saveData = gameStateStore.toSaveData();
      if (!saveData || !(saveData as any).社交?.记忆) {
        throw new Error('无法获取存档或记忆模块');
      }
      const settings = JSON.parse(localStorage.getItem('memory-settings') || '{}');
      const midTermRefineTrigger = settings.midTermRefineTrigger ?? 25;
      const midTermMemories = (saveData as any).社交.记忆.中期记忆 || [];
      if (midTermMemories.length < midTermRefineTrigger) {
        toast.info(`中期记忆未达到精炼阈值(${midTermRefineTrigger}条)`, { id: 'memory-refine' });
        return;
      }
      const memoriesText = midTermMemories
        .map((m: any, i: number) => `${i + 1}. ${formatMidTermEntryForPrompt(m)}`)
        .join('\n');
      const refinePrompt = await getPrompt('midTermRefine');
      const userPrompt = refinePrompt.replace('{{记忆内容}}', memoriesText);
      const aiConfig = aiService.getConfig();
      let useRawMode = true;
      try {
        const { useAPIManagementStore } = require('@/stores/apiManagementStore');
        useRawMode = useAPIManagementStore().getFunctionMode('memory_summary') === 'raw';
      } catch {
        useRawMode = aiConfig.memorySummaryMode === 'raw';
      }
      const tavernHelper = getTavernHelper();
      let response: string;
      if (tavernHelper) {
        response = String(await tavernHelper.generateRaw({
          ordered_prompts: [
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: '</input>' }
          ],
          should_stream: false,
          usageType: 'memory_summary'
        }));
      } else {
        response = await aiService.generateRaw({
          ordered_prompts: [{ role: 'user', content: userPrompt }],
          should_stream: false,
          usageType: 'memory_summary'
        });
      }
      const text = String(response).trim();
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      const raw = jsonMatch ? jsonMatch[1].trim() : text;
      let parsed: { refined?: Array<{ 相关角色?: string[]; 事件时间?: string; 记忆主体?: string }> };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('精炼 API 返回的不是有效 JSON');
      }
      const refined = Array.isArray(parsed.refined) ? parsed.refined : [];
      const newMidTerm: any[] = refined
        .filter((e: any) => e && typeof e.记忆主体 === 'string')
        .map((e: any) => ({
          相关角色: Array.isArray(e.相关角色) ? e.相关角色 : [],
          事件时间: typeof e.事件时间 === 'string' ? e.事件时间 : '',
          记忆主体: String(e.记忆主体).trim(),
          已精炼: true
        }));
      if (newMidTerm.length === 0) {
        throw new Error('精炼结果为空或格式无效');
      }
      if (!gameStateStore.memory) {
        gameStateStore.memory = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
      }
      gameStateStore.memory.中期记忆 = newMidTerm;
      await characterStore.saveCurrentGame();
      console.log(`[AI双向系统] ✅ 中期精炼完成：${midTermMemories.length}条 -> ${newMidTerm.length}条`);
      toast.success(`中期记忆已精炼：${midTermMemories.length}条 → ${newMidTerm.length}条`, { id: 'memory-refine' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      console.error('[AI双向系统] 中期精炼失败:', error);
      toast.error(`精炼失败: ${msg}`, { id: 'memory-refine' });
    } finally {
      this.isRefining = false;
    }
  }

  private _preprocessCommands(commands: any[]): any[] {
    if (!Array.isArray(commands)) return [];

    const inventoryRootKeys = new Set(['背包.物品', '物品栏.物品']);

    return commands.map((cmd) => {
      if (!cmd || typeof cmd !== 'object') return cmd;

      // 修复: AI推送一个字符串而不是物品对象到物品栏
      if (cmd.action === 'push' && inventoryRootKeys.has(cmd.key) && typeof cmd.value === 'string') {
        console.warn(`[AI双向系统] 预处理: 将字符串物品 "${cmd.value}" 转换为对象。`);
        const itemName = cmd.value;
        return {
          ...cmd,
          value: {
            物品ID: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            名称: itemName,
            类型: '杂物',
            品质: { quality: '凡品', grade: 0 },
            数量: 1,
            描述: `一个普通的${itemName}。`
          }
        };
      }

      // 修复: 新增功法但缺少功法技能数组，导致后续生成/校验报错
      const isInventoryItemCreation =
        (cmd.action === 'push' && inventoryRootKeys.has(cmd.key)) ||
        (cmd.action === 'set' &&
          typeof cmd.key === 'string' &&
          Array.from(inventoryRootKeys).some((root) => cmd.key.startsWith(root + '.')));

      if (isInventoryItemCreation && cmd.value && typeof cmd.value === 'object' && cmd.value.类型 === '功法') {
        return { ...cmd, value: this._repairTechniqueItem(cmd.value) };
      }

      return cmd;
    });
  }

  private _repairTechniqueItem(item: any): any {
    if (!item || typeof item !== 'object') return item;
    if (item.类型 !== '功法') return item;

    const repaired: any = { ...item };

    const techniqueName = typeof repaired.名称 === 'string' && repaired.名称.trim() ? repaired.名称.trim() : '未知功法';

    const progress =
      typeof repaired.修炼进度 === 'number' && Number.isFinite(repaired.修炼进度) ? repaired.修炼进度 : 0;
    repaired.修炼进度 = progress;

    if (!Array.isArray(repaired.功法技能)) {
      repaired.功法技能 = [];
    }

    repaired.功法技能 = repaired.功法技能
      .filter((s: any) => s && typeof s === 'object')
      .map((s: any, idx: number) => {
        const skillName =
          typeof s.技能名称 === 'string' && s.技能名称.trim() ? s.技能名称.trim() : `${techniqueName}·招式${idx + 1}`;
        const skillDescription = typeof s.技能描述 === 'string' ? s.技能描述 : '';
        const unlockThreshold =
          typeof s.熟练度要求 === 'number' && Number.isFinite(s.熟练度要求) ? s.熟练度要求 : 0;
        const cost = typeof s.消耗 === 'string' ? s.消耗 : '';
        return { ...s, 技能名称: skillName, 技能描述: skillDescription, 熟练度要求: unlockThreshold, 消耗: cost };
      });

    if (repaired.功法技能.length === 0) {
      console.warn(`[AI双向系统] 预处理: 功法 "${techniqueName}" 缺少功法技能，已自动补齐基础技能以防报错。`);
      repaired.功法技能 = [
        {
          技能名称: `${techniqueName}·运功`,
          技能描述: `运转${techniqueName}的基础法门，凝聚精力并稳固气机。`,
          熟练度要求: 0,
          消耗: '精力10'
        }
      ];
    }

    if (!Array.isArray(repaired.已解锁技能)) {
      repaired.已解锁技能 = [];
    }
    repaired.已解锁技能 = repaired.已解锁技能
      .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
      .map((v: string) => v.trim());

    for (const s of repaired.功法技能) {
      const unlockThreshold = typeof s.熟练度要求 === 'number' ? s.熟练度要求 : 0;
      if (progress >= unlockThreshold && typeof s.技能名称 === 'string' && !repaired.已解锁技能.includes(s.技能名称)) {
        repaired.已解锁技能.push(s.技能名称);
      }
    }

    if (typeof repaired.已装备 !== 'boolean') {
      repaired.已装备 = false;
    }

    return repaired;
  }

  /**
   * 地点路人 NPC 生成：根据当前地点与世界观，调用 LLM 生成逻辑上会出现在该地点的 NPC（多数普通、极少数重点），
   * 执行 set 社交.关系.{名字} 并写入该地点的 地点NPC。
   */
  private async _generateLocationNpcs(saveData: SaveData, locationDesc: string): Promise<void> {
    const 关系 = (saveData as any).社交?.关系;
    const existingNpcNames = typeof 关系 === 'object' && 关系 !== null ? Object.keys(关系) : [];
    const 世界信息 = (saveData as any).世界?.信息;
    const worldContext =
      typeof 世界信息 === 'object' && 世界信息 !== null
        ? [世界信息.世界背景, 世界信息.世界纪元].filter(Boolean).join('；')
        : undefined;
    const 地点信息 = 世界信息?.地点信息;
    const loc = findLocationInTree(
      地点信息 as (LocationEntry | unknown)[] | undefined,
      locationDesc
    ) as LocationEntry | null;
    const gameTime = (saveData as any).元数据?.时间;
    const 系统配置 = (saveData as any).系统?.配置;
    const { getNsfwSettingsFromStorage } = await import('@/utils/nsfw');
    const nsfwFromStorage = getNsfwSettingsFromStorage();
    const nsfwMode =
      typeof 系统配置?.nsfwMode === 'boolean' ? 系统配置.nsfwMode : nsfwFromStorage.nsfwMode;
    const nsfwGenderFilter =
      typeof 系统配置?.nsfwGenderFilter === 'string'
        ? 系统配置.nsfwGenderFilter
        : nsfwFromStorage.nsfwGenderFilter;
    const importantNpcGenerationRange =
      系统配置?.importantNpcGenerationRange &&
      typeof 系统配置.importantNpcGenerationRange === 'object'
        ? 系统配置.importantNpcGenerationRange
        : undefined;

    const prompt = buildLocationNpcGenerationPrompt({
      locationDesc,
      locationDetail: loc?.描述,
      worldContext: worldContext || undefined,
      existingNpcNames,
      gameTime:
        gameTime && typeof gameTime === 'object'
          ? { 年: gameTime.年, 月: gameTime.月, 日: gameTime.日 }
          : undefined,
      nsfwMode: nsfwMode || undefined,
      nsfwGenderFilter,
      importantNpcGenerationRange
    });

    const { useAPIManagementStore } = await import('@/stores/apiManagementStore');
    const apiStore = useAPIManagementStore();
    if (!apiStore.isFunctionEnabled('location_npc_generation')) {
      console.log('[AI双向系统] 地点路人 NPC 生成已禁用，跳过生成');
      return;
    }

    const tavernHelper = getTavernHelper();
    let rawResponse: string;
    if (tavernHelper) {
      rawResponse = String(
        await tavernHelper.generateRaw({
          ordered_prompts: [
            { role: 'system', content: '你只输出一个 JSON 对象，不要任何解释或思维链。' },
            { role: 'user', content: prompt }
          ],
          should_stream: false,
          usageType: 'location_npc_generation'
        })
      );
    } else {
      rawResponse = await aiService.generateRaw({
        ordered_prompts: [
          { role: 'system', content: '你只输出一个 JSON 对象，不要任何解释或思维链。' },
          { role: 'user', content: prompt }
        ],
        should_stream: false,
        usageType: 'location_npc_generation'
      });
    }

    const trimmed = String(rawResponse).trim();
    const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : trimmed;
    let parsed: { tavern_commands?: Array<{ action: string; key: string; value?: unknown }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn('[AI双向系统] 地点路人 NPC 生成：响应非合法 JSON，已跳过');
      return;
    }

    const commands = Array.isArray(parsed.tavern_commands) ? parsed.tavern_commands : [];
    const newNpcNames: string[] = [];

    for (const cmd of commands) {
      if (!cmd || cmd.action !== 'set' || typeof cmd.key !== 'string' || !cmd.key.startsWith('社交.关系.')) continue;
      const parts = cmd.key.split('.');
      if (parts.length !== 3) continue;
      const npcName = parts[2];
      if (!npcName || existingNpcNames.includes(npcName)) continue;

      let value = cmd.value;
      if (value && typeof value === 'object') {
        (value as any).当前位置 = (value as any).当前位置 && typeof (value as any).当前位置 === 'object'
          ? { ...(value as any).当前位置, 描述: locationDesc }
          : { 描述: locationDesc };
        const gameTimeForValidate = (saveData as any).元数据?.时间;
        const [valid, repaired] = validateAndRepairNpcProfile(value, gameTimeForValidate);
        if (!valid || !repaired) continue;
        value = repaired;
      } else {
        continue;
      }

      try {
        this.executeCommand({ action: 'set', key: cmd.key, value }, saveData);
        newNpcNames.push(npcName);
        existingNpcNames.push(npcName);
      } catch (e) {
        console.warn('[AI双向系统] 地点路人 NPC 指令执行失败:', cmd.key, e);
      }
    }

    if (newNpcNames.length > 0) {
      appendNpcsToLocation(saveData as Record<string, unknown>, locationDesc, newNpcNames);
      console.log('[AI双向系统] 地点路人 NPC 已生成:', newNpcNames.join('、'));
    }
  }

  private executeCommand(command: { action: string; key: string; value?: unknown }, saveData: SaveData): void {
    const { action, key, value } = command;

    if (!action || !key) {
      throw new Error('指令格式错误：缺少 action 或 key');
    }

    const path = key.toString();
    const allowedRoots = ['元数据', '角色', '社交', '世界', '系统'] as const;
    const isV3Path = allowedRoots.some((root) => path === root || path.startsWith(`${root}.`));
    if (!isV3Path) {
      throw new Error(`指令key必须以 ${allowedRoots.join(' / ')} 开头（V3短路径），当前: ${path}`);
    }

    // 🔥 保护关键数组字段，防止被设为 null
    const arrayFields = [
      // V3
      '角色.效果',
      '社交.任务.当前任务列表',
      '社交.记忆.短期记忆',
      '社交.记忆.中期记忆',
      '社交.记忆.长期记忆',
      '社交.记忆.隐式中期记忆',
      '系统.历史.叙事',
    ];
    // 精确匹配：路径必须完全等于数组字段，或者是数组元素（如 状态效果[0]）但不是其子属性
    const isArrayField = arrayFields.some(field => {
      // 完全匹配
      if (path === field) return true;
      // 匹配数组元素，但不匹配数组元素的子属性
      // 例如：状态效果[0] ✓  状态效果[0].持续时间分钟 ✗
      if (path.startsWith(field + '[') && !path.includes('.', field.length)) return true;
      return false;
    });

    if (action === 'set' && isArrayField) {
      if (value === null || value === undefined) {
        console.warn(`[AI双向系统] 阻止将数组字段 ${path} 设为 null/undefined，改为空数组`);
        set(saveData, path, []);
        return;
      }
      if (!Array.isArray(value)) {
        console.warn(`[AI双向系统] 阻止将数组字段 ${path} 设为非数组值，保持原值`);
        return;
      }
    }

    if (action === 'set') {
      const segments = path.split('.');
      const isNpcRoot = segments.length === 3 && segments[0] === '社交' && segments[1] === '关系';
      if (isNpcRoot && isPlainObject(value)) {
        const existingNpc = get(saveData, path);
        const baseNpc = isPlainObject(existingNpc) ? existingNpc : {};
        const mergedNpc = mergePlainObjectsReplacingArrays(baseNpc, value);
        if (typeof (mergedNpc as any).名字 !== 'string' || !(mergedNpc as any).名字) {
          (mergedNpc as any).名字 = segments[2];
        }
        const gameTime = (saveData as any)?.元数据?.时间;
        const [isValid, repairedNpc] = validateAndRepairNpcProfile(mergedNpc, gameTime);
        if (isValid && repairedNpc) {
          set(saveData, path, repairedNpc);
          return;
        }
      }
      // 社交.关系.{npc}.关系 且 value 为 plain object：合并进既有 关系，不整体替换
      const is关系Merge = segments.length === 4 && segments[0] === '社交' && segments[1] === '关系' && segments[3] === '关系' && isPlainObject(value);
      if (is关系Merge) {
        const existing = get(saveData, path);
        const base = isPlainObject(existing) ? existing : {};
        set(saveData, path, { ...base, ...value });
        return;
      }
    }
    switch (action) {
      case 'set': {
        // 在做事项更新时：将当前在做事项归档到 历史在做事项（不交由模型更新）
        const segments = path.split('.');
        const is在做事项Path = segments.length === 4 && segments[0] === '社交' && segments[1] === '关系' && segments[3] === '在做事项';
        if (is在做事项Path && typeof value === 'string') {
          const npcPath = `社交.关系.${segments[2]}`;
          const npc = get(saveData, npcPath) as Record<string, unknown> | undefined;
          const current在做事项 = npc?.在做事项;
          if (typeof current在做事项 === 'string' && current在做事项.trim()) {
            let 历史 = Array.isArray(npc?.历史在做事项) ? (npc.历史在做事项 as string[]).slice() : [];
            历史.unshift(current在做事项.trim());
            const maxHistory = 20;
            if (历史.length > maxHistory) 历史 = 历史.slice(0, maxHistory);
            set(saveData, `${npcPath}.历史在做事项`, 历史);
          }
        }
        const oldLocForLeave = path === '角色.位置' ? (get(saveData, path) as { 描述?: string } | undefined) : undefined;
        const oldDescForLeave = oldLocForLeave?.描述;
        set(saveData, path, value);
        if (path === '角色.位置' && value && typeof value === 'object') {
          const newDesc = (value as { 描述?: string }).描述;
          if (typeof newDesc === 'string' && newDesc.trim()) {
            const 世界 = get(saveData, '世界', {}) as Record<string, unknown>;
            if (!世界.状态) 世界.状态 = {};
            const 状态 = 世界.状态 as Record<string, unknown>;
            const 探索记录 = Array.isArray(状态.探索记录) ? 状态.探索记录 : [];
            if (!探索记录.includes(newDesc)) {
              探索记录.push(newDesc);
              状态.探索记录 = 探索记录;
              set(saveData, '世界', 世界);
            }
          }
          if (typeof oldDescForLeave === 'string' && oldDescForLeave.trim() && oldDescForLeave !== newDesc) {
            onPlayerLeaveLocation(saveData as Record<string, unknown>, oldDescForLeave, newDesc);
          }
        }
        break;
      }

      case 'add': {
        const currentValue = get(saveData, path, 0);
        if (typeof currentValue !== 'number' || typeof value !== 'number') {
          throw new Error(`ADD操作要求数值类型，但得到: ${typeof currentValue}, ${typeof value}`);
        }
        const newValue = currentValue + value;

        // 🔥 防止货币（金钱）变成负数
        if (path.includes('金钱') && newValue < 0) {
          console.warn(`[AI双向系统] ${path} 执行add后会变成负数 (${currentValue} + ${value} = ${newValue})，已限制为0`);
          set(saveData, path, 0);
        } else {
          set(saveData, path, newValue);
        }

        break;
      }

      case 'push': {
        // 世界.状态.探索记录：需确保 世界.状态 存在；地点名称去重
        const is探索记录 = path === '世界.状态.探索记录';
        if (is探索记录) {
          const 世界 = get(saveData, '世界', {}) as any;
          if (!世界.状态) 世界.状态 = {};
          const 探索记录 = Array.isArray(世界.状态.探索记录) ? 世界.状态.探索记录 : [];
          const locName = typeof value === 'string' ? value.trim() : null;
          if (locName && !探索记录.includes(locName)) {
            探索记录.push(locName);
            世界.状态.探索记录 = 探索记录;
            set(saveData, '世界', 世界);
          }
          break;
        }
        // 世界.信息.地点信息：需确保 世界.信息 及 地点信息 存在，否则 get 返回默认 [] 导致写入失败
        const is地点信息 = path === '世界.信息.地点信息';
        if (is地点信息) {
          const 世界 = get(saveData, '世界', {}) as any;
          if (!世界.信息 || typeof 世界.信息 !== 'object') 世界.信息 = {};
          if (!Array.isArray(世界.信息.地点信息)) 世界.信息.地点信息 = [];
          const valueToPush = value ?? null;
          if (valueToPush && typeof valueToPush === 'object') {
            世界.信息.地点信息.push(valueToPush);
            set(saveData, '世界', 世界);
            console.log('[AI双向系统] push 世界.信息.地点信息 成功:', (valueToPush as any)?.名称);
          }
          break;
        }
        const array = get(saveData, path, []) as unknown[];
        if (!Array.isArray(array)) {
          throw new Error(`PUSH操作要求数组类型，但 ${path} 是 ${typeof array}`);
        }
        let valueToPush: unknown = value ?? null;
        // 当向记忆数组推送时，自动添加时间戳（但跳过隐式中期记忆，因为已在processGmResponse中处理）
        const isMemoryPath =
          path.startsWith('社交.记忆.') || path.startsWith('记忆.');
        const isImplicitMid =
          path === '社交.记忆.隐式中期记忆' || path === '记忆.隐式中期记忆';
        if (typeof valueToPush === 'string' && isMemoryPath && !isImplicitMid) {
          if (!valueToPush.trim()) {
            break;
          }
          const timePrefix = this._formatGameTime((saveData as any).元数据?.时间);
          valueToPush = `${timePrefix}${valueToPush}`;
        }
        array.push(valueToPush);
        set(saveData, path, array);
        break;
      }

      case 'delete':
        unset(saveData, path);
        break;

      case 'pull': {
        // 从数组中移除匹配的元素（用于任务系统、状态效果等）
        const array = get(saveData, path, []) as unknown[];
        if (!Array.isArray(array)) {
          throw new Error(`PULL操作要求数组类型，但 ${path} 是 ${typeof array}`);
        }

        // value 应该是一个对象，包含用于匹配的字段
        if (!value || typeof value !== 'object') {
          throw new Error(`PULL操作要求value是对象类型，用于匹配要移除的元素`);
        }

        const matchCriteria = value as Record<string, unknown>;
        const updatedArray = array.filter(item => {
          if (!item || typeof item !== 'object') return true;

          // 检查是否所有匹配条件都满足
          for (const [key, val] of Object.entries(matchCriteria)) {
            if ((item as Record<string, unknown>)[key] !== val) {
              return true; // 不匹配，保留
            }
          }
          return false; // 完全匹配，移除
        });

        set(saveData, path, updatedArray);
        console.log(`[AI双向系统] PULL操作: 从 ${path} 移除了 ${array.length - updatedArray.length} 个元素`);
        break;
      }

      default:
        throw new Error(`未知的操作类型: ${action}`);
    }
  }

  /**
   * 仅将命令应用到 saveData，不写 上次主回合更新回合（供世界心跳等非主回合流程调用）。
   */
  public applyCommandsOnly(
    saveData: SaveData,
    commands: Array<{ action: string; key: string; value?: unknown }>
  ): void {
    for (const cmd of commands) {
      try {
        this.executeCommand(cmd, saveData);
      } catch (e) {
        console.warn('[AI双向系统] applyCommandsOnly 单条失败:', cmd.key, e);
      }
    }
  }

  /**
   * 提取记忆总结所需的精简存档数据
   * 与正式游戏交互保持一致：移除叙事历史、短期记忆、隐式中期记忆
   */
  private _extractEssentialDataForSummary(saveData: SaveData): SaveData {
    const simplified = cloneDeep(saveData);

    // 移除叙事历史（避免与短期记忆重复）
    const hist = (simplified as any).系统?.历史;
    if (hist?.叙事) delete hist.叙事;

    // 移除短期和隐式中期记忆（以优化AI上下文）
    const mem = (simplified as any).社交?.记忆;
    if (mem) {
      delete mem.短期记忆;
      delete mem.隐式中期记忆;
    }

    return simplified;
  }

  /**
   * 智能摘要值，避免在状态变更日志中存储大量重复数据
   * 对于大型数组和对象，只记录摘要信息
   */
  /**
   * 为变更日志优化的值摘要方法
   * 对于关键路径（NPC记忆、事件等），保留更多信息以便正确显示
   */
  private _summarizeValueForChangeLog(key: string, value: any, action: string): any {
    // null 或 undefined 直接返回
    if (value === null || value === undefined) {
      return value;
    }

    // 基本类型直接返回
    if (typeof value !== 'object') {
      return value;
    }

    // 🔥 关键路径：对于 push/pull 操作，保留完整的新增/删除值
    if (action === 'push' || action === 'pull') {
      // 对于单个值的 push/pull，完整保留
      return cloneDeep(value);
    }

    // 🔥 关键路径：NPC记忆相关（社交.关系.*.人物记忆）
    if (key.includes('社交.关系.') && key.includes('.人物记忆')) {
      // 对于记忆数组，保留最后一个元素（最新记忆）
      if (Array.isArray(value) && value.length > 0) {
        return {
          __type: 'Array',
          __length: value.length,
          __summary: `[${value.length}条记忆]`,
          __last: cloneDeep(value[value.length - 1])
        };
      }
    }

    // 🔥 关键路径：事件记录
    if (key.includes('社交.事件') || key.includes('系统.事件')) {
      if (Array.isArray(value) && value.length > 0) {
        return {
          __type: 'Array',
          __length: value.length,
          __summary: `[${value.length}个事件]`,
          __last: cloneDeep(value[value.length - 1])
        };
      }
    }

    // 🔥 关键路径：短期记忆、中期记忆
    if (key.includes('记忆.短期记忆') || key.includes('记忆.中期记忆') || key.includes('记忆.隐式中期记忆')) {
      if (Array.isArray(value) && value.length > 0) {
        return {
          __type: 'Array',
          __length: value.length,
          __summary: `[${value.length}条记忆]`,
          __last: cloneDeep(value[value.length - 1])
        };
      }
    }

    // 其他情况使用原有的摘要逻辑
    return this._summarizeValue(value);
  }

  private _summarizeValue(value: any): any {
    // null 或 undefined 直接返回
    if (value === null || value === undefined) {
      return value;
    }

    // 基本类型直接返回
    if (typeof value !== 'object') {
      return value;
    }

    // 数组类型：根据大小决定是否摘要
    if (Array.isArray(value)) {
      // 小数组（≤3个元素）：完整保留
      if (value.length <= 3) {
        return cloneDeep(value);
      }
      // 大数组：只记录摘要信息
      return {
        __type: 'Array',
        __length: value.length,
        __summary: `[数组: ${value.length}个元素]`,
        __first: value[0] ? this._summarizeValue(value[0]) : undefined,
        __last: value[value.length - 1] ? this._summarizeValue(value[value.length - 1]) : undefined
      };
    }

    // 对象类型：检查是否是大型对象
    const keys = Object.keys(value);

    // 小对象（≤5个属性）：完整保留
    if (keys.length <= 5) {
      return cloneDeep(value);
    }

    // 大对象：只记录摘要信息
    const summary: any = {
      __type: 'Object',
      __keys: keys.length,
      __summary: `[对象: ${keys.length}个属性]`
    };

    // 保留前3个属性作为预览
    keys.slice(0, 3).forEach(key => {
      summary[key] = this._summarizeValue(value[key]);
    });

    return summary;
  }

  private parseAIResponse(rawResponse: string): GM_Response {
    if (!rawResponse || typeof rawResponse !== 'string') {
      throw new Error('AI响应为空或格式错误');
    }

    const rawText = rawResponse.trim();
    console.log('[parseAIResponse] 原始响应长度:', rawText.length);
    console.log('[parseAIResponse] 原始响应前500字符:', rawText.substring(0, 500));

    // 🔥 移除思维链（兜底保护）
    // 支持多种变体：<thinking>, <antThinking>, <ant-thinking>, <reasoning>, <thought> 等
    const cleanedText = rawText
      .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<\/?reasoning>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<\/?thought>/gi, '')
      .trim();

    const tryParse = (text: string): Record<string, unknown> | null => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const standardize = (obj: Record<string, unknown>): GM_Response => {
      const commands = Array.isArray(obj.tavern_commands) ? obj.tavern_commands :
                      Array.isArray(obj.指令) ? obj.指令 :
                      Array.isArray(obj.commands) ? obj.commands : [];

      const tavernCommands = commands.map((cmd: any) => ({
        action: cmd.action || 'set',
        key: cmd.key || '',
        value: cmd.value
      }));

      let actionOptions = Array.isArray(obj.action_options) ? obj.action_options :
                          Array.isArray(obj.行动选项) ? obj.行动选项 : [];

      actionOptions = actionOptions.filter((opt: unknown) =>
        typeof opt === 'string' && opt.trim().length > 0
      );

      if (actionOptions.length === 0) {
        console.warn('[parseAIResponse] ⚠️ action_options为空，使用默认选项');
        actionOptions = [
          '继续当前活动',
          '观察周围环境',
          '与附近的人交谈',
          '查看自身状态',
          '稍作休息调整'
        ];
      }

      const rawMid = obj.mid_term_memory ?? obj.中期记忆 ?? obj.memory;
      const mid_term_memory: string | ImplicitMidTermEntry =
        rawMid != null && typeof rawMid === 'object' && typeof (rawMid as ImplicitMidTermEntry).记忆主体 === 'string'
          ? (rawMid as ImplicitMidTermEntry)
          : String(rawMid || '');

      const gm: GM_Response = {
        text: String(obj.text || obj.叙事文本 || obj.narrative || ''),
        mid_term_memory,
        tavern_commands: tavernCommands,
        action_options: this.sanitizeActionOptionsForDisplay(actionOptions)
      };
      if (obj.semantic_memory != null && typeof obj.semantic_memory === 'object') gm.semantic_memory = obj.semantic_memory as GM_Response['semantic_memory'];
      return gm;
    };

    // 1. 直接解析
    let parsedObj = tryParse(cleanedText);
    if (parsedObj) return standardize(parsedObj);

    // 2. 提取代码块（结尾的```可选，处理AI未闭合代码块的情况）
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (codeBlockMatch?.[1]) {
      parsedObj = tryParse(codeBlockMatch[1].trim());
      if (parsedObj) return standardize(parsedObj);
    }

    // 3. 提取第一个JSON对象
    const extractFirstJSON = (text: string): string | null => {
      const startIndex = text.indexOf('{');
      if (startIndex === -1) return null;

      let depth = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (char === '{') depth++;
        if (char === '}') {
          depth--;
          if (depth === 0) return text.substring(startIndex, i + 1);
        }
      }
      return null;
    };

    const firstJSON = extractFirstJSON(cleanedText);
    if (firstJSON) {
      parsedObj = tryParse(firstJSON);
      if (parsedObj) {
        console.log('[parseAIResponse] ✅ 成功提取第一个JSON对象');
        return standardize(parsedObj);
      }
    }

    throw new Error('无法解析AI响应：未找到有效的JSON格式');
  }

  /**
   * 从 API 原始响应中提取 tavern_commands，与主流程解析逻辑一致。
   * 供世界心跳等非主流程复用：支持传入字符串（助手内容）或完整响应对象（含 choices/candidates）。
   */
  public extractTavernCommandsFromResponse(
    rawResponse: string | Record<string, unknown> | null | undefined
  ): Array<{ action: string; key: string; value?: unknown }> {
    let contentStr: string;
    if (rawResponse == null) {
      contentStr = '';
    } else if (typeof rawResponse === 'string') {
      contentStr = rawResponse.trim();
    } else {
      const obj = rawResponse as Record<string, unknown>;
      const fromChoices = (obj.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content;
      const fromCandidates = (obj.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>)?.[0]?.content?.parts?.[0]?.text;
      contentStr = (typeof fromChoices === 'string' ? fromChoices : fromCandidates ?? '').trim();
      if (!contentStr && typeof obj.text === 'string') contentStr = String(obj.text).trim();
      if (!contentStr) contentStr = JSON.stringify(rawResponse);
    }

    const cleanedText = contentStr
      .replace(/<(?:ant[-_]?)?thinking>[\s\S]*?<\/(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<\/?(?:ant[-_]?)?thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<\/?reasoning>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<\/?thought>/gi, '')
      .trim();

    const tryParse = (text: string): Record<string, unknown> | null => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    // 1. 直接解析
    let parsedObj = tryParse(cleanedText);
    if (parsedObj) {
      const cmds = Array.isArray(parsedObj.tavern_commands) ? parsedObj.tavern_commands : Array.isArray(parsedObj.指令) ? parsedObj.指令 : [];
      return cmds.map((cmd: any) => ({ action: cmd.action || 'set', key: cmd.key || '', value: cmd.value }));
    }

    // 2. 提取代码块（与 parseAIResponse 一致，结尾 ``` 可选）
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (codeBlockMatch?.[1]) {
      parsedObj = tryParse(codeBlockMatch[1].trim());
      if (parsedObj) {
        const cmds = Array.isArray(parsedObj.tavern_commands) ? parsedObj.tavern_commands : Array.isArray(parsedObj.指令) ? parsedObj.指令 : [];
        return cmds.map((cmd: any) => ({ action: cmd.action || 'set', key: cmd.key || '', value: cmd.value }));
      }
    }

    // 3. 提取第一个 JSON 对象
    const extractFirstJSON = (text: string): string | null => {
      const startIndex = text.indexOf('{');
      if (startIndex === -1) return null;
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (char === '\\') { escapeNext = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{') depth++;
        if (char === '}') { depth--; if (depth === 0) return text.substring(startIndex, i + 1); }
      }
      return null;
    };
    const firstJSON = extractFirstJSON(cleanedText);
    if (firstJSON) {
      parsedObj = tryParse(firstJSON);
      if (parsedObj) {
        const cmds = Array.isArray(parsedObj.tavern_commands) ? parsedObj.tavern_commands : Array.isArray(parsedObj.指令) ? parsedObj.指令 : [];
        return cmds.map((cmd: any) => ({ action: cmd.action || 'set', key: cmd.key || '', value: cmd.value }));
      }
    }

    return [];
  }
}

export const AIBidirectionalSystem = AIBidirectionalSystemClass.getInstance();

// 导出 getTavernHelper 以供其他模块使用
export { getTavernHelper };
