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
- 特质: string (可随机，若随机则由初始化 set 角色.身份.特质；通用版替代灵根)
- 天赋: [{名称, 描述}] (只读)
- 先天六维属性?: {体质, 直觉, 悟性, 气运, 魅力, 心性} (只读，1-10，通用属性)
- 后天六维属性?: {体质, 直觉, 悟性, 气运, 魅力, 心性} (可修改，用 add，每项上限 20)

### 1.2 属性（可改，路径：\`角色.属性\`）
- 地位: {名称: string, 描述: string}（社会地位/职位，如 {名称:"李家的千金", 描述:"李氏家族的掌上明珠，就读于名牌大学"}；用 set \`角色.属性.地位\` 更新整个对象；默认 {名称:"还未揭露", 描述:""}）
- 声望: number (用 add)
- 体力: {当前, 上限} (生命/体力，当前用 add，上限在成长时用 add)
- 精力: {当前, 上限} (精力/能量，当前用 add，上限在成长时用 add)

### 1.3 位置（路径：\`角色.位置\`）
- 位置: {描述:"大陆·区域·地点", x, y} (用 set 更新整个对象)
  - 描述: string (必填，格式"大陆·区域·地点"，**仅真实物理场所**；禁止状态/过程如「离开中」「前往中」「移动中」「路上」，路径不得含连续「··」)
  - x: number (0-10000)
  - y: number (0-10000)

### 1.4 效果（buff/debuff 数组；路径：\`角色.效果\`）
- 效果: [{状态名称, 类型:"buff"|"debuff", 生成时间, 持续时间分钟, 状态描述, 强度?, 来源?}]
  - 只能用 push 添加；过期由系统清理
  - 生成时间必填：使用当前 \`元数据.时间\` 的完整对象 {年, 月, 日, 小时, 分钟}

### 1.5 身体/法身（NSFW/酒馆端；路径：\`角色.身体\`）
仅当 **系统配置.nsfwMode=true** 且为酒馆端时，才会生成/更新；游戏中可通过 set \`角色.身体\` 或 set \`角色.身体.xxx\` 更新。
- 身高?: number (cm)
- 体重?: number (kg)
- 体脂率?: number (%)
- 三围?: {胸围:number, 腰围:number, 臀围:number}
- 外观特征?: string[]
- 敏感点?: string[]
- 开发度?: {部位名称: number} (0-100)
- 纹身与印记?: string[]
- 胸部描述?: string
- 私处描述?: string
- 生殖器描述?: string
- 部位?: object (预留)
- 部位开发?: object (预留；用于变量面板/扩展系统写入)
`;

const INVENTORY_STRUCTURE = `
## 2. 背包与物品（路径：角色.背包）

### 2.1 背包结构
- 金钱: {现金: number, 铜: number, 银: number, 金: number}（通用货币，用 add 增减；四档可对应世界观如铜钱/银两/金币等）
- 物品: {物品ID: Item对象}（用 set 添加完整对象，用 delete 删除）

### 2.2 物品通用字段（必需）
- 物品ID: string (格式: {类型}_时间戳_随机数)
- 名称: string
- 类型: "装备"|"消耗品"|"材料"|"其他"
- 品质: {quality: "普通"|"优良"|"稀有"|"史诗"|"传说"|"神话", grade: 0-10}
- 数量: number (默认 1)
- 描述: string

### 2.3 装备类型特有字段
- 装备增幅?: { 体力上限?, 精力上限? 等 }
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
必需字段：名字/性别/出生日期/性格/外貌/背景/与玩家关系/好感度/当前位置.描述/当前外貌状态/当前内心想法/在做事项/记忆[]/背包/实时关注
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
- 类型: "重点"|"普通"（主线/剧情新建为"重点"，地点背景 NPC 为"普通"；缺省视为"重点"）
- 地位: {名称: string, 描述: string}（社会地位/职位；名称如"素家的专车司机"、"咖啡厅的店长"、"流浪汉"；描述为简短说明；默认 {名称:"还未揭露", 描述:""}。当 NPC 身份/职业变化时用 set \`社交.关系.[NPC名].地位\` 更新）
- 与玩家关系: string (如"陌生人"/"朋友"/"师徒"/"仇敌")
- 关系?: Record<string, string>（本 NPC 对其他 NPC；key=对方名字，value=关系标签；**仅**经 tavern_commands：\`set 社交.关系.{npc}.关系.{其他}\` 或 \`set 社交.关系.{npc}.关系\` 对象合并，或创建 NPC 时在 value 中带 \`关系\`）
- 好感度: number (-100~100，用 add 修改)
- 人格底线: string[]
- 记忆: string[]
- 记忆总结: string[]
- 当前位置: {描述: string, x?, y?}
- 当前外貌状态: string
- 当前内心想法: string
- 在做事项: string（简短一句，如 "在客栈打杂"；主回合/世界心跳可更新）
- 背包: {金钱: {现金, 铜, 银, 金}, 物品: {}}
- 实时关注: boolean
- 私密信息?: PrivacyProfile（NSFW 模式；当 系统配置.nsfwMode=true 且性别符合 nsfwGenderFilter 时为必填）

### 3.3 NPC 更新示例
- 好感度：add \`社交.关系.[NPC名].好感度\` 10
- 记忆：push \`社交.关系.[NPC名].记忆\` "……"
- 状态：set \`社交.关系.[NPC名].当前外貌状态\` "……"
- 想法：set \`社交.关系.[NPC名].当前内心想法\` "……"
- 在做事项：set \`社交.关系.[NPC名].在做事项\` "……"（简短一句）
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

### 5.2 地点信息（扁平数组 + 上级）
路径: 世界.信息.地点信息
- **仅真实场所**：地点须为建筑、区域、街道、自然地点等；**禁止**载具（轿车内、马车内）、飞行器（飞舟内、机舱内）、船内、车厢内等非地点；角色在移动载具中时用地面地点（出发地/目的地/途经地）。
- **禁止状态/过程**：不得将「离开中」「前往中」「移动中」「路上」等状态作为地点名称或 角色.位置.描述；路径中不得出现连续分隔符「··」（如 \`区域··离开中\`）；仅可 push 或 set 真实物理场所。
- **扁平数组**：所有地点在同一层，通过 \`上级\` 字段建树
- 用 push 添加：{名称, 描述?, 上级?, 地点NPC?}
  - 名称: string（唯一标识，建议用全路径如 "S市·巴别塔·露台"，与 当前位置.描述 一致）
  - 描述?: string（简短说明）
  - 上级?: string（父地点 名称，根节点无）
  - 地点NPC?: string[]（本地的 NPC 名列表；玩家离开后重点 NPC 会离开，普通 NPC 留守）
- **多级地点须生成全部父级**：名称 为多级路径（如 \`S市·上城区·素家庄园\`）时，须按层级依次 push 每一级（先 S市，再 S市·上城区，再 S市·上城区·素家庄园），每级 上级 为上一级全路径；缺漏父级会导致地图无法显示树形。
- 示例：push \`世界.信息.地点信息\` \`{名称:"百货大楼",描述:"繁华商区"}\`；子地点 push \`{名称:"百货大楼·一楼",上级:"百货大楼",描述:"一层大厅"}\`

### 5.3 探索记录（系统维护，LLM 一般不直接写）
路径: 世界.状态.探索记录
- 已探索的地点名称列表；角色.位置 变化时由系统自动 push

### 5.4 地点 NPC 列表（存于各地点内）
路径: 世界.信息.地点信息[i].地点NPC
- 每个地点条目可有 \`地点NPC: string[]\`（本地的 NPC 名列表）
- push 地点时可在 value 中带 \`地点NPC: [NPC名]\`
- 更新：set \`世界.信息.地点信息[i].地点NPC\` \`[NPC名]\`（i 为索引）
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

/** 仅酒馆端：NPC 私密信息（PrivacyProfile）必填字段说明，便于 AI 创建 NPC 时带齐 */
const PRIVACY_PROFILE_FIELDS_HINT = `
### 当 系统配置.nsfwMode=true 且 NPC 性别符合 nsfwGenderFilter 时
创建 NPC 的 value 必须包含 \`私密信息\` 对象，且包含以下必填字段（禁止「待生成/暂无/空对象」）：
- 是否为处女/处男(boolean)、身体部位(数组，每项含 部位名称/敏感度/开发度/特征描述)、性格倾向、性取向、性癖好(数组)、性渴望程度(0-100)、当前性状态、体液分泌状态、性交总次数(number)、性伴侣名单(数组)、最近一次性行为时间(string)、特殊体质(数组)。逻辑一致：是否为处女/处男=true 时，性交总次数=0、性伴侣名单=[]。
`.trim();

export function stripNsfwContentMing(input: string): string {
  return input
    .split('\n')
    .filter((line) => !/nsfw|私密信息|身体部位开发|法身|角色\.身体|privacy/i.test(line))
    .join('\n')
    .trim();
}

export function getSaveDataStructureMingForEnv(isTavern: boolean): string {
  if (isTavern) return SAVE_DATA_STRUCTURE_MING + '\n\n' + PRIVACY_PROFILE_FIELDS_HINT;
  return stripNsfwContentMing(SAVE_DATA_STRUCTURE_MING);
}
