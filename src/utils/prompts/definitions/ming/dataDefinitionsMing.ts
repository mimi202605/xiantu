/**
 * @fileoverview 存档数据结构定义 - 通用版 (ming)
 * 适用于各类故事，不包含境界、大道、宗门、功法、灵根、修炼等修仙专有结构。
 */

const CHARACTER_STRUCTURE = `
## 1. 角色（路径：角色.*）

### 1.1 身份（只读，路径：\`角色.身份\`）
- 名字: string (只读)
- 性别: "男"|"女"|"其他" (只读)
- 年龄: number (自动计算，禁改)
- 出生日期: {年, 月, 日, 小时?, 分钟?} (只读)
- 世界: string (只读)
- 种族: string (默认"人族")
- 出身: string|{名称, 描述} (只读)
- 天赋: [{名称, 描述}] (只读)

### 1.2 属性（可改，路径：\`角色.属性\`）
- 声望: number (用 add)
- 气血: {当前, 上限} (生命/体力，当前用 add，上限在成长时用 add)
- 灵气: {当前, 上限} (精力/能量，当前用 add，上限在成长时用 add)

### 1.3 位置（路径：\`角色.位置\`）
- 位置: {描述:"大陆·区域·地点", x, y} (用 set 更新整个对象)
  - 描述: string (必填，格式"大陆·区域·地点")
  - x: number (0-10000)
  - y: number (0-10000)

### 1.4 效果（buff/debuff 数组；路径：\`角色.效果\`）
- 效果: [{状态名称, 类型:"buff"|"debuff", 生成时间, 持续时间分钟, 状态描述, 强度?, 来源?}]
  - 只能用 push 添加；过期由系统清理
  - 生成时间必填：使用当前 \`元数据.时间\` 的完整对象 {年, 月, 日, 小时, 分钟}

### 1.5 装备（路径：\`角色.装备\`）
- 装备1~6: string|null (装备物品ID 或 null)

### 1.6 身体/法身（NSFW/酒馆端；路径：\`角色.身体\`）
仅当 **系统配置.nsfwMode=true** 且为酒馆端时生成/更新。
- 身高、体重、体脂率、三围、外观特征、敏感点、开发度、纹身与印记等
`;

const INVENTORY_STRUCTURE = `
## 2. 背包与物品（路径：角色.背包）

### 2.1 背包结构
- 灵石: {下品: number, 中品: number, 上品: number, 极品: number}（通用货币，用 add 增减）
- 物品: {物品ID: Item对象}（用 set 添加完整对象，用 delete 删除）

### 2.2 物品通用字段（必需）
- 物品ID: string (格式: {类型}_时间戳_随机数)
- 名称: string
- 类型: "装备"|"消耗品"|"材料"|"其他"
- 品质: {quality: "凡"|"黄"|"玄"|"地"|"天"|"仙"|"神", grade: 0-10}
- 数量: number (默认 1)
- 描述: string

### 2.3 装备类型特有字段
- 装备增幅?: { 气血上限?, 灵气上限? 等 }
- 特殊效果?: string
- 已装备: boolean

### 2.4 消耗品/材料/其他
- 使用效果?: string
- 稀有度?: string
`;

const RELATIONS_STRUCTURE = `
## 3. 关系（路径：社交.关系）

### 3.1 NPC 创建规则
**必须一次性 set 完整 NPC 对象，禁止分步添加。**
必需字段：名字/性别/出生日期/性格/外貌/背景/与玩家关系/好感度/当前位置.描述/当前外貌状态/当前内心想法/记忆[]/背包/实时关注
禁止残缺对象；信息不足须合理补全。

### 3.2 NPC 数据结构（通用版）
- 名字: string
- 性别: "男"|"女"|"其他"
- 种族: string (默认"人族")
- 出生: string (出身背景)
- 年龄: number (由出生日期自动计算，禁止手动设)
- 出生日期: {年, 月, 日}（年 必须 < 当前游戏时间.年）
- 外貌描述: string
- 性格特征: string[]
- 与玩家关系: string (如"陌生人"/"朋友"/"师徒"/"仇敌")
- 关系?: Record<string, string>（本 NPC 对其他 NPC；key=对方名字，value=关系标签；**仅**经 tavern_commands：\`set 社交.关系.{npc}.关系.{其他}\` 或 \`set 社交.关系.{npc}.关系\` 对象合并，或创建 NPC 时在 value 中带 \`关系\`）
- 好感度: number (-100~100，用 add 修改)
- 人格底线: string[]
- 记忆: string[]
- 记忆总结: string[]
- 当前位置: {描述: string, x?, y?}
- 当前外貌状态: string
- 当前内心想法: string
- 背包: {灵石: {下品, 中品, 上品, 极品}, 物品: {}}
- 实时关注: boolean
- 私密信息?: PrivacyProfile（NSFW 模式；当 系统配置.nsfwMode=true 且性别符合 nsfwGenderFilter 时为必填）

### 3.3 NPC 更新示例
- 好感度：add \`社交.关系.[NPC名].好感度\` 10
- 记忆：push \`社交.关系.[NPC名].记忆\` "……"
- 状态：set \`社交.关系.[NPC名].当前外貌状态\` "……"
- 想法：set \`社交.关系.[NPC名].当前内心想法\` "……"
`;

const MEMORY_STRUCTURE = `
## 4. 记忆（只读，路径：社交.记忆）
AI 禁止通过 tavern_commands 修改记忆。由系统根据 mid_term_memory 自动处理。
- 中期记忆: [string]
- 长期记忆: [string]
`;

const GAME_INDEX_STRUCTURE = `
## 4.1 语义记忆（只读，路径：系统.扩展.语义记忆）
AI 禁止通过 tavern_commands 修改。由系统根据 step2 输出的 \`semantic_memory\` 自动合并。实体与关系图由 社交.关系（含 与玩家关系、关系）+ 角色 派生，不再使用 游戏实体索引。
- 系统.扩展.语义记忆: { triples }
  - SemanticTriple: subject, predicate, object；可选 timestamp（ISO 或 YYYY-MM-DD-HH-mm，未填时合并自动补）、importance（1–10，默认 5）、category；用于排序与选择性抽取，检索按 importance×recency×上下文 取 top N。
`;

const WORLD_INFO_STRUCTURE = `
## 5. 世界（路径：世界.信息）

### 5.1 势力信息
路径: 世界.信息.势力信息[索引]
- 名称、类型、等级、位置、描述、特色、加入条件、加入好处、与玩家关系、声望值 等

### 5.2 地点信息
路径: 世界.信息.地点信息
- 用 push 添加：{名称, 类型, 位置, coordinates: {x,y}, 描述, 安全等级, 开放状态}
`;

const GAME_STATE_STRUCTURE = `
## 6. 时间（路径：元数据.时间）
- 年, 月, 日, 小时, 分钟: number
- 时间推进：add \`元数据.时间.分钟\`，系统自动进位
`;

const EVENT_SYSTEM_STRUCTURE = `
## 7. 事件系统（路径：社交.事件）

### 7.1 事件记录
路径: 社交.事件.事件记录（数组，用 push 添加）

### 7.2 事件对象结构
- 事件ID: string (如 event_时间戳_随机数)
- 事件名称: string
- 事件类型: string（如："势力冲突"|"局势变化"|"重大发现"|"人物风波" 等，按世界观定）
- 事件描述: string
- 影响等级: "轻微"|"中等"|"重大"|"灾难"
- 影响范围: string
- 相关人物: string[]
- 事件来源: "随机"|"玩家影响"|"系统"
- 发生时间: {年, 月, 日, 小时, 分钟}（必填）
`;

export const SAVE_DATA_STRUCTURE_MING = `
# 【数据结构定义】通用版 (ming) 精简存档

> 你收到的是精简版存档：元数据只有时间，社交.记忆只有中期和长期，系统域不发送。
> 本结构为通用设定，不包含境界、大道、宗门、功法、灵根、修炼等专有字段。

${CHARACTER_STRUCTURE}
${INVENTORY_STRUCTURE}
${RELATIONS_STRUCTURE}
${MEMORY_STRUCTURE}
${GAME_INDEX_STRUCTURE}
${WORLD_INFO_STRUCTURE}
${GAME_STATE_STRUCTURE}
${EVENT_SYSTEM_STRUCTURE}
`.trim();

export function stripNsfwContentMing(input: string): string {
  return input
    .split('\n')
    .filter((line) => !/nsfw|私密信息|身体部位开发|法身|角色\.身体|privacy/i.test(line))
    .join('\n')
    .trim();
}

export function getSaveDataStructureMingForEnv(isTavern: boolean): string {
  if (isTavern) return SAVE_DATA_STRUCTURE_MING;
  return stripNsfwContentMing(SAVE_DATA_STRUCTURE_MING);
}
