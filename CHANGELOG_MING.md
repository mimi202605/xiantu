# MING 通用版 - 更新日志

> MING 为不绑定修仙的通用版提示词与数据结构，聚焦 token 效率与长期状态一致性。

---

## [0.2.13] - 2026-02-02

### 坤舆图：修复有子地点时方框与圆同时显示

部分情况下，有内部结构的地点同时渲染了方框与圆形，原因是 Vue 的 `v-else` 与错误的 `v-if` 配对。改用 `<template v-if>` / `<template v-else>` 包裹形状组，确保有子地点仅显示方框、无子地点仅显示圆形。

#### 涉及文件

- `MapMinimap.vue`

---

## [0.2.12] - 2026-02-01

### 坤舆图：minimap 展示与 地点NPC 逻辑优化

#### 变更摘要

- **地图 minimap 展示**：`MapPanel` 由树形列表改为 minimap 风格；新增 `MapMinimap.vue`（SVG 画布、缩放/平移、悬停详情）、`locationMapUtils.ts`（地点布局与坐标）；顶层地点围绕中心分布，子地点聚集于父节点附近；悬停显示地点描述与在场 NPC。
- **getNpcsAtLocation**：回退匹配改为**完全相等**（`当前位置.描述 === locationDesc`）；当 地点NPC 为空且回退找到 NPC 时，支持 `updateStoreOnFallback` 将结果写回该地点的 地点NPC，保持数据同步。

#### 涉及文件

- `MapPanel.vue`、`MapMinimap.vue`、`locationMapUtils.ts`、`locationUtils.ts`

---

## [0.2.11] - 2026-02-01

### 修复：push 世界.信息.地点信息 不生效

AI 生成的 `push 世界.信息.地点信息` 指令此前常不生效，导致地点信息无法自主更新。

#### 变更摘要

- **dataRepair**：确保 `世界.信息` 及 `世界.信息.地点信息` 在修复时存在；若缺失则初始化为 `{}` 与 `[]`，避免 push 时路径未定义导致写入失败。
- **executeCommand**：为 `push 世界.信息.地点信息` 增加与 `世界.状态.探索记录` 类似的特殊处理；显式确保 `世界.信息` 与 `地点信息` 数组存在后再 push，不再依赖 `get` 默认值；增加调试日志。

#### 涉及文件

- `dataRepair.ts`、`AIBidirectionalSystem.ts`

---

## [0.2.10] - 2026-01-31

### 数据结构清理：退役装备/功法/修炼/技能，NPC 灵根/先天六司/境界，属性通用化

移除已退役的数据结构，简化存档与 NPC 定义，使属性更通用。

#### 变更摘要

- **角色数据 - 装备/功法/修炼/技能 已退役**：`SaveDataV3` 中 `角色.装备`、`角色.功法`、`角色.修炼`、`角色.技能` 改为可选；存档展示（`GameVariableSaveDataSection`）过滤不展示；`AIBidirectionalSystem` 叙事判定不再注入；`gameStateStore.toSaveData` 不再写入；`characterInitialization`、`saveMigration`、`dataRepair` 不再创建/补全；`saveValidationV3` 不再校验 `角色.装备`；`GameVariablePanel` 移除对应路径映射。
- **NPC - 灵根/先天六司/境界 已退役**：`NpcProfile` 中 `境界`、`灵根`、`先天六司` 改为可选；`NpcProfile.属性.神识` 改为可选；`dataValidation` 不再强制补全；`dataDefinitions` / `dataDefinitionsMing` 移除相关字段说明。
- **属性通用化**：`PlayerStatus` 中 `境界`、`神识` 改为可选；注释补充：气血=生命/体力，灵气=精力/能量；`dataDefinitions` 属性说明增加通用语义。
- **开局验证修复**：`saveValidationV3` 移除对 `角色.装备` 的必填校验，解决开局「角色.装备 必填且必须是对象」报错。

#### 涉及文件

- `saveSchemaV3.ts`、`game.d.ts`、`gameStateStore.ts`、`saveValidationV3.ts`、`saveMigration.ts`、`dataRepair.ts`、`dataValidation.ts`、`characterInitialization.ts`、`AIBidirectionalSystem.ts`、`GameVariablePanel.vue`、`GameVariableSaveDataSection.vue`、`dataDefinitions.ts`、`dataDefinitionsMing.ts`

---

## [0.2.9] - 2026-01-31

### 地图系统与 NPC 类型（Phase 1）

实现地图数据结构、探索记录、地点 NPC、NPC 类型（重点/普通）及地图 UI。

#### 变更摘要

- **地图数据结构**：`LocationEntry` 递归结构（`内部` 子地点、`上级` 父地点）；顶层 `地点信息` 并列存储；`地点NPC` 存于各地点内，可追溯各地点的 NPC；玩家离开后重点 NPC 会离开，普通 NPC 留守。
- **探索记录**：`世界.状态.探索记录`（string[]）；`set 角色.位置` 时自动 push 新地点；`gameStateStore.explorationRecord` 读写。
- **地点 NPC**：从 `WorldInfo` 移至各 `LocationEntry` 内；`getNpcsAtLocation` 从地点树查找；`onPlayerLeaveLocation` 在玩家离开时移除重点 NPC 并更新其 `当前位置`，普通 NPC 留守。
- **NPC 类型**：`NpcProfile.类型?: "重点"|"普通"`；`deriveFrom社交关系`、`RelationshipNetworkPanel` 仅展示重点 NPC；`GameVariableSaveDataSection` 排序（重点在前）；`recentNpcNames` 含重点 + 当前地点 NPC；当前地点普通 NPC 单独注入 prompt。
- **升级逻辑**：与普通 NPC 互动（push 记忆、add 好感度等）后自动升级为重点。
- **executeCommand**：`push 世界.状态.探索记录` 去重；`set 角色.位置` 时触发探索记录更新与 `onPlayerLeaveLocation`。
- **数据迁移**：`saveMigration` 补全 探索记录、NPC 类型；旧 `世界.信息.地点NPC`（Record）迁移到各地点内。
- **地图 UI**：`MapPanel`、`LocationTreeNode` 递归树展示；已探索/未探索/当前位置区分；路由 `/game/map`、侧栏「坤舆图」入口。
- **worldHeartbeat**：`getNpcUpdatePriority` 预留；`getNpcsAtLocation` 导出。

#### 地点信息 prompt 修复

- **开局**：`characterInitializationPromptsMing` 消除「只用 set」与「必须 push 地点信息」矛盾；明确「唯独地点信息必须用 push」。
- **主游戏**：`LOCATION_UPDATE_RULES` 加入主业务规则；新增「地点信息同步（必须）」：set 角色.位置 到新地点时**必须**同时 push 世界.信息.地点信息。
- **分步生成**：`SPLIT_GENERATION_STEP2_MING` 强化「set 角色.位置 到新地点时，必须同时 push 世界.信息.地点信息」。

#### 涉及文件

- `game.d.ts`、`gameStateStore.ts`、`locationUtils.ts`、`worldHeartbeat.ts`、`AIBidirectionalSystem.ts`、`dataRepair.ts`、`saveMigration.ts`、`dataValidation.ts`、`memoryRetrievalService.ts`、`RelationshipNetworkPanel.vue`、`GameVariableSaveDataSection.vue`、`GameVariablePanel.vue`、`MapPanel.vue`、`LocationTreeNode.vue`、`LeftSidebar.vue`、`router/index.ts`、`businessRulesMing.ts`、`dataDefinitionsMing.ts`、`inlinePromptsMing.ts`、`characterInitializationPromptsMing.ts`、`defaultPrompts.ts`、`docs/plan-world-npc-*.md`

---

## [0.2.8] - 2026-01-31

### Ming 模式清理：统一使用 Ming 提示词

逐步移除与 Ming 模式无关的逻辑和提示词，保持项目精简。采用非激进、分阶段方式。

#### 变更摘要

- **Phase 1 - 角色初始化**：`characterInitializationPromptsMing.ts` 新增 `buildCharacterInitializationPromptMing`、`buildCharacterSelectionsSummaryMing`；`characterInitialization.ts` 根据 `USE_MING_PROMPTS` 选择 Ming 版本；术语调整：灵根 → 特质。
- **Phase 2 - defaultPrompts**：移除非 Ming 的 imports（coreRules、businessRules、textFormats、worldStandards、actionOptions、eventSystemRules、dataDefinitions、characterInitializationPrompts）；所有提示词直接使用 Ming 版本，移除 `USE_MING_PROMPTS ?` 三元分支。
- **Phase 3 - 其他模块**：`promptAssembler.ts` 使用 `stripNsfwContentMing`、`SAVE_DATA_STRUCTURE_MING`；`AIBidirectionalSystem.ts` 使用 `stripNsfwContentMing`；`GameVariableFormatGuideModal.vue` 使用 `getSaveDataStructureMingForEnv`；`cotCore.ts` 从 `textFormatsMing` 导入 `DICE_ROLLING_RULES`。
- **Phase 4 - 文档**：新增 `docs/plan-ming-cleanup.md`，列出后续可删除的修仙版定义文件及检查清单。

#### 涉及文件

- `defaultPrompts.ts`、`characterInitialization.ts`、`characterInitializationPromptsMing.ts`、`promptAssembler.ts`、`AIBidirectionalSystem.ts`、`GameVariableFormatGuideModal.vue`、`cotCore.ts`、`docs/plan-ming-cleanup.md`

---

## [0.2.7] - 2026-01-28

### 移除 game_entities，关系图仅由 社交.关系 派生

实体与 NPC–NPC 关系不再使用 `game_entities` / `系统.扩展.游戏实体索引`；关系图**全部**由 **`社交.关系`**（含 与玩家关系、关系）+ **角色** 派生，写入**统一**经 **tavern_commands**。

#### 变更摘要

- **NpcProfile**：新增 **`关系?: Record<string, string>`**（本 NPC 对其他 NPC；key=对方名字，value=关系标签）。仅经 tavern_commands 写：`set 社交.关系.{npc}.关系.{其他}` 或 `set 社交.关系.{npc}.关系` 对象**合并**。
- **gameStateIndexer**：`mergeInto扩展` **删除**对 `game_entities` 的处理，**仅**处理 **semantic_memory**；`readFrom扩展` 只返回 `semanticMemory`。不再读写 `游戏实体索引`。
- **memoryRetrievalService**：不再从 `readFrom扩展` 取 `gameEntityIndex`；新增 **`deriveFrom社交关系(社交关系, 角色身份)`**，从 `社交.关系` 与 `角色.身份` 派生 `entities`、`relationships`（Player–NPC 从 与玩家关系，NPC–NPC 从 关系）。`retrieve()` 使用派生结果与 `readFrom扩展` 的 `semanticMemory`。
- **AIBidirectionalSystem**：不再向 `mergeInto扩展` 传入 `game_entities`；**移除** `gmResponse.game_entities` 及 `parseAIResponse` 对 `game_entities` 的提取。**`executeCommand`**：当 `set 社交.关系.{npc}.关系` 且 value 为 **plain object** 时，**合并**进既有 `关系`（`{ ...existing, ...value }`），不整体替换。
- **Step2 / Init Step2**：从输出格式中**移除 `game_entities`**；Step2 格式改为 `{"mid_term_memory","tavern_commands","action_options","semantic_memory"}`。inlinePromptsMing、dataDefinitionsMing 说明 NPC–NPC 关系**仅**经 tavern_commands（`set 社交.关系.{npc}.关系.{其他}` 或 `set 社交.关系.{npc}.关系` 对象合并）。
- **gameStateStore**：**移除** `gameEntityIndex`；`loadFromSaveData` / `toSaveData` 仅读写 `语义记忆`（`系统.扩展.语义记忆`）。**迁移**：若存在 `系统.扩展.游戏实体索引.relationships`，在 load 时迁移到 `社交.关系[fromId].关系[toId]`（仅 NPC–NPC，fromId/toId 均在 社交.关系）。
- **GameVariablePanel / GameVariableGameIndexSection**：实体与关系由 **`deriveFrom社交关系(relationships, character)`** 派生，不再使用 `gameEntityIndex`；`mapSavePathToStorePath` 删除 `系统.扩展.游戏实体索引` → `gameEntityIndex`。
- **类型**：`AIGameMaster.d.ts` 删除 `GM_Response.game_entities`；`gameStateIndex.ts` 删除 `GameEntityIndex`、`GameEntitiesOutput`；`GameEntityType` 增加 `'player'`（派生用）。

#### 涉及文件

- `game.d.ts`、`gameStateIndexer.ts`、`memoryRetrievalService.ts`、`AIBidirectionalSystem.ts`、`inlinePromptsMing.ts`、`dataDefinitionsMing.ts`、`gameStateStore.ts`、`GameVariablePanel.vue`、`GameVariableGameIndexSection.vue`、`GameVariableDataDisplay.vue`、`gameStateIndex.ts`、`AIGameMaster.d.ts`

### 确保 NpcProfile.关系 在创角/加载时初始化并展示

`NpcProfile.关系`（NPC–NPC 关系）需在创角、加载存档、事件引入 NPC 时**始终存在**，以便在 **游戏变量**（存档数据、实体与语义）与 **人物关系→原始数据** 中正确展示。

#### 变更摘要

- **dataRepair.repairNpc**：若 NPC 缺 `关系` 或非对象，补 `关系: {}`。
- **dataValidation.validateAndRepairNpcProfile**：AI 通过 `set 社交.关系.{npc}` 创建 NPC 时，确保 `关系` 存在。
- **gameStateStore.loadFromSaveData**：加载存档后，遍历 `社交.关系` 中每个 NPC，确保 `关系` 已初始化。
- **AIBidirectionalSystem**：事件引入特殊 NPC 时，写入前确保 `npcToAdd.关系` 存在。

#### 涉及文件

- `dataRepair.ts`、`dataValidation.ts`、`gameStateStore.ts`、`AIBidirectionalSystem.ts`

### 语义记忆：排序、检索与可视化

- **合并时自动补 timestamp**：`gameStateIndexer` 在合并 `semantic_memory.triples` 时，对缺 `timestamp` 的项自动补（`元数据.时间` → `gameTimeToSortable` 或 `new Date().toISOString()`）。
- **检索**：`querySemanticTriples` 替代 `queryByTimeImportance`；**真实时间衰减**（解析 timestamp，`decay(age)=1/(1+age/halflife)`）、**contextBoost**（subject/object ∈ 玩家、recentNpcNames 时加权），`score = contextBoost × importance × recency`，取 top N。
- **排序工具**：`sortTriples(triples, by, order)`、`parseTripleTimestamp(t)` 供检索与 UI 复用；`by` 支持 subject / predicate / object / importance / timestamp / category。
- **可视化**：`GameVariableGameIndexSection` 语义记忆块展示 **timestamp**；支持**排序**（默认 timestamp 降序）、**筛选**（subject 包含、category、importance ≥）、**按 subject 分组**。
- **时间**：`time.ts` 新增 `gameTimeToSortable`、`gameTimeToMinutes`、`gameTimeStringToMinutes`；prompts/dataDefinitions 建议填 `timestamp`、`importance`，未填 timestamp 时合并自动补。

---

## [0.2.6] - 2026-01-28

### 🐛 修复：创角时世界信息未写入 游戏变量→世界信息

创角界面填写的世界名称、时代背景、世界描述此前未写入 `世界.信息`，游戏变量中的「世界信息」始终为默认占位。

#### 变更摘要

- **原因**：`characterInitialization` 中的 `EnhancedWorldGenerator`  stub 接收 `enhancedConfig`（来自 `characterCreationStore.selectedWorld` 的 name / era / description）但未使用，`buildStubWorldInfo()` 固定返回 世界名称/世界背景/世界纪元 的默认值。
- **修改**：`EnhancedWorldGenerator` 构造函数保存 `config`，`buildStubWorldInfo()` 从 `config.worldName`、`config.worldBackground`、`config.worldEra` 填入 世界名称、世界背景、世界纪元、世界描述、世界观；缺省时仍回退默认值。

#### 涉及文件

- `src/services/characterInitialization.ts`

---

## [0.2.5] - 2026-01-27

### 宗门系统移除（Sect 退役）

宗门系统已从 MING 中完全退役，相关 API 分配、迁移提示与 UI 已清理。

#### 变更摘要

- **API 管理**：`apiManagementStore` 移除 `sect_generation` 类型及 `DEFAULT_API_ASSIGNMENTS`、`DEFAULT_FUNCTION_MODES`、`DEFAULT_FUNCTION_ENABLED` 中的宗门生成项；`APIManagementPanel` 从功能分配列表、`getFunctionName`、`getFunctionDesc` 中移除宗门生成。
- **GameView**：移除 `maybePromptSectMigration`、`getActiveSaveKey`、`lastMigrationPromptKey` 及对 `detectSectMigration`、`SectMigrationModal` 的引用（该迁移逻辑与组件此前已删除，此处清理残留调用）。

#### 涉及文件

- `apiManagementStore.ts`、`APIManagementPanel.vue`、`GameView.vue`

---

## [0.2.4] - 2026-01-28

### 三千大道系统移除（Thousand Dao 退役）

三千大道系统已从 MING 中完全移除，相关类型、Store、校验、初始化、迁移、UI、队列与 i18n 均做清理。

#### 变更摘要

- **类型与 Store**：`game.d.ts` 移除 `DaoStage`、`DaoData`、`ThousandDaoSystem`；`gameStateStore` 移除 `thousandDao` 及 load/toSaveData/reset 中的 大道 读写；`saveSchemaV3` 中 `角色.大道` 改为可选。
- **校验与 AI**：`commandValueValidator`、`commandValidator` 移除 大道 对象校验；`AIBidirectionalSystem` 构建给 AI 的 角色 不再包含 大道。
- **角色与存档**：`characterInitialization`、`offlineInitialization` 不再初始化 `角色.大道`；`characterStore` 移除 大道 修复；`saveMigration` 迁移时不再写入 大道；`dataRepair` 不再补全 大道。
- **UI 与路由**：`CharacterDetailsPanel` 移除 大道 相关 computed、ref、方法、样式；`GameVariablePanel` 移除 `角色.大道` 映射；`GameVariableFormatGuideModal` 移除「2. 大道」章节及导航；`RightSidebar` 的 `getTalentData` 不再从 大道 查找；`router` 移除 ThousandDao 相关注释与路由。
- **组合式、队列与文案**：`useCharacterData` 移除 `daoData`；`actionQueueStore` 移除 感悟大道 (comprehend) 冲突逻辑及 cultivate 中的 大道 分支；`defaultPrompts`、`FormattedText`、`stateChangeFormatter` 注释去 大道；`ModeSelection`「共证大道」改为「与友共游 · 一起冒险」；`enhancedActionQueue` 的 `storageKey` 由 `dao_undo_actions` 改为 `gm_undo_actions`。
- **i18n**：删除 大道 面板专用 key（如 加载三千大道、已解锁大道、条大道 等）；`天道感应中...` 改为「生成中...」。保留 大道五十、道法受阻、三千大道 等叙事/品质用词。

#### 涉及文件

- `game.d.ts`、`gameStateStore.ts`、`saveSchemaV3.ts`、`commandValueValidator.ts`、`commandValidator.ts`、`AIBidirectionalSystem.ts`、`characterInitialization.ts`、`offlineInitialization.ts`、`characterStore.ts`、`saveMigration.ts`、`dataRepair.ts`、`CharacterDetailsPanel.vue`、`GameVariablePanel.vue`、`GameVariableFormatGuideModal.vue`、`RightSidebar.vue`、`router/index.ts`、`useCharacterData.ts`、`actionQueueStore.ts`、`defaultPrompts.ts`、`FormattedText.vue`、`stateChangeFormatter.ts`、`ModeSelection.vue`、`enhancedActionQueue.ts`、`i18n/index.ts`

---

## [0.2.3] - 2026-01-28

### 世界事件·事件类型（对齐通用版）

世界事件系统的事件类型与 `eventSystemRulesMing` 的通用设定统一，移除修仙向类型（宗门大战、世界变革、异宝降世、秘境现世、势力变动、天灾人祸），改为通用四类 + 特殊NPC 开关。

#### 变更摘要

- **事件类型开关（世界事件 → 事件类型）**：`势力冲突`、`局势变化`、`重大发现`、`人物风波`、`特殊NPC`。
- **自定义事件·类型下拉**：仅保留 `势力冲突`、`局势变化`、`重大发现`、`人物风波`；默认类型由「世界变革」改为「人物风波」。
- **占位与示例**：自定义提示词占位改为「更偏向势力冲突、人物风波…」；描述模板占位移除 `{境界}`，示例改为「{玩家名}在{位置}遭遇了……」。
- **类型与回退**：`game.d.ts` 的 `EventType`、`启用事件类型` 更新为上述 ming 集合；`eventGenerators` 中世界事件解析回退由「世界变革」改为「局势变化」；特殊NPC 生成的 `event_type` 示例改为「人物风波|势力冲突|局势变化|重大发现」。
- **游戏变量格式说明**：`GameVariableFormatGuideModal` 中事件类型说明与示例改为「势力冲突/局势变化/重大发现/人物风波」及通用示例（如「两大势力爆发冲突」「势力冲突」「势力A」「势力B」）。

#### 涉及文件

- `EventPanel.vue`、`game.d.ts`、`eventGenerators.ts`、`GameVariableFormatGuideModal.vue`

---

## [0.2.2] - 2026-01-28

### ✨ 游戏实体关系图（游戏变量·实体与语义）

在「实体与语义」视图中新增**关系图**，基于 Cytoscape 可视化 `游戏实体索引` 的实体与关系。

- **关系图**：在游戏变量 → 实体与语义中增加「关系图」区块，以节点（实体）与有向边（关系）展示；支持缩放、拖拽节点（仅视图，不写回）、恢复默认布局、节点/边标签显隐切换。
- **依赖**：`cytoscape`；节点按 type 着色（npc/location/item/event/faction/other）。
- **主角节点**：`id === 'player'` 的节点显示 角色.身份.名字，缺省为「玩家」。
- **悬停描述**：悬停 NPC 节点时显示 人物关系（社交.关系）中该角色的 **出生**（string 或 `{描述,名称}`）；工具提示紧贴节点右侧（按 pan/zoom 将节点模型坐标换算为视口坐标后偏移）。

#### 新增与修改

- `GameEntityGraph.vue`：关系图组件；`GameVariableGameIndexSection` 引入关系图并传入 `entities`、`relationships`、`npcProfiles`（社交.关系）、`playerName`（角色.身份.名字）。
- `GameVariablePanel`：`socialRelations`（`gameStateStore.relationships`）传入 DataDisplay；`GameVariableDataDisplay`、`GameVariableGameIndexSection` 增加 `socialRelations`、`playerName` 传递。
- `package.json`：`cytoscape`。
- i18n：`关系图`、`显示标签`、`恢复默认`、`暂无实体或关系`。

---

## [0.2.1] - 2026-01-28

### 变更：语义记忆三元组不再设总量上限

- **合并**：`mergeInto扩展` 中的 `mergeTriples` 不再对 `系统.扩展.语义记忆.triples` 做数量上限裁剪，本回合及隐式中期记忆产出的三元组全部追加保留。
- **依据**：记忆检索 `memoryRetrieve` 已通过 `maxLines`、按关系/按重要度×时间取前 N 等逻辑，只向提示词注入有界子集，token 不会随 triples 总量 unbounded 增长。
- **代码**：`gameStateIndexer.ts` 移除 `MAX_TRIPLES` 及 `mergeTriples` 内的 sort+slice；`memoryRetrievalService.ts` 在文件头与 `queryByTimeImportance` 处补充提取逻辑说明。

---

## [0.2.0] - 2026-01-27

### ✨ 游戏状态索引与语义记忆（Token 高效架构）

为提升长会话下的状态一致性并降低 token 消耗，新增**游戏实体索引**、**语义记忆**与**记忆检索**，在行动生成（分步第 2 步或单步）中由 LLM 一并输出并落盘，检索结果在每回合注入提示词。

#### 1. 游戏状态索引（Game State Indexer）

- **实体**：NPC、地点、物品、事件、势力等，含 `id`、`type`、`name`、`metadata`、`tags`
- **关系**：`fromId`–`relationship`–`toId`，支持 NPC–NPC、玩家–NPC、玩家–地点等
- **存储**：`系统.扩展.游戏实体索引`，随 SaveData 写入 IndexedDB
- **合并**：每回合将 LLM 输出的 `game_entities` 与既有索引合并，实体按 id 更新，关系去重，数量超限时按策略裁剪

#### 2. 语义记忆（Semantic Memory）

- **三元组**：`(subject, predicate, object)`，可选 `timestamp`、`importance`、`category`
- **示例**：`(张三, 是, 玩家的师父)`、`(玩家, 在, 青城山获得玉佩)`
- **存储**：`系统.扩展.语义记忆`，随 SaveData 持久化
- **合并**：追加本回合 `semantic_memory.triples`，按重要度裁剪总量

#### 3. 记忆检索（Memory Retrieval）

- **按关系**：从玩家与近期 NPC 出发做图上游走，得到相关实体与关系导出
- **按时间/重要度**：对语义三元组按 `importance × recency` 排序，取前 N 条
- **注入**：每回合将检索结果格式化为 `# 相关实体` / `# 关系` / `# 语义记忆` 注入系统提示，替代冗长摘要，减少无效 token

#### 4. 与行动生成的集成

- **分步第 2 步**（`SPLIT_GENERATION_STEP2_MING`、`SPLIT_INIT_STEP2_MING`）：输出增加可选 `game_entities`、`semantic_memory`，若本回合无重要实体或事实可给 `{}`
- **GM_Response**：扩展 `game_entities`、`semantic_memory`；`parseAIResponse` 与分步构造的 `gmResponse` 中传递这两项
- **processGmResponse**：在写回前调用 `mergeInto扩展`，将本回合产出合并进 `saveData.系统.扩展`
- **processPlayerAction**：构建系统提示前调用 `memoryRetrieve`，将检索块插入 `# 语义记忆与实体索引`

#### 5. 数据定义与 Store

- **dataDefinitionsMing**：新增 4.1 节说明 `系统.扩展.游戏实体索引`、`系统.扩展.语义记忆` 为只读，由 step2 输出驱动
- **gameStateStore**：`gameEntityIndex`、`semanticMemory` 从 `系统.扩展` 读写，在 `loadFromSaveData` / `toSaveData` 中贯通

#### 6. 游戏变量面板展示

- **实体与语义** Tab：在游戏变量中新增「实体与语义」视图，展示 `系统.扩展.游戏实体索引`（实体列表：id/type/name/tags；关系列表：fromId–relationship–toId）与 `系统.扩展.语义记忆`（三元组 subject|predicate|object，含 importance、category），支持单条复制。
- **数据来源**：从 `gameStateStore.gameEntityIndex`、`gameStateStore.semanticMemory` 读取；`mapSavePathToStorePath` 支持 `系统.扩展.游戏实体索引`、`系统.扩展.语义记忆` 的编辑回写。
- **新增**：`GameVariableGameIndexSection.vue`；`GameVariableDataSelector` 增加 `Network` 图标；i18n 增加 `实体与语义`、`存档数据(短路径)`。

#### 新增文件

- `src/types/gameStateIndex.ts`：`GameEntity`、`EntityRelationship`、`SemanticTriple`、`GameEntityIndex`、`SemanticMemoryStore` 及 LLM 输出类型
- `src/services/gameStateIndexer.ts`：`mergeInto扩展`、`readFrom扩展`
- `src/services/memoryRetrievalService.ts`：`retrieve(saveData, ctx)`
- `src/components/dashboard/components/GameVariableGameIndexSection.vue`：游戏变量「实体与语义」区块

---

### 🐛 修复：MING 下 NPC 因缺「境界」被拒

- **原因**：`commandValueValidator` 的 `validateNPCObject` 将 `境界` 视为必填，而 MING 的 NPC 结构（`dataDefinitionsMing`）为通用版，不包含 `境界`，导致 `set 社交.关系.{NPC名}` 被拒，报错 `NPC缺少"境界"字段`。
- **修改**：在 `validateNPCObject` 中把 `境界` 改为可选：仅当 `value.境界 != null` 时用 `validateRealmObject` 校验；缺失不再报错。
- **影响**：修仙版若 NPC 未填 `境界`，仍由 `validateAndRepairNpcProfile` 在执行时补默认；MING 版可正常创建不含 `境界` 的 NPC。

---

## [0.1.0] - 此前

- MING 通用版提示词与数据结构（`definitions/ming`、`characterInitializationPromptsMing` 等）
- 不绑定境界、大道、宗门、功法、灵根、修炼等修仙专有字段
