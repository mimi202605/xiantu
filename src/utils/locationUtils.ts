/**
 * @fileoverview
 * 地图与地点相关工具函数。
 * 地点数据结构：顶层在 地点信息 数组中并列（parallel）；每项可有 内部 递归子地点；
 * 地点NPC 存于每个地点内，可追溯各地点的 NPC。
 */

import type { LocationEntry } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';

/**
 * 在递归地点树中按名称查找地点条目
 */
function findLocationInTree(
  entries: (LocationEntry | unknown)[] | undefined,
  locationName: string
): LocationEntry | null {
  if (!Array.isArray(entries)) return null;
  for (const e of entries) {
    if (e && typeof e === 'object' && (e as LocationEntry).名称 === locationName) {
      return e as LocationEntry;
    }
    const inner = (e as LocationEntry)?.内部;
    if (Array.isArray(inner)) {
      const found = findLocationInTree(inner, locationName);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 获取某地点的 NPC 名列表。
 *
 * 数据来源优先级：
 * 1. 地点信息.地点信息 树中该地点的 地点NPC 字段（AI 通过 tavern_commands push 时写入）
 * 2. 回退：社交.关系 中按 NPC.当前位置.描述 与 locationDesc **完全相等** 匹配
 *
 * 回退触发条件（满足任一即回退到 社交.关系）：
 * - 地点不在 地点信息 树中（loc 为 null）
 * - 地点的 地点NPC 为 undefined 或 null
 * - 地点的 地点NPC 不是数组
 * - 地点的 地点NPC 为空数组 []
 *
 * 回退逻辑：遍历 社交.关系，仅当 当前位置.描述 === locationDesc（完全相等）时计入。
 * 若回退找到 NPC 且地点在树中存在，会更新该地点的 地点NPC 到 gameStateStore。
 */
export function getNpcsAtLocation(
  saveData: Record<string, unknown>,
  locationDesc?: string,
  options?: { updateStoreOnFallback?: boolean }
): string[] {
  if (!locationDesc || typeof locationDesc !== 'string') return [];

  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息;
  const loc = findLocationInTree(entries as (LocationEntry | unknown)[] | undefined, locationDesc);

  // 1. 优先使用 地点信息 内的 地点NPC
  const 地点NPC = loc?.地点NPC;
  if (Array.isArray(地点NPC) && 地点NPC.length > 0) {
    return 地点NPC;
  }

  // 2. 回退：从 社交.关系 按 当前位置.描述 **完全相等** 匹配
  const 关系 = (saveData?.社交 as Record<string, unknown>)?.关系 as Record<string, unknown> | undefined;
  if (!关系 || typeof 关系 !== 'object') return [];

  const result: string[] = [];
  for (const [name, npc] of Object.entries(关系)) {
    const 当前位置 = (npc as Record<string, unknown>)?.当前位置 as Record<string, unknown> | undefined;
    const descStr = 当前位置?.描述;
    if (typeof descStr !== 'string') continue;
    if (descStr === locationDesc) result.push(name);
  }

  // 3. 若回退找到 NPC 且地点在树中存在，更新该地点的 地点NPC 到 store
  if (result.length > 0 && loc && options?.updateStoreOnFallback) {
    const store = useGameStateStore();
    const storeEntries = store.worldInfo?.地点信息;
    const storeLoc = findLocationInTree(storeEntries as (LocationEntry | unknown)[] | undefined, locationDesc);
    if (storeLoc) {
      storeLoc.地点NPC = [...result];
    }
  }

  return result;
}

/**
 * 玩家离开地点时：重点 NPC 从该地点的 地点NPC 中移除并更新其 当前位置；普通 NPC 留守。
 */
export function onPlayerLeaveLocation(
  saveData: Record<string, unknown>,
  oldLocationDesc: string,
  newLocationDesc?: string
): void {
  if (!oldLocationDesc || typeof oldLocationDesc !== 'string') return;

  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息 as (LocationEntry & { 地点NPC?: string[] })[] | undefined;
  const loc = findLocationInTree(entries, oldLocationDesc);
  if (!loc?.地点NPC || !Array.isArray(loc.地点NPC)) return;

  const 关系 = (saveData?.社交 as Record<string, unknown>)?.关系 as Record<string, { 类型?: string; 当前位置?: { 描述?: string } }> | undefined;
  if (!关系 || typeof 关系 !== 'object') return;

  const toRemove: string[] = [];
  for (const npcName of loc.地点NPC) {
    const npc = 关系[npcName];
    if (npc && (npc as { 类型?: string }).类型 === '重点') {
      toRemove.push(npcName);
      const 新位置描述 = newLocationDesc || '云游中';
      if (npc.当前位置 && typeof npc.当前位置 === 'object') {
        (npc.当前位置 as { 描述?: string }).描述 = 新位置描述;
      } else {
        (npc as { 当前位置: { 描述: string } }).当前位置 = { 描述: 新位置描述 };
      }
    }
  }
  loc.地点NPC = loc.地点NPC.filter((n) => !toRemove.includes(n));
}

/**
 * 在指定地点的 地点NPC 中追加名字（去重、不重复添加已有名字）。
 * 若地点不在树中则无操作。
 */
export function appendNpcsToLocation(
  saveData: Record<string, unknown>,
  locationDesc: string,
  npcNames: string[]
): void {
  if (!locationDesc || !Array.isArray(npcNames) || npcNames.length === 0) return;

  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息 as (LocationEntry & { 地点NPC?: string[] })[] | undefined;
  const loc = findLocationInTree(entries, locationDesc);
  if (!loc) return;

  const current = Array.isArray(loc.地点NPC) ? loc.地点NPC : [];
  const set = new Set(current);
  for (const name of npcNames) {
    if (typeof name === 'string' && name.trim() && !set.has(name.trim())) {
      set.add(name.trim());
    }
  }
  loc.地点NPC = Array.from(set);
}

/** 导出供其他模块使用 */
export { findLocationInTree };
