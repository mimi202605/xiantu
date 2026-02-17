/**
 * @fileoverview
 * 地图与地点相关工具函数。
 * 地点信息为**扁平数组**，通过 `上级` 建树（见 map-test-data-locations.md）；无嵌套结构。
 */

import type { LocationEntry } from '@/types/game';
import { useGameStateStore } from '@/stores/gameStateStore';

/**
 * 在扁平地点数组中按 名称 查找。
 */
export function findLocationInTree(
  entries: (LocationEntry | unknown)[] | undefined,
  locationName: string
): (LocationEntry & { 地点NPC?: string[] }) | null {
  if (!Array.isArray(entries)) return null;
  const found = entries.find(
    (e) => e && typeof e === 'object' && (e as LocationEntry).名称 === locationName
  );
  return found != null ? (found as LocationEntry & { 地点NPC?: string[] }) : null;
}

/**
 * 遍历扁平地点数组中每个条目（无递归）。
 */
export function forEachLocationInTree(
  entries: (LocationEntry & { 地点NPC?: string[] })[] | undefined,
  callback: (loc: LocationEntry & { 地点NPC?: string[] }) => void
): void {
  if (!Array.isArray(entries)) return;
  for (const e of entries) {
    if (e && typeof e === 'object') callback(e as LocationEntry & { 地点NPC?: string[] });
  }
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
 * 追加前会从其他地点的 地点NPC 中移除同名 NPC，保证全局有且只有一个同名的 NPC（与双向校准兼容）。
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

  // 先从其他地点移除同名 NPC（如与玩家同行的 NPC 移到新地点时，需从原地点去掉）
  for (const name of npcNames) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed) removeNpcFromOtherLocations(saveData, trimmed, locationDesc);
  }

  const current = Array.isArray(loc.地点NPC) ? loc.地点NPC : [];
  const set = new Set(current);
  for (const name of npcNames) {
    if (typeof name === 'string' && name.trim() && !set.has(name.trim())) {
      set.add(name.trim());
    }
  }
  loc.地点NPC = Array.from(set);
}

/**
 * 从「除指定地点外」的所有地点的 地点NPC 中移除该 NPC。
 * 用于保证同一 NPC 只出现在一个地点的 地点NPC 列表中。
 */
export function removeNpcFromOtherLocations(
  saveData: Record<string, unknown>,
  npcName: string,
  keepAtLocationName: string
): void {
  if (!npcName || typeof npcName !== 'string' || !keepAtLocationName) return;

  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息 as (LocationEntry & { 地点NPC?: string[] })[] | undefined;

  forEachLocationInTree(entries, (loc) => {
    if (loc.名称 === keepAtLocationName) return;
    if (!Array.isArray(loc.地点NPC)) return;
    const before = loc.地点NPC.length;
    loc.地点NPC = loc.地点NPC.filter((n) => n !== npcName);
    if (loc.地点NPC.length !== before) {
      // 已从该地点移除
    }
  });
}

/**
 * 确保指定地点在 地点信息 中存在（仅扁平结构：顶层数组 + 上级）。
 * 支持 `·` 分隔符：`A·B·C` 表示三层，每层 名称 为从根起的全路径（如 S市、S市·巴别塔、S市·巴别塔·露台）。
 * 若某层已存在则复用，不存在则 push 到顶层 地点信息 数组，不写入 内部。
 * 返回最末端地点条目。
 */
export function ensureLocationExists(
  saveData: Record<string, unknown>,
  locationDesc: string
): LocationEntry | null {
  if (!locationDesc || typeof locationDesc !== 'string') return null;

  const 世界 = saveData?.世界 as Record<string, unknown> | undefined;
  if (!世界) return null;
  let 信息 = 世界.信息 as Record<string, unknown> | undefined;
  if (!信息) {
    信息 = { 地点信息: [] };
    世界.信息 = 信息;
  }
  if (!Array.isArray(信息.地点信息)) {
    信息.地点信息 = [];
  }
  const entries = 信息.地点信息 as (LocationEntry & { 地点NPC?: string[] })[];

  const parts = locationDesc.split('·').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let parentFullPath: string | undefined;
  let lastLoc: (LocationEntry & { 地点NPC?: string[] }) | null = null;

  for (let i = 0; i < parts.length; i++) {
    const fullPath = parts.slice(0, i + 1).join('·');
    let found = findLocationInTree(entries, fullPath);
    if (!found) {
      const newLoc: LocationEntry & { 地点NPC?: string[] } = {
        名称: fullPath,
        ...(parentFullPath != null ? { 上级: parentFullPath } : {}),
        地点NPC: [],
      };
      entries.push(newLoc);
      found = newLoc;
    }
    parentFullPath = fullPath;
    lastLoc = found;
  }

  return lastLoc;
}

/**
 * 收集地点树中所有地点名称（用于 UI dropdown）。
 */
export function collectAllLocationNames(saveData: Record<string, unknown>): string[] {
  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息 as (LocationEntry & { 地点NPC?: string[] })[] | undefined;
  const names: string[] = [];
  forEachLocationInTree(entries, (loc) => {
    if (loc.名称) names.push(loc.名称);
  });
  return names;
}

/**
 * 校准「关系 NPC 的当前位置」与「世界.信息.地点信息[地点].地点NPC」双向一致。
 * API 不一定同时正确写入两项，因此在后端做一次同步与互补。
 * 绝大多数情况下只修改 地点NPC；仅当 关系[npc].当前位置 缺失或与地点不一致时才写 关系。
 *
 * 1. 关系 → 地点：有 当前位置.描述 的 NPC 从其它地点移除并加入该地点的 地点NPC（只改地点NPC）
 *    若地点不在树中，自动创建（调用 ensureLocationExists）
 * 2. 地点去重：每个 NPC 有且只在一个地点的 地点NPC 中（仅对仍出现在多处的 NPC，首次出现地点保留）
 * 3. 地点 → 关系：各地点的 地点NPC 补全/修正 关系[npc].当前位置.描述
 */
export function calibrateNpcLocationSync(saveData: Record<string, unknown>): void {
  const 关系 = (saveData?.社交 as Record<string, unknown>)?.关系 as Record<
    string,
    { 当前位置?: { 描述?: string } }
  > | undefined;
  const 地点信息 = (saveData?.世界 as Record<string, unknown>)?.信息 as Record<string, unknown> | undefined;
  const entries = 地点信息?.地点信息 as (LocationEntry & { 地点NPC?: string[] })[] | undefined;

  if (!关系 || typeof 关系 !== 'object') return;
  if (!Array.isArray(entries)) return;

  // 1. 关系 → 地点：只改 地点NPC，不写 关系；若地点不存在则自动创建
  for (const [npcName, npc] of Object.entries(关系)) {
    const locDesc = npc?.当前位置?.描述;
    if (typeof locDesc !== 'string' || !locDesc.trim()) continue;
    // 若地点不在树中，自动创建
    if (!findLocationInTree(entries, locDesc)) {
      ensureLocationExists(saveData, locDesc);
    }
    removeNpcFromOtherLocations(saveData, npcName, locDesc);
    appendNpcsToLocation(saveData, locDesc, [npcName]);
  }

  // 2. 地点去重：仅修改 地点NPC（API 可能只在多处写了 地点NPC，未写 关系）
  const npcFirstLocation = new Map<string, string>();
  forEachLocationInTree(entries, (loc) => {
    if (!Array.isArray(loc.地点NPC)) return;
    for (const npcName of loc.地点NPC) {
      if (!npcFirstLocation.has(npcName)) npcFirstLocation.set(npcName, loc.名称);
    }
  });
  forEachLocationInTree(entries, (loc) => {
    if (!Array.isArray(loc.地点NPC)) return;
    loc.地点NPC = loc.地点NPC.filter((n) => npcFirstLocation.get(n) === loc.名称);
  });

  // 3. 地点 → 关系：补全/修正 关系[npc].当前位置（仅在此步写 关系）
  forEachLocationInTree(entries, (loc) => {
    const locName = loc.名称;
    if (!Array.isArray(loc.地点NPC)) return;
    for (const npcName of loc.地点NPC) {
      const npc = 关系[npcName];
      if (!npc || typeof npc !== 'object') continue;
      const current = npc.当前位置;
      if (!current || typeof current !== 'object' || current.描述 !== locName) {
        (npc as { 当前位置: { 描述: string } }).当前位置 = { 描述: locName };
      }
    }
  });
}

