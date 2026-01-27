# MING 通用版 - 更新日志

> MING 为不绑定修仙的通用版提示词与数据结构，聚焦 token 效率与长期状态一致性。

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
