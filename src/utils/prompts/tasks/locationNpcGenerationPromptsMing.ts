/**
 * @fileoverview 地点路人 NPC 生成提示词 - 通用版 (ming)
 * 当玩家到达新地点时，由 LLM 决定该场景是否出现路人/店员等 NPC，并生成 tavern_commands 写入 社交.关系 与地点 地点NPC。
 * 原则：多数普通 NPC，极少数重点 NPC。
 */

export type NsfwGenderFilter = 'all' | 'female' | 'male';

export interface LocationNpcGenerationInput {
  /** 当前地点描述（与 角色.位置.描述 一致） */
  locationDesc: string;
  /** 地点简短描述（若有，来自 世界.信息.地点信息） */
  locationDetail?: string;
  /** 世界背景/纪元等，用于风格一致 */
  worldContext?: string;
  /** 已有 NPC 名字列表，避免重名 */
  existingNpcNames: string[];
  /** 当前游戏时间，用于出生日期合理性 */
  gameTime?: { 年: number; 月: number; 日: number };
  /** 成人内容已开启时，符合性别的 NPC 须带 私密信息 */
  nsfwMode?: boolean;
  nsfwGenderFilter?: NsfwGenderFilter;
}

const RESPONSE_FORMAT = `
## 输出格式（仅输出一个 JSON 对象）

只输出一个 JSON，不要解释、思维链或代码围栏外的文字。可用 \`\`\`json ... \`\`\` 包裹。

### 结构
{
  "tavern_commands": [
    { "action": "set", "key": "社交.关系.张三", "value": { /* 完整 NpcProfile 对象 */ } },
    ...
  ]
}

- 若无路人则：\`"tavern_commands": []\`
- 每个命令：action 固定为 "set"，key 为 "社交.关系.{NPC中文名}"，value 为**完整**的 NPC 档案对象。
- NPC 名字不得与 existingNpcNames 重复，且必须与 key 中的名字一致（value.名字 === key 最后一段）。
`.trim();

const NPC_STRUCTURE_HINT = `
### NPC 对象必需字段（路人可精简但必填）
- 名字: string（与 key 中名字一致）
- 性别: "男"|"女"|"其他"
- 类型: "普通"|"重点"（**多数为 "普通"，极少数 "重点"**）
- 出生日期: { 年, 月, 日 }（年 必须 < 当前游戏年）
- 出生: string（如 "本地村民"、"过路商贾"）
- 外貌描述: string
- 性格特征: string[]（1-3 个）
- 与玩家关系: "陌生人"
- 好感度: 0
- 当前位置: { 描述: "必须与当前地点描述完全一致" }
- 属性: { 体力: {当前, 上限}, 精力: {当前, 上限}, 寿元上限 }
- 境界?: string 或 {名称, 阶段}（可选，不填则界面显示为「凡人」；若世界观有境界设定可填写）
- 记忆: []
- 当前外貌状态: string（如 "神色如常"）
- 当前内心想法: string（如 "忙于手头事"）
- 人格底线: [] 或 ["..."]
- 背包: { 金钱: {下品:0, 中品:0, 上品:0, 极品:0}, 物品: {} }
- 关系: {}
- 实时关注: false
`.trim();

/** 当 nsfwMode 且性别符合时，NPC 必须带 私密信息，此为必填字段说明 */
const NSFW_NPC_HINT = (nsfwGenderFilter: NsfwGenderFilter) => {
  const who =
    nsfwGenderFilter === 'all'
      ? '所有性别'
      : nsfwGenderFilter === 'female'
        ? '女性（性别=女）'
        : '男性（性别=男）';
  return `
### NSFW：私密信息（当 NPC 性别符合「${who}」时必填）
- 符合上述性别的 NPC，value 中**必须**包含 \`私密信息\` 对象，禁止「待生成/暂无/空对象」。
- \`私密信息\` 必填字段：是否为处女/处男(boolean)、身体部位(数组，每项含 部位名称/敏感度/开发度/特征描述)、性格倾向、性取向、性癖好(数组)、性渴望程度(0-100)、当前性状态、体液分泌状态、性交总次数(number)、性伴侣名单(数组)、最近一次性行为时间(string)、特殊体质(数组)。
- 逻辑一致：是否为处女/处男=true 时，性交总次数=0、性伴侣名单=[]。
`.trim();
};

export function buildLocationNpcGenerationPrompt(input: LocationNpcGenerationInput): string {
  const {
    locationDesc,
    locationDetail,
    worldContext,
    existingNpcNames,
    gameTime,
    nsfwMode,
    nsfwGenderFilter = 'female'
  } = input;

  const yearHint = gameTime?.年 != null ? `当前游戏年：${gameTime.年}。出生日期.年 必须 < ${gameTime.年}。` : '';
  const nsfwSection = nsfwMode ? `\n${NSFW_NPC_HINT(nsfwGenderFilter)}\n` : '';

  return `
# 任务：地点路人 NPC 生成

根据**当前地点**与**世界观**，判断该场景是否会有路人、店员、路人修士等。若有，生成 0～N 个 NPC，用 tavern_commands 输出；若无则输出空数组。

## 原则（铁律）
- **多数为 普通 NPC，极少数为 重点 NPC**。例如：一个茶馆可有 2～4 个普通（茶客、伙计），最多 1 个重点（说书人/掌柜）。
- 仅生成**逻辑上会出现在该地点**的人（店铺有店员/顾客、街道有行人、荒野可无人）。
- 姓名不得与已有 NPC 重复。已有名字：${existingNpcNames.length ? existingNpcNames.join('、') : '无'}。
- 每个 NPC 的 \`当前位置.描述\` 必须**完全等于**：\`${locationDesc}\`。

## 当前信息
- **地点**：${locationDesc}
${locationDetail ? `- **地点说明**：${locationDetail}` : ''}
${worldContext ? `- **世界背景**：${worldContext}` : ''}
${yearHint}

${NPC_STRUCTURE_HINT}
${nsfwSection}

${RESPONSE_FORMAT}
`.trim();
}
