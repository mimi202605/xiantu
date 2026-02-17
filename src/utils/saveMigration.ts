import type { SaveData, GameTime, EventSystem, ImplicitMidTermEntry, MidTermEntry } from '@/types/game';
import type { SaveDataV3 } from '@/types/saveSchemaV3';
import { DEFAULT_CURRENCY, normalizeCurrency } from '@/utils/currencyDefaults';
import { createEmptyEngramMemory, ensureEngramMemory } from '@/services/engram/memoryRepository';

export type SaveMigrationIssue =
  | 'legacy-root-keys'
  | 'missing-required-keys'
  | 'invalid-structure';

export interface SaveMigrationDetection {
  needsMigration: boolean;
  issues: SaveMigrationIssue[];
  legacyKeysFound: string[];
}

export interface SaveMigrationReport {
  legacyKeysFound: string[];
  removedLegacyKeys: string[];
  warnings: string[];
}

const LEGACY_ROOT_KEYS = [
  '状态',
  '玩家角色状态',
  '玩家角色状态信息',
  '玩家角色信息',
  '角色基础信息',
  '玩家角色基础信息',
  '修行状态',
  '状态效果',
  '叙事历史',
  '对话历史',
  '任务系统',
  '事件系统',
  '宗门系统',
  '世界信息',
  '人物关系',
  '装备栏',
  '游戏时间',
  '三千大道',
  '修炼功法',
  '掌握技能',
  '身体部位开发',
] as const;

const REQUIRED_V3_KEYS = ['元数据', '角色', '社交', '世界', '系统'] as const;

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const stripAIFieldsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripAIFieldsDeep);
  if (!isPlainObject(value)) return value;

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === '_AI说明' || key === '_AI修改规则' || key === '_AI重要提醒') continue;
    output[key] = stripAIFieldsDeep(val);
  }
  return output;
};

const coerceTime = (value: any): GameTime => {
  const base: GameTime = { 年: 1000, 月: 1, 日: 1, 小时: 8, 分钟: 0 };
  if (!isPlainObject(value)) return base;
  return {
    年: Number(value.年 ?? value.年数 ?? base.年),
    月: Number(value.月 ?? base.月),
    日: Number(value.日 ?? base.日),
    小时: Number(value.小时 ?? base.小时),
    分钟: Number(value.分钟 ?? base.分钟),
  } as GameTime;
};

export function isSaveDataV3(saveData: SaveData | null | undefined): saveData is SaveDataV3 {
  if (!saveData || typeof saveData !== 'object') return false;
  const anySave = saveData as any;
  return (
    isPlainObject(anySave.元数据) &&
    isPlainObject(anySave.角色) &&
    isPlainObject(anySave.社交) &&
    isPlainObject(anySave.世界) &&
    isPlainObject(anySave.系统)
  );
}

export function detectLegacySaveData(saveData: SaveData | null | undefined): SaveMigrationDetection {
  if (!saveData || typeof saveData !== 'object') {
    return {
      needsMigration: true,
      issues: ['invalid-structure'],
      legacyKeysFound: [],
    };
  }

  const anySave = saveData as any;

  if (isSaveDataV3(saveData)) {
    return { needsMigration: false, issues: [], legacyKeysFound: [] };
  }

  const legacyKeysFound = [
    ...LEGACY_ROOT_KEYS.filter((k) => k in anySave),
    // “短路径平铺结构”也视为旧结构（需要迁移到 5 领域 V3）
    ...(anySave.属性 || anySave.位置 || anySave.背包 || anySave.时间 ? ['短路径平铺'] : []),
  ] as string[];

  const missingRequired = REQUIRED_V3_KEYS.filter((k) => !(k in anySave));
  const issues: SaveMigrationIssue[] = [];
  if (legacyKeysFound.length > 0) issues.push('legacy-root-keys');
  if (missingRequired.length > 0) issues.push('missing-required-keys');

  return {
    needsMigration: issues.length > 0,
    issues,
    legacyKeysFound,
  };
}

const buildDefaultEventSystem = (): EventSystem => ({
  配置: {
    启用随机事件: true,
    最小间隔年: 1,
    最大间隔年: 10,
    事件提示词: '',
  },
  下次事件时间: null,
  事件记录: [],
});

const buildDefaultMemory = (): SaveDataV3['社交']['记忆'] => ({
  短期记忆: [],
  中期记忆: [],
  长期记忆: [],
  隐式中期记忆: [],
});

const coerceStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (typeof value === 'string' && value.trim().length > 0) return [value.trim()];
  return [];
};

/** 从旧版隐式中期字符串中解析时间前缀（如【仙道1000年1月1日 08:00】），无则返回空串 */
function extractTimePrefixFromMemoryString(s: string): string {
  const m = s.match(/^【(仙道|仙历|未知时间)[^】]*】/);
  return m ? m[0].replace(/^【|】$/g, '') : '';
}

/** 将旧版 string[] 隐式中期记忆迁移为 ImplicitMidTermEntry[] */
function coerceImplicitMidTermArray(mem: any): ImplicitMidTermEntry[] {
  const raw = mem?.隐式中期记忆 ?? mem?.implicit_mid_term ?? mem?.implicitMidTerm;
  if (!Array.isArray(raw)) return [];
  const out: ImplicitMidTermEntry[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && v.trim()) {
      const timePart = extractTimePrefixFromMemoryString(v);
      const body = timePart ? v.replace(/^【[^】]*】/, '').trim() : v.trim();
      out.push({ 相关角色: [], 事件时间: timePart, 记忆主体: body || v.trim() });
    } else if (v && typeof v === 'object' && typeof (v as any).记忆主体 === 'string') {
      const o = v as any;
      out.push({
        相关角色: Array.isArray(o.相关角色) ? o.相关角色 : [],
        事件时间: typeof o.事件时间 === 'string' ? o.事件时间 : '',
        记忆主体: String(o.记忆主体),
      });
    }
  }
  return out;
}

/** 将中期记忆规范为 MidTermEntry[]（保留字符串或对象） */
function coerceMidTermArray(mem: any): MidTermEntry[] {
  const raw = mem?.中期记忆 ?? mem?.mid_term ?? mem?.midTerm;
  if (!Array.isArray(raw)) return [];
  const out: MidTermEntry[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && v.trim()) {
      out.push(v.trim());
    } else if (v && typeof v === 'object' && typeof (v as any).记忆主体 === 'string') {
      out.push(v as MidTermEntry);
    }
  }
  return out;
}

const normalizeMemory = (value: unknown): SaveDataV3['社交']['记忆'] => {
  const base = buildDefaultMemory();
  if (!isPlainObject(value)) return base;

  const anyValue = value as any;
  return {
    短期记忆: coerceStringArray(anyValue.短期记忆 ?? anyValue.short_term ?? anyValue.shortTerm),
    中期记忆: coerceMidTermArray(anyValue),
    长期记忆: coerceStringArray(anyValue.长期记忆 ?? anyValue.long_term ?? anyValue.longTerm),
    隐式中期记忆: coerceImplicitMidTermArray(anyValue),
  };
};

const buildDefaultOnline = (): SaveDataV3['系统']['联机'] => ({
  模式: '单机',
  房间ID: null,
  玩家ID: null,
  只读路径: ['世界'],
  世界曝光: false,
  冲突策略: '服务器',
});

const buildDefaultWorldInfo = (nowIso: string) => ({
  世界名称: '朝天大陆',
  地点信息: [],
  生成时间: nowIso,
  世界背景: '',
  世界纪元: '',
  特殊设定: [],
  版本: 'v1',
});

const buildDefaultIdentity = () => ({
  名字: '无名修士',
  性别: '男',
  出生日期: { 年: 982, 月: 1, 日: 1 },
  种族: '人族',
  世界: '朝天大陆',
  天资: '凡人',
  出生: '散修',
  特质: '五行杂灵根',
  天赋: [],
  先天六维属性: { 体质: 5, 直觉: 5, 悟性: 5, 气运: 5, 魅力: 5, 心性: 5 },
  后天六维属性: { 体质: 0, 直觉: 0, 悟性: 0, 气运: 0, 魅力: 0, 心性: 0 },
});

export function migrateSaveDataToLatest(raw: SaveData): { migrated: SaveDataV3; report: SaveMigrationReport } {
  const sourceRaw = deepClone(raw ?? ({} as any)) as any;
  const source = stripAIFieldsDeep(sourceRaw) as any;

  const report: SaveMigrationReport = {
    legacyKeysFound: [],
    removedLegacyKeys: [],
    warnings: [],
  };

  if (isSaveDataV3(source)) {
    const normalized = deepClone(source) as any;
    if (!isPlainObject(normalized.社交)) normalized.社交 = {};
    normalized.社交.记忆 = normalizeMemory(normalized.社交.记忆);
    // 世界.状态.探索记录、NPC 类型 默认值（地点NPC 存于各地点内）
    if (!isPlainObject(normalized.世界)) normalized.世界 = {};
    if (!isPlainObject(normalized.世界.状态)) normalized.世界.状态 = {};
    if (!Array.isArray(normalized.世界.状态.探索记录)) normalized.世界.状态.探索记录 = [];
    if (typeof (normalized.元数据 as any)?.回合序号 !== 'number' || (normalized.元数据 as any).回合序号 < 0) {
      (normalized.元数据 as any).回合序号 = 0;
    }
    const hb = normalized.世界.状态.心跳;
    if (!hb || typeof hb !== 'object') {
      (normalized.世界.状态 as any).心跳 = {
        启用: false,
        周期数值: 5,
        历史条数: 10,
        遗忘回合数: 10,
        历史: [],
      };
    } else {
      if (typeof hb.周期数值 !== 'number' || hb.周期数值 < 1) (normalized.世界.状态 as any).心跳.周期数值 = 5;
      if (typeof hb.历史条数 !== 'number' || hb.历史条数 < 1) (normalized.世界.状态 as any).心跳.历史条数 = 10;
      if (typeof hb.遗忘回合数 !== 'number' || hb.遗忘回合数 < 0) (normalized.世界.状态 as any).心跳.遗忘回合数 = 10;
      if (!Array.isArray(hb.历史)) (normalized.世界.状态 as any).心跳.历史 = [];
    }
    // 迁移旧 世界.信息.地点NPC（Record）到各地点内的 地点NPC；并移除地点条目的 内部 字段（结构已改为仅扁平+上级）
    const old地点NPC = normalized.世界?.信息?.地点NPC;
    if (Array.isArray(normalized.世界?.信息?.地点信息)) {
      const entries = normalized.世界.信息.地点信息 as any[];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e || typeof e !== 'object' || typeof e.名称 !== 'string') continue;
        if (isPlainObject(old地点NPC)) {
          const npcList = old地点NPC[e.名称];
          if (Array.isArray(npcList) && npcList.length > 0) {
            e.地点NPC = npcList;
          }
        }
        delete e.内部;
      }
      if (isPlainObject(old地点NPC)) delete normalized.世界.信息.地点NPC;
    }
    const rels = normalized.社交?.关系;
    if (isPlainObject(rels)) {
      for (const npc of Object.values(rels) as any[]) {
        if (npc && typeof npc === 'object' && npc.类型 !== '重点' && npc.类型 !== '普通') {
          npc.类型 = '重点';
        }
      }
    }
    // 六维属性：根骨→体质、灵性→直觉；旧键 先天六司/后天六司 → 先天六维属性/后天六维属性
    const normalizeSixDimensions = (o: any) => {
      if (!o || typeof o !== 'object') return;
      for (const oldKey of ['先天六司', '后天六司']) {
        const six = o[oldKey];
        if (!six || typeof six !== 'object') continue;
        const newKey = oldKey === '先天六司' ? '先天六维属性' : '后天六维属性';
        if (!o[newKey]) o[newKey] = { ...six };
        const target = o[newKey];
        if ('根骨' in target && typeof target.根骨 === 'number') {
          target.体质 = target.体质 ?? target.根骨;
          delete target.根骨;
        }
        if ('灵性' in target && typeof target.灵性 === 'number') {
          target.直觉 = target.直觉 ?? target.灵性;
          delete target.灵性;
        }
        delete o[oldKey];
      }
    };
    if (normalized.角色?.身份) normalizeSixDimensions(normalized.角色.身份);
    if (isPlainObject(normalized.社交?.关系)) {
      for (const npc of Object.values(normalized.社交.关系) as any[]) {
        if (npc && typeof npc === 'object') normalizeSixDimensions(npc);
      }
    }
    if (!isPlainObject(normalized.系统)) normalized.系统 = {};
    if (!isPlainObject(normalized.系统.扩展)) normalized.系统.扩展 = {};
    (normalized.系统.扩展 as any).engramMemory = ensureEngramMemory(
      (normalized.系统.扩展 as any).engramMemory ?? createEmptyEngramMemory(),
    );
    // 货币：统一为 金钱 + 现金/铜/银/金
    if (normalized.角色?.背包) {
      const cur = normalized.角色.背包.金钱 ?? normalized.角色.背包.灵石;
      normalized.角色.背包.金钱 = normalizeCurrency(cur);
      delete normalized.角色.背包.灵石;
    }
    if (isPlainObject(normalized.社交?.关系)) {
      for (const npc of Object.values(normalized.社交.关系) as any[]) {
        if (npc?.背包) {
          const cur = npc.背包.金钱 ?? npc.背包.灵石;
          npc.背包.金钱 = normalizeCurrency(cur);
          delete npc.背包.灵石;
        }
      }
    }
    // 属性与身份：境界→地位，气血/灵气/神识→体力/精力/洞察力，灵根→特质
    const normAttrs = (attrs: any) => {
      if (!attrs || typeof attrs !== 'object') return;
      if (attrs.境界 != null) { attrs.地位 = attrs.地位 ?? attrs.境界; delete attrs.境界; }
      if (attrs.气血 != null) { attrs.体力 = attrs.体力 ?? attrs.气血; delete attrs.气血; }
      if (attrs.灵气 != null) { attrs.精力 = attrs.精力 ?? attrs.灵气; delete attrs.灵气; }
      if (attrs.神识 != null) { attrs.洞察力 = attrs.洞察力 ?? attrs.神识; delete attrs.神识; }
    };
    const normIdentity = (id: any) => {
      if (!id || typeof id !== 'object') return;
      if (id.境界 != null) { id.地位 = id.地位 ?? id.境界; delete id.境界; }
      if (id.灵根 != null) { id.特质 = id.特质 ?? id.灵根; delete id.灵根; }
      if (id.先天六司 != null) { id.先天六维属性 = id.先天六维属性 ?? id.先天六司; delete id.先天六司; }
      if (id.后天六司 != null) { id.后天六维属性 = id.后天六维属性 ?? id.后天六司; delete id.后天六司; }
    };
    if (normalized.角色?.属性) normAttrs(normalized.角色.属性);
    if (normalized.角色?.身份) normIdentity(normalized.角色.身份);
    if (isPlainObject(normalized.社交?.关系)) {
      for (const npc of Object.values(normalized.社交.关系) as any[]) {
        if (npc?.属性) normAttrs(npc.属性);
        normIdentity(npc);
      }
    }
    return { migrated: normalized as SaveDataV3, report };
  }

  report.legacyKeysFound = LEGACY_ROOT_KEYS.filter((k) => k in source) as string[];

  const nowIso = new Date().toISOString();

  const flatCharacter =
    source.角色 ??
    source.角色基础信息 ??
    source.玩家角色基础信息 ??
    source.玩家角色信息 ??
    source.玩家角色状态信息?.角色 ??
    null;

  const legacyStatusLike = source.属性 ?? source.状态 ?? source.玩家角色状态 ?? source.玩家角色状态信息 ?? null;
  const legacyStatusObj = isPlainObject(legacyStatusLike) ? legacyStatusLike : ({} as any);

  const hp = (legacyStatusObj as any).体力 ?? (legacyStatusObj as any).气血 ?? { 当前: 100, 上限: 100 };
  const mp = (legacyStatusObj as any).精力 ?? (legacyStatusObj as any).灵气 ?? { 当前: 50, 上限: 50 };
  const insight = (legacyStatusObj as any).洞察力 ?? (legacyStatusObj as any).神识 ?? { 当前: 30, 上限: 30 };
  const flatAttributes = {
    地位: (legacyStatusObj as any).地位 ?? (legacyStatusObj as any).境界 ?? null,
    声望: (legacyStatusObj as any).声望 ?? 0,
    体力: hp,
    精力: mp,
    洞察力: insight,
    寿命: (legacyStatusObj as any).寿命 ?? { 当前: 18, 上限: 80 },
  };

  const effectsCandidate =
    source.效果 ??
    source.修行状态 ??
    (legacyStatusObj as any).状态效果 ??
    source.状态效果 ??
    [];
  const flatEffects = Array.isArray(effectsCandidate) ? effectsCandidate : [];

  const flatLocation =
    source.位置 ??
    (legacyStatusObj as any).位置 ??
    (source.状态位置 as any) ??
    { 描述: '朝天大陆·无名之地', x: 5000, y: 5000 };

  const flatTime = coerceTime(source.元数据?.时间 ?? source.时间 ?? source.游戏时间);

  const rawBag = source.背包 ?? { 物品: {} };
  const flatInventory = {
    金钱: normalizeCurrency((rawBag as any).金钱 ?? (rawBag as any).灵石),
    物品: (rawBag as any).物品 ?? {},
  };
  // 装备/功法/修炼/技能 已退役，迁移时不再处理

  // [MING] 宗门迁移已移除（宗门系统已退役）
  const flatRelationships = source.关系 ?? source.人物关系 ?? {};
  const flatMemory = normalizeMemory(source.记忆 ?? source.社交?.记忆);

  const flatEventRaw = source.事件 ?? source.事件系统 ?? buildDefaultEventSystem();
  const flatEvent = (() => {
    const eventSystem = isPlainObject(flatEventRaw)
      ? (deepClone(flatEventRaw) as any)
      : (buildDefaultEventSystem() as any);

    if (!Array.isArray(eventSystem.事件记录)) eventSystem.事件记录 = [];
    if (!isPlainObject(eventSystem.下次事件时间)) eventSystem.下次事件时间 = null;

    return eventSystem as any;
  })();

  const worldInfoCandidate = source.世界?.信息 ?? source.世界 ?? source.世界信息 ?? source.worldInfo ?? undefined;
  const worldInfoRaw = isPlainObject(worldInfoCandidate) ? worldInfoCandidate : buildDefaultWorldInfo(nowIso);
  const worldInfo = { ...worldInfoRaw } as any;
  delete worldInfo.大陆信息;
  delete worldInfo.势力信息;
  delete worldInfo.continents;

  const systemConfig = source.系统?.配置 ?? source.系统 ?? source.系统配置 ?? undefined;
  const rawSystemExtension = source.系统?.扩展 ?? source.扩展;
  const systemExtension = isPlainObject(rawSystemExtension) ? deepClone(rawSystemExtension) : {};
  (systemExtension as any).engramMemory = ensureEngramMemory(
    (systemExtension as any).engramMemory ?? createEmptyEngramMemory(),
  );

  const narrative =
    source.系统?.历史?.叙事 ??
    source.历史?.叙事 ??
    (source.叙事历史 ? source.叙事历史 : source.对话历史 ? source.对话历史 : []);

  const online =
    source.系统?.联机 ??
    source.联机 ??
    buildDefaultOnline();

  let identity = (isPlainObject(flatCharacter) ? (flatCharacter as any) : buildDefaultIdentity()) as any;
  // 规范身份键名（灵根→特质，六司→六维属性，境界→地位）
  identity = { ...identity };
  if (identity.灵根 != null) { identity.特质 = identity.特质 ?? identity.灵根; delete identity.灵根; }
  if (identity.境界 != null) { identity.地位 = identity.地位 ?? identity.境界; delete identity.境界; }
  if (identity.先天六司 != null) { identity.先天六维属性 = identity.先天六维属性 ?? identity.先天六司; delete identity.先天六司; }
  if (identity.后天六司 != null) { identity.后天六维属性 = identity.后天六维属性 ?? identity.后天六司; delete identity.后天六司; }
  // 规范关系 NPC 的背包与属性
  const flatRels = { ...flatRelationships } as Record<string, any>;
  for (const k of Object.keys(flatRels)) {
    const npc = flatRels[k];
    if (npc && typeof npc === 'object') {
      if (npc.背包) {
        npc.背包 = { 金钱: normalizeCurrency(npc.背包.金钱 ?? npc.背包.灵石), 物品: npc.背包.物品 ?? {} };
      }
      if (npc.属性) {
        const a = npc.属性;
        if (a.气血 != null) { a.体力 = a.体力 ?? a.气血; delete a.气血; }
        if (a.灵气 != null) { a.精力 = a.精力 ?? a.灵气; delete a.灵气; }
        if (a.神识 != null) { a.洞察力 = a.洞察力 ?? a.神识; delete a.神识; }
      }
      if (npc.灵根 != null) { npc.特质 = npc.特质 ?? npc.灵根; delete npc.灵根; }
      if (npc.境界 != null) { npc.地位 = npc.地位 ?? npc.境界; delete npc.境界; }
      if (npc.先天六司 != null) { npc.先天六维属性 = npc.先天六维属性 ?? npc.先天六司; delete npc.先天六司; }
      if (npc.后天六司 != null) { npc.后天六维属性 = npc.后天六维属性 ?? npc.后天六司; delete npc.后天六司; }
    }
  }
  const migrated: SaveDataV3 = {
    元数据: {
      版本号: 3,
      存档ID: String(source.元数据?.存档ID ?? source.存档ID ?? `save_${Date.now()}`),
      存档名: String(source.元数据?.存档名 ?? source.存档名 ?? '迁移存档'),
      游戏版本: source.元数据?.游戏版本 ?? source.游戏版本,
      创建时间: String(source.元数据?.创建时间 ?? source.创建时间 ?? nowIso),
      更新时间: nowIso,
      游戏时长秒: Number(source.元数据?.游戏时长秒 ?? source.游戏时长秒 ?? source.元数据?.游戏时长 ?? source.游戏时长 ?? 0),
      时间: flatTime,
      回合序号: Number((source.元数据 as any)?.回合序号 ?? 0),
    },
    角色: {
      身份: identity,
      属性: flatAttributes,
      位置: flatLocation,
      效果: flatEffects,
      身体: source.身体 ?? (source.身体部位开发 ? { 部位开发: source.身体部位开发 } : undefined),
      背包: flatInventory,
      // 装备/功法/修炼/技能 已退役，迁移时不再写入（旧存档中若有则忽略）
    },
    社交: {
      关系: flatRels,
      事件: flatEvent,
      记忆: flatMemory,
    },
    世界: {
      信息: worldInfo,
      状态: (() => {
        const s = source.世界?.状态 ?? source.世界状态;
        if (isPlainObject(s)) {
          const hb = (s as any).心跳;
          if (!hb || typeof hb !== 'object') {
            return { ...s, 探索记录: Array.isArray(s.探索记录) ? s.探索记录 : [], 心跳: { 启用: false, 周期数值: 5, 历史条数: 10, 遗忘回合数: 10, 历史: [] } };
          }
          return { ...s, 探索记录: Array.isArray(s.探索记录) ? s.探索记录 : [] };
        }
        return { 探索记录: [], 心跳: { 启用: false, 周期数值: 5, 历史条数: 10, 遗忘回合数: 10, 历史: [] } };
      })(),
    },
    系统: {
      配置: systemConfig,
      设置: source.系统?.设置 ?? source.设置 ?? undefined,
      缓存: source.系统?.缓存 ?? source.缓存 ?? undefined,
      行动队列: source.系统?.行动队列 ?? source.行动队列 ?? undefined,
      历史: { 叙事: Array.isArray(narrative) ? narrative : [] },
      扩展: systemExtension,
      联机: isPlainObject(online) ? { ...buildDefaultOnline(), ...(online as any) } : buildDefaultOnline(),
    },
  };

  // 清除旧key：迁移后的对象严格只保留新字段
  for (const key of LEGACY_ROOT_KEYS) {
    if (key in source) report.removedLegacyKeys.push(String(key));
  }

  // 最小校验与告警
  for (const key of REQUIRED_V3_KEYS) {
    if (!(key in migrated as any)) report.warnings.push(`迁移后缺少必填字段：${String(key)}`);
  }
  if (!migrated.角色?.身份) report.warnings.push('迁移后仍缺少 角色.身份（将导致部分界面无法展示）');

  return { migrated: migrated as SaveDataV3, report };
}
