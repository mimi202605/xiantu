import type { SaveData } from '@/types/game';
import { set, get, unset, cloneDeep } from 'lodash';
import { validateAndRepairNpcProfile } from '@/utils/dataValidation';
import { onPlayerLeaveLocation } from '@/utils/locationUtils';
import { TextProcessor } from './TextProcessor';


// Helper functions locally if not exported
function isPlainObjectLocal(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function applyPlainObjectPatchReplacingArrays(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, patchValue] of Object.entries(patch)) {
    const targetValue = (target as any)[key];
    if (isPlainObjectLocal(targetValue) && isPlainObjectLocal(patchValue)) {
      applyPlainObjectPatchReplacingArrays(targetValue, patchValue);
      continue;
    }
    (target as any)[key] = cloneDeep(patchValue);
  }
}

function mergePlainObjectsReplacingArrays(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged = cloneDeep(base) as Record<string, unknown>;
  applyPlainObjectPatchReplacingArrays(merged, patch);
  return merged;
}

export class StateUpdater {
  public static executeCommand(command: { action: string; key: string; value?: unknown }, saveData: SaveData): void {
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
      if (isNpcRoot && isPlainObjectLocal(value)) {
        const existingNpc = get(saveData, path);
        const baseNpc = isPlainObjectLocal(existingNpc) ? existingNpc : {};
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
      const is关系Merge = segments.length === 4 && segments[0] === '社交' && segments[1] === '关系' && segments[3] === '关系' && isPlainObjectLocal(value);
      if (is关系Merge) {
        const existing = get(saveData, path);
        const base = isPlainObjectLocal(existing) ? existing : {};
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
          const timePrefix = TextProcessor.formatGameTime((saveData as any).元数据?.时间);
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

  public static applyCommandsOnly(
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

  public static preprocessCommands(commands: any[]): any[] {
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

  private static _repairTechniqueItem(item: any): any {
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

  public static summarizeValueForChangeLog(key: string, value: any, action: string): any {
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

  private static _summarizeValue(value: any): any {
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
}
