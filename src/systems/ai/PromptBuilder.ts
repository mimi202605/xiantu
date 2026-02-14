import { getPrompt } from '@/services/defaultPrompts';
import { usePromptAssemblyStore } from '@/stores/promptAssemblyStore';
import { useUIStore } from '@/stores/uiStore';
import { getNpcsAtLocation } from '@/utils/locationUtils';
import { retrieve as memoryRetrieve } from '@/services/memoryRetrievalService';
import { cloneDeep } from 'lodash';
import { assembleSystemPrompt } from '@/utils/prompts/promptAssembler';
import { stripNsfwContentMing } from '@/utils/prompts/definitions/ming/dataDefinitionsMing';
import { getTavernHelper } from '@/utils/tavern';
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration';
import type { GM_Response } from '@/types/AIGameMaster';
import type { SaveData, NpcProfile } from '@/types/game'; // Adjust imports

export class PromptBuilder {

    public static async buildNarrativeState(stateForAI: any): Promise<Record<string, unknown>> {
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
              中期记忆: stateForAI.社交?.记忆?.中期记忆,
              长期记忆: stateForAI.社交?.记忆?.长期记忆,
            },
          },
          世界: normalizeWorldForPrompt(stateForAI.世界),
        };
      }

  public static async assembleFullSystemPrompt(
    stateForAI: any,
    uiStore: any,
    shouldRecordAssembly: boolean,
    assemblyModules: any[]
  ): Promise<string> {
    const activePrompts: string[] = [];
    if (uiStore.enableActionOptions) {
      activePrompts.push('actionOptions');
    }

    // 🔥 世界事件规则始终注入（用于“世界会变化”的叙事一致性）
    activePrompts.push('eventSystem');

    const assembledPrompt = await assembleSystemPrompt(
      activePrompts,
      uiStore.actionOptionsPrompt,
      stateForAI,
      shouldRecordAssembly ? { onSection: (m) => assemblyModules.push(m) } : undefined
    );

    return assembledPrompt;
  }
}
