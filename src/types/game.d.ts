// src/types/game.d.ts

/**
 * @fileoverview
 * 坤舆图志 - 游戏核心数据结构天规
 * 此文件定义了整个游戏存档、角色、NPC等核心数据的TypeScript类型。
 * 所有数据结构均基于道友提供的最新《大道坤舆图》。
 */

import type { QualityType, GradeType } from '@/data/itemQuality';
import type { World, TalentTier, Origin, SpiritRoot, Talent } from './index';
export type { WorldMapConfig } from './worldMap';

// --- AI 元数据通用接口 ---
// 注意：存档落盘结构不允许出现 `_AI说明/_AI修改规则/_AI重要提醒` 等字段；
// 这些提示仅允许存在于提示词/代码内部，不进入 SaveData。
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AIMetadata {}

// --- 系统与规则（可嵌入提示与限制） ---
export interface AttributeLimitConfig {
  先天六维属性?: {
    每项上限: number; // 六项单项最大值（默认10）
  };
}

export interface SystemConfig extends AIMetadata {
  初始年龄?: number; // 开局年龄，用于自动计算寿命
  开局时间?: GameTime; // 开局游戏时间，用于自动计算寿命
  规则?: {
    属性上限?: AttributeLimitConfig;
    装备系统?: string;
    品质控制?: string;
  };
  提示?: string | string[]; // 可放置给AI的约束提示，随存档一并注入
  nsfwMode?: boolean; // Whether to enable NSFW mode
  nsfwGenderFilter?: 'all' | 'male' | 'female'; // NSFW gender filter
  npcDemotionThreshold?: number; // Turns of inactivity before demotion (default 5)
  importantNpcGenerationRange?: { min: number; max: number }; // Range of important NPCs to generate at new locations (default 0-1)
  /**
   * Engram 记忆增强配置（可选）
   * - legacy: 保持原检索链路
   * - hybrid: 由统一检索器替代原 memoryRetrieve
   */
  engram?: MingEngramConfig;
}

export interface MingEngramEmbeddingConfig {
  enabled: boolean;
  provider: 'openai' | 'ollama' | 'custom' | 'vllm' | 'cohere' | 'jina' | 'voyage';
  model: string;
  topK: number;
  minScore: number;
}

export interface MingEngramRerankConfig {
  enabled: boolean;
  providerUrl?: string;
  model?: string;
  topN: number;
}

export interface MingEngramTrimConfig {
  enabled: boolean;
  trigger: 'token' | 'count';
  tokenLimit: number;
  countLimit: number;
  keepRecent: number;
}

export interface MingEngramConfig {
  enabled: boolean;
  retrievalMode: 'legacy' | 'hybrid';
  embedding: MingEngramEmbeddingConfig;
  rerank: MingEngramRerankConfig;
  trim: MingEngramTrimConfig;
  debug?: boolean;
}

export interface MingEventNode {
  id: string;
  summary: string;
  structured_kv: {
    time_anchor: string;
    role: string[];
    location: string[];
    event: string;
    logic: string[];
    causality: string;
  };
  is_embedded: boolean;
  is_archived: boolean;
  significance_score: number;
  level: number;
  parent_id?: string;
  source_range: { start_index: number; end_index: number };
  timestamp: number;
}

export interface MingEntityNode {
  id: string;
  name: string;
  type: 'char' | 'loc' | 'item' | 'concept' | 'unknown';
  aliases: string[];
  description: string;
  profile: Record<string, unknown>;
  is_embedded?: boolean;
  last_updated_at: number;
}

export interface MingEntityRelation {
  id: string;
  from_id: string;
  to_id: string;
  relation: string;
  confidence: number;
  source_event_id?: string;
  last_updated_at: number;
}

export interface MingEngramMeta {
  last_summarized_floor: number;
  last_extracted_floor: number;
  last_trimmed_at?: number;
  embedding_model?: string;
  vector_dim?: number;
  schema_version: number;
}

export interface MingEngramMemory {
  events: MingEventNode[];
  entities: MingEntityNode[];
  relations: MingEntityRelation[];
  meta: MingEngramMeta;
}

// --- 状态变更日志接口 ---
export type StateChange = {
  key: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
};

export interface StateChangeLog {
  before?: any;
  after?: any;
  changes: StateChange[];
  timestamp?: string;
}

// --- 记忆条目接口 ---
export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: Date;
  importance: number; // 1-10
  tags: string[];
  type: 'user_action' | 'ai_response' | 'system_event' | 'summary' | 'short' | 'mid' | 'long';
  hidden?: boolean; // 是否为隐藏记忆
  convertedFrom?: 'short' | 'mid' | 'long'; // 转换来源
  category: 'combat' | 'social' | 'cultivation' | 'exploration' | 'other';
  metadata?: {
    location?: string;
    npcs?: string[];
    items?: string[];
    skills?: string[];
  };
}

// --- 处理响应接口 ---
export interface ProcessedResponse {
  content: string;
  metadata: {
    confidence: number;
    reasoning: string[];
    memoryUpdates: MemoryEntry[];
    suggestedActions: string[];
    memoryStats?: {
      shortTermCount: number;
      midTermCount: number;
      longTermCount: number;
      hiddenMidTermCount: number;
      lastConversion?: Date;
    };
  };
}

// --- 天道系统相关类型 ---
export interface HeavenlyCalculation {
  天道值: number;
  修正因子: number;
  基础计算: any;
  [key: string]: any;
}

// 简化的核心属性类型（仅用于天道系统内部计算）
export interface CoreAttributes {
  攻击力: number;
  防御力: number;
  灵识: number;
  敏捷: number;
  气运: number;
  境界加成: number;
}

// 简化的死亡状态类型（仅用于天道系统内部判定）
export interface DeathState {
  已死亡: boolean;
  死亡时间?: string;
  死亡原因?: string;
}

// 简化的天道系统类型（仅用于内部计算，不存储到 PlayerStatus）
export interface HeavenlySystem {
  版本: string;
  角色名称: string;
  境界等级: number;
  核心属性: CoreAttributes;
  死亡状态: DeathState;
  更新时间: string;
}

// --- 基础与通用类型 ---

export interface Vector2 {
  X: number;
  Y: number;
}

export interface ValuePair<T> {
  当前: T;
  上限: T;
}

/** 英文字段名的ValuePair（用于vitals字段） */
export interface EnglishValuePair<T> {
  current: T;
  max: T;
}

/** 物品品质信息 - 新版本 */

export interface ItemQuality {
  quality: QualityType; // 品质等级：神、仙、天、地、玄、黄、凡
  grade: GradeType; // 品级：0-10
}


// --- 六维属性（原先天六司）---

export interface InnateAttributes {
  体质: number;
  直觉: number;
  悟性: number;
  气运: number;
  魅力: number;
  心性: number;
}

/** 英文键名的先天六司，用于组件传参 */

export interface InnateAttributesEnglish {
  root_bone: number;
  spirituality: number;
  comprehension: number;
  fortune: number;
  charm: number;
  temperament: number;
}

export type AttributeKey = keyof InnateAttributesEnglish;

// --- 物品与背包 ---

/** 装备增幅或功法属性加成 */
export interface AttributeBonus {
  体力上限?: number;
  精力上限?: number;
  洞察力上限?: number;
  后天六维属性?: Partial<InnateAttributes>;
  [key: string]: any; // 允许其他动态属性
}

/** 功法技能（背包中功法物品的技能数组） */
export interface TechniqueSkill {
  技能名称: string;
  技能描述: string;
  消耗?: string;
  熟练度要求?: number; // 达到此修炼进度后解锁（0-100百分比）
  [key: string]: any; // 允许其他动态属性
}

/** 功法效果 */
export interface TechniqueEffects {
  修炼速度加成?: number;
  属性加成?: Partial<InnateAttributes & { [key: string]: number }>;
  特殊能力?: string[];
}

/** 物品类型 */
export type ItemType = '装备' | '功法' | '丹药' | '材料' | '其他';

/** 基础物品接口 */
export interface BaseItem {
  物品ID: string;
  名称: string;
  类型: ItemType;
  品质: ItemQuality;
  数量: number;
  已装备?: boolean; // true表示装备中/修炼中，false表示未装备
  描述: string;
  可叠加?: boolean;
}

/** 装备类型物品 */
export interface EquipmentItem extends BaseItem {
  类型: '装备';
  装备增幅?: AttributeBonus;
  特殊效果?: string | AttributeBonus;
}

/** 功法类型物品 */
export interface TechniqueItem extends BaseItem {
  类型: '功法';
  功法效果?: TechniqueEffects;
  功法技能?: TechniqueSkill[]; // ✅ 改为数组格式
  修炼进度?: number; // 0-100 百分比
  修炼中?: boolean; // 是否正在修炼（兼容旧代码）
  已解锁技能?: string[]; // ✅ 已解锁的技能名称列表
  // 注意：新代码应使用 已装备 字段，修炼中 仅为向后兼容
}

/** 消耗品/材料类型物品（丹药、材料、其他） */
export interface ConsumableItem extends BaseItem {
  类型: '丹药' | '材料' | '其他';
  使用效果?: string;
}

/** 物品的联合类型 */
export type Item = EquipmentItem | TechniqueItem | ConsumableItem;


/** 修炼功法引用（只存储引用，不存储完整数据） */
export interface CultivationTechniqueReference {
  物品ID: string;    // 引用背包中的功法ID
  名称: string;      // 功法名称（用于快速显示）
}

/** 掌握的技能（技能数据+进度合并） */
export interface MasteredSkill {
  技能名称: string;
  技能描述: string;
  来源: string; // 来源功法名称
  消耗?: string; // 消耗说明

  // 进度数据（与技能数据合并）
  熟练度: number; // 技能熟练度
  使用次数: number; // 使用次数统计
}

/** 货币四档：现金、铜、银、金 */
export interface CurrencyFourTier {
  现金: number;
  铜: number;
  银: number;
  金: number;
}

export interface Inventory extends AIMetadata {
  /** 通用货币（四档：现金、铜、银、金） */
  金钱?: CurrencyFourTier;
  物品: Record<string, Item>; // 物品现在是对象结构，key为物品ID，value为Item对象
}

/** 功法中的技能信息 */
export interface SkillInfo {
  name: string;
  description: string;
  type: string; // 简化：统一为字符串类型
  unlockCondition: string;
  unlocked: boolean;
}

// [MING] 宗门系统相关类型已移除（SectType, SectPosition, SectRelationship, SectMemberInfo, SectInfo, SectSystemData, SectMigrationRecord, SectSystemV2, SectContentStatus, SectLibraryTechniqueExtended, SectShopItemExtended）

/** 修为境界等级 */
export type RealmLevel = '练气' | '筑基' | '金丹' | '元婴' | '化神' | '炼虚' | '合体' | '渡劫';

/** 成员数量统计（用于世界势力 WorldFaction 等） */
export interface SectMemberCount {
  总数?: number;
  total?: number;
  按境界?: Record<RealmLevel, number>;
  byRealm?: Record<string, number>;
  按职位?: Record<string, number>;
}

// [MING] 三千大道系统已移除

// --- 装备 ---

/** 装备槽类型 */
export interface EquipmentSlot {
  名称: string;
  物品ID: string;
  装备特效?: string[];
  装备增幅?: {
    体力上限?: number;
    精力上限?: number;
    洞察力上限?: number;
    后天六维属性?: Partial<InnateAttributes>;
  };
  耐久度?: ValuePair<number>;
  品质?: ItemQuality;
}

export interface Equipment extends AIMetadata {
  装备1: string | null;
  装备2: string | null;
  装备3: string | null;
  装备4: string | null;
  装备5: string | null;
  装备6: string | null;
}

// --- 状态效果 ---

export type StatusEffectType = 'buff' | 'debuff'; // 统一小写

export interface StatusEffect {
  状态名称: string;
  类型: 'buff' | 'debuff';
  生成时间: {
    年: number;
    月: number;
    日: number;
    小时: number;
    分钟: number;
  };
  持续时间分钟: number;
  状态描述: string;
  强度?: number;
  来源?: string;
  时间?: string; // 可选：时间描述（如"3天"、"1个月"）
  剩余时间?: string; // 可选：剩余时间描述
}

// --- 角色实时状态 ---

/** 地位（原境界）结构 */
export interface Realm {
  名称: string;        // 地位名称
  阶段: string;        // 阶段，如"初期"、"中期"、"后期"、"圆满"
  当前进度: number;    // 当前进度
  下一级所需: number;  // 突破到下一阶段所需进度
  突破描述: string;    // 突破描述
}
// 地位子阶段类型
export type RealmStage = '初期' | '中期' | '后期' | '圆满' | '极境';

// 境界子阶段定义
export interface RealmStageDefinition {
  stage: RealmStage;
  title: string;
  breakthrough_difficulty: '简单' | '普通' | '困难' | '极难' | '逆天';
  resource_multiplier: number; // 资源倍数（体力、精力、洞察力）
  lifespan_bonus: number; // 寿命加成
  special_abilities: string[]; // 特殊能力
  can_cross_realm_battle?: boolean; // 是否可越阶战斗
}

export interface RealmDefinition {
  level: number;
  name: string;
  title: string;
  coreFeature: string;
  lifespan: string;
  activityScope: string;
  gapDescription: string;
  stages?: RealmStageDefinition[]; // 境界子阶段，凡人境界没有子阶段
}



export interface PlayerStatus extends AIMetadata {
  地位?: Realm; // 地位（可选）
  声望: number;
  位置: {
    描述: string;
    x?: number; // 经度坐标 (Longitude, 通常 100-115)
    y?: number; // 纬度坐标 (Latitude, 通常 25-35)
    灵气浓度?: number; // 环境强度 1-100（可选）
  };
  体力: ValuePair<number>;
  精力: ValuePair<number>;
  洞察力?: ValuePair<number>;
  寿命: ValuePair<number>;
  状态效果?: StatusEffect[];
  事件系统?: EventSystem;
  身体部位开发?: Record<string, PlayerBodyPart>; // NSFW: 玩家身体部位开发数据 (V3路径: 角色.身体部位开发)
}

// --- MECE短路径：拆分“属性/位置/效果” ---
export type PlayerAttributes = Pick<PlayerStatus, '地位' | '声望' | '体力' | '精力' | '洞察力' | '寿命'>;
// 位置：空间信息（从 PlayerStatus.位置 提取）
export type PlayerLocation = PlayerStatus['位置'];

/** 用于UI组件显示的角色状态信息 */
export interface CharacterStatusForDisplay {
  name: string;
  realm: Realm; // 地位结构
  age: number; // 来自寿命的当前值
  hp: string;
  mana: string;
  spirit: string; // 洞察力
  lifespan: ValuePair<number>;
  声望: number;
  cultivation_exp: number;
  cultivation_exp_max: number;
  root_bone: number;
  spirituality: number;
  comprehension: number;
  fortune: number;
  charm: number;
  temperament: number;
}

// --- 世界数据类型定义 ---

/** 世界大陆信息 */
export interface WorldContinent {
  名称: string;
  name?: string; // 兼容英文名
  描述: string;
  地理特征?: string[];
  修真环境?: string;
  气候?: string;
  天然屏障?: string[];
  大洲边界?: { x: number; y: number }[];
  主要势力?: (string | number)[]; // 兼容id和名称
  factions?: (string | number)[]; // 兼容英文名
}

/** 世界势力信息 - 统一的宗门/势力数据结构 */
export interface WorldFaction {
  id?: string | number; // 增加可选的id字段
  名称: string;
  类型: '修仙宗门' | '魔道宗门' | '中立宗门' | '修仙世家' | '魔道势力' | '商会组织' | '散修联盟' | string;
  等级: '超级' | '一流' | '二流' | '三流' | string;
  所在大洲?: string; // 增加可选的所在大洲字段
  位置?: string | { x: number; y: number }; // 支持字符串描述或坐标
  势力范围?: string[] | { x: number; y: number }[]; // 支持字符串数组或坐标数组
  描述: string;
  特色: string | string[]; // 支持字符串或字符串数组
  与玩家关系?: '敌对' | '中立' | '友好' | '盟友' | string;
  声望值?: number;

  // 宗门系统扩展字段 - 只对宗门类型势力有效
  特色列表?: string[]; // 宗门特色列表，替代 特色 字符串

  // 宗门成员统计
  成员数量?: SectMemberCount;

  // 宗门领导层 - 新增必需字段
  领导层?: {
    宗主: string;
    宗主修为: string; // 如"化神中期"、"元婴后期"等
    副宗主?: string;
    圣女?: string;
    圣子?: string;
    太上长老?: string;
    太上长老修为?: string;
    长老数量?: number; // 宗门长老数量
    最强修为: string; // 宗门内最高修为境界
    综合战力?: number; // 1-100的综合战力评估
    核心弟子数?: number;
    内门弟子数?: number;
    外门弟子数?: number;
  };

  // 势力范围详情
  势力范围详情?: {
    控制区域?: string[]; // 替代 势力范围 字符串数组
    影响范围?: string;
    战略价值?: number; // 1-10
  };

  // 加入相关
  可否加入?: boolean;
  加入条件?: string[];
  加入好处?: string[];
}

/**
 * 地点条目（递归结构，用于地图系统）
 * 顶层地点在 地点信息 数组中并列存储（parallel）；每个地点的子地点在 内部 中递归嵌套
 * 地点NPC 存于每个地点内，可追溯各地点的 NPC；玩家离开后重点 NPC 会离开，普通 NPC 留守
 */
export interface LocationEntry {
  名称: string;
  描述?: string;
  上级?: string;         // 父地点名称，根节点无；子查父
  内部?: LocationEntry[]; // 子地点，递归；父查子
  地点NPC?: string[];    // 本地的 NPC 名列表；与 社交.关系 对耦
}

/** 世界地点信息（扩展 LocationEntry，兼容旧数据） */
export interface WorldLocation extends LocationEntry {
  类型?: '城池' | '宗门' | '秘境' | '险地' | '商会' | '坊市' | '洞府' | string;
  位置?: string;
  coordinates?: { x: number; y: number }; // 原始坐标数据
  特色?: string;
  安全等级?: '安全' | '较安全' | '危险' | '极危险' | string;
  开放状态?: '开放' | '限制' | '封闭' | '未发现' | string;
  相关势力?: string[];
  特殊功能?: string[];
}

/** 世界生成信息 */
export interface WorldGenerationInfo {
  生成时间: string;
  世界背景: string;
  世界纪元: string;
  特殊设定: string[];
  版本: string;
}

/** 完整的世界信息数据结构（不含大陆/势力，开局不生成） */
export interface WorldInfo {
  世界名称: string;
  地点信息: (WorldLocation | LocationEntry)[]; // 顶层并列；每项可有 内部 递归子地点；地点NPC 存于各地点内
  地图配置?: WorldMapConfig;
  // 从 WorldGenerationInfo 扁平化
  生成时间: string;
  世界背景: string;
  世界纪元: string;
  特殊设定: string[];
  版本: string;
}

// --- 事件系统 ---

/** 事件类型（可扩展，ming 通用：势力冲突/局势变化/重大发现/人物风波） */
export type EventType =
  | '势力冲突'
  | '局势变化'
  | '重大发现'
  | '人物风波'
  | string;

/** 事件记录 */
export interface GameEvent {
  事件ID: string;
  事件名称: string;
  事件类型: EventType;
  事件描述: string;
  影响等级?: '轻微' | '中等' | '重大' | '灾难' | string;
  影响范围?: string;
  相关人物?: string[];
  相关势力?: string[];
  事件来源: '随机' | '玩家影响' | '系统' | string;
  发生时间: GameTime;
}

/** 自定义事件模板 */
export interface CustomEventTemplate {
  id: string;
  名称: string;
  类型: EventType;
  描述模板: string; // 支持占位符如 {玩家名}、{位置}
  影响等级: '轻微' | '中等' | '重大' | '灾难';
  启用: boolean;
}

/** 事件系统配置 */
export interface EventSystemConfig {
  启用随机事件: boolean;
  最小间隔年: number;
  最大间隔年: number;
  事件提示词: string;
  // 事件类型开关（ming 通用）
  启用事件类型?: {
    势力冲突?: boolean;
    局势变化?: boolean;
    重大发现?: boolean;
    人物风波?: boolean;
    特殊NPC?: boolean;
  };
  // 特殊NPC事件触发概率 (0-100)
  特殊NPC概率?: number;
  // 自定义事件模板
  自定义事件?: CustomEventTemplate[];
}

/** 事件系统（统一管理世界事件） */
export interface EventSystem {
  配置: EventSystemConfig;
  下次事件时间: GameTime | null;
  事件记录: GameEvent[];
}

// --- 世界心跳 ---

/** 单次心跳中某 NPC 的更新条目（用于 UI 展示与单条回溯） */
export interface HeartbeatUpdateEntry {
  npc名字: string;
  更新摘要?: string;
  更新前?: Partial<NpcProfile>;
  更新后?: Partial<NpcProfile>;
}

/** 单次心跳记录（可展开 UI） */
export interface HeartbeatRecord {
  时间: string;
  回合序号: number;
  触发方式: '周期' | '事件' | '手动';
  相关事件ID?: string;
  更新列表: HeartbeatUpdateEntry[];
  /** 更新前的完整 NPC 快照，用于全部/单条回溯 */
  快照: Record<string, NpcProfile>;
}

/** 世界.状态.心跳 配置与历史 */
export interface WorldHeartbeatConfig {
  启用: boolean;
  周期数值: number;
  上次心跳回合序号?: number;
  历史条数: number;
  遗忘回合数: number;
  历史?: HeartbeatRecord[];
}

// --- 世界地图 ---

// --- NPC 模块 ---

// TavernCommand is now imported from AIGameMaster.d.ts to avoid conflicts

/** 身体部位开发数据 */
export interface BodyPartDevelopment {
  部位名称: string; // 如：胸部、小穴、菊穴、嘴唇、耳朵等
  敏感度: number; // 0-100
  开发度: number; // 0-100（统一使用"开发度"，与AI提示词保持一致）
  特殊印记?: string; // 如：「已调教」「极度敏感」「可喷奶」、「合欢莲印」等
  特征描述: string; // 部位的详细描述，如："娇小粉嫩，轻触即颤"、"紧致温润，吸附感强"
}

/** 玩家身体部位开发数据 - 简化结构 */
export interface PlayerBodyPart {
  特征描述: string;
}

/** 玩家身体详细数据 (NSFW/Tavern Only) */
export interface BodyStats {
  // 基础体格
  身高: number; // cm
  体重: number; // kg
  体脂率?: number; // %

  // 三围数据
  三围: {
    胸围: number; // cm
    腰围: number; // cm
    臀围: number; // cm
  };

  // 性征描述
  胸部描述?: string; // 罩杯、形状等
  私处描述?: string; // 女性私处/特殊部位
  生殖器描述?: string; // 尺寸、形状、特征

  // 外观细节
  肤色?: string;
  发色?: string;
  瞳色?: string;
  纹身与印记?: string[];
  穿刺?: string[];

  // 敏感与开发
  敏感点?: string[];
  开发度?: Record<string, number>; // 部位 -> 0-100

  // 其他
  其它?: Record<string, any>;
}

/** 统一的私密信息模块 (NSFW) */
export interface PrivacyProfile {
  是否为处女: boolean;
  身体部位: BodyPartDevelopment[];
  性格倾向: string;
  性取向: string;
  性癖好: string[];
  性渴望程度: number;
  当前性状态: string;
  体液分泌状态: string;
  性交总次数: number;
  性伴侣名单: string[];
  最近一次性行为时间: string;
  特殊体质: string[];
}

/** NPC核心档案 - 精简高效的数据结构 */
export interface NpcProfile {
  // === 核心身份 ===
  名字: string;
  性别: '男' | '女' | '其他';
  出生日期: { 年: number; 月: number; 日: number; 小时?: number; 分钟?: number }; // 出生日期（用于自动计算年龄）
  种族?: string; // 如：人族、妖族、魔族
  出生: string | { 名称?: string; 描述?: string }; // 出生背景（必填）
  外貌描述: string; // AI生成的外貌描述，必填
  性格特征: string[]; // 如：['冷静', '谨慎', '好色']

  // === 身份与属性 ===
  地位?: Realm; // 地位（可选）
  特质?: string | SpiritRoot; // 角色特质
  天赋?: CharacterBaseInfo['天赋'];
  先天六维属性?: InnateAttributes;
  后天六维属性?: InnateAttributes;

  // === 核心数值（整合为属性对象）===
  属性: {
    体力?: ValuePair<number>;
    精力?: ValuePair<number>;
    洞察力?: ValuePair<number>;
    寿元上限: number; // 最大寿命（当前年龄由出生日期自动计算）
  };

  // === 社交关系 ===
  与玩家关系: string; // 如：道侣、师徒、朋友、敌人、陌生人
  /** 重点/普通；缺省视为重点；普通 NPC 仅在地点、提及、重要 NPC 关系网中出现 */
  类型?: '重点' | '普通';
  /** 本 NPC 对其他 NPC 的关系；key=对方名字，value=关系标签 */
  关系?: Record<string, string>;
  好感度: number; // -100 到 100
  当前位置: {
    描述: string;
    x?: number; // 经度坐标 (Longitude, 通常 100-115)
    y?: number; // 纬度坐标 (Latitude, 通常 25-35)
    灵气浓度?: number; // 环境强度 1-100（可选）
  };
  势力归属?: string;

  // === 人格系统 ===
  人格底线: string[] | string; // 如：['背叛信任', '伤害亲友', '公开侮辱', '强迫违背意愿']，触犯后好感度断崖式下跌

  // === 记忆系统 ===
  记忆: Array<{ 时间: string; 事件: string } | string>; // 兼容新旧格式：对象或纯字符串
  记忆总结?: string[];

  // === 实时状态（用 set 直接替换）===
  当前外貌状态: string; // 如："脸颊微红，眼神迷离" / "衣衫整洁，神态自然"
  当前内心想法: string; // 如："在思考什么..." / "对xxx感到好奇"
  /** 世界心跳/主回合可更新；简短一句，如 "在客栈打杂" */
  在做事项?: string;
  /** 历史在做事项归档（只读，由系统在更新 在做事项 时自动追加旧值；心跳时一并发送给模型） */
  历史在做事项?: string[];

  // === 资产物品 ===
  背包: {
    金钱?: CurrencyFourTier; // 现金、铜、银、金
    物品: Record<string, Item>;
  };

  // === 可选模块 ===
  私密信息?: PrivacyProfile; // 仅NSFW模式下存在
  实时关注: boolean; // 标记为关注的NPC会在AI回合中主动更新
  /** true 则不参与世界心跳更新；正常回合更新不受影响 */
  心跳锁定?: boolean;
  /** 最近一次被主回合（主游戏）更新时的 元数据.回合序号；仅主回合更新时写入，心跳更新不写入 */
  上次主回合更新回合?: number;

  // === 扩展字段（用于“特殊NPC/定制人物”等业务标记，不影响核心生成）===
  扩展?: {
    specialNpc?: boolean;
    specialNpcId?: string;
    specialNpcTags?: string[];
  };

  // === 旧数据兼容字段 ===
  外貌?: string;
  性格?: string;
}


// --- 记忆模块 ---

/** 隐性中期记忆单条：消费时按 相关角色 过滤注入 */
export interface ImplicitMidTermEntry {
  相关角色: string[];
  事件时间: string;
  记忆主体: string;
}

/** 中期记忆单条：可为纯字符串（旧格式/未精炼）或带已精炼标记的结构 */
export interface MidTermEntryObject {
  相关角色?: string[];
  事件时间?: string;
  记忆主体: string;
  已精炼?: boolean;
}

export type MidTermEntry = string | MidTermEntryObject;

export interface Memory extends AIMetadata {
  短期记忆?: string[]; // 最近的对话、事件的完整记录
  中期记忆: MidTermEntry[]; // 对短期记忆的总结；达阈值后经记忆总结 API 精炼，已精炼条目不重复精炼
  长期记忆: string[]; // 世界观进化结果，由中期记忆经世界观进化 API 生成
  隐式中期记忆?: ImplicitMidTermEntry[] | string[]; // 新格式为对象数组；旧存档可为 string[]，迁移时转为 ImplicitMidTermEntry[]
}

// --- 游戏时间 ---

export interface GameTime extends AIMetadata {
  年: number;
  月: number;
  日: number;
  小时: number;
  分钟: number;
}

// --- 存档数据核心 ---

export interface GameMessage {
  type: 'user' | 'ai' | 'system' | 'player' | 'gm';
  content: string;
  time: string;
  stateChanges?: StateChangeLog; // 状态变更记录
  actionOptions: string[]; // 行动选项（必填）
  metadata?: {
    commands?: any[];
  };
}

// 保持人物关系为严格的字典，键为NPC名称/ID，值为NpcProfile

export interface SaveData {
  [key: string]: any;
}


// --- 单个存档槽位 ---

export interface SaveSlot {
  id?: string;
  存档名: string;
  保存时间: string | null;
  最后保存时间?: string | null; // 新增：最后保存时间
  游戏内时间?: string;
  游戏时长?: number; // 游戏时长（秒）
  角色名字?: string; // 角色名字
  地位?: string; // 当前地位
  位置?: string; // 当前位置
  修为进度?: number; // 进度
  世界地图?: WorldMap;
  存档数据?: SaveData | null;
  // 联机模式专属字段
  云端同步信息?: {
    最后同步: string;
    版本: number;
    需要同步: boolean;
    后端创建失败?: boolean; // 标记后端创建是否失败
  };
}

// --- 角色基础信息 (静态) ---

export interface CharacterBaseInfo extends AIMetadata {
  名字: string;
  性别: '男' | '女' | '其他' | string;
  出生日期: { 年: number; 月: number; 日: number; 小时?: number; 分钟?: number }; // 出生日期（用于自动计算年龄）
  种族?: string;
  地位?: Realm; // 地位（可选）
  世界: World;
  天资: TalentTier;
  出生: Origin | string;
  特质?: string | SpiritRoot; // 角色特质（创角页用 SpiritRoot 结构，存档可存 string）
  /** @deprecated 已迁移为 特质，仅兼容旧创角/存档 */
  灵根?: string | SpiritRoot;
  天赋: Talent[];
  先天六维属性: InnateAttributes;
  后天六维属性: InnateAttributes; // 后天获得的六维属性加成，开局默认全为0
  创建时间?: string;
  描述?: string;
}


// --- 角色档案 (动静合一) ---

export interface CharacterProfile {
  模式: '单机' | '联机';
  // 角色身份（静态信息，用于列表展示/导出）
  角色: CharacterBaseInfo;
  // 🔥 统一结构：单机和联机都使用存档列表
  // 单机模式：可以有多个存档（"存档1", "存档2", ...）
  // 联机模式：只有一个存档（通常key为"云端修行"或"online"）
  存档列表: Record<string, SaveSlot & {
    // 联机模式专属字段（单机模式下为undefined）
    云端同步信息?: {
      最后同步: string;
      版本: number;
      需要同步: boolean;
      后端创建失败?: boolean; // 标记后端创建是否失败
    };
  }>;

  // 🔥 废弃字段：为了兼容旧数据，保留但标记为废弃
  /** @deprecated 请使用存档列表，此字段仅用于兼容旧版本联机存档 */
  存档?: SaveSlot & {
    云端同步信息?: {
      最后同步: string;
      版本: number;
      需要同步: boolean;
      后端创建失败?: boolean;
    };
  };
}

// --- 动作队列系统 ---

/** 动作类型 */
export type QueueActionType =
  | 'item_use'      // 使用物品
  | 'item_equip'    // 装备物品
  | 'item_discard'  // 丢弃物品
  | 'item_practice' // 修炼功法
  | 'npc_interact'  // NPC互动
  | 'custom';       // 自定义动作

/** 动作撤回数据 */
export interface ActionUndoData {
  type: QueueActionType;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  originalQuantity?: number;
  [key: string]: any; // 其他撤回需要的数据
}

/** 单个动作项 */
export interface QueueActionItem {
  id: string;
  text: string; // 显示给用户的文本
  type: QueueActionType;
  canUndo: boolean; // 是否可以撤回
  undoData?: ActionUndoData; // 撤回时需要的数据
  timestamp: number;
}

/** 动作队列 - 用于收集用户操作的文本描述 */
export interface ActionQueue {
  actions: QueueActionItem[]; // 动作列表
}

// --- 顶层本地存储结构 ---

export interface LocalStorageRoot {
  当前激活存档: {
    角色ID: string;
    存档槽位: string; // e.g., "存档1" for single player, or a default key for online
  } | null;
  角色列表: Record<string, CharacterProfile>; // 以角色唯一ID (char_1001) 为key
}

export type Continent = WorldContinent;
export type Location = WorldLocation;

// --- 修炼速度系统 ---

/** 修炼速度影响因子 */
export interface CultivationSpeedFactors {
  灵气浓度系数: number;    // 0.1 - 2.0，基于位置环境强度(1-100)
  先天六维属性系数: number;    // 0.5 - 2.0，基于先天六维属性综合值
  后天六维属性系数: number;    // 0.0 - 0.6，基于后天六维属性综合值（额外加成）
  状态效果系数: number;    // 0.5 - 2.0，基于buff/debuff
  功法加成系数: number;    // 0.0 - 1.0，基于当前修炼功法
  环境加成系数: number;    // 0.0 - 0.5，洞府、宗门福地等
}

/** 修炼速度计算结果 */
export interface CultivationSpeedResult {
  基础速度: number;        // 每回合基础修为增加
  综合系数: number;        // 所有因子的综合乘数
  最终速度: number;        // 基础速度 * 综合系数
  预计突破时间: string;    // 预计到达下一阶段的游戏时间
  因子详情: CultivationSpeedFactors;
}

/** 境界突破时间标准（游戏时间） */
export interface RealmBreakthroughTime {
  境界名称: string;
  阶段: string;
  最短月数: number;        // 最短突破时间（月）
  标准月数: number;        // 标准突破时间（月）
  最长月数: number;        // 最长突破时间（月）
  // 兼容旧格式
  最短时间?: string;       // 如 "1年"
  标准时间?: string;       // 如 "5年"
  最长时间?: string;       // 如 "20年"
  突破难度?: '简单' | '普通' | '困难' | '极难' | '逆天';
}

// --- 六维属性系统约束 ---

/** 六维属性约束配置 */
export interface SixSiConstraints {
  先天六维属性: {
    每项上限: 10;          // 固定值，不可修改
    总分上限: 60;          // 6项 × 10
    对加成权重: 0.7;       // 占总加成的70%
  };
  后天六维属性: {
    每项上限: 20;          // 单项最大值
    单次增加上限: 3;       // 每次最多增加1-3点（极稀有机缘可达5点）
    单次减少上限: 5;       // 每次最多减少1-5点（惩罚）
    对加成权重: 0.3;       // 占总加成的30%
    获取方式: string[];    // ['装备', '天赋', '丹药', '机缘']
  };
}

/** 六维属性加成结果 */
export interface SixSiBonus {
  修炼速度加成: number;    // 百分比 0-100
  战斗力加成: number;      // 百分比 0-100
  感知范围加成: number;    // 百分比 0-100
  交际能力加成: number;    // 百分比 0-100
  机缘概率加成: number;    // 百分比 0-100
}

/** 六维属性权重配置 */
export interface SixSiWeights {
  体质: number;
  直觉: number;
  悟性: number;
  心性: number;
  气运: number;
  魅力: number;
}
