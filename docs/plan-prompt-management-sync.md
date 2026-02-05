# 提示词管理系统同步与更新计划

## 一、当前系统功能概述

### 1.1 提示词管理（提示词管理）是什么

- **入口**：游戏内/首页侧边栏「提示词管理」、独立路由 `/prompts`，组件 `PromptManagementPanel.vue`。
- **数据流**：
  - 列表与默认内容来自 `getSystemPrompts()`（`src/services/defaultPrompts.ts`）。
  - 持久化：IndexedDB 库 `dad-prompts`，由 `promptStorage`（`src/services/promptStorage.ts`）读写。
  - 运行时取词：业务代码通过 `getPrompt(key)` → `promptStorage.get(key)` 获取内容；若用户曾保存过且 `modified=true` 则用用户版本，否则用 `getSystemPrompts()[key].content` 作为默认。
- **UI 能力**：按分类展示、展开/折叠、启用/禁用、权重 1–10、编辑正文、重置为默认、单条/全部导出、导入、保存全部。联机模式下只读。

### 1.2 分类与过滤

- **分类**（`PROMPT_CATEGORIES`）：核心请求、总结请求、开局初始化、动态生成、联机模式。
- **过滤**：`loadByCategory({ isOnlineMode, isSplitGeneration, isEventSystemEnabled })` 会根据 `condition` 隐藏部分提示词（如仅联机显示联机类、仅分步显示分步类、仅事件系统显示事件类）。

### 1.3 设计意图

- 所有「在用的」提示词应能在 提示词管理 中看到、编辑、启用/禁用、调权，并随代码默认更新（未修改时用最新默认）。
- 一处定义（defaultPrompts + 各 definition 文件），运行时统一走 `getPrompt(key)`，保证管理界面与真实发送内容一致。

---

## 二、当前在用的提示词（运行时 getPrompt 使用情况）

以下 key 在代码中**确实被 `getPrompt(key)` 使用**，与 提示词管理 一致：

| Key | 使用位置 | 说明 |
|-----|----------|------|
| `coreOutputRules` | promptAssembler | 核心输出格式 |
| `businessRules` | promptAssembler, AIBidirectionalSystem | 核心规则 |
| `dataDefinitions` | promptAssembler, AIBidirectionalSystem | 数据结构 |
| `textFormatRules` | promptAssembler, AIBidirectionalSystem | 文本格式/判定 |
| `worldStandards` | promptAssembler, AIBidirectionalSystem | 世界标准 |
| `cotCore` | AIBidirectionalSystem | 自检/思维链控制 |
| `actionOptions` | promptAssembler, AIBidirectionalSystem | 行动选项 |
| `eventSystemRules` | promptAssembler, AIBidirectionalSystem | 世界事件规则 |
| `splitGenerationStep1` | AIBidirectionalSystem | 分步正文 |
| `splitGenerationStep2` | AIBidirectionalSystem | 分步指令 |
| `splitInitStep1` | AIBidirectionalSystem | 开局分步正文 |
| `splitInitStep2` | AIBidirectionalSystem | 开局分步指令 |
| `onlineModeRules` | promptAssembler | 联机规则 |
| `onlineTravelContext` | promptAssembler | 穿越场景理解 |
| `onlineWorldSync` | promptAssembler | 联机世界同步 |
| `onlineInteraction` | promptAssembler | 联机交互 |
| `memorySummary` | AIBidirectionalSystem | 记忆总结 |
| `textOptimization` | AIBidirectionalSystem | 文本优化 |
| `eventGeneration` | eventGenerators | 事件生成 |

以上 19 个 key 与 提示词管理 一致，无需结构性变更，仅需保证 defaultPrompts 中 content 与各 definition 文件同步更新。

---

## 三、在 提示词管理 中但运行时未使用

以下 key 在 `getSystemPrompts()` 中有定义、会出现在 提示词管理 中，但**没有任何地方调用 `getPrompt(该 key)`**：

| Key | 名称（UI） | 说明与建议 |
|-----|------------|------------|
| `extendedBusinessRules` | 2.5 扩展规则 | 从未被 getPrompt。要么在组装系统提示时加入（如 promptAssembler / AIBidirectionalSystem），要么从 提示词管理 中移除或标记为「预留」。 |
| `npcMemorySummary` | NPC记忆总结 | 未被使用。若未来有 NPC 记忆总结流程，应改为调用 getPrompt('npcMemorySummary')；否则可保留为预留或移出管理。 |
| `npcGeneration` | NPC生成 | 未被使用。地点路人 NPC 实际使用 `buildLocationNpcGenerationPrompt()`（locationNpcGenerationPromptsMing.ts），与该项无关。需决定：是否让「地点路人 NPC」走 getPrompt('npcGeneration')，或重命名/拆分为「地点路人NPC生成」并接入。 |
| `itemGeneration` | 物品生成 | 未被使用。若游戏内有动态物品生成且希望可配置，应接入 getPrompt('itemGeneration')；否则可保留为预留或移出。 |
| `worldGeneration` | 世界生成 | 当前世界生成为 stub（EnhancedWorldGenerator 不调 AI），未使用该提示词。若恢复真实世界生成，应使用 getPrompt('worldGeneration')；否则可保留为预留或移出。 |
| `characterInit` | 角色初始化 | 运行时使用 `buildCharacterInitializationPromptMing()`，内部用 `assembleSystemPrompt([])` + 角色初始化任务文件内容，**未**使用 getPrompt('characterInit')。管理界面中的「角色初始化」与真实开局提示不一致。 |
| `newbieGuide` | 新手引导 | 未被使用。若希望前几回合引导可配置，应在相应逻辑中注入 getPrompt('newbieGuide')；否则可保留为预留或移出。 |

建议：对以上每一项在计划中二选一——**接入运行时**或**从管理列表隐藏/标记为预留**，避免用户误以为改了就生效。

---

## 四、未进入 提示词管理 但实际在用的提示

以下提示在代码中直接使用，**不经过 getPrompt**，因此不会出现在 提示词管理 中，用户无法统一编辑或启用/禁用：

| 来源 | 用途 | 说明 |
|------|------|------|
| `gameElementPrompts.ts` | 角色创建步骤中的 AI 生成 | WORLD_ITEM_GENERATION_PROMPT（世界）、TALENT_TIER_ITEM_GENERATION_PROMPT、ORIGIN_ITEM_GENERATION_PROMPT、SPIRIT_ROOT_ITEM_GENERATION_PROMPT、TALENT_ITEM_GENERATION_PROMPT。用于 Step1–Step5 的「随机/AI 生成」选项。 |
| `locationNpcGenerationPromptsMing.ts` | 地点路人 NPC 生成 | `buildLocationNpcGenerationPrompt(input)`，在 AIBidirectionalSystem 中调用，生成当前地点的路人/店员等。 |
| `dataRepairPrompts.ts` | 数据修复 | `getAIDataRepairSystemPrompt(corruptedData, typeDefs)`，characterStore 等处用于修复损坏存档。 |
| `characterInitializationPromptsMing.ts` | 角色初始化完整流程 | `buildCharacterInitializationPromptMing()` 使用 assembleSystemPrompt + 本文件内 RESPONSE_FORMAT、COMMANDS_RULES、NARRATIVE_RULES、数据结构等，**未**使用 getPrompt('characterInit')。 |

若希望「所有在用的提示都可管理」，需要将上述来源改为通过 提示词管理 的 key 获取内容（或拆分为多个 key），并在 defaultPrompts 中补全定义。

---

## 五、内容来源与同步

- **defaultPrompts.ts** 从多处拼装 content：
  - 合并常量：CoreMing、BusinessMing、TextMing、WorldMing、ACTION_OPTIONS_RULES_MING、EVENT_SYSTEM_RULES_MING、InlineMing.*、getCotCorePrompt、getSaveDataStructureMingForEnv、getCharacterInitializationPromptMingForEnv 等。
- **潜在问题**：
  - 若只改了 definition 文件（如 businessRulesMing.ts）而没改 defaultPrompts 的拼接逻辑，或反之，会出现「代码里规则已更新、但管理里默认文案还是旧的」或相反。
  - 部分条目（如 cotCore）依赖运行时参数（如 `getCotCorePrompt('{{用户输入}}', false)`），在 提示词管理 中显示的是某一固定占位版本，与实际调用时可能略有差异，需在文档或 UI 中说明。

建议：在计划中增加「提示词内容清单与归属表」，标明每个 key 的 content 来自哪些文件/函数，便于后续改 prompt 时同步改 defaultPrompts 和管理界面说明。

---

## 六、建议的变更方向（保持与现有功能一致）

目标：保持现有 提示词管理 的交互与数据流不变，只做「对齐运行时」和「补全可管理范围」的调整。

### 6.1 必做：让「在管理中有、但未使用」的项与运行时一致

1. **extendedBusinessRules**
   - **方案 A**：在 `promptAssembler.assembleSystemPrompt` 及 AIBidirectionalSystem 中分步生成第二步中，在 businessRules 之后追加 `getPrompt('extendedBusinessRules')`（若启用）。
   - **方案 B**：从 `getSystemPrompts()` 中移除，或放到「预留/实验」分类且说明「当前版本未注入」。

2. **characterInit**
   - **方案 A（推荐）**：修改 `buildCharacterInitializationPromptMing()`，在组装「角色初始化」专用系统提示时，用 `getPrompt('characterInit')` 作为主模板或其中一大段，其余（如响应格式、命令规则）可从现有常量拼装，但主说明与数据结构部分与 提示词管理 一致。
   - **方案 B**：若希望保持「角色初始化完全由任务文件驱动」，则从 提示词管理 的 initialization 分类中移除 characterInit，或改为「仅展示/只读」，并注明「实际内容以角色初始化任务文件为准」。

3. **npcGeneration / 地点路人 NPC**
   - 当前「NPC生成」管理项对应的是 InlineMing.NPC_GENERATION_MING，而实际地点路人用的是 locationNpcGenerationPromptsMing。建议二选一：
   - **方案 A**：将「地点路人 NPC」改为使用可配置提示词。例如新增 key `locationNpcGeneration`，content 来自或合并 locationNpcGenerationPromptsMing 的说明，在 `buildLocationNpcGenerationPrompt` 中先取 `getPrompt('locationNpcGeneration')` 再拼动态部分（地点名、已有 NPC 等）。
   - **方案 B**：保留现有 npcGeneration 为「通用 NPC 生成」预留；另在 提示词管理 中增加「地点路人 NPC 生成」条目，对应 locationNpcGeneration 的模板内容，并在 buildLocationNpcGenerationPrompt 中改用 getPrompt。

4. **npcMemorySummary / newbieGuide / itemGeneration / worldGeneration**
   - 若近期会做「NPC 记忆总结 / 新手引导 / 动态物品生成 / 真实世界生成」并希望可配置：在对应功能里接入 getPrompt，并保证 defaultPrompts 中已有该 key。
   - 若近期不做：在 提示词管理 中将这些归入「预留」分类或在 UI 上标注「当前版本未使用」，避免用户误改。

### 6.2 可选：把「在用但未管理」的提示纳入 提示词管理

1. **角色创建步骤（世界/天资/出身/灵根/天赋）**
   - 在 defaultPrompts 中为每个增加 key（如 `creationWorldGeneration`、`creationTalentTier`、`creationOrigin`、`creationSpiritRoot`、`creationTalent`），content 从 gameElementPrompts 的对应常量初始化。
   - Step1–Step5 中改为 `getPrompt('creationWorldGeneration')` 等，这样用户可在 提示词管理 中编辑并导出/导入。

2. **地点路人 NPC**
   - 见 6.1 第 3 条；纳入后与「NPC生成」或「动态生成」分类统一管理。

3. **数据修复**
   - 若希望用户可微调修复说明，可增加 key `dataRepair`，content 为 dataRepairPrompts 中的模板文本，`getAIDataRepairSystemPrompt` 改为在模板中使用该 content（或拼接 getPrompt('dataRepair') + 动态的 typeDefs/corruptedData）。

### 6.3 文档与维护

1. **提示词清单表**（建议放在 `docs/` 或代码注释）：
   - 列出每个 key、中文名称、所属分类、content 来源（文件/函数）、是否被 getPrompt 使用、使用位置。
2. **修改提示词时的检查清单**：
   - 改 definition 文件时，是否要同步改 defaultPrompts 的拼接？
   - 新增/删除 key 时，是否在 promptStorage/import 的「已知 key」逻辑中处理？（当前 import 只接受 getSystemPrompts 中已有的 key。）
3. **分类与 condition**：
   - 若有新功能（如「地图预生成 NPC」），对应提示词应设好 category 与 condition，以便在 提示词管理 中按条件显示。

### 6.4 不改变现有行为的部分

- 提示词管理的 UI 交互、导出/导入格式、IndexedDB 结构、联机只读逻辑保持不变。
- `getPrompt(key)` 的语义（用户已保存且 modified 则用用户版，否则用 getSystemPrompts 默认）保持不变。
- 现有 19 个已使用 key 的调用点不变，仅保证 defaultPrompts 与各 definition 文件内容一致即可。

---

## 七、实施优先级建议

| 优先级 | 内容 | 说明 |
|--------|------|------|
| P0 | 文档：建立「提示词 key ↔ 使用位置 ↔ content 来源」清单 | 便于后续任何 prompt 改动时同步 提示词管理 与代码。 |
| P1 | extendedBusinessRules：要么接入组装逻辑，要么从列表移除或标为未使用 | 避免管理界面与真实请求不一致。 |
| P1 | characterInit：要么运行时改用 getPrompt('characterInit')，要么从管理移除/只读并说明 | 同上。 |
| P2 | 地点路人 NPC：将 locationNpcGeneration 纳入 提示词管理 并让 buildLocationNpcGenerationPrompt 使用 getPrompt | 与「动态生成」类提示词一致，用户可编辑。 |
| P2 | npcMemorySummary / newbieGuide / itemGeneration / worldGeneration：决定接入或标为预留 | 减少误导。 |
| P3 | 角色创建步骤 5 个提示词纳入 提示词管理 | 用户可统一调整创建阶段的生成风格。 |
| P3 | 数据修复提示词纳入 提示词管理（可选） | 便于高级用户微调修复行为。 |

---

## 八、总结

- **当前 提示词管理**：数据流与 UI 设计清晰，与 `getPrompt` + IndexedDB 的配合正确。
- **主要问题**：部分在管理中的 key 未被使用；部分在用的提示未经过 getPrompt，未进入管理。
- **目标**：在不大改现有功能的前提下，让「管理里有的 = 会生效的」，并逐步把「在用但未管理」的提示纳入同一体系，同时用文档和清单保证后续 prompt 变更时 提示词管理 与代码同步更新。

完成上述 P0–P1 后，提示词管理系统与当前在用的提示将对齐；再按需实施 P2–P3 即可扩展可管理范围并保持行为一致。
