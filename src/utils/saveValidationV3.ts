import type { GameTime, SaveData } from '@/types/game';

export interface SaveValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const validateGameTime = (time: any): string[] => {
  const errors: string[] = [];
  if (!isPlainObject(time)) return ['元数据.时间 必须是对象'];
  const fields: Array<[keyof GameTime, number, number]> = [
    ['年', 0, 999999],
    ['月', 1, 12],
    ['日', 1, 31],
    ['小时', 0, 23],
    ['分钟', 0, 59],
  ];
  for (const [k, min, max] of fields) {
    const v = (time as any)[k];
    if (!isNumber(v)) errors.push(`元数据.时间.${String(k)} 必须是数字`);
    else if (v < min || v > max) errors.push(`元数据.时间.${String(k)} 超出范围（${min}-${max}）`);
  }
  return errors;
};

export const isSaveDataV3Shape = (saveData: SaveData | null | undefined): boolean => {
  if (!saveData || typeof saveData !== 'object') return false;
  const anySave = saveData as any;
  return (
    isPlainObject(anySave.元数据) &&
    isPlainObject(anySave.角色) &&
    isPlainObject(anySave.社交) &&
    isPlainObject(anySave.世界) &&
    isPlainObject(anySave.系统)
  );
};

export function validateSaveDataV3(saveData: SaveData): SaveValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isSaveDataV3Shape(saveData)) {
    return {
      isValid: false,
      errors: ['不是 V3 存档结构（缺少 元数据/角色/社交/世界/系统）'],
      warnings: [],
    };
  }

  const anySave = saveData as any;

  const version = anySave.元数据?.版本号;
  if (version !== 3) errors.push('元数据.版本号 必须为 3');
  if (typeof anySave.元数据?.存档ID !== 'string' || !anySave.元数据.存档ID.trim()) errors.push('元数据.存档ID 必填');
  if (typeof anySave.元数据?.存档名 !== 'string' || !anySave.元数据.存档名.trim()) errors.push('元数据.存档名 必填');
  if (typeof anySave.元数据?.创建时间 !== 'string') errors.push('元数据.创建时间 必须是字符串(ISO8601)');
  if (typeof anySave.元数据?.更新时间 !== 'string') errors.push('元数据.更新时间 必须是字符串(ISO8601)');
  if (!isNumber(anySave.元数据?.游戏时长秒)) errors.push('元数据.游戏时长秒 必须是数字');
  errors.push(...validateGameTime(anySave.元数据?.时间));

  if (!isPlainObject(anySave.角色?.身份)) errors.push('角色.身份 必填且必须是对象');
  if (!isPlainObject(anySave.角色?.属性)) errors.push('角色.属性 必填且必须是对象');
  if (!isPlainObject(anySave.角色?.位置)) errors.push('角色.位置 必填且必须是对象');
  if (!Array.isArray(anySave.角色?.效果)) errors.push('角色.效果 必填且必须是数组');
  if (!isPlainObject(anySave.角色?.背包)) errors.push('角色.背包 必填且必须是对象');
  // 角色.装备 已退役，不再校验

  const items = anySave.角色?.背包?.物品;
  if (!isPlainObject(items)) errors.push('角色.背包.物品 必填且必须是对象');

  if (!isPlainObject(anySave.社交?.关系)) errors.push('社交.关系 必填且必须是对象');
  if (!isPlainObject(anySave.社交?.事件)) errors.push('社交.事件 必填且必须是对象');
  if (!isPlainObject(anySave.社交?.记忆)) errors.push('社交.记忆 必填且必须是对象');

  if (!isPlainObject(anySave.世界?.信息)) errors.push('世界.信息 必填且必须是对象');
  if (!isPlainObject(anySave.系统?.联机)) errors.push('系统.联机 必填且必须是对象');

  const roPaths = anySave.系统?.联机?.只读路径;
  if (!Array.isArray(roPaths)) errors.push('系统.联机.只读路径 必填且必须是数组');

  // 系统.扩展.engramMemory（可选）：若存在则进行结构校验
  const engramMemory = anySave.系统?.扩展?.engramMemory;
  if (engramMemory !== undefined) {
    if (!isPlainObject(engramMemory)) {
      errors.push('系统.扩展.engramMemory 必须是对象');
    } else {
      if (!Array.isArray((engramMemory as any).events)) {
        warnings.push('系统.扩展.engramMemory.events 不是数组，运行时将回退为空数组');
      }
      if (!Array.isArray((engramMemory as any).entities)) {
        warnings.push('系统.扩展.engramMemory.entities 不是数组，运行时将回退为空数组');
      }
      if (!Array.isArray((engramMemory as any).relations)) {
        warnings.push('系统.扩展.engramMemory.relations 不是数组，运行时将回退为空数组');
      }
      if (!isPlainObject((engramMemory as any).meta)) {
        warnings.push('系统.扩展.engramMemory.meta 不是对象，运行时将回退默认 meta');
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}
