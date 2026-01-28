# MING 通用版 - 更新日志

> MING 为不绑定修仙的通用版提示词与数据结构，聚焦 token 效率与长期状态一致性。

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
