import type { SaveData, LocationEntry } from '@/types/game';
import { findLocationInTree, appendNpcsToLocation } from '@/utils/locationUtils';
import { buildLocationNpcGenerationPrompt } from '@/utils/prompts/tasks/locationNpcGenerationPromptsMing';
import { useAPIManagementStore } from '@/stores/apiManagementStore';
import { getTavernHelper } from '@/utils/tavern';
import { aiService } from '@/services/aiService';
import { validateAndRepairNpcProfile } from '@/utils/dataValidation';
import { StateUpdater } from './StateUpdater';

export class NPCGenerator {
  /**
   * 地点路人 NPC 生成：根据当前地点与世界观，调用 LLM 生成逻辑上会出现在该地点的 NPC（多数普通、极少数重点），
   * 执行 set 社交.关系.{名字} 并写入该地点的 地点NPC。
   */
  public static async generateLocationNpcs(saveData: SaveData, locationDesc: string, stateUpdater: typeof StateUpdater): Promise<void> {
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
        stateUpdater.executeCommand({ action: 'set', key: cmd.key, value }, saveData);
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
}
