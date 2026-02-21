/**
 * 数据修复和清洗工具
 *
 * 功能:
 * - 修复AI返回的不完整或错误的存档数据
 * - 填充缺失的必需字段
 * - 验证并修正数据类型和范围
 *
 * 被以下文件引用:
 * - src/stores/characterStore.ts
 */

import type { SaveData, Item, NpcProfile, GameTime, Realm, PlayerAttributes, PlayerLocation } from '@/types/game';
import type { GradeType } from '@/data/itemQuality';
import { cloneDeep } from 'lodash';
import { isSaveDataV3, migrateSaveDataToLatest } from '@/utils/saveMigration';
import { DEFAULT_CURRENCY, normalizeCurrency } from '@/utils/currencyDefaults';
import { validateSaveDataV3 } from '@/utils/saveValidationV3';
import { calibrateNpcLocationSync, normalizeLocationName } from '@/utils/locationUtils';
import { createEmptyEngramMemory, ensureEngramMemory } from '@/services/engram/memoryRepository';

/**
 * 修复并清洗存档数据，确保所有必需字段存在且格式正确
 */
export function repairSaveData(saveData: SaveData | null | undefined): SaveData {
  console.log('[数据修复] 开始修复存档数据');

  try {
    if (!saveData || typeof saveData !== 'object') {
      console.error('[数据修复] ❌ 存档数据为空或无效，创建默认存档');
      return createMinimalSaveDataV3();
    }

    // 统一入口：非V3一律先迁移到V3（迁移后只保留V3结构）
    const migrated = isSaveDataV3(saveData) ? (saveData as any) : migrateSaveDataToLatest(saveData as any).migrated;
    const repaired = cloneDeep(migrated) as any;

    // 运行期校验（允许轻微修复，但结构必须是 V3 五领域）
    const validation = validateSaveDataV3(repaired);
    if (!validation.isValid) {
      console.warn('[数据修复] ⚠️ 存档结构不合格，使用最小V3模板兜底:', validation.errors);
      return createMinimalSaveDataV3();
    }

    // --- 元数据 ---
    repaired.元数据 = repaired.元数据 && typeof repaired.元数据 === 'object' ? repaired.元数据 : createMinimalSaveDataV3().元数据;
    repaired.元数据.版本号 = 3;
    repaired.元数据.存档ID = repaired.元数据.存档ID || `save_${Date.now()}`;
    repaired.元数据.存档名 = repaired.元数据.存档名 || '自动存档';
    repaired.元数据.创建时间 = repaired.元数据.创建时间 || new Date().toISOString();
    repaired.元数据.更新时间 = new Date().toISOString();
    repaired.元数据.游戏时长秒 = validateNumber(repaired.元数据.游戏时长秒, 0, 999999999, 0);
    repaired.元数据.时间 = repairGameTime(repaired.元数据.时间);
    if (typeof (repaired.元数据 as any).回合序号 !== 'number' || (repaired.元数据 as any).回合序号 < 0) {
      (repaired.元数据 as any).回合序号 = 0;
    }

    // --- 角色 ---
    repaired.角色 = repaired.角色 && typeof repaired.角色 === 'object' ? repaired.角色 : createMinimalSaveDataV3().角色;
    repaired.角色.身份 = repaired.角色.身份 && typeof repaired.角色.身份 === 'object' ? repaired.角色.身份 : createMinimalSaveDataV3().角色.身份;

    repaired.角色.身份.名字 = repaired.角色.身份.名字 || '无名修士';
    repaired.角色.身份.性别 = repaired.角色.身份.性别 || '男';
    if (!repaired.角色.身份.出生日期) repaired.角色.身份.出生日期 = { 年: 982, 月: 1, 日: 1 };
    if (!repaired.角色.身份.先天六维属性 || typeof repaired.角色.身份.先天六维属性 !== 'object') {
      repaired.角色.身份.先天六维属性 = { 体质: 5, 直觉: 5, 悟性: 5, 气运: 5, 魅力: 5, 心性: 5 };
    } else {
      const attrs = repaired.角色.身份.先天六维属性;
      attrs.体质 = validateNumber(attrs.体质, 0, 10, 5);
      attrs.直觉 = validateNumber(attrs.直觉, 0, 10, 5);
      attrs.悟性 = validateNumber(attrs.悟性, 0, 10, 5);
      attrs.气运 = validateNumber(attrs.气运, 0, 10, 5);
      attrs.魅力 = validateNumber(attrs.魅力, 0, 10, 5);
      attrs.心性 = validateNumber(attrs.心性, 0, 10, 5);
    }
    if (!repaired.角色.身份.后天六维属性 || typeof repaired.角色.身份.后天六维属性 !== 'object') {
      repaired.角色.身份.后天六维属性 = { 体质: 0, 直觉: 0, 悟性: 0, 气运: 0, 魅力: 0, 心性: 0 };
    }

    // --- 属性 ---
    if (!repaired.角色.属性 || typeof repaired.角色.属性 !== 'object') {
      console.warn('[数据修复] 属性缺失，创建默认值');
      repaired.角色.属性 = createDefaultAttributes();
    } else {
      repaired.角色.属性.地位 = repairRealm(repaired.角色.属性.地位 ?? repaired.角色.属性.境界);
      repaired.角色.属性.体力 = repairValuePair(repaired.角色.属性.体力 ?? repaired.角色.属性.气血, 100, 100);
      repaired.角色.属性.精力 = repairValuePair(repaired.角色.属性.精力 ?? repaired.角色.属性.灵气, 50, 50);
      repaired.角色.属性.洞察力 = repairValuePair(repaired.角色.属性.洞察力 ?? repaired.角色.属性.神识, 30, 30);
      repaired.角色.属性.寿命 = repairValuePair(repaired.角色.属性.寿命, 18, 80);
      repaired.角色.属性.声望 = validateNumber(repaired.角色.属性.声望, 0, 999999, 0);
      delete repaired.角色.属性.境界;
      delete repaired.角色.属性.气血;
      delete repaired.角色.属性.灵气;
      delete repaired.角色.属性.神识;
    }

    // --- 位置 ---
    if (!repaired.角色.位置 || typeof repaired.角色.位置 !== 'object') {
      repaired.角色.位置 = createDefaultLocation();
    } else if (!repaired.角色.位置.描述) {
      repaired.角色.位置.描述 = '朝天大陆·无名之地';
    }

    // --- 效果 ---
    if (!Array.isArray(repaired.角色.效果)) repaired.角色.效果 = [];

    // --- 装备 已退役，不再强制补全 ---

    // --- 背包 ---
    if (!repaired.角色.背包 || typeof repaired.角色.背包 !== 'object') {
      repaired.角色.背包 = { 金钱: { ...DEFAULT_CURRENCY }, 物品: {} };
    } else {
      const cur = normalizeCurrency(repaired.角色.背包.金钱 ?? repaired.角色.背包.灵石);
      repaired.角色.背包.金钱 = {
        现金: validateNumber(cur.现金, 0, 999999999, 0),
        铜: validateNumber(cur.铜, 0, 999999999, 0),
        银: validateNumber(cur.银, 0, 999999999, 0),
        金: validateNumber(cur.金, 0, 999999999, 0),
      };

      if (!repaired.角色.背包.物品 || typeof repaired.角色.背包.物品 !== 'object') {
        repaired.角色.背包.物品 = {};
      } else {
        const validItems: Record<string, Item> = {};
        for (const [id, item] of Object.entries(repaired.角色.背包.物品 as Record<string, unknown>)) {
          const rawItem = item as any;
          if (rawItem && typeof rawItem === 'object' && typeof rawItem.名称 === 'string' && rawItem.名称.trim()) {
            validItems[id] = repairItem(rawItem as Item);
          }
        }
        repaired.角色.背包.物品 = validItems;
      }
    }

    // --- 社交.关系 ---
    if (!repaired.社交 || typeof repaired.社交 !== 'object') repaired.社交 = createMinimalSaveDataV3().社交;
    if (!repaired.社交.关系 || typeof repaired.社交.关系 !== 'object') {
      repaired.社交.关系 = {};
    } else {
      const raw = repaired.社交.关系 as Record<string, unknown>;
      const validNpcs: Record<string, NpcProfile> = {};

      for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith('_')) continue;
        if (!value || typeof value !== 'object') continue;

        const npc = value as any;
        const nameFromValue = typeof npc.名字 === 'string' ? npc.名字.trim() : '';
        const nameFromKey = typeof key === 'string' ? key.trim() : '';
        const finalName = nameFromValue || nameFromKey;
        if (!finalName) continue;

        npc.名字 = finalName;
        validNpcs[finalName] = repairNpc(npc as NpcProfile);
      }

      repaired.社交.关系 = validNpcs;
    }

    // --- 社交.记忆 ---
    if (!repaired.社交.记忆 || typeof repaired.社交.记忆 !== 'object') {
      repaired.社交.记忆 = { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] };
    } else {
      repaired.社交.记忆.短期记忆 = Array.isArray(repaired.社交.记忆.短期记忆) ? repaired.社交.记忆.短期记忆 : [];
      repaired.社交.记忆.中期记忆 = Array.isArray(repaired.社交.记忆.中期记忆) ? repaired.社交.记忆.中期记忆 : [];
      repaired.社交.记忆.长期记忆 = Array.isArray(repaired.社交.记忆.长期记忆) ? repaired.社交.记忆.长期记忆 : [];
      repaired.社交.记忆.隐式中期记忆 = Array.isArray(repaired.社交.记忆.隐式中期记忆) ? repaired.社交.记忆.隐式中期记忆 : [];
    }

    // --- 系统.历史 ---
    if (!repaired.系统 || typeof repaired.系统 !== 'object') repaired.系统 = createMinimalSaveDataV3().系统;
    if (!repaired.系统.扩展 || typeof repaired.系统.扩展 !== 'object') repaired.系统.扩展 = {};
    repaired.系统.扩展.engramMemory = ensureEngramMemory(
      repaired.系统.扩展.engramMemory ?? createEmptyEngramMemory(),
    );
    if (!repaired.系统.历史 || typeof repaired.系统.历史 !== 'object') repaired.系统.历史 = { 叙事: [] };
    if (!Array.isArray(repaired.系统.历史.叙事)) repaired.系统.历史.叙事 = [];

    // --- 角色子模块：功法/修炼/技能 已退役，不再补全 ---

    // --- 社交.事件 ---
    if (!repaired.社交.事件 || typeof repaired.社交.事件 !== 'object') {
      repaired.社交.事件 = {
        配置: { 启用随机事件: true, 最小间隔年: 1, 最大间隔年: 10, 事件提示词: '' },
        下次事件时间: null,
        事件记录: [],
      };
    } else {
      if (!repaired.社交.事件.配置 || typeof repaired.社交.事件.配置 !== 'object') {
        repaired.社交.事件.配置 = { 启用随机事件: true, 最小间隔年: 1, 最大间隔年: 10, 事件提示词: '' };
      }
      if (!Array.isArray(repaired.社交.事件.事件记录)) repaired.社交.事件.事件记录 = [];
      if (repaired.社交.事件.下次事件时间 && typeof repaired.社交.事件.下次事件时间 !== 'object') {
        repaired.社交.事件.下次事件时间 = null;
      }
    }

    // --- 世界.状态、世界.信息 ---
    if (!repaired.世界 || typeof repaired.世界 !== 'object') repaired.世界 = createMinimalSaveDataV3().世界;
    const 原状态 = repaired.世界.状态 && typeof repaired.世界.状态 === 'object' ? repaired.世界.状态 : null;
    if (!repaired.世界.状态 || typeof repaired.世界.状态 !== 'object') repaired.世界.状态 = {};
    if (!Array.isArray(repaired.世界.状态.探索记录)) repaired.世界.状态.探索记录 = [];
    // 世界.状态.心跳（世界心跳系统）：若刚用 {} 覆盖了 状态，尽量保留原 心跳 配置
    const 原心跳 = 原状态 && typeof (原状态 as any).心跳 === 'object' ? (原状态 as any).心跳 : null;
    let 心跳 = (repaired.世界.状态 as any).心跳;
    if (!心跳 || typeof 心跳 !== 'object') {
      const 默认心跳 = {
        启用: false,
        周期数值: 5,
        历史条数: 10,
        遗忘回合数: 10,
        历史: [],
      };
      (repaired.世界.状态 as any).心跳 = 原心跳
        ? {
            ...默认心跳,
            ...原心跳,
            启用: 原心跳.启用 === true || 原心跳.启用 === 'true' || 原心跳.启用 === 1,
            历史: Array.isArray(原心跳.历史) ? 原心跳.历史 : [],
          }
        : 默认心跳;
      心跳 = (repaired.世界.状态 as any).心跳;
    }
    if (心跳 && typeof 心跳 === 'object') {
      if (typeof 心跳.启用 !== 'boolean') 心跳.启用 = 心跳.启用 === true || 心跳.启用 === 'true' || 心跳.启用 === 1;
      if (typeof 心跳.周期数值 !== 'number' || 心跳.周期数值 < 1) 心跳.周期数值 = 5;
      if (typeof 心跳.历史条数 !== 'number' || 心跳.历史条数 < 1) 心跳.历史条数 = 10;
      if (typeof 心跳.遗忘回合数 !== 'number' || 心跳.遗忘回合数 < 0) 心跳.遗忘回合数 = 10;
      if (!Array.isArray(心跳.历史)) 心跳.历史 = [];
    }
    // 确保 世界.信息 及 地点信息 存在（保留已有对象引用，避免丢失 地点信息）
    if (!repaired.世界.信息 || typeof repaired.世界.信息 !== 'object') {
      repaired.世界.信息 = repaired.世界.信息 && typeof repaired.世界.信息 === 'object' ? repaired.世界.信息 : {};
    }
    if (!Array.isArray(repaired.世界.信息.地点信息)) repaired.世界.信息.地点信息 = [];
    delete (repaired.世界.信息 as any).大陆信息;
    delete (repaired.世界.信息 as any).势力信息;
    delete (repaired.世界.信息 as any).continents;

    // 地点名称引号规范化并合并重复（中文/英文引号视为同一地点）
    // 合并规则：地点NPC 取并集；描述/上级 一空一不空取不空、两空保持、两不空取更长的描述、上级取先非空（规范化后一致）
    const 地点列表 = repaired.世界.信息.地点信息 as Array<{ 名称?: string; 上级?: string; 描述?: string; 地点NPC?: string[] }>;
    const seenByNorm = new Map<string, number>();
    const merged: typeof 地点列表 = [];
    for (const e of 地点列表) {
      if (!e || typeof e !== 'object' || typeof e.名称 !== 'string') continue;
      const norm = normalizeLocationName(e.名称);
      const e上级 = e.上级 != null ? normalizeLocationName(String(e.上级)) : '';
      const e描述 = typeof e.描述 === 'string' ? e.描述.trim() : '';
      const idx = seenByNorm.get(norm);
      if (idx !== undefined) {
        const existing = merged[idx];
        if (Array.isArray(e.地点NPC))
          existing.地点NPC = [...new Set([...(existing.地点NPC || []), ...e.地点NPC])];
        const ex描述 = typeof existing.描述 === 'string' ? existing.描述.trim() : '';
        if (e描述) {
          if (!ex描述) existing.描述 = e.描述;
          else if (e描述.length > ex描述.length) existing.描述 = e.描述;
        }
        const ex上级 = existing.上级 != null ? String(existing.上级).trim() : '';
        if (e上级 && !ex上级) existing.上级 = e上级;
      } else {
        seenByNorm.set(norm, merged.length);
        merged.push({
          ...e,
          名称: norm,
          上级: e上级 ? e上级 : (e.上级 != null ? normalizeLocationName(String(e.上级)) : undefined),
          描述: e描述 ? e.描述 : e.描述,
          地点NPC: Array.isArray(e.地点NPC) ? [...e.地点NPC] : [],
        });
      }
    }
    repaired.世界.信息.地点信息 = merged;

    // 校准 关系[npc].当前位置 与 世界.信息.地点信息[地点].地点NPC 双向一致
    try {
      calibrateNpcLocationSync(repaired as Record<string, unknown>);
    } catch (e) {
      console.warn('[数据修复] 地点-NPC 校准失败:', e);
    }

    // --- 修炼 已退役，不再校验 ---


    console.log('[数据修复] ✅ 存档数据修复完成');
    return repaired;
  } catch (error) {
    console.error('[数据修复] ❌ 修复过程发生严重错误，返回默认存档:', error);
    return createMinimalSaveDataV3();
  }
}

/**
 * 修复地位数据（社会地位/职位）
 */
function repairRealm(realm: any): Realm {
  if (!realm || typeof realm !== 'object') {
    return { 名称: "还未揭露", 描述: "" };
  }
  const name = typeof realm.名称 === 'string' && realm.名称.trim() ? realm.名称 : "还未揭露";
  const desc = typeof realm.描述 === 'string' ? realm.描述 : "";
  return { 名称: name, 描述: desc };
}

/**
 * 修复ValuePair数据
 */
function repairValuePair(pair: any, defaultCurrent: number, defaultMax: number): { 当前: number; 上限: number } {
  if (!pair || typeof pair !== 'object') {
    return { 当前: defaultCurrent, 上限: defaultMax };
  }

  const current = validateNumber(pair.当前, 0, 999999999, defaultCurrent);
  const max = validateNumber(pair.上限, 1, 999999999, defaultMax);

  return {
    当前: Math.min(current, max), // 确保当前值不超过上限
    上限: max
  };
}

/**
 * 修复游戏时间
 */
function repairGameTime(time: any): GameTime {
  if (!time || typeof time !== 'object') {
    return { 年: 1000, 月: 1, 日: 1, 小时: 8, 分钟: 0 };
  }

  return {
    年: validateNumber(time.年, 1, 999999, 1000),
    月: validateNumber(time.月, 1, 12, 1),
    日: validateNumber(time.日, 1, 30, 1),
    小时: validateNumber(time.小时, 0, 23, 8),
    分钟: validateNumber(time.分钟, 0, 59, 0)
  };
}

/**
 * 修复物品数据
 */
function repairItem(item: Item): Item {
  const repaired = { ...item };

  // 确保基础字段
  repaired.物品ID = repaired.物品ID || `item_${Date.now()}`;
  repaired.名称 = repaired.名称 || '未命名物品';
  repaired.数量 = validateNumber(repaired.数量, 1, 999999, 1);

  // 修复品质
  if (!repaired.品质 || typeof repaired.品质 !== 'object') {
    repaired.品质 = { quality: '凡', grade: 1 };
  } else {
    const validQualities = ['凡', '黄', '玄', '地', '天', '仙', '神'];
    if (!validQualities.includes(repaired.品质.quality)) {
      repaired.品质.quality = '凡';
    }
    repaired.品质.grade = validateNumber(repaired.品质.grade, 0, 10, 1) as GradeType;
  }

  // 确保类型有效
  const validTypes = ['装备', '功法', '丹药', '材料', '其他'];
  if (!validTypes.includes(repaired.类型)) {
    repaired.类型 = '其他';
  }

  return repaired;
}

/**
 * 修复NPC数据
 */
function repairNpc(npc: NpcProfile): NpcProfile {
  const repaired = { ...npc };

  // 确保基础字段
  repaired.名字 = repaired.名字 || '无名';
  repaired.性别 = repaired.性别 || '男';

  // 年龄已自动从出生日期计算,删除年龄字段

  // 修复地位（原境界）
  repaired.地位 = repairRealm((repaired as any).地位 ?? (repaired as any).境界);
  delete (repaired as any).境界;
  if ((repaired as any).灵根 != null) { repaired.特质 = repaired.特质 ?? (repaired as any).灵根; delete (repaired as any).灵根; }
  if ((repaired as any).先天六司 != null) delete (repaired as any).先天六司;
  if ((repaired as any).后天六司 != null) delete (repaired as any).后天六司;

  // 修复先天六维属性
  if (!repaired.先天六维属性 || typeof repaired.先天六维属性 !== 'object') {
    repaired.先天六维属性 = (repaired as any).先天六司 && typeof (repaired as any).先天六司 === 'object'
      ? { ...(repaired as any).先天六司 } : { 体质: 5, 直觉: 5, 悟性: 5, 气运: 5, 魅力: 5, 心性: 5 };
  }
  if (!repaired.后天六维属性 || typeof repaired.后天六维属性 !== 'object') {
    repaired.后天六维属性 = (repaired as any).后天六司 && typeof (repaired as any).后天六司 === 'object'
      ? { ...(repaired as any).后天六司 } : { 体质: 0, 直觉: 0, 悟性: 0, 气运: 0, 魅力: 0, 心性: 0 };
  }

  // 修复核心数值（体力/精力/洞察力）
  if (!repaired.属性 || typeof repaired.属性 !== 'object') {
    repaired.属性 = {
      体力: { 当前: 100, 上限: 100 },
      精力: { 当前: 50, 上限: 50 },
      洞察力: { 当前: 30, 上限: 30 },
      寿元上限: 100
    };
  } else {
    repaired.属性.体力 = repairValuePair(repaired.属性.体力 ?? (repaired.属性 as any).气血, 100, 100);
    repaired.属性.精力 = repairValuePair(repaired.属性.精力 ?? (repaired.属性 as any).灵气, 50, 50);
    repaired.属性.洞察力 = repairValuePair(repaired.属性.洞察力 ?? (repaired.属性 as any).神识, 30, 30);
    repaired.属性.寿元上限 = typeof repaired.属性.寿元上限 === 'number' ? repaired.属性.寿元上限 : 100;
  }
  if ((repaired as any).气血 || (repaired as any).灵气 || (repaired as any).神识 || (repaired as any).寿元) {
    repaired.属性.体力 = repaired.属性.体力 ?? repairValuePair((repaired as any).气血, 100, 100);
    repaired.属性.精力 = repaired.属性.精力 ?? repairValuePair((repaired as any).灵气, 50, 50);
    repaired.属性.洞察力 = repaired.属性.洞察力 ?? repairValuePair((repaired as any).神识, 30, 30);
    repaired.属性.寿元上限 = (repaired as any).寿元?.上限 ?? repaired.属性.寿元上限 ?? 100;
    delete (repaired as any).气血;
    delete (repaired as any).灵气;
    delete (repaired as any).神识;
    delete (repaired as any).寿元;
  }

  // 修复位置
  if (!repaired.当前位置 || typeof repaired.当前位置 !== 'object') {
    repaired.当前位置 = { 描述: '朝天大陆·无名之地' };
  } else if (!repaired.当前位置.描述) {
    repaired.当前位置.描述 = '朝天大陆·无名之地';
  }

  // 修复好感度
  repaired.好感度 = validateNumber(repaired.好感度, -100, 100, 0);

  // 修复记忆
  if (!Array.isArray(repaired.记忆)) {
    repaired.记忆 = [];
  }

  // 修复背包（金钱：现金/铜/银/金）
  if (!repaired.背包 || typeof repaired.背包 !== 'object') {
    repaired.背包 = { 金钱: { ...DEFAULT_CURRENCY }, 物品: {} };
  } else {
    repaired.背包.金钱 = normalizeCurrency(repaired.背包.金钱 ?? (repaired.背包 as any).灵石);
    repaired.背包.物品 = repaired.背包.物品 ?? {};
  }

  // 修复 NPC-NPC 关系（NpcProfile.关系）
  repaired.关系 = repaired.关系 && typeof repaired.关系 === 'object' ? repaired.关系 : {};

  // 修复 类型（重点/普通）；缺省视为重点
  if (repaired.类型 !== '重点' && repaired.类型 !== '普通') {
    repaired.类型 = '重点';
  }

  return repaired;
}

/**
 * 验证数字，确保在范围内
 */
function validateNumber(value: any, min: number, max: number, defaultValue: number): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(min, Math.min(max, value));
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }
  return defaultValue;
}

/**
 * 创建默认玩家状态
 */
function createDefaultAttributes(): PlayerAttributes {
  return {
    地位: {
      名称: '还未揭露',
      描述: ''
    },
    声望: 0,
    体力: { 当前: 100, 上限: 100 },
    精力: { 当前: 50, 上限: 50 },
    洞察力: { 当前: 30, 上限: 30 },
    寿命: { 当前: 18, 上限: 80 },
  } as PlayerAttributes;
}

function createDefaultLocation(): PlayerLocation {
  return { 描述: '朝天大陆·无名之地', x: 5000, y: 5000 } as PlayerLocation;
}

/**
 * 创建最小可用存档
 */
function createMinimalSaveData(): SaveData {
  return createMinimalSaveDataV3();
}

function createMinimalSaveDataV3(): SaveData {
  const nowIso = new Date().toISOString();
  const time = { 年: 1000, 月: 1, 日: 1, 小时: 8, 分钟: 0 } as GameTime;
  return {
    元数据: {
      版本号: 3,
      存档ID: `save_${Date.now()}`,
      存档名: '自动存档',
      游戏版本: '0.0.0',
      创建时间: nowIso,
      更新时间: nowIso,
      游戏时长秒: 0,
      时间: time,
      回合序号: 0,
    },
    角色: {
      身份: {
        名字: '无名修士',
        性别: '男',
        出生日期: { 年: 982, 月: 1, 日: 1 },
        种族: '人族',
        世界: '朝天大陆' as any,
        天资: '凡人' as any,
        出生: '散修',
        特质: '五行杂灵根',
        天赋: [],
        先天六维属性: { 体质: 5, 直觉: 5, 悟性: 5, 气运: 5, 魅力: 5, 心性: 5 },
        后天六维属性: { 体质: 0, 直觉: 0, 悟性: 0, 气运: 0, 魅力: 0, 心性: 0 },
      },
      属性: createDefaultAttributes(),
      位置: createDefaultLocation(),
      效果: [],
      身体: { 总体状况: '', 部位: {} },
      背包: { 金钱: { ...DEFAULT_CURRENCY }, 物品: {} },
      // 装备/功法/修炼/技能 已退役
    },
    社交: {
      关系: {},
      事件: {
        配置: { 启用随机事件: true, 最小间隔年: 1, 最大间隔年: 10, 事件提示词: '' },
        下次事件时间: null,
        事件记录: [],
      },
      记忆: { 短期记忆: [], 中期记忆: [], 长期记忆: [], 隐式中期记忆: [] },
    },
    世界: {
      信息: {
        世界名称: '朝天大陆',
        地点信息: [],
        生成时间: nowIso,
        世界背景: '',
        世界纪元: '',
        特殊设定: [],
        版本: 'v1',
      },
      状态: {
        探索记录: [],
        心跳: {
          启用: false,
          周期数值: 5,
          历史条数: 10,
          遗忘回合数: 10,
          历史: [],
        },
      },
    },
    系统: {
      配置: {},
      设置: {},
      缓存: { 掌握技能: [], 临时统计: {} },
      行动队列: { actions: [] },
      历史: { 叙事: [] },
      扩展: { engramMemory: createEmptyEngramMemory() },
      联机: { 模式: '单机', 房间ID: null, 玩家ID: null, 只读路径: ['世界'], 世界曝光: false, 冲突策略: '服务器' },
    },
  } as any;
}
