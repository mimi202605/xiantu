/**
 * @fileoverview 角色初始化 AI 提示词 - 通用版 (ming)
 * 适用于各类故事，不包含修仙、境界、灵根、大道、功法等。
 */

import type { World, TalentTier, Origin, SpiritRoot, Talent } from '@/types';
import type { WorldInfo, WorldMapConfig, SystemConfig } from '@/types/game';
import { SAVE_DATA_STRUCTURE_MING, stripNsfwContentMing } from '../definitions/ming/dataDefinitionsMing';
import { assembleSystemPrompt } from '../promptAssembler';
import { isTavernEnv } from '@/utils/tavern';

// =====================================================================
// 响应格式定义
// =====================================================================

const RESPONSE_FORMAT_MING = `
## 输出格式（最高优先级）

**只输出一个 JSON 对象，不要任何解释性文字、思维链、标签！**

可以用 \`\`\`json 代码围栏包裹，也可以直接输出 JSON。

### JSON 结构示例：
\`\`\`json
{
  "text": "这里是1200-2500字的开局叙事正文...",
  "mid_term_memory": "这里是50-100字的摘要",
  "tavern_commands": [
    {"action":"set","key":"元数据.时间","value":{"年":1050,"月":1,"日":1,"小时":8,"分钟":0}},
    {"action":"set","key":"角色.身份.出生日期","value":{"年":1032,"月":1,"日":1,"小时":0,"分钟":0}},
    {"action":"set","key":"角色.位置","value":{"描述":"东荒大陆·青云山脉·小村庄","x":5000,"y":5000}},
    {"action":"set","key":"角色.属性.声望","value":0},
    {"action":"set","key":"角色.背包.金钱","value":{"现金":50,"铜":0,"银":0,"金":0}}
  ],
  "action_options": ["四处走动熟悉环境","查看自身状态","与附近的人交谈","调查周围","打听消息"]
}
\`\`\`

### 关键要求：
1. **text 字段**：
   - 1200-2500 字的开局叙事
   - 只写故事正文，不要夹带任何游戏数据、JSON、变量名
   - 沉浸式叙事，符合世界观，不要出现「玩家」「获得」等游戏术语

2. **mid_term_memory 字段**：
   - 50-100 字摘要，必填
   - 概括开局的核心信息

3. **tavern_commands 字段**：
   - 必须是数组
   - 每个命令：{"action":"set","key":"路径","value":值}
   - 所有 key 必须以 元数据/角色/社交/世界/系统 开头

4. **action_options 字段**：
   - 必须输出 5 个选项，不能为空，符合当前场景

### 禁止事项：
- ❌ 不要输出 \`<thinking>\` 或任何思维链标签
- ❌ 不要输出解释性文字
- ❌ 不要在 text 中夹带游戏数据
`.trim();

// =====================================================================
// 初始化命令规则
// =====================================================================

const COMMANDS_RULES_MING = `
## 初始化命令（tavern_commands）

### 必须执行的命令（按顺序）：

1. **时间** - 设置 \`元数据.时间\`
   - 格式：{"年":1050,"月":1,"日":1,"小时":8,"分钟":0}
   - 同时设置 \`角色.身份.出生日期\`（出生年 = 元数据.时间.年 - 开局年龄）

2. **位置** - 设置 \`角色.位置\`
   - 必须包含 {描述, x, y}
   - 描述格式：大陆·区域·地点（用·分隔）
   - 从可用地点列表中选择，坐标 x、y 范围 0-10000

3. **声望** - 设置 \`角色.属性.声望\`
   - 普通出身：0-10
   - 有势力/组织背景：10-50
   - 名门/显赫：50-100

4. **随机项** - 若出身/天赋/特质为「随机」
   - 用 \`set\` 写入 \`角色.身份.出身\`、\`角色.身份.天赋\` 或 \`角色.身份.特质\` 的具体内容
   - 出身格式：{"名称":"…","描述":"…"} 或 string；特质为 string（如「聪慧」「坚韧」「神秘血脉」等）

5. **地位** - 设置 \`角色.属性.地位\`
   - 格式：{"名称":"社会地位/职位","描述":"简短说明"}
   - 根据出身/背景决定：如出身为世家则 {名称:"XX家的少爷/千金", 描述:"..."}；平民则 {名称:"村民/学徒/店员", 描述:"..."}
   - 若信息不足可设为 {名称:"还未揭露", 描述:""}

6. **资源** - 设置初始资源
   - \`角色.背包.金钱\`（根据出身决定数量，见下方资源控制）
   - \`角色.背包.物品.{物品ID}\`（如有初始物品，类型为 装备/消耗品/材料/其他）

7. **NPC** - 仅创建文本中明确提到的重要人物（0-3 个）
   - 写入 \`社交.关系.{NPC 中文名}\`
   - key 使用 NPC 的中文名，NPC 对象内的 \`名字\` 与 key 一致

8. **地点** - 开局位置必须写入地点信息（必须）
   - 在 set \`角色.位置\` 之后，**必须** push \`世界.信息.地点信息\`（这是开局**唯一**允许的 push 操作）
   - \`角色.位置.描述\` 与 push 的 名称 仅限**真实物理场所**；禁止「离开中」「前往中」「移动中」「路上」等状态/过程，路径不得含连续「··」；**禁止泛指/占位**（如「国外」「某城市」「某地点」「某办公室」「某区域」），须生成**具体**地点名称；push 时须带 描述。
   - 格式：\`{"action":"push","key":"世界.信息.地点信息","value":{"名称":"与角色.位置.描述一致","描述":"简短描述"}}\`
   - 示例：若 角色.位置.描述 为 "东荒大陆·青云山脉·小村庄"，则 push \`{名称:"东荒大陆·青云山脉·小村庄",描述:"..."}\`

9. **NSFW：玩家法身/私密档案**（仅酒馆端，系统设置中 NSFW 已开启时必做）
   - **唯一合法 key**：\`角色.身体\`。**禁止**在 tavern_commands 中出现 key 为 \`角色.身体部位开发\` 的指令。
   - 必须用 set 写入 \`角色.身体\`，value 须为对象，至少包含：身高(number)、体重(number)、三围({胸围,腰围,臀围})、至少一项文字描述（胸部描述/私处描述/生殖器描述）、以及敏感点(string[])、开发度(Record<部位名,0-100>)、纹身与印记(string[])，严禁「待AI生成」「暂无」等占位
   - 示例：\`{"action":"set","key":"角色.身体","value":{"身高":165,"体重":52,"三围":{"胸围":84,"腰围":62,"臀围":88},"胸部描述":"…","私处描述":"…","敏感点":["乳头","耳垂"],"开发度":{"胸部":20,"乳头":10},"纹身与印记":[]}}\`

### 约束：
- 所有 key 以 元数据/角色/社交/世界/系统 开头
- 开局以 set 为主；**唯独地点信息**必须用 push 添加（见第 8 条）
`.trim();

// =====================================================================
// 叙事规则
// =====================================================================

const NARRATIVE_RULES_MING = `
## 叙事要求与文风设定

### 文风基调
- **符合世界观**：语言、氛围须与用户选择的世界一致（古风、现代、西幻等）
- **沉浸式**：侧重环境、氛围、角色的感官与处境，避免罗列数据
- **禁止游戏术语**：文本中严禁出现「玩家」「获得」「装备了」「等级提升」等出戏词汇

### 逻辑与难度
- **合理起点**：出身决定眼界与起点，须与玩家选择匹配；禁止开局即获得离谱能力或资源
- **时间感**：根据世界观体现时间流逝（如「数日过去」「寒来暑往」）
- **角色一致**：年龄、出身决定行为与认知，须前后一致

### 角色塑造
- **年龄**：从玩家选择的年龄开始，言行符合该年龄段
- **出身**：决定眼界与起点，须与选择完全匹配
`.trim();

// =====================================================================
// 资源范围参考
// =====================================================================

const RESOURCE_RANGES_MING = `
## 初始资源控制（严格执行）

### 货币 / 金钱（基于出身）
- **贫困/流浪**：0-10
- **平民/普通**：10-50
- **世家/组织**：100-300
- **富裕/商贾**：300-800

### 物品与装备
- **数量**：1-5 件，宁缺毋滥
- **品质**：以凡品为主，严禁开局直接给地品/天品/神品（除非顶级出身且有剧情铺垫）
- **类型**：装备、消耗品、材料、其他

### NPC 与关系
- **数量**：0-3 个（须为剧情中产生羁绊的重要人物，路人不要生成关系）
- **关系**：初始好感不宜过高（血亲除外），体现人情冷暖
`.trim();

// =====================================================================
// 导出
// =====================================================================

export const CHARACTER_INITIALIZATION_PROMPT_MING = `
# 角色初始化任务（通用版）

${RESPONSE_FORMAT_MING}

---

${COMMANDS_RULES_MING}

---

${NARRATIVE_RULES_MING}

---

${RESOURCE_RANGES_MING}

---

# 数据结构
${SAVE_DATA_STRUCTURE_MING}
`.trim();

export function getCharacterInitializationPromptMingForEnv(isTavern: boolean): string {
  if (isTavern) return CHARACTER_INITIALIZATION_PROMPT_MING;
  return stripNsfwContentMing(CHARACTER_INITIALIZATION_PROMPT_MING);
}

// =====================================================================
// 构建函数（与 characterInitializationPrompts 接口一致）
// =====================================================================

interface ContextItem {
  name?: string;
  名称?: string;
  description?: string;
  描述?: string;
  type?: string;
  类型?: string;
}

/**
 * 构建玩家选择摘要（通用版，不含修仙专有术语）
 */
export function buildCharacterSelectionsSummaryMing(
  userSelections: {
    name: string;
    gender: string;
    race: string;
    age: number;
    world: World;
    talentTier: TalentTier;
    origin: Origin | string;
    spiritRoot: SpiritRoot | string;
    talents: Talent[];
    attributes: Record<string, number>;
    difficultyPrompt?: string;
  },
  worldContext?: {
    worldInfo?: WorldInfo;
    availableLocations?: ContextItem[];
    mapConfig?: WorldMapConfig;
    systemSettings?: SystemConfig;
  }
): string {
  const { name, gender, race, age, world, talentTier, origin, spiritRoot, talents, attributes, difficultyPrompt } = userSelections;
  const originIsObj = typeof origin === 'object' && origin !== null;
  const spiritRootIsObj = typeof spiritRoot === 'object' && spiritRoot !== null;

  // 特质/灵根：对象时输出完整信息供 API 使用，不丢失品级、描述、修炼加成等
  const traitSection =
    spiritRootIsObj
      ? (() => {
          const sr = spiritRoot as SpiritRoot;
          const lines = [
            `名称: ${sr.name}`,
            sr.tier != null ? `品级: ${sr.tier}` : '',
            sr.description ? `描述: ${sr.description}` : '',
            sr.cultivation_speed ? `修炼相关: ${sr.cultivation_speed}` : '',
            sr.special_effects?.length ? `特殊效果: ${sr.special_effects.join('；')}` : '',
          ].filter(Boolean);
          return lines.join('\n');
        })()
      : `${spiritRoot}: (随机，需AI生成)`;

  const talentsList = talents.length > 0
    ? talents.map(t => `- ${t.name}: ${t.description}`).join('\n')
    : '无';
  const attrList = Object.entries(attributes).map(([k, v]) => `${k}:${v}`).join(', ');
  const locations = worldContext?.availableLocations
    ?.slice(0, 8)
    .map(l => `- ${l.name || l.名称} (${l.type || l.类型})`)
    .join('\n') || '(未生成)';

  return `
# 玩家角色数据

## 基础信息
姓名: ${name} | 性别: ${gender} | 种族: ${race} | 年龄: ${age}岁

## 世界
${world.name} (${world.era})
${world.description}

## 天资
${talentTier.name}: ${talentTier.description}

## 出身
${originIsObj ? (origin as Origin).name : origin}: ${originIsObj ? (origin as Origin).description : '(随机，需AI生成)'}

## 特质（即灵根/角色特质，以下为完整信息，请勿丢失）
${traitSection}

## 天赋
${talentsList}

## 先天属性
${attrList}

---

## 可用地点
${locations}

⚠️ 位置必须从上述地点选择，坐标范围: x:0-10000, y:0-10000

---

## 难度设置
${difficultyPrompt || '【难度模式：普通】\n- 世界遵循正常规则，机缘与危险并存'}

---

## 系统设置
${worldContext?.systemSettings?.nsfwMode ? `- **NSFW模式**: 已开启
- **私密信息生成范围**: ${worldContext?.systemSettings?.nsfwGenderFilter === 'all' ? '所有NPC' : worldContext?.systemSettings?.nsfwGenderFilter === 'female' ? '仅女性NPC' : '仅男性NPC'}
⚠️ 创建NPC时，若NPC性别符合上述范围，必须生成完整的"私密信息(PrivacyProfile)"字段
⚠️ **玩家私密档案（法身）**：你必须在 tavern_commands 中输出一条 \`{"action":"set","key":"角色.身体","value":{...}}\`，value 至少包含：身高、体重、三围(胸围/腰围/臀围)、至少一项描述(胸部描述/私处描述/生殖器描述)、以及敏感点(数组)、开发度(对象)、纹身与印记(数组)。禁止使用"待AI生成"或空对象。` : '- **NSFW模式**: 已关闭（不生成私密信息/法身）'}

---

## 输出要求
严格遵循系统的JSON输出规则：
- 不要输出 \`<thinking>\` / 思维链 / 任何推理过程标签
- 正文写入 JSON 的 "text" 字段（不要再输出 "<narrative>" 等标签）
- 行动选项写入 JSON 的 "action_options" 字段（5个）
`.trim();
}

/**
 * 构建角色初始化系统提示词（通用版）
 */
export async function buildCharacterInitializationPromptMing(): Promise<string> {
  const basePrompt = await assembleSystemPrompt([]);

  const prompt = `${basePrompt}

---

# 当前任务：角色初始化

你现在需要执行角色初始化任务。用户将提供角色的基础信息（姓名、性别、年龄、天赋、出身等），你需要：
1. 根据用户选择生成1200-2500字的开局叙事
2. 通过tavern_commands设置初始数据（时间、位置、资源、NPC等）
3. 输出5个行动选项

**立即执行任务，输出JSON格式的角色初始化数据。**

---

${RESPONSE_FORMAT_MING}

---

${COMMANDS_RULES_MING}

---

${NARRATIVE_RULES_MING}

---

${RESOURCE_RANGES_MING}
`.trim();

  return isTavernEnv() ? prompt : stripNsfwContentMing(prompt);
}
