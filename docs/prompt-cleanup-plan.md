# Prompt 删减与更新计划

## 概述（设计 note 中的原始标注）

**主回合部分**

- 地点势力不重叠（铁律）— 可删
- 冲突回合制（重要）— 可删
- 【数据结构定义】通用版 (ming) 精简存档 — 可删/精简

**需修改的 section**

- ## 2. 背包与物品：灵石 → 金钱
- ### 2.2 物品通用字段 — 需要修改
- ### 2.3 装备类型特有字段 — 需要修改
- # 品质系统 — 使用通用等级（见正文）
- 气血 → 体力，灵气 → 精力；**神识去除**
- **灵根彻底改为特质**（prompt、数据结构、创建流程、类型与读写）
- **六司属性**：根骨→体质、灵性→直觉（prompt、data structure、前端；主角与 NPC 兼顾）

---

## 一、建议直接删除的 section（无修改价值）

### 1. 地点势力不重叠（铁律）

- **位置**：`definitions/ming/businessRulesMing.ts` → LOCATION_UPDATE_RULES 内（约 64–67 行）
- **说明**：每条「每个地点只能归属一个势力」「势力控制区域不得重叠」等对通用 ming 故事未必适用，且与「精简」方向一致，建议整段删除。

### 2. 冲突回合制（重要）

- **位置**：`definitions/ming/businessRulesMing.ts` → CONFLICT_TURN_RULES 整个 export（约 142–159 行）
- **说明**：`defaultPrompts.ts` 中 BUSINESS_RULES 仍包含此项。若不再强调「冲突必须回合制」，可删除该常量并从 BUSINESS_RULES 数组中移除。

### 3. 修改范围原则

- **原则**：仅修改 **prompt** 与对应的 **data structure** 定义；其余功能（如背包、物品、装备的读写与 UI 等）保留不变。
- **原因**：项目已无修仙系统，装备与背包需通用化，但通过改 prompt 与数据结构描述即可达成，不扩大改造范围。

---

## 二、需要根据 ming 用途更新的 section

### 1. 背包与物品 · 货币：灵石 → 金钱

**涉及文件与位置：**

- `dataDefinitionsMing.ts`：INVENTORY_STRUCTURE 中「灵石: {下品, 中品, 上品, 极品}」→ 改为「金钱」及合适结构（如单一 number 或 { 铜钱?, 银两?, 金币? } 等，按设定选一）。
- `dataDefinitionsMing.ts`：RELATIONS_STRUCTURE 中 NPC 背包「灵石: {下品, 中品, 上品, 极品}」→ 与上一致。
- `characterInitializationPromptsMing.ts`：示例与规则中的「角色.背包.灵石」、资源控制「货币/灵石」→ 全部改为「金钱」及对应路径。
- `locationNpcGenerationPromptsMing.ts`：NPC_STRUCTURE_HINT 中「背包: { 灵石: {下品:0, …} }」→ 改为金钱。
- `inlinePromptsMing.ts`（约 144 行）：set 角色.背包.灵石 → set 角色.背包.金钱。
- `cotCore.ts`：所有「灵石」路径与说明 → 改为「金钱」。

**注意**：若存档/代码中已有「灵石」字段，需同时定好数据迁移或兼容策略（例如旧存档仍读 灵石，新存档写 金钱）。

### 2. 属性用词：气血 → 体力，灵气 → 精力；神识去除

**涉及文件与位置：**

- `dataDefinitionsMing.ts`：角色属性「气血」「灵气」→「体力」「精力」；装备增幅「气血上限/灵气上限」→「体力上限/精力上限」。**不定义、不提及「神识」。**
- `locationNpcGenerationPromptsMing.ts`：NPC 属性「气血/灵气」→「体力/精力」；**删除 NPC 的「神识」字段。**
- `coreRulesMing.ts`：RESPONSE_FORMAT_RULES 中「add 气血」「add 灵气」→「add 体力」「add 精力」；不出现神识。
- `cotCore.ts`：所有「气血」「灵气」→「体力」「精力」；**彻底删除「神识」相关项**（神识消耗、NPC 神识变化、检查清单中的神识）。

**原则**：**神识去除**。只保留「体力+精力」两栏资源，不再有第三资源神识。

### 3. INVENTORY_STRUCTURE 与装备系统通用化（2.2 / 2.3）

- **位置**：`dataDefinitionsMing.ts` → **INVENTORY_STRUCTURE**（含 2.1 背包结构、2.2 物品通用字段、2.3 装备类型特有字段、2.4 消耗品/材料/其他）。
- **目标**：因不再有修仙系统，对 **装备系统做通用化改革**；只改 prompt 与对应的 data structure 描述，其余功能保留。
- **修改方向**：
  - **2.1**：货币由灵石改为金钱（见二.1），其余背包结构保留。
  - **2.2 物品通用字段**：类型保持「装备|消耗品|材料|其他」等通用分类；描述中去掉修仙用语，使物品定义适用于任意世界观。
  - **2.3 装备类型特有字段**：装备增幅由「气血上限/灵气上限」改为「体力上限/精力上限」等通用属性名，与角色属性（二.2）一致；删除仅修仙相关的「灵气/气血」表述，保留「已装备、特殊效果」等通用字段。
  - **2.4**：保留消耗品/材料/其他的通用字段，不删减功能。
- **不改动**：除 prompt 与 data structure 定义以外的逻辑（如前端背包/装备读写、后端解析等）维持现状。

### 4. 品质系统（使用通用）

- **位置**：`definitions/ming/worldStandardsMing.ts` → QUALITY_SYSTEM；凡引用品质处（如 dataDefinitionsMing 物品品质、inlinePromptsMing 生成规则等）均需一致。
- **当前**：凡|黄|玄|地|天|仙|神 + grade 0–10。
- **修改方向**：**品质使用通用**。改为通用等级名，例如：普通|优良|稀有|史诗|传说|神话（或 一档|二档|…|六档），并配 grade 0–10；prompt 与 data structure 中统一使用该套通用品质，不再使用修仙品质标签。

### 5. 六司属性：根骨→体质，灵性→直觉（主角与 NPC）

- **原则**：六司中 **根骨** 改为 **体质**、**灵性** 改为 **直觉**；prompt、data structure、前端均需修改；**主角与 NPC 兼顾**（部分仅主角、部分仅 NPC、部分两者皆有）。
- **主角**  
  - **Data structure**：`角色.身份.先天六司`、`角色.身份.后天六司` 键名由 根骨/灵性 改为 体质/直觉；类型 `InnateAttributes` 等同步改为 体质、直觉。  
  - **Prompt**：`dataDefinitionsMing` 若补充 先天六司/后天六司 定义，使用 体质、直觉；`characterInitializationPromptsMing`、规则中凡写六司处改为 体质/直觉。  
  - **前端**：创建流程（Step6 属性分配、Step7 预览、HexagonChart）、角色详情、变量说明等显示「体质」「直觉」；i18n 根骨→体质、灵性→直觉；提交存档时 先天六司 使用 体质/直觉 键。  
  - **业务**：`characterInitialization.ts`、`saveMigration`、`dataRepair`、`commandValidator`、`offlineInitialization`、`characterStore` 等读写 先天六司/后天六司 时使用 体质、直觉；旧存档「根骨/灵性」可做迁移或兼容。
- **NPC**  
  - **Data structure**：NPC 对象若含 先天六司/后天六司（如 `社交.关系.[NPC].先天六司`），键名改为 体质、直觉。  
  - **Prompt**：`dataDefinitionsMing` 的 NPC 结构、`locationNpcGenerationPromptsMing` 等若包含六司，改为 体质/直觉。  
  - **前端**：关系网络/详情中展示 NPC 六司时使用「体质」「直觉」标签；导出或复制时键名为 体质、直觉。
- **仅主角**：创建流程分配点、开局初始属性计算、天道点/六司约束配置。  
- **仅 NPC**：地点路人生成时若生成六司、特殊 NPC 预设数据（如 `specialNpcs.ts`）。  
- **两者**：类型定义、commandValidator 允许的路径、dataRepair 默认值、i18n 与通用组件（HexagonChart、FormattedText 等）。

---

## 三、其他修仙残留（建议一并清理）

### 1. cotCore.ts（CoT 自检清单）

- **现状**：大量修仙专用项（境界、渡劫、功法、悟道、宗门、神识、寿元等）。
- **建议**：为 ming 做一版「通用 CoT」：只保留 位置/时间/金钱(原灵石)/物品/关系/事件/体力/精力 等通用同步项；**删除「神识」全部条目**；删除「修炼与突破」「渡劫系统」「宗门系统」等整块；占位符去掉 [道名]/[功法ID]，仅保留 [NPC名] 等通用占位符。可新建 `cotCoreMing.ts` 或在本文件内按 USE_MING_PROMPTS 分支。

### 2. promptAssembler.ts 注释

- 第 58 行：'境界、NPC、战斗等业务规则' → 改为「NPC、冲突、难度等业务规则」或类似，避免境界一词。

### 3. defaultPrompts.ts 中 add 的「生成原因」

- 若仍有「境界、NPC、战斗」等描述，改为通用表述。

### 4. gameElementPrompts.ts（创建流程用）与灵根→特质

- **现状**：含功法生成、灵根、灵气/神识/气血/寿元 等。
- **灵根彻底改为特质**：创建流程中原「灵根」步骤改为「特质」；prompt、数据结构、类型与读写全部使用「特质」：
  - **Prompt**：`characterInitializationPromptsMing`、`gameElementPrompts` 等中凡「灵根」改为「特质」；生成任务改为「特质」描述（如核心特质、先天特质等），不再出现灵根/品级/修炼倍率等修仙用语。
  - **数据结构**：`dataDefinitionsMing` 身份中增加「特质」字段说明；COMMANDS_RULES_MING 中增加「若特质为随机则 set 角色.身份.特质」。
  - **业务与类型**：`characterInitialization.ts` 在 USE_MING_PROMPTS 时读写 `角色.身份.特质`；类型 `CharacterBaseInfo` 等增加「特质」、或 Ming 下以「特质」替代「灵根」并做旧存档「灵根→特质」兼容。
  - **创建步骤**：Step4 由「灵根选择」改为「特质选择」；i18n、组件文案与选项统一为「特质」。
- **建议**：功法相关 prompt 若未用可删或改为「技能/能力」等通用生成；品质使用通用（见二.4）；消耗资源仅 体力/精力，不出现 神识/寿元。

### 5. 非 ming 的 definitions（legacy）

- `definitions/businessRules.ts`、`dataDefinitions.ts`、`worldStandards.ts`、`textFormats.ts`、`coreRules.ts`、`eventSystemRules.ts` 等仍含大量境界/宗门/功法/灵气/气血。
- 当前 defaultPrompts 已只接 ming，这些文件仅作 legacy。建议：要么在文件头注明「Legacy，仅当 USE_MING_PROMPTS=false 时使用」，要么后续不再维护并考虑删除，避免误改。

### 6. characterInitializationPrompts.ts（非 ming）

- 仅当 USE_MING_PROMPTS=false 时使用。建议同 legacy：注明或后续移除。

---

## 四、灵根彻底改为特质（结论）

**原则**：**灵根彻底改为特质**。prompt、数据结构、创建流程、类型与读写均使用「特质」，不再保留「灵根」用语（Ming 下存档键为「特质」，并做旧存档「灵根→特质」兼容）。

**需落实项：**

1. **数据结构** `dataDefinitionsMing.ts`：`角色.身份` 中增加「特质」字段说明；不出现「灵根」。
2. **初始化命令** `COMMANDS_RULES_MING`：增加「若特质为随机则 set 角色.身份.特质」；AI 须将「特质」写入存档。
3. **业务逻辑** `characterInitialization.ts`：USE_MING_PROMPTS 时读写 `角色.身份.特质`（或 `baseInfo.特质` / `derivedInfo.特质`）；做旧存档「灵根→特质」迁移或兼容。
4. **类型**：`CharacterBaseInfo` 等在 Ming 下支持「特质」字段；可保留 `灵根` 仅作 legacy 兼容。
5. **创建流程与 i18n**：Step4 由「灵根选择」改为「特质选择」；相关 prompt（如 gameElementPrompts 中灵根生成）改为「特质」生成；i18n 与 UI 文案统一为「特质」。

---

## 五、执行顺序建议

1. 先做「用词与结构」统一：金钱、体力、精力；**品质使用通用**；**神识去除**（prompt 与 data structure 中删除所有神识）；**灵根彻底改为特质**（见四）。
2. 再删「可删除」的 section（地点势力不重叠、冲突回合制）。
3. 然后改数据定义与业务规则中的 2.2/2.3、品质系统（通用）。
4. 落实特质：dataDefinitionsMing 身份加「特质」、COMMANDS_RULES_MING 加随机特质 set、characterInitialization 与类型在 Ming 下读写「特质」并兼容旧「灵根」、创建步骤与 gameElementPrompts 改为「特质」。
5. 最后处理 cotCore（含删除神识全部项）与 gameElementPrompts，并清理注释/legacy 标注。
6. **六司**：data structure / types 根骨→体质、灵性→直觉；prompt（dataDefinitionsMing、characterInit、gameElementPrompts 等）与前端（i18n、创建、详情、关系网络）同步；主角与 NPC 兼顾，旧存档「根骨/灵性」做迁移或兼容。
7. 若存在存档或前端仍读「灵石/气血/灵气/神识/灵根/根骨/灵性」，在步骤 1 中一并规划迁移或兼容。
