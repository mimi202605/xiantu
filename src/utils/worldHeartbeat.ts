/**
 * @fileoverview
 * 世界心跳系统 - 预留接口
 * 供 Phase 3 世界心跳、NPC 更新优先级等使用。
 */

/**
 * 预留：获取 NPC 更新优先级列表。
 * 供心跳调度使用，当前仅返回重点 NPC 名列表。
 */
export function getNpcUpdatePriority(
  saveData: Record<string, unknown>,
  _worldEvent?: unknown
): string[] {
  const 关系 = (saveData?.社交 as any)?.关系;
  if (!关系 || typeof 关系 !== 'object') return [];
  return Object.keys(关系).filter((k) => (关系[k] as any)?.类型 === '重点');
}

/** 获取某地点的 NPC 名列表 */
export { getNpcsAtLocation } from './locationUtils';
