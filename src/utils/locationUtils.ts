/**
 * @fileoverview
 * 地图与地点相关工具函数。
 * 地点数据结构：顶层在 地点信息 数组中并列（parallel）；每项可有 内部 递归子地点；
 * 地点NPC 存于每个地点内，可追溯各地点的 NPC。
 */

import type { LocationEntry } from '@/types/game';

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
 * 优先从该地点的 地点NPC（存于 地点信息 树内）读取；
 * 若无，则从 社交.关系 中按 当前位置.描述 匹配（精确或包含）。
 */
export function getNpcsAtLocation(
  saveData: Record<string, unknown>,
  locationDesc?: string
): string[] {
  if (!locationDesc || typeof locationDesc !== 'string') return [];

  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息;
  const loc = findLocationInTree(entries as (LocationEntry | unknown)[] | undefined, locationDesc);
  if (loc?.地点NPC && Array.isArray(loc.地点NPC)) {
    return loc.地点NPC;
  }

  const 关系 = (saveData?.社交 as Record<string, unknown>)?.关系 as Record<string, unknown> | undefined;
  if (!关系 || typeof 关系 !== 'object') return [];

  const result: string[] = [];
  for (const [name, npc] of Object.entries(关系)) {
    const desc = (npc as Record<string, unknown>)?.当前位置 as Record<string, unknown> | undefined;
    const descStr = desc?.描述;
    if (typeof descStr === 'string' && (descStr === locationDesc || descStr.includes(locationDesc) || locationDesc.includes(descStr))) {
      result.push(name);
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

/** 导出供其他模块使用 */
export { findLocationInTree };
