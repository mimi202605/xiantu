// src/types/index.ts

// 从 game.d.ts 导出 TechniqueItem 类型以修复编译错误
export type { TechniqueItem } from './game.d';
import type { SaveDataV3 } from './saveSchemaV3';
import type { APIUsageType } from '@/stores/apiManagementStore';

// --- 核心AI交互结构 (保留) ---
export interface GM_Request {
  action: 'new_game' | 'player_action';
  character_data: any; // 角色卡数据
  player_input?: string; // 玩家输入
  mid_term_memory?: string; // 中期记忆
}

export interface GM_Response {
  narrative: string; // AI生成的旁白
  map_data: any; // AI生成的地图数据
  mid_term_memory: string; // AI总结的中期记忆
  cachedWorldData?: any; // AI缓存的世界数据
  action_options: string[]; // 行动选项（必填）
}

// --- 创角核心类型定义 ---

export interface World {
  id: number;
  name: string;
  era?: string | null;
  description?: string | null;
  source?: 'local' | 'cloud';
}

export interface TalentTier {
  id: number;
  name: string;
  description?: string | null;
  total_points: number;
  rarity: number;
  color: string;
  source?: 'local' | 'cloud';
}

export interface Origin {
  id: number;
  name: string;
  description?: string | null;
  talent_cost: number;
  attribute_modifiers?: Record<string, number> | null;
  rarity: number;
  source?: 'local' | 'cloud';
  background_effects?: { type: string; description: string }[];
}

export interface SpiritRoot {
  id: number;
  name: string;
  tier?: string | null;
  description?: string | null;
  cultivation_speed?: string;
  special_effects?: string[];
  base_multiplier: number;
  talent_cost: number;
  rarity?: number;
  source?: 'local' | 'cloud';
}

// --- 全新存档与游戏状态结构 ---

export interface Talent {
  id: number; // 统一为数字ID以匹配后端
  name: string;
  description?: string | null;
  talent_cost: number;
  rarity: number;
  tier_id?: number | null;
  tier?: TalentTier | null;
  source?: 'local' | 'cloud';
  effects?: Array<{
    类型: string;
    目标?: string;
    数值: number;
    技能?: string;
    名称?: string;
  }>;
}

export interface CharacterGameState {
  mapData: any;
  talents: Talent[];
  reputation: number;
  titles: string[];
  hp?: number; hp_max?: number;
  mana?: number; mana_max?: number;
  spirit?: number; spirit_max?: number;
  lifespan?: number; lifespan_max?: number;
  root_bone?: number;
  spirituality?: number;
  comprehension?: number;
  fortune?: number;
  charm?: number;
  temperament?: number;
}

export type CharacterSaveData = {
  [saveSlotId: string]: CharacterGameState;
};

export type GameSaves = {
  [characterId: string]: CharacterSaveData;
};

// --- 补完核心角色定义 ---

export interface Currency {
  low: number; high: number;
  mid: number; supreme: number;
}

export interface StorageExpansion {
  id: string;
  name: string;
  addedCapacity: number;
}

export interface Item {
  id: string;
  name: string;
  quantity: number;
  description: string;
}

export interface Inventory {
  items: Item[];
  capacity: number;
  expansions: StorageExpansion[];
  currency: Currency;
}

export interface Character {
  id: number;
  character_name: string;
  world_id: number;
  created_at: string;
  inventory: Inventory;
  talents: Talent[];
  reputation: number;

  // --- 先天六司 (永不改变) ---
  root_bone: number;
  spirituality: number;
  comprehension: number;
  fortune: number;
  charm: number;
  temperament: number;

  // --- 创角选择 (永不改变) ---
  world?: World | null;
  talent_tier?: TalentTier | null;
  origin?: Origin | null;
  spirit_root?: SpiritRoot | null;

  // --- 动态可变属性 (用于游戏状态) ---
  realm?: string;
  hp?: number; hp_max?: number;
  mana?: number; mana_max?: number;
  spirit?: number; spirit_max?: number;
  lifespan?: number; lifespan_max?: number;
}

/**
 * 【新】统一的角色数据类型，用于各处流转
 * 包含了来源信息和可选的游戏状态预览
 */
export type CharacterData = Character & {
  source: 'local' | 'cloud';
  gameState?: CharacterGameState;
};

/**
 * 角色创建时的载荷类型
 */
export interface CharacterCreationPayload {
  charId: string;
  characterName: string;
  world: World;
  talentTier: TalentTier;
  origin: Origin | null;  // 允许为null，表示随机出身
  spiritRoot: SpiritRoot | null;  // 允许为null，表示随机灵根
  talents: Talent[];
  baseAttributes: {
    root_bone: number;
    spirituality: number;
    comprehension: number;
    fortune: number;
    charm: number;
    temperament: number;
  };
  mode: '单机' | '联机';
  age: number;
  gender: string;
  race?: string;  // 种族字段（可选，默认为'人族'）
}

// --- 创角自定义数据结构 ---

export type DADCustomData = {
  worlds: World[];
  talentTiers: TalentTier[];
  origins: Origin[];
  spiritRoots: SpiritRoot[];
  talents: Talent[];
};
// src/types/index.ts

/**
 * 代表所有游戏存档的集合
 * key是存档名称, value是聊天记录数组
 */
export type AllSaves = Record<string, any[]>;

// --- 新增的类型定义 ---

export interface InitialGameData {
  baseInfo: {
    名字: string;
    先天六司?: {
      体质?: number;
      直觉?: number;
      悟性?: number;
      气运?: number;
      魅力?: number;
      心性?: number;
    };
    性别?: string;
    世界?: string;
    天资?: any; // 允许包含描述的复杂类型
    天赋?: any[]; // 允许包含描述的复杂类型
    出生?: any; // 允许包含描述的复杂类型
    灵根?: any; // 允许包含描述的复杂类型
  };
  creationDetails: {
    age: number;
    originName: string;
    spiritRootName: string;
    talentNames?: string[];
    talentTierName?: string;
  };
  // 🔥 新增字段：直接传递世界信息
  worldInfo?: WorldInfo;
  availableContinents?: Array<{
    名称: string;
    描述: string;
    大洲边界?: any;
  }>;
  availableLocations?: Array<{
    名称: string;
    类型: string;
    描述?: string;
    所属势力?: string;
    coordinates?: any;
  }>;
  mapConfig?: any;
  saveData?: any;
  world?: any;
}

export interface WorldInfo {
  世界名称: string;
  大陆信息?: any[];
  势力信息?: any[];
  地点信息?: any[];
  世界背景?: string;
  世界纪元?: string;
  生成时间?: string;
  特殊设定?: string[];
  版本?: string;
}

// 存档结构以 V3 为准（见 docs/save-schema-v3.md）
export type SaveData = SaveDataV3;

// --- TavernHelper API 类型定义 ---

// 为酒馆世界书条目定义一个最小化的接口以确保类型安全
export interface LorebookEntry {
  uid: number;
  comment: string;
  keys: string[];
  content: string;
}

// 提示词注入类型定义(根据@types文档)
export interface InjectionPrompt {
  id: string;
  /**
   * 要注入的位置
   * - 'in_chat': 插入到聊天中
   * - 'none': 不会发给 AI, 但能用来激活世界书条目.
   */
  position: 'in_chat' | 'none';
  depth: number;
  role: 'system' | 'assistant' | 'user';
  content: string;
  /** 提示词在什么情况下启用; 默认为始终 */
  filter?: (() => boolean) | (() => Promise<boolean>);
  /** 是否作为欲扫描文本, 加入世界书绿灯条目扫描文本中; 默认为任意 */
  should_scan?: boolean;
}

export interface InjectPromptsOptions {
  once?: boolean; // 是否只在下一次请求生成中有效
}

export interface Overrides {
  char_description?: string;
  char_personality?: string;
  scenario?: string;
  example_dialogue?: string;
  [key: string]: unknown;
}

export interface TavernHelper {
  // 核心生成与命令
  generate: (config: {
    user_input?: string;
    should_stream?: boolean;
    image?: File | string | (File | string)[];
    overrides?: Overrides;
    injects?: Omit<InjectionPrompt, 'id'>[];
    max_chat_history?: 'all' | number;
    custom_api?: Record<string, unknown>;
    generation_id?: string;
    usageType?: APIUsageType;
  }) => Promise<string>; // 更新generate方法签名
  generateRaw: (config: Record<string, unknown>) => Promise<unknown>; // 更改为接受配置对象
  triggerSlash: (command: string) => Promise<unknown>;

  // 斜杠命令注册（扩展功能，可选）
  registerSlashCommand?: (command: string, callback: (args?: any) => Promise<void> | void) => void;

  // 提示词注入
  injectPrompts: (prompts: InjectionPrompt[], options?: InjectPromptsOptions) => void;
  uninjectPrompts: (ids: string[]) => void;

  // 变量操作
  getVariables(options: { type: 'global' | 'chat' | 'local' }): Promise<Record<string, unknown>>;
  getVariable(key: string, options: { type: 'global' | 'chat' | 'local' }): Promise<unknown>;
  setVariable(key: string, value: unknown, options: { type: 'global' | 'chat' | 'local' }): Promise<void>;
  insertOrAssignVariables(data: Record<string, unknown>, options: { type: 'global' | 'chat' | 'local' }): Promise<void>;
  deleteVariable(variable_path: string, options?: { type?: string; message_id?: number | 'latest' }): Promise<{ variables: Record<string, unknown>; delete_occurred: boolean }>;

  // 角色与宏
  getCharData(): Promise<{ name: string } | null>;
  substitudeMacros(macro: string): Promise<string>;

  // 世界书操作
  getLorebooks(): Promise<string[]>;
  createLorebook(name: string): Promise<void>;
  getLorebookEntries(name: string): Promise<LorebookEntry[]>;
  setLorebookEntries(name: string, entries: Partial<LorebookEntry>[]): Promise<void>;
  createLorebookEntries(name: string, entries: unknown[]): Promise<void>;

  // 聊天记录操作
  getLastMessageId(): Promise<number>;
  deleteChatMessages(message_ids: number[], options?: { refresh?: 'none' | 'all' }): Promise<void>;
  updateChatHistory?(history: unknown[]): Promise<void>; // 为了向后兼容，设为可选
  clearChat?(): Promise<void>; // 清空聊天记录

  // 设置与其他
  settings?: {
    token?: string;
  };
}
