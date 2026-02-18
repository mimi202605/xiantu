# MING 通用版 - 更新日志

> MING 为不绑定修仙的通用版提示词与数据结构，聚焦 token 效率与长期状态一致性。

---

## [0.2.87] - 2026-02-17

### 记忆中心：已发送信息按回合唯一、重发覆盖

- **行为**：因回退后可能重复发送同一回合的 prompt，已发送记录改为**每回合仅保留一条**；同一回合再次发送时覆盖该回合的既有记录，不再追加重复条。
- **实现**：`已发送信息` 项增加可选 `roundIndex`（回合序号）；`appendSentMessage(text, roundIndex?)` 传入当前 `roundNumber` 时，先查找同 `roundIndex` 记录并原地覆盖，否则追加；旧存档无 `roundIndex` 的条目仍正常展示。
- **涉及文件**
  - `src/types/saveSchemaV3.ts`
  - `src/stores/gameStateStore.ts`
  - `src/components/dashboard/MainGamePanel.vue`

---

## [0.2.86] - 2026-02-17

### Prompt：禁止将载具/飞行器/非地点作为地点

- **地点仅限真实场所**：禁止将载具（轿车内、马车内）、飞行器（飞舟内、机舱内）、船内、车厢内等非地点作为 `角色.位置.描述` 或 push 到 `世界.信息.地点信息`；若角色在移动载具中，应写其当前所处的地面地点（出发地/目的地/途经地）。
- **涉及 prompt**：位置更新与地点信息同步（businessRulesMing）、地点与探索 Step2（inlinePromptsMing）、地点信息数据定义（dataDefinitionsMing）、地图 NPC 请求（locationNpcGenerationPromptsMing）。
- **涉及文件**
  - `src/utils/prompts/definitions/ming/businessRulesMing.ts`
  - `src/utils/prompts/definitions/ming/inlinePromptsMing.ts`
  - `src/utils/prompts/definitions/ming/dataDefinitionsMing.ts`
  - `src/utils/prompts/tasks/locationNpcGenerationPromptsMing.ts`

---

## [0.2.85] - 2026-02-17

### 回退与 Rerank：说明与可观测

- **回退不影响 Rerank 配置**
  - 回退仅覆盖存档并修剪向量库，**不修改** localStorage（`dad_game_settings`）与 API 管理，故 Engram 总开关、hybrid、Rerank 配置在回退后保持不变。
  - 若回退后主回合不再触发 Rerank 请求，多为回退后存档中事件/实体/语义记忆过少，导致统一检索候选列表 `allCandidates` 为空（Rerank 仅在候选数 > 0 时调用）。

- **可观测**
  - `unifiedRetriever`：当 Rerank 已启用但 `allCandidates.length === 0` 时输出 `console.debug('[Engram] Rerank 已启用但未执行：当前无候选…')`，便于确认是否为“无候选故未调用”。
  - `characterStore` 回退逻辑处增加注释，说明上述行为及原因。
  - `docs/ENGRAM_API_MANAGEMENT_USER_GUIDE.md`：在「主回合回退与 Engram」中补充回退不改配置、以及回退后 Rerank 未执行时的原因与控制台提示。

- **涉及文件**
  - `src/services/engram/unifiedRetriever.ts`
  - `src/stores/characterStore.ts`
  - `docs/ENGRAM_API_MANAGEMENT_USER_GUIDE.md`

---

## [0.2.84] - 2026-02-17

### 地点结构：仅扁平数组 + 上级（不兼容旧存档）+ 生成须带全父级

- **地点数据结构（不兼容变更）**
  - 地点信息改为**仅「扁平数组 + 上级」**建树，移除 `内部` 嵌套；类型 `LocationEntry` 删除 `内部?`。
  - `locationUtils`：`findLocationInTree`、`forEachLocationInTree` 改为仅操作扁平数组（无递归）；删除 `normalizeLocationEntriesToFlat`。`ensureLocationExists` 只向顶层 `地点信息` push，每层 `名称` 为全路径、`上级` 为父级全路径。
  - `locationMapUtils`：地图建树仅用扁平列表 + `上级`，不再做归一化；节点 id 为 `名称`（全路径）。
  - `saveMigration`：地点 NPC 迁移只遍历顶层数组；迁移时对每条地点执行 `delete e.内部`，旧存档加载后持久化数据不再含 `内部`。
  - `worldHeartbeatPromptsMing`：地点列表直接遍历扁平数组生成 prompt 行，不再调用归一化。
  - `LocationTreeNode.vue`：子节点由可选 prop `flatEntries` 按 `上级 === entry.名称` 推导，不再读取 `entry.内部`。

- **Prompt：生成地点须带全部父级**
  - **主流程 Step2**（`inlinePromptsMing`）：地点与探索增加「生成地点时必须生成其全部父级地点结构」，多级路径须按层级依次 push 每一级（先根级再末级），并注明缺漏父级会导致地图无法显示层级。
  - **位置更新**（`businessRulesMing`）：在「位置更新」下增加说明——`描述` 为多级路径时必须同时向 `世界.信息.地点信息` 补全全部父级，并指向「地点信息同步」。
  - **地点信息同步 / 数据定义**：明确多级路径须依次 push 每一级并给出示例（东荒大陆 → 东荒大陆·青云城 → 东荒大陆·青云城·客栈）。
  - **地图 NPC 请求**（`locationNpcGenerationPromptsMing`）：输出格式增加「地点结构修正」——若当前地点为多级路径，须在 tavern_commands 中补全全部父级（push 世界.信息.地点信息）；原则增加「地点层级补全」，要求先 push 该地点及每一级父地点再输出 set NPC。

- **文档**
  - `map-test-data-locations.md`：规范说明改为「仅使用扁平数组 + 上级，无嵌套字段」（移除旧存档兼容表述）。

- **涉及文件**
  - `src/types/game.d.ts`（LocationEntry 移除 内部）
  - `src/utils/locationUtils.ts`（flat-only find/forEach，ensureLocationExists 只 push 顶层）
  - `src/utils/locationMapUtils.ts`（不再 normalize，仅 上级 建树）
  - `src/utils/saveMigration.ts`（地点迁移仅顶层，delete 内部）
  - `src/utils/prompts/tasks/worldHeartbeatPromptsMing.ts`（地点行直接遍历扁平）
  - `src/utils/prompts/definitions/ming/inlinePromptsMing.ts`（Step2 地点父级要求）
  - `src/utils/prompts/definitions/ming/businessRulesMing.ts`（位置更新衔接、地点信息同步父级示例）
  - `src/utils/prompts/definitions/ming/dataDefinitionsMing.ts`（多级地点须生成全部父级）
  - `src/utils/prompts/tasks/locationNpcGenerationPromptsMing.ts`（地点结构修正与层级补全）
  - `src/components/dashboard/components/LocationTreeNode.vue`（flatEntries、children 由 上级 推导）
  - `docs/map-test-data-locations.md`

---

## [0.2.83] - 2026-02-17

### Engram 调试与展示：Rerank 鉴权、提示词组装主回合可见、游戏变量 Engram 可视化

- **Rerank 请求鉴权（修复 401）**
  - `rerankService`：`RerankOptions` 新增 `apiKey?: string`；请求头增加 `Authorization: Bearer <apiKey>`，与 Embedding 一致，避免未鉴权导致 401。
  - `unifiedRetriever`：`UnifiedRetrieveInput` 新增 `rerankApiKey`；调用 `rerankCandidates` 时传入。
  - `AIBidirectionalSystem`：主回合 hybrid 检索时从 API 管理当前 Rerank API 读取 `apiKey` 并传入 `unifiedRetrieve`。

- **提示词组装：主回合始终记录且与分步共存**
  - 主回合不再依赖「调试模式 + 有模组」才记录：每次主回合都会写入一条「主回合」快照（含 fullPrompt、dataModules、embeddingRequest、rerankRequest）；调试开启时额外包含提示词模组列表。
  - `promptAssemblyStore`：将「分步第1步」从 `ROUND_START_FLOW_NAMES` 中移除，仅保留「主回合」「开局第1步」为回合开始（会清空上一回合）。启用分步生成时，记录顺序为 主回合 → 分步第1步 → 分步第2步，三者共存于同一回合快照列表，用户可切换查看「主回合」及 Embedding/Rerank 区块。
  - 提示词组装面板：当当前快照非主回合且无 embedding/rerank 数据时，显示说明「Embedding / Rerank 请求仅在「主回合」且启用 hybrid 检索时记录…」。

- **提示词组装：Embedding / Rerank 请求区块**
  - `AssemblySnapshot` 新增可选 `embeddingRequest`、`rerankRequest`（query、model、endpoint、responsePreview 等）。
  - `unifiedRetriever` 返回 `debug?: { embeddingRequest?, rerankRequest? }`，主回合记录时写入 store。
  - 面板中新增独立 section「Embedding 请求（本步骤）」「Rerank 请求（本步骤）」，与分步模组同级展示。

- **游戏变量：Engram 数据可视化**
  - 游戏变量查看新增数据类型「Engram」：与「实体与语义」并列，实时展示 `系统.扩展.engramMemory`。
  - 新组件 `GameVariableEngramSection.vue`：展示 Meta（schema_version、embedding_model、vector_dim、向量库状态）、事件列表（含向量有无/维度、embedding 预览）、实体列表（同上）、关系列表；向量库按当前存档 context 从 IndexedDB 异步加载。
  - `GameVariablePanel`：新增 `engramData`、`vectorContext`，`dataTypes` 增加 `engram`；`GameVariableDataDisplay` 路由到 `GameVariableEngramSection`。

- **涉及文件**
  - `src/services/engram/rerankService.ts`（apiKey、Authorization header）
  - `src/services/engram/unifiedRetriever.ts`（UnifiedRetrieveDebug、rerankApiKey、debug 填充与返回）
  - `src/utils/AIBidirectionalSystem.ts`（主回合始终 record、hybridRetrievalDebug、rerankApiKey 传入）
  - `src/stores/promptAssemblyStore.ts`（ROUND_START 不含 分步第1步；Snapshot 增加 embeddingRequest/rerankRequest）
  - `src/components/dashboard/PromptAssemblyPanel.vue`（Embedding/Rerank section、engram 说明 hint）
  - `src/components/dashboard/GameVariablePanel.vue`（engramData、vectorContext、engram tab）
  - `src/components/dashboard/components/GameVariableDataDisplay.vue`（engram 分支与 props）
  - `src/components/dashboard/components/GameVariableEngramSection.vue`（新增）
  - `src/i18n/index.ts`（Engram 文案）

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

---

## [0.2.82] - 2026-02-16

### Engram 与 API 管理整合 + Rerank 路径 + 回退时向量库修剪

- **Engram API 统一纳入 API 管理**
  - `apiManagementStore`：新增 `rerank` 为 `APIUsageType`，默认分配与 function modes 含 embedding/rerank。
  - **API 管理 → 辅助功能**：新增「Embedding向量化」「Rerank重排」分配项，用户可为两者单独选择或新增 API（URL、Model、API Key 等在 API 列表中编辑）。
  - **系统设置 → 记忆增强（Engram）**：当前 Embedding API、Rerank API 及其 **模型** 改为**只读展示**（来源于 API 管理），不可在此编辑；总开关「启用 Engram 增强」仅在此处，关闭后覆盖「启用向量检索」「启用 Rerank」。
  - Embedding/Rerank 实际使用的 **模型** 优先取自 API 管理中当前分配 API 的 `model` 字段；系统设置中「Embedding Model」「Rerank Model」仅作只读展示。

- **Rerank 端点路径**
  - 默认：Rerank 请求使用 `{API base URL}/rerank`（`DEFAULT_RERANK_ROUTING_PATH`），修复此前缺少路径的问题。
  - **可选自定义路径**：`APIConfig` 新增 `useCustomRouting?: boolean`、`customRoutingPath?: string`；API 管理编辑界面新增「使用自定义路径」开关与路径输入（如 `v1/rerank`）。`getRerankEndpointUrl()` 据此生成完整端点；系统设置只读展示实际使用的 Rerank 端点 URL。

- **主回合回退与向量库洁净**
  - 回退到「上次对话」时，除整份存档（含 `系统.扩展.engramMemory`）替换为备份外，**同步修剪 IndexedDB 向量库**：仅保留回退后存档中仍存在的事件/实体 ID 对应向量，移除被回退掉的那次对话所产生的 embedding。
  - `vectorRepository` 新增 `trimVectorStoreToMemory(store, memory)`；`characterStore.rollbackToLastConversation` 在保存回退数据后调用，保证向量库无死数据并避免回退后重生成时重名实体向量冲突。
  - 失败时仅打 `debug.warn`，不阻断回退流程。

- **文档**
  - 新增 `docs/ENGRAM_API_MANAGEMENT_USER_GUIDE.md`：实现范围总览、可配置项详解（API 管理 + 系统设置 Engram）、Engram 记忆系统完整实现（记忆结构/写入/向量/检索/Trim）、主回合回退与向量修剪说明、用户流程与开发者参考。

- **涉及文件**
  - `src/stores/apiManagementStore.ts`（rerank 类型、useCustomRouting/customRoutingPath、getRerankEndpointUrl、DEFAULT_RERANK_ROUTING_PATH）
  - `src/components/dashboard/APIManagementPanel.vue`（辅助功能 embedding/rerank、自定义路径 UI）
  - `src/components/engram/EngramSettingsSection.vue`（只读 API/模型展示、getRerankEndpointUrl 展示）
  - `src/services/engram/embeddingService.ts`（模型优先 API 管理）
  - `src/services/engram/rerankService.ts`（RerankOptions.model、endpointUrl）
  - `src/services/engram/unifiedRetriever.ts`（rerankEndpointUrl、rerankModel 入参）
  - `src/services/engram/vectorRepository.ts`（trimVectorStoreToMemory）
  - `src/utils/AIBidirectionalSystem.ts`（getRerankEndpointUrl、rerankModel 传入 unifiedRetrieve）
  - `src/stores/characterStore.ts`（回退后修剪向量库）
  - `docs/ENGRAM_API_MANAGEMENT_USER_GUIDE.md`（新增）

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

---

## [0.2.81] - 2026-02-16

### Engram 迁移：Phase 7（设置面板补齐 Rerank/Trim 控制）

- **Engram 设置 UI 扩展**
  - `EngramSettingsSection.vue` 新增可视化配置项：
    - `rerank.enabled`
    - `rerank.providerUrl`
    - `rerank.model`
    - `rerank.topN`
    - `trim.enabled`
    - `trim.trigger`（count/token）
    - `trim.tokenLimit`
    - `trim.countLimit`
    - `trim.keepRecent`
  - 保持与 `normalizeEngramConfig()` 一致：输入值走统一归一化与边界约束。

- **用户价值**
  - 向量召回、重排、裁剪关键参数均可在设置页直接调试与验证。
  - 避免手工改本地配置，降低 hybrid 调优成本。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/components/engram/EngramSettingsSection.vue`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.80] - 2026-02-16

### Engram 迁移：Phase 6（调试可见性 + Provider 适配增强）

- **Hybrid 检索调试可见性**
  - `AIBidirectionalSystem.ts`：
    - 在 `engram.debug=true` 时输出 `unifiedRetrieve.stats` 日志。
    - Prompt Assembly 记录新增 `engramHybridStats` 数据模组，便于在面板里审计召回数量、向量命中、重排启用等信息。

- **Embedding Provider 适配增强**
  - `embeddingService.ts`：
    - 从“统一 OpenAI 兼容”扩展为 provider 分支：
      - `ollama` -> `/api/embeddings`
      - `cohere` -> `/v1/embed`
      - 其余 provider 继续使用 `/v1/embeddings`
    - `ollama` 支持无 API Key 场景。
    - 失败仍自动回退本地 pseudo embedding，保持链路稳定。

- **兼容与稳定性**
  - legacy 流程不受影响。
  - 调试能力仅在 `engram.debug` 启用时增加可见内容，不改变主业务逻辑。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/services/engram/embeddingService.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.79] - 2026-02-16

### Engram 迁移：Phase 5（关系边抽取 + 图谱关系检索）

- **关系边数据结构**
  - `game.d.ts` 新增 `MingEntityRelation`。
  - `MingEngramMemory` 扩展 `relations: MingEntityRelation[]`，补齐实体间关系边存储。
  - `memoryRepository.ts` 扩展归一化与读写：
    - `createEmptyEngramMemory` 默认包含 `relations`。
    - 新增 `upsertEngramRelations()`。

- **关系边写路径**
  - 新增 `src/services/engram/relationBuilder.ts`：
    - 从事件 `role/location/event` 抽取关系边（如 `co_occurs_with`、`appears_at`、`involved_in`）。
    - 融合 `社交.关系` 的玩家关系为补充边。
  - `AIBidirectionalSystem.processGmResponse()`：
    - 在事件/实体写入后执行关系抽取并 upsert 到 `engramMemory.relations`。

- **关系边读路径**
  - `unifiedRetriever.ts` 新增 relation candidates：
    - 消费 `engramMemory.relations` 生成图谱关系检索行并参与统一打分排序。
    - 与实体候选、派生图谱候选一起形成更完整的 graph 语境块。

- **兼容校验**
  - `saveValidationV3.ts` 增加 `engramMemory.relations` 结构 warning 检查。
  - legacy/hybrid 门控保持不变。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/types/game.d.ts`
- `src/services/engram/types.ts`
- `src/services/engram/memoryRepository.ts`
- `src/services/engram/relationBuilder.ts`（新增）
- `src/services/engram/unifiedRetriever.ts`
- `src/services/engram/index.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `src/utils/saveValidationV3.ts`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.78] - 2026-02-16

### Engram 迁移：Phase 4（实体向量化 + 图谱语义召回）

- **实体向量写入**
  - `vectorRepository.ts` 新增 `mergeEntityVectors()`，支持 `entityVectors` 增量写入。
  - `AIBidirectionalSystem.processGmResponse()`：
    - 向量化阶段由“仅事件”升级为“事件 + 实体”联合写入。
    - 写入后回填 `engramMemory.entities[].is_embedded`。
    - 同步记录 `vectorizedEntities` 统计变更。

- **检索阶段升级**
  - `unifiedRetriever.ts`：
    - 向量召回不再仅针对 `EventNode`，新增 `EntityNode` 向量语义匹配。
    - `topK/minScore` 在实体侧同样生效（实体侧使用缩放窗口）。
    - 最终排序支持“事件分 + 实体分”各自融合，提升语义命中稳定性。

- **兼容与稳定性**
  - 仍为 hybrid 有效、legacy 不变。
  - 向量服务不可用时保持 graceful fallback。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/services/engram/vectorRepository.ts`
- `src/services/engram/unifiedRetriever.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.77] - 2026-02-16

### Engram 迁移：Phase 3（实体图谱回填 + Trim 策略）

- **写路径补齐实体回填**
  - 新增 `src/services/engram/entityBuilder.ts`：
    - 基于新写入事件（`structured_kv.role/location/event`）与当前存档关系网，构建 `MingEntityNode`。
    - 输出 `char/loc/concept` 实体并携带基础 profile（来源、关系、位置等）。
  - `AIBidirectionalSystem.processGmResponse()`：
    - 在追加 `EventNode` 后执行实体提取并 `upsert` 到 `engramMemory.entities`。

- **Trim 策略执行**
  - `memoryRepository.ts` 新增 `trimEngramMemory()`：
    - 按 `engram.trim` 执行事件裁剪（`trigger=count|token`）。
    - 始终保留 `keepRecent` 最新事件，再在预算内保留较新的历史事件。
    - 裁剪发生时更新 `meta.last_trimmed_at`。
  - 主写路径接入该策略，避免 `engramMemory.events` 无界增长。

- **读路径图谱增强**
  - `unifiedRetriever.ts` 新增 `engramMemory.entities` 候选构建，并并入图谱候选排序。
  - 在 hybrid 模式下，检索上下文可直接消费 Engram 实体节点，而不仅依赖社交关系派生图。

- **兼容与稳定性**
  - 所有新增逻辑仍受 `engram` 配置控制，失败路径保留非阻塞回退。
  - `legacy` 流程保持不变。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/services/engram/entityBuilder.ts`（新增）
- `src/services/engram/memoryRepository.ts`
- `src/services/engram/unifiedRetriever.ts`
- `src/services/engram/index.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.76] - 2026-02-16

### Engram 迁移：Phase 2（向量索引 + 分数融合 + 可选 rerank）

- **Embedding 与向量索引（读写打通）**
  - 新增 `src/services/engram/embeddingService.ts`：
    - 统一 embedding 调用入口（OpenAI 兼容 `/v1/embeddings`）。
    - 支持从 API 管理读取 `embedding` 专用 API 分配，失败时回退本地 deterministic pseudo embedding，避免主流程中断。
  - `AIBidirectionalSystem.processGmResponse()`：
    - 事件写入 `engramMemory.events` 后，在 hybrid + embedding 启用时为新事件生成向量并写入独立向量仓储。
  - `vectorRepository.ts` 新增 `mergeEventVectors()`，用于增量合并事件向量并保持 `model/dim` 元数据。

- **Hybrid 检索升级（score fusion）**
  - `unifiedRetriever.ts` 增加向量读路径：
    - 读取 `engram_vectors_{characterId}_{slotId}`。
    - 对 `EventNode` 执行 query-vector 相似度召回，应用 `topK/minScore`，与关键词/时效/上下文分进行融合排序。
  - 支持可选 rerank：
    - 新增 `src/services/engram/rerankService.ts`，可调用外部 rerank endpoint。
    - rerank 可用时对候选分做二次融合；失败自动回退基础融合分。

- **接口与设置联动（API 管理）**
  - `apiManagementStore.ts` 新增 `APIUsageType='embedding'`，并加入默认 API 分配与模式配置。
  - `APIManagementPanel.vue` 新增 `Embedding向量化` 功能项，可单独分配 API；该项不显示 Raw/标准模式切换（固定向量用途）。

- **主流程兼容性**
  - `legacy` 模式不变，`hybrid` 才启用向量检索增强。
  - 所有向量/重排异常均为非阻塞告警，不影响回合推进。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/services/engram/embeddingService.ts`（新增）
- `src/services/engram/rerankService.ts`（新增）
- `src/services/engram/vectorRepository.ts`
- `src/services/engram/unifiedRetriever.ts`
- `src/services/engram/index.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `src/stores/apiManagementStore.ts`
- `src/components/dashboard/APIManagementPanel.vue`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.75] - 2026-02-16

### Engram 迁移：Phase 1（可运行读写链路）

- **写路径（EventNode 落盘）**
  - 新增 `src/services/engram/eventBuilder.ts`：
    - 从 `GM_Response` 构建 `MingEventNode`。
    - 采用轻量 burn 逻辑（`structured_kv -> summary`）生成检索友好文本。
  - `AIBidirectionalSystem.processGmResponse()`：
    - 在主流程不阻塞的前提下追加事件到 `系统.扩展.engramMemory.events`。
    - 写入失败仅告警，不影响主回合命令执行。

- **读路径（hybrid 替代检索入口）**
  - 新增 `src/services/engram/unifiedRetriever.ts`：
    - 聚合四类候选：`events`、`triples`、`graph`、`rules`。
    - 统一打分排序并输出单一检索块（Phase 1 为非向量基线）。
  - 新增 `src/services/engram/injectionFormatter.ts`：
    - 负责去重、token/行数预算裁剪、分区格式化输出。
  - `AIBidirectionalSystem.processPlayerAction()`：
    - `legacy` 模式：保持 `memoryRetrieve()`。
    - `hybrid` 模式：改走 `unifiedRetrieve()`（检索入口被替代，不再双链路并列拼接）。
    - 新增 `retrievalMode` 调试透出到提示词组装 data module。

- **分步生成同步增强**
  - `splitGeneration` 第1步与第2步都接入统一检索块注入，避免仅单步模式生效导致行为差异。

- **配置读取**
  - `src/services/engram/config.ts` 增加 `loadEngramConfigFromStorage()`，统一从 `dad_game_settings.engram` 读取并归一化。

- **验证**
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。
  - 默认 `engram.enabled=false`，legacy 流程保持不变。

#### 涉及文件

- `src/utils/AIBidirectionalSystem.ts`
- `src/services/engram/eventBuilder.ts`（新增）
- `src/services/engram/unifiedRetriever.ts`（新增）
- `src/services/engram/injectionFormatter.ts`（新增）
- `src/services/engram/config.ts`
- `src/services/engram/index.ts`
- `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.74] - 2026-02-16

### Engram 迁移：Phase 0（基础设施落地）

- **类型层（非破坏扩展）**
  - `game.d.ts` 新增：
    - `MingEngramConfig`（`retrievalMode: 'legacy' | 'hybrid'`）
    - `MingEventNode` / `MingEntityNode` / `MingEngramMeta` / `MingEngramMemory`
  - `SystemConfig` 新增可选字段：`engram?: MingEngramConfig`。
  - `saveSchemaV3.ts` 新增 `系统.扩展.engramMemory?: MingEngramMemory` 类型声明（可选）。

- **服务骨架（src/services/engram）**
  - `types.ts`：导出 Engram 核心类型 + `EngramVectorStore`。
  - `config.ts`：`DEFAULT_ENGRAM_CONFIG` 与 `normalizeEngramConfig()`（历史设置归一化）。
  - `memoryRepository.ts`：`createEmptyEngramMemory`、`ensureEngramMemory`、读写/append/upsert/patch helpers。
  - `vectorRepository.ts`：向量独立存储 key 规则与读写（`engram_vectors_{charId}_{slotId}`）。
  - `index.ts`：统一导出。

- **存档链路打通**
  - `gameStateStore.ts`
    - state 新增 `engramMemory`。
    - `loadFromSaveData` 读取 `系统.扩展.engramMemory` 并归一化。
    - `toSaveData` 回写 `系统.扩展.engramMemory`（缺失时写入空结构）。
    - `resetState` 清空 `engramMemory`。
  - `saveMigration.ts`
    - V3 归一化路径补齐 `engramMemory` 默认结构。
    - 旧档迁移路径保留并规范 `系统.扩展.engramMemory`。
  - `dataRepair.ts`
    - 修复流程确保 `系统.扩展.engramMemory` 存在且结构合法。
    - 最小 V3 存档模板包含 `engramMemory`。
  - `saveValidationV3.ts`
    - `engramMemory` 若存在则校验结构（非法报错；弱结构给 warning）。

- **设置 UI（SettingsPanel）**
  - 新增组件：`src/components/engram/EngramSettingsSection.vue`。
  - `SettingsPanel.vue` 集成该区块，支持配置：
    - enable
    - retrievalMode（legacy/hybrid）
    - embedding enabled/provider/model/topK/minScore
    - debug
  - 配置落盘到 `dad_game_settings.engram`，并在加载/重置/验证时统一归一化。

- **兼容与回归**
  - legacy 保持默认：`enabled=false`、`retrievalMode='legacy'`。
  - `npm run type-check` 通过。
  - IDE lints 无新增错误。

#### 涉及文件

- `src/types/game.d.ts`
- `src/types/saveSchemaV3.ts`
- `src/stores/gameStateStore.ts`
- `src/utils/saveMigration.ts`
- `src/utils/dataRepair.ts`
- `src/utils/saveValidationV3.ts`
- `src/components/dashboard/SettingsPanel.vue`
- `src/components/engram/EngramSettingsSection.vue`（新增）
- `src/services/engram/types.ts`（新增）
- `src/services/engram/config.ts`（新增）
- `src/services/engram/memoryRepository.ts`（新增）
- `src/services/engram/vectorRepository.ts`（新增）
- `src/services/engram/index.ts`（新增）

---

## [0.2.73] - 2026-02-15

### API 超时与中期记忆消费格式

- **API 超时**
  - 导出 `API_TIMEOUT_MS`（默认 5 分钟），主回合及自定义 API 统一使用。
  - 流式请求使用 `getAbortSignalWithTimeout()`，超时后中止 fetch，避免仅依赖服务端/反向代理超时。
  - 504 错误时向用户提示：约 1 分钟多为代理/服务端超时，本端 5 分钟；建议调大 proxy_read_timeout 等。

- **中期记忆消费保留相关角色与事件时间**
  - `memoryHelpers` 新增 `formatMidTermEntryForPrompt(entry)`：对象条目输出「【相关角色: …】【事件时间: …】记忆主体」单行，字符串条目原样返回。
  - 主流程 state JSON（buildNarrativeState）、中期精炼（triggerMidTermRefine）、长期总结（triggerMemorySummary）均改为使用该格式，使相关角色与事件时间参与所有 API 调用。

#### 涉及文件

- `src/services/aiService.ts`
- `src/utils/memoryHelpers.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.70] - 2026-02-15

### 记忆中心：配置 UI 与测试按钮

- **记忆系统配置界面**
  - **分组**：设置按「短期记忆」「中期精炼」「长期总结」「自定义格式」「手动操作」分块，仅用统一间距区分、取消分割线。
  - **子区块**：「总结后保留中期数量」为 -1 时显示的「不删减时参与总结的条数」改为独立子区块（标题「当保留数量为 -1 时」、浅色背景），层级更清晰。
  - **手动操作区**：统一上下左右 padding，与整体间距一致。
  - **短期转化**：面板内短期→中期转化逻辑改为使用配置的 `shortTermLimit`（与「默认: 5」一致），不再使用写死的常量。

- **测试按钮与 Tab 同步**
  - **问题**：点击「测试」添加中期记忆后，「全部」tab 计数增加但「中期」tab 不增加。
  - **修复**：保存到 store 后调用 `loadMemoryData()` 从 store 重新加载，保证「全部」「中期」等 tab 计数与 `gameStateStore.memory` 一致；写入 `中期记忆` 时使用新数组引用以触发响应式更新。

- **i18n**：新增「中期精炼」「长期总结」「精炼/总结触发阈值」「总结后保留中期数量」「当保留数量为 -1 时」「手动操作」等文案及英文翻译。

#### 涉及文件

- `src/components/dashboard/MemoryCenterPanel.vue`
- `src/i18n/index.ts`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.72] - 2026-02-15

### 语义记忆与提示词组装

- **语义记忆：按关联 NPC 与重要程度发送**
  - **关联 NPC**：主回合构造 `recentNpcNames` 时，对每个重点 NPC 同时加入 `社交.关系` 的 **key** 与 **名字**，保证与 triple 的 subject/object 匹配；`querySemanticTriples` 新增 `relatedOnly`（默认 true），仅保留 subject/object 在玩家或关联 NPC 中的 triple，再按 importance × recency 排序取 top N。
  - **文档**：`docs/semantic-memory-retrieval-check.md` 记录 consumer（主回合 GM 的 system 消息）、发送时机、分步模式下当前不注入语义的说明。

- **提示词组装：数据模组与短期记忆可见**
  - **Store**：`AssemblySnapshot` 新增可选 `dataModules`，用于记录注入的「数据模组」。
  - **主回合记录**：调试模式下记录 `coreStatusSummary`、`semanticAndEntities`（语义记忆与实体索引）、`stateJson`（游戏状态 JSON，含中期/长期记忆）、联机时的 `travelStatus`；并设置 `memoryContent` 为本次发送的短期记忆（assistant）内容。
  - **面板**：提示词组装页展示「本步骤注入的数据模组」列表（key、构成、生成原因、content），步骤摘要显示「X 个提示词模组 + Y 个数据模组」，便于核对是否发送了游戏记忆与语义数据。

#### 涉及文件

- `src/utils/AIBidirectionalSystem.ts`
- `src/services/memoryRetrievalService.ts`
- `src/stores/promptAssemblyStore.ts`
- `src/components/dashboard/PromptAssemblyPanel.vue`
- `docs/semantic-memory-retrieval-check.md`（新增）
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.71] - 2026-02-15

### 中期记忆逻辑修订（设计实现）

- **数据模型与迁移**
  - **类型**（`game.d.ts`）：`ImplicitMidTermEntry`（相关角色、事件时间、记忆主体）、`MidTermEntry`（string | 带 记忆主体/已精炼 的对象）、`Memory` 中 `隐式中期记忆` 为对象数组。
  - **迁移**（`saveMigration.ts`）：`normalizeMemory` 使用 `coerceImplicitMidTermArray`、`coerceMidTermArray`，旧存档的 string[] 隐式中期/中期自动转为新结构。

- **主回合发给 AI 的内容**
  - 仅发送 **短期记忆** + **中期记忆**（经 `getMidTermContent` 取字符串）+ **长期记忆**；**隐式中期记忆**不再单独成块送入，避免与短期重复。

- **中期存储与精炼**
  - Step2 / init step2 的 prompt 要求 `mid_term_memory` 为对象 `{ 相关角色, 事件时间, 记忆主体 }`；`processGmResponse` 将该对象写入隐式中期记忆，短期溢出时一条转入中期（`已精炼: false`）。
  - **精炼**：中期条数 ≥ `midTermRefineTrigger`（默认 25）时调用 `triggerMidTermRefine()`，用精炼 API 结果整体替换中期记忆并标 `已精炼: true`。
  - **长期总结**：中期条数 ≥ `longTermTrigger`（默认 50）时调用 `triggerMemorySummary()`；`midTermKeep === -1` 时不删减，取最旧 `longTermSummarizeCount` 条生成 1 条长期；主回合内精炼与长期总结二选一触发。

- **辅助与消费**
  - **memoryHelpers.ts**：`getMidTermContent`、`normalizeImplicitMidTermForConsumption` 等，供主回合与总结使用。
  - **gameStateStore**：`addToShortTermMemory` 写入隐式中期格式，溢出时推入中期；加载存档时对中期/隐式中期做 coerce。
  - **worldHeartbeatService**：当前会话从隐式中期记忆读取，支持对象格式。
  - **MainGamePanel**：记忆设置与记忆中心配置同步（短期上限、阈值等）。

#### 涉及文件

- `src/types/game.d.ts`、`src/types/AIGameMaster.d.ts`
- `src/utils/saveMigration.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `src/utils/memoryHelpers.ts`（新增）
- `src/utils/prompts/definitions/ming/inlinePromptsMing.ts`
- `src/stores/gameStateStore.ts`
- `src/services/worldHeartbeatService.ts`
- `src/components/dashboard/MainGamePanel.vue`
- `src/services/defaultPrompts.ts`
- `CHANGELOG.md` / `CHANGELOG_MING.md`

---

## [0.2.69] - 2026-02-14

### 回退：AIBidirectionalSystem 重构

- **Revert 说明**
  - **原因**：commit d960de6 将 `AIBidirectionalSystem` 拆分为 `src/systems/ai/` 多模块后，出现角色创建时「位置信息在处理过程中丢失」、主回合后回合序号与状态不更新、提示词组装回退旧版等问题，影响面大。
  - **操作**：完整回退 d960de6，恢复 `src/utils/AIBidirectionalSystem.ts` 单文件实现（含 processGmResponse、回合推进、提示词组装等完整逻辑），删除 `src/systems/ai/*` 共 8 个模块文件。
  - **兼容**：0.2.66（Body Parts / Agent 工作流）、0.2.67（位置下拉）、0.2.68（地图去重）未依赖被回退模块，功能保持不变。
  - **附带**：`worldHeartbeatPromptsMing.ts` 中 `npc.记忆总结` 类型断言修正，保证 type-check 通过。

#### 涉及文件

- `src/utils/AIBidirectionalSystem.ts`（恢复）
- `src/systems/ai/*`（删除）
- `CHANGELOG.md` / `CHANGELOG_MING.md`
- `src/utils/prompts/tasks/worldHeartbeatPromptsMing.ts`（类型修正）

---

## [0.2.68] - 2026-02-14

### 地图系统：修复地点重复显示

- **Map Duplication Fix**
  - **Issue**: 地图数据中存在冗余定义（既作为 nested child 又作为 flat entry），导致 `collectFromTree` 收集时重复添加同名节点。
  - **Fix**: 在 `src/utils/locationMapUtils.ts` 中增强 deduplication 逻辑。当处理 flat entry（来自 `上级`）时，若检测到该节点路径 implies 它是已存在的 nested child 的后代，则自动跳过，防止重复。
  - **Verification**: 通过 reproduction script 验证，确认 duplicate node 已被正确滤除。

#### 涉及文件

- `src/utils/locationMapUtils.ts`

## [0.2.67] - 2026-02-14

### UI 优化：位置选择控件

- **位置编辑优化 (Location Dropdown)**
  - **功能**: 在人物基本信息编辑中，将位置输入框改为 **下拉选择 + 手动输入** 双模式。
  - **交互**: 默认显示 `<select>` 下拉框，列出所有已知的世界地点；点击切换按钮可切换为文本输入框，允许输入自定义地点。
  - **自动判定**: 若当前位置不在已知列表中，自动切换为文本输入模式。
  - **样式**: 统一使用 Lucide 图标（List/Type）与 Glassmorphism 风格。

#### 涉及文件

- `src/components/dashboard/RelationshipNetworkPanel.vue`

---

## [0.2.66] - 2026-02-14

### NPC 编辑增强与 Agent 工作流升级

- **NPC 身体部位编辑 (Body Parts Editing)**
  - **功能**: 在 NSFW Tab 新增身体部位管理功能，支持添加、编辑、删除部位。
  - **UI**: 采用全新的 **Glassmorphism (通过 Teleport 挂载)** 模态窗设计，包含毛玻璃背景、发光输入框与平滑动画。
  - **交互**: 提供部位名称、特征描述、特殊印记、敏感度/开发度（0-100）的完整编辑能力。

- **私密信息概览编辑 (Private Info Inline Editing)**
  - **功能**: 私密信息概览区域（如性取向、处女状态、性格倾向等）支持 **行内点击编辑**。
  - **交互**: 布尔值字段点击切换，文本/数值字段点击弹出输入框，支持快捷保存/取消。

- **Agent 工作流升级**
  - **Workflow**: 重写 `.agent/workflows/plan.md`，强制执行「深度分析 -> 结构化拆解 -> 分阶段实施」的开发流程。
  - **规范**: 明确要求在编码前进行详细的需求与代码库分析，并记录设计失败教训（`mistakes_and_prevention.md`）。

- **其他修复与优化**
  - **Location Utils**: 增强 `ensureLocationExists` 逻辑，确保层级地点数据的完整性。
  - **Heartbeat**: 优化世界心跳与 NPC 位置同步逻辑。
  - **HTML 结构**: 修复 `RelationshipNetworkPanel.vue` 中丢失的闭合标签问题。

#### 涉及文件

- `src/components/dashboard/RelationshipNetworkPanel.vue`
- `src/style.css` (Glassmorphism styles)
- `.agent/workflows/plan.md`
- `mistakes_and_prevention.md`
- `task.md`

---

## [0.2.64] - 2026-02-13

### 开发框架：Agentic Framework & 私有仓库

- **Agentic Framework（`.agent/`）**
  - **Rules**：建立 `domain-rules`、`coding-standards`、`project-structure`、`tech-stack` 规则文件，标准化 AI 辅助开发上下文。
  - **Workflows**：创建可复用工作流：`test`、`commit`、`review`、`refactor`、`debug`、`plan`。
  - **Game Testing Workflows**：
    - `setup-new-game.md`：新游戏环境初始化（API → 导入设置 → 预设 → 世界生成）。
    - `setup-load-game.md`：加载已有存档（API → 导入存档 → 设置）。
    - `game-round.md`：执行并验证一轮游戏生成周期。
  - **Manual Import Rule**：明确标注文件导入需用户手动操作，数据丢失时立即请求用户协助。

- **私有仓库分离**
  - **Structure**：将 `.agent/`、`.cursor/`、`docs/`、`testing_gamedata/` 移至 `private/` 目录。
  - **Git**：`private/` 作为独立 Git 仓库，推送至 `michael2221807/ming_private`。
  - **Junctions**：通过 Windows Directory Junctions 链接回项目根目录，工具无感知。
  - **`.gitignore`**：主仓库忽略 `private/`、`.agent/`、`.cursor/`、`docs/`、`testing_gamedata/`。
  - **Setup Script**：`private/setup_private_env.bat` 支持新机器一键恢复链接。
  - **Bootstrap**：`SETUP.md` 提供新环境完整搭建指南。

- **Browser Debugging**
  - **Port**：确认开发服务器端口 `9091`。
  - **Workflow**：`debug.md` 包含浏览器连接与 `HOME` 环境变量配置说明。

---

## [0.2.63] - 2026-02-12

### NPC 优化：降级逻辑与生成配置

- **NPC 自动降级（Maintenance）**
  - **Logic**：每回合结束时（独立于世界心跳）执行 `runNpcMaintenance`，检测并不在「实时关注」列表的重点 NPC。
  - **Rule**：若重点 NPC 活跃时间超过 `npcDemotionThreshold`（默认 5 回合）未更新，自动降级为普通 NPC，减少 prompt token 消耗。
  - **Independence**：降级逻辑不再依赖世界心跳开启，确保长期运行的游戏性能。

- **Prompt 优化：按需过滤**
  - **Filter**：构建 Prompt 时，非当前位置且非「实时关注」的普通 NPC 将被剔除，不再发送给 AI。
  - **Effect**：大幅降低上下文 Token 占用，同时保留重点 NPC 与玩家当前位置 NPC 的互动能力。

- **配置增强（UI & Config）**
  - **Settings**：设置面板新增「NPC 设置」区块。
  - **Features**：
    - `NPC 降级阈值`：配置重点 NPC 转普通的非活跃回合数（1-999）。
    - `新地点重点NPC生成数量`：配置到达新地点时生成的重点 NPC 数量范围（Min-Max）。
  - **Relationship Panel**：关系网络列表默认过滤掉普通 NPC，仅显示重点 NPC 与「实时关注」的 NPC；普通 NPC 需勾选显示才可见。

- **Prompt 优化：剔除心跳历史**
  - **Removal**：从 Prompt Payload 中彻底移除 `世界.状态.心跳` 对象。
  - **Effect**：消除因心跳历史快照堆积导致的 Prompt 膨胀问题，显著提升长线游戏 Token 效率。

#### 涉及文件

- `src/utils/AIBidirectionalSystem.ts`
- `src/services/worldHeartbeatService.ts`
- `src/components/dashboard/SettingsPanel.vue`
- `src/components/dashboard/RelationshipNetworkPanel.vue`
- `src/utils/prompts/tasks/locationNpcGenerationPromptsMing.ts`
- `src/types/game.d.ts`

---

## [0.2.62] - 2026-02-12

### 强制酒馆模式与 NSFW 逻辑解耦

- **强制酒馆模式 (Force Tavern Mode)**
  - **Feature**：在「设置 -> 游戏设置」中新增「强制酒馆模式」开关（默认开启），允许在非酒馆环境下强制启用酒馆相关逻辑（如特殊NPC随机事件）。
  - **Logic**：`isTavernEnv` 判断逻辑更新为：`真实酒馆环境 || 强制酒馆模式开启`。
- **NSFW 逻辑解耦**
  - **Refactor**：NSFW 内容生成不再依赖 `isTavernEnv`，改为完全由「NSFW 模式」开关控制。
  - **Effect**：即使在非酒馆模式下，只要开启 NSFW 模式，Prompt 组装时也会包含 NSFW 相关规则与数据定义。

#### 涉及文件

- `src/components/dashboard/SettingsPanel.vue`
- `src/utils/tavern.ts`
- `src/utils/prompts/promptAssembler.ts`

---

## [0.2.61] - 2026-02-12

### 辅助功能清理与向量记忆模块移除

- **Vector Memory (Embedding) 移除**
  - **原因**：底层服务 `vectorMemoryService.ts` 缺失，导致相关功能不可用且引发报错。
  - **变更**：
    - 移除 `MemoryCenterPanel.vue` 中的「向量记忆」标签页及相关逻辑。
    - 移除 `APIManagementPanel.vue` 中的「Embedding」配置项及 `vectorMemoryService` Mock 对象。
    - 移除 `apiManagementStore.ts` 中的 `embedding` API 类型。
- **辅助功能代码清理**
  - **World Generation**：确认功能正常，移除重复的配置项。
  - **Sect Generation**：确认已废弃，移除相关注释代码。
  - **Refactor**：优化 `apiManagementStore.ts` 与 `APIManagementPanel.vue` 代码结构，移除冗余的 `world_generation` 定义。

#### 涉及文件

- `src/components/dashboard/MemoryCenterPanel.vue`
- `src/components/dashboard/APIManagementPanel.vue`
- `src/stores/apiManagementStore.ts`
- `src/services/vectorMemoryService.ts` (Reference only, file was missing)

---

## [0.2.60] - 2026-02-12

### API 配置优化：独立配置与重试机制

- **独立 API 配置与开关**
  - **功能开关**：API 管理面板新增「世界心跳」与「新地点NPC生成」开关；「世界心跳」开关状态与系统设置（gameState）同步。
  - **独立模型**：可在 API 管理面板为心跳、NPC 生成等功能指定独立的 API 连接配置（模型/地址/Key）。
  - **逻辑控制**：`AIBidirectionalSystem` 在调用 NPC 生成前检查开关状态，关闭时跳过生成。

- **重试机制增强**
  - **生效修复**：修复 API 重试次数设置在 Web/酒馆模式下未正确应用的问题（原固定为 2 次，现读取配置）。
  - **快速失败（Quick-Fail）**：新增保护逻辑，若 API 请求在 600ms 内失败（通常为本地配置错误或连接被拒），则跳过重试，避免无效循环与日志刷屏。

- **URL 路径自动清理**
  - **v1 重复修复**：修复自定义 API 地址（如 `.../v1`）与自动拼接路径组合时产生 `/v1/v1/...` 的问题；现自动移除配置 URL 末尾的 `/v1` 或 `/`。

#### 涉及文件

- `src/components/dashboard/APIManagementPanel.vue`
- `src/stores/apiManagementStore.ts`
- `src/services/aiService.ts`
- `src/utils/AIBidirectionalSystem.ts`

---

## [0.2.59] - 2026-02-12

### UI：顶部栏增加回合数显示

- **UI**：在顶部信息栏（TopBar）时间旁增加「回合: X」显示，与 `gameStateStore.roundNumber` 同步。
- **Style**：适配移动端与桌面端样式，保持与现有信息栏一致的视觉风格。

#### 涉及文件

- `src/components/dashboard/TopBar.vue`

## [0.2.58] - 2026-02-11

### 回溯功能：对话/状态统一回滚

- **Feature**：`rollbackToLastConversation` 返回回滚差异（Round/Heartbeat/Narrative diffs），UI 显示详细 Toast。
- **Fix**：`canRollback` 检查 Slot 存在而非仅内存数据，支持 IndexedDB 此时不在内存中的场景（Lazy Load）。
- **Undo Sync**：回滚后 `enhancedActionQueue.clearUndoHistory()` 清除 localStorage 中的 `gm_undo_actions` 及内存 ActionQueue，防止 stale undo actions。
- **Coverage**：确认 `toSaveData()` 已覆盖所有 Design Spec Items（Heartbeat/NPC/Round/SentMsg/Map/Events），无需额外补丁。

#### 涉及文件

- `src/stores/characterStore.ts`
- `src/components/dashboard/MainGamePanel.vue`
- `src/utils/enhancedActionQueue.ts` (Referenced)

## [0.2.57] - 2026-02-11

### 视频背景：Gemini Veo 生成资源

- **背景视频**：封面视频背景由 `ming_background_horizontal.mp4` 更换为 `ming_background_video.mp4`；该视频由 Gemini Veo 生成。
- **组件更新**：`VideoBackground.vue` 默认 `src` 更新为 `./ming_background_video.mp4`。
- **样式 adjustments**：移除 `.video-background video` 的 `min-width/min-height: 100%`，改用 `width: 100%; height: 100%; object-fit: cover;` 确保填充且不溢出；z-index 设为 -1。

#### 涉及文件

- `src/components/common/VideoBackground.vue`

---

## [0.2.56] - 2026-02-08

### 世界心跳：触发与手动执行修复

- **loadFromSaveData（根本原因）**：从存档/IndexedDB 加载时，心跳 `启用` 不再因「非 boolean」被置为 false；改为按 truthy 解析（`true` / `"true"` / `1` 视为启用），避免加载后周期心跳从不触发。
- **dataRepair**：当 `世界.状态` 被替换为 `{}` 时保留原 `心跳` 配置并合并默认值；`启用` 非 boolean 时按 truthy 规范为布尔。
- **周期判定**：AIBidirectionalSystem 中心跳触发条件按 truthy 判断 `启用`，并增加诊断日志（`启用类型`、原因），便于排查。
- **npc.记忆总结 类型安全**：worldHeartbeatPromptsMing 中 `npc.记忆总结` 可能为字符串或非数组，直接 `.slice().join()` 会报错导致心跳（含手动触发）失败；现统一规范为数组再拼接，手动/周期/事件触发可正常执行。

#### 涉及文件

- `src/stores/gameStateStore.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `src/utils/dataRepair.ts`
- `src/utils/prompts/tasks/worldHeartbeatPromptsMing.ts`

---

## [0.2.55] - 2026-02-08

### 角色创建与预设：特质文案统一

- **预设名称占位**：PresetSaveModal 输入框 placeholder 由「剑修预设、治愈系预设等」改为「战斗向预设、辅助向预设等」。
- **预设导入文案**：CharacterCreation 加载预设时，界面与日志统一为「特质」（原「灵根」）；变量命名 `existingSpiritRoot`/`newSpiritRoot` 改为 `existingTrait`/`newTrait`；预设数据键名仍为 `spiritRoot` 以兼容旧预设文件。
- **presetManager**：CharacterPreset 中 `spiritRoot` 增加 JSDoc，注明界面称「特质」、键名保留兼容。

#### 涉及文件

- `src/components/common/PresetSaveModal.vue`
- `src/utils/presetManager.ts`
- `src/views/CharacterCreation.vue`
- `docs/design note`

---

## [0.2.54] - 2026-02-08

### 记忆中心：已发送信息

- **功能**：在记忆中心内新增「已发送信息」tab，仅记录玩家发送给 API 的原文（含行动趋向等完整 payload），支持按条复制；不参与任何 API prompt 生成，仅供玩家查阅。
- **存储**：gameStateStore 新增 `sentToApiMessages`（含 text、timestamp），读写存档路径为 `系统.扩展.已发送信息`；发送消息时在 MainGamePanel 中追加记录。
- **复制**：优先使用 Clipboard API，失败或不可用时使用 `document.execCommand('copy')` 兜底，减少非安全上下文下「复制失败」。
- **i18n**：新增 已发送信息、已发送信息说明、暂无已发送信息。

#### 涉及文件

- `src/stores/gameStateStore.ts`
- `src/components/dashboard/MainGamePanel.vue`
- `src/components/dashboard/MemoryCenterPanel.vue`
- `src/i18n/index.ts`

### NPC 私密档案 Prompt 修正

- **definitions/dataDefinitions.ts**：PrivacyProfile（4.5）补全「最近一次性行为时间: string」及逻辑一致性说明（是否为处女/处男 与 性交总次数、性伴侣名单）；性渴望程度注明 0-100。
- **definitions/businessRules.ts**：身体部位结构描述改为必含 部位名称/敏感度/开发度/特征描述，特殊印记为可选，避免 AI 误将可选字段当作必填。

#### 涉及文件

- `src/utils/prompts/definitions/dataDefinitions.ts`
- `src/utils/prompts/definitions/businessRules.ts`

---

## [0.2.53] - 2026-02-08

### 视频背景：更换为横版资源

- **背景视频**：全屏背景由 `ming_background_wide.mp4` 更换为 `ming_background_horizontal.mp4`；VideoBackground 组件默认 `src` 改为 `./ming_background_horizontal.mp4`。
- **资源**：移除 `public/ming_background_wide.mp4`，新增 `public/ming_background_horizontal.mp4`。

#### 涉及文件

- `src/components/common/VideoBackground.vue`
- `public/ming_background_wide.mp4`（删除）
- `public/ming_background_horizontal.mp4`（新增）

---

## [0.2.52] - 2026-02-08

### 背景视频资源与游戏版本 1.0.2

- **背景视频**：新增 `public/ming_background_wide.mp4`，供 VideoBackground 组件作为全屏背景使用。
- **游戏版本**：package.json `version` 由 `1.0.1` 升级为 `1.0.2`；构建时通过 APP_VERSION 注入，界面版本显示将同步为 1.0.2。

#### 涉及文件

- `package.json`
- `public/ming_background_wide.mp4`

---

## [0.2.51] - 2026-02-08

### 视频背景：消除黑边

- **问题**：VideoBackground 全屏视频背景在四周边框出现黑边。
- **修改**
  - 容器：使用 `100vw`/`100vh` 与 `min-width`/`min-height: 100%` 确保填满视口。
  - 视频：增加 `min-width`/`min-height: 100%`、`object-position: center`，并用 `transform: translate(-50%, -50%) scale(1.02)` 略微放大，在保持居中的前提下裁掉视频内嵌 letterbox 黑边。

#### 涉及文件

- `src/components/common/VideoBackground.vue`

---

## [0.2.50] - 2026-02-08

### 游戏版本 1.0.1

- package.json `version` 由 `1.0.0` 升级为 `1.0.1`；构建时通过 APP_VERSION 注入，界面版本显示将同步为 1.0.1。

#### 涉及文件

- `package.json`

---

## [0.2.49] - 2026-02-08

### 界面品牌、链接与地位显示

- **品牌与链接**
  - 游戏内顶栏标题：仙途 → 天命（中英文 i18n 天命/MING）；左下角 GitHub 图标链接改为 https://github.com/michael2221807/ming。
  - 赞助支持弹窗（LeftSidebar、App.vue）：移除支付宝/微信二维码，改为「GitHub Star」按钮（同仓库链接）；教程弹窗标题「仙途教程」→「天命教程」，底部 GitHub 链接改为本仓库。
  - i18n：新增 天命、GitHub Star。
- **地位显示（境界→地位）**
  - TopBar：玩家名旁徽章改为从 `attributes.地位` 格式化（formatStatus），无则「凡人」；补充 title 提示「地位」。
  - 续前世因缘（CharacterManagement）：getRealmName 改为基于 formatStatusDisplay(地位/境界)，单机/联机存档卡片均用 地位 ?? 境界。
  - RightSidebar、CharacterDetailsPanel：formatRealmDisplay 改为基于 formatStatusDisplay，NPC 关系用 地位 ?? 境界。
  - SavePanel：当前存档与列表项显示 地位 ?? 境界，标签「境界」→「地位」。

#### 涉及文件

- `src/App.vue`
- `src/components/character-creation/CharacterManagement.vue`
- `src/components/dashboard/CharacterDetailsPanel.vue`
- `src/components/dashboard/LeftSidebar.vue`
- `src/components/dashboard/RightSidebar.vue`
- `src/components/dashboard/SavePanel.vue`
- `src/components/dashboard/TopBar.vue`
- `src/i18n/index.ts`

---

## [0.2.48] - 2026-02-08

### README：Pages 触发条件更正

- 自动构建与部署表格中，GitHub Pages（pages.yml）的触发方式由「推送 v* tag 或 main 分支」改为仅「推送 v* tag」。

#### 涉及文件

- `README.md`

---

## [0.2.47] - 2026-02-08

### README：自动构建与部署小节重写

- **触发方式表格**：明确各工作流触发条件（推送 v\* tag 触发 release/docker/pages；推送 main 触发 pages；任意 push/PR 触发 ci，仅校验不部署）。
- **GitHub Pages 部署要点**：访问地址、Settings → Pages → Source 须选 GitHub Actions、environment protection rules 报错时的处理步骤。
- **手动运行**：说明可在 Actions 页手动运行 Deploy GitHub Pages 与 Docker Build and Push。

#### 涉及文件

- `README.md`

---

## [0.2.46] - 2026-02-08

### GitHub Pages：移除 index.html EJS，构建时注入 base 标签

- **问题**：若 Pages 从分支部署会直接提供源码 index.html，页面会显示未编译的 EJS 代码（如 `<% if (htmlWebpackPlugin.options.basePath) ... %>`）。
- **修改**
  - **index.html**：去掉 EJS，改为占位标签 `<base href="__BASE_PATH__" data-build-replace>`，源码为纯 HTML。
  - **webpack**：新增 BaseTagReplacePlugin，在 processAssets 阶段将占位替换为 `<base href="/ming/">`（当设置 BASE_PATH）或移除该标签；并移除 HtmlWebpackPlugin 的 basePath 模板参数。
  - **README**：说明 Pages 的 Source 须选择 **GitHub Actions**，由工作流构建并部署 dist，勿用分支静态文件。

#### 涉及文件

- `index.html`
- `webpack.config.js`
- `README.md`

---

## [0.2.45] - 2026-02-08

### gameStateStore：relationships 改为 const

- 存档加载时 `relationships` 仅赋值一次、不再修改，由 `let` 改为 `const`。

#### 涉及文件

- `src/stores/gameStateStore.ts`

---

## [0.2.44] - 2026-02-08

### 类型与数据结构对齐（type-check 修复）

- **命名与类型统一**
  - 境界 → 地位（SaveSlot、PlayerAttributes、NpcProfile 等）
  - 气血/灵气/神识 → 体力/精力/洞察力（PlayerStatus、NpcProfile 属性、存档角色.属性）
  - 后天六司 → 后天六维属性（CharacterBaseInfo）
  - 灵石 → 金钱（CurrencyFourTier）；灵根 → 特质（NpcProfile，SpiritRoot 结构）
- **涉及模块**
  - `specialNpcs.ts`：NpcProfile 使用 地位、特质、先天六维属性、属性（体力/精力/洞察力）、背包.金钱
  - `offlineInitialization.ts`：后天六维属性、角色.属性 使用 地位/体力/精力/洞察力/寿命
  - `worldHeartbeatService.ts`：心跳.历史 可能为 undefined，改为先写入局部数组再赋回
  - `characterCreationStore.ts`：云特质 map 参数类型 SpiritRoot（非 SpiritRootWithSource）
  - `characterStore.ts`：存档槽位与角色信息全部使用 地位、后天六维属性
  - `dataRepair.ts`：迁移旧 气血/灵气/神识 时通过 `(repaired.属性 as any)` 访问

#### 涉及文件

- `src/data/specialNpcs.ts`
- `src/services/offlineInitialization.ts`
- `src/services/worldHeartbeatService.ts`
- `src/stores/characterCreationStore.ts`
- `src/stores/characterStore.ts`
- `src/utils/dataRepair.ts`

---

## [0.2.43] - 2026-02-08

### GitHub Pages 部署修复与构建产物更名

- **GitHub Pages 空白页修复**
  - 构建时通过环境变量 `BASE_PATH`（如 `/ming/`）设置 Webpack `publicPath`，避免相对路径在无尾斜杠 URL 下解析错误导致脚本 404。
  - Pages 工作流中为 build 步骤设置 `BASE_PATH=/${{ github.event.repository.name }}/`；HTML 模板在存在 basePath 时注入 `<base href="...">`。
  - 新增 `dist/404.html` 作为 SPA 回退，子路径请求重定向到应用根路径。
  - README 快速开始中注明 Pages 访问地址为 `https://<username>.github.io/ming/`。
- **构建产物更名**
  - 生产环境打包主输出由 **XianTu.js** 更名为 **ming.js**。

#### 涉及文件

- `webpack.config.js`
- `index.html`
- `.github/workflows/pages.yml`
- `README.md`

---

## [0.2.42] - 2026-02-08

### README 致谢：仙途 / 千叶 credit

- README 文末（许可证之后）增加 **🙏 致谢** 小节：MING 基于 [仙途（XianTu）](https://github.com/qianye60/XianTu) 衍生开发，感谢 [千叶](https://github.com/qianye60) 大佬的原作与开源。

#### 涉及文件

- `README.md`

---

## [0.2.41] - 2026-02-08

### README 功能概览：突出 MING 与原版差异

- **定位句**：增加「MING 在原版基础上强化 NPC 与世界的互动，让角色、地点与时间更有机地联动」。
- **前置三大块**：**NPC 与关系**（NPC 重新设计、关系网络与当前位置、关系图可视化、地点-NPC 双向绑定）；**动态地图与探索**（层级动态生成、探索地图交互、色系与当前位置、探索状态与教程）；**世界心跳**（可配置周期、间歇更新 NPC 与世界、关系/在做事项/地点同步、记忆与遗忘）。
- **其余功能**：AI 动态叙事、通用叙事框架、智能判定、多存档、全平台与双主题、酒馆兼容保留并略作精简。

#### 涉及文件

- `README.md`

---

## [0.2.40] - 2026-02-08

### README：本地图片、天命/MING 内容、徽章占位

- **图片本地化**：封面与双主题截图由线上链接改为本地 **`public/天命-cover.jpg`**、**`public/天命-dark.png`**、**`public/天命-light.png`**，README 内引用 `./public/...`。
- **内容更新**：主标题改为「天命（MING）」；副标题与功能概览按通用版、特质/地位/六维/天命点、探索地图、亮色柔光半透明等与 changelog 一致；技术栈、快速开始（含封面视频 `ming_background.mp4`）、更新日志要点与贡献/许可证表述更新；移除原项目专属链接（QQ 群、游戏介绍、在线体验）。
- **徽章**：visitors、stars、forks 链接改为占位 **`your-username/ming`**（及 visitor 的 `page_id=your-username.ming`），README 内注明将 `your-username` 替换为本人 GitHub 用户名即可。

#### 涉及文件

- `README.md`
- `public/天命-cover.jpg`（新增）
- `public/天命-dark.png`（新增）
- `public/天命-light.png`（新增）

---

## [0.2.39] - 2026-02-08

### 亮色主题：柔光、边框可见、半透明透出视频

- **全局亮色 token（style.css :root）**
  - 降低亮度：`--color-background`、`--color-surface`、`--color-surface-light` 改为柔光色（#e8e6e1、#ebe9e4、#e2e0db），减轻刺眼。
  - 加强边框：`--color-border` 改为 `rgba(0,0,0,0.22)`，`--color-border-hover` 改为 0.35，便于区分面板与列表项。
- **创角流程亮色样式**
  - CharacterCreation、Step1～Step7、step-selection.css 中亮色块统一使用 `var(--color-surface)` / `var(--color-surface-light)` / `var(--color-border)`，列表项与按钮显式 `border: 1px solid var(--color-border)`，保证边框清晰。
- **亮色主区与暗色一致：半透明透出视频**
  - 创角页 `.creation-scroll` 亮色下改为 `var(--color-background-transparent)` + `backdrop-filter`，不再使用不透明底色。
  - 模式选择页 `.selection-content` 亮色下改为半透明渐变（柔光色 0.88/0.85）+ `backdrop-filter`，与暗色一致可透出封面视频。

#### 涉及文件

- `src/style.css`
- `src/views/CharacterCreation.vue`
- `src/views/ModeSelection.vue`
- `src/styles/step-selection.css`
- `src/components/character-creation/Step1_WorldSelection.vue`
- `src/components/character-creation/Step2_TalentTierSelection.vue`
- `src/components/character-creation/Step3_OriginSelection.vue`
- `src/components/character-creation/Step4_SpiritRootSelection.vue`
- `src/components/character-creation/Step5_TalentSelection.vue`
- `src/components/character-creation/Step6_AttributeAllocation.vue`
- `src/components/character-creation/Step7_Preview.vue`

---

## [0.2.38] - 2026-02-08

### 封面与模式选择：天命意象文案

- **封面标题**：主标题由「仙 途」改为 **「天 命」**（保留 `.header-title` 渐变与发光样式）；副标题由「闲时坐看涛生灭，千秋不过酒一壶」改为 **「命数自定，前路在握」**。
- **区块标题**：「择一道途」改为 **「择一天命」**。
- **模式选择**
  - 单机：标题「独自修行」→ **「独行己命」**，短描述 → **「一人一命 · 本地书写」**，详情 → **「独写命书，进度存于本地」**。
  - 联机：标题「联机共修」→ **「共书天命」**，短描述 → **「与友共书 · 同写命途」** / **「云端未启 · 暂不可入」**，详情 → **「云端存档，多端同步，与友人共写天命」**。
- **按钮与提示**：主按钮「初入仙途」→ **「开启天命」**，次按钮「续前世因缘」→ **「续写前缘」**；联机未启用/登录弹窗文案改为天命相关表述。
- i18n 新增上述键及英文翻译；ModeSelection 引入 `useI18n` 用于弹窗文案。

#### 涉及文件

- `src/views/ModeSelection.vue`
- `src/i18n/index.ts`

---

## [0.2.37] - 2026-02-08

### 封面背景：默认视频文件名改为 ming_background.mp4

- 封面视频默认文件由 **`public/background.mp4`** 改为 **`public/ming_background.mp4`**；`VideoBackground.vue` 默认 `src` 与 `public/README.md` 说明已同步更新。

#### 涉及文件

- `public/README.md`
- `src/components/common/VideoBackground.vue`
- `public/background.mp4`（删除）
- `public/ming_background.mp4`（新增）

---

## [0.2.36] - 2026-02-08

### 封面背景改为本地资源

- **素材位置**：将封面背景视频放在项目根目录 **`public/background.mp4`**，创角页、模式选择页等处的 VideoBackground 将使用该本地文件（不再依赖第三方链接）。
- **构建与开发**
  - 新增 **`public/`** 目录，内含 README 说明与 `.gitkeep`；生产构建通过 **copy-webpack-plugin** 将 `public/` 复制到 `dist/`；开发时 devServer 增加对 `public/` 的 static 配置，使 `./background.mp4` 可访问。
- **组件**：`VideoBackground.vue` 默认 `src` 由 `https://ddct.top/backgroundvedio.mp4` 改为 **`./background.mp4`**；若需自定义仍可传入 `src` 覆盖。

#### 涉及文件

- `public/`（新建，含 README.md、.gitkeep）
- `webpack.config.js`
- `package.json`（devDependencies 增加 copy-webpack-plugin）
- `src/components/common/VideoBackground.vue`

---

## [0.2.35] - 2026-02-08

### 创角：天命点用语、剩余点数显示、七步四字命名

- **天命点显示**
  - 界面中「天道点」统一改为「天命点」（剩余天命点、消耗天命点、天命点消耗等）。
  - i18n 增加 天命点、剩余天命点、消耗天命点、天命点消耗 等键及英文；Step2/Step3/Step4/Step5/Step6、CharacterCreation 中标签与提示均改用天命点相关文案；数据解析仍兼容旧字段名。
- **剩余天命点显示范围**
  - 创角导航区「剩余天命点」由仅 Step3–7 显示改为 **Step1–7** 均显示，Step1/Step2 也可看到当前剩余点数。
- **七步进度命名（四字、诗意）**
  - 进度条步骤名改为：**万象择一**（选世界）、**禀赋天成**（天资）、**因果前缘**（出身）、**性灵所钟**（特质）、**才情所钟**（天赋）、**命格初成**（属性分配）、**一览终章**（预览）；i18n 补充对应英文（One Among Myriad, Gifts of Nature, Cause and Karma, Nature's Calling, Gifts Revealed, Fate Takes Form, Glimpse the End）。

#### 涉及文件

- `src/views/CharacterCreation.vue`
- `src/i18n/index.ts`
- `src/components/character-creation/Step2_TalentTierSelection.vue`
- `src/components/character-creation/Step3_OriginSelection.vue`
- `src/components/character-creation/Step4_SpiritRootSelection.vue`
- `src/components/character-creation/Step5_TalentSelection.vue`
- `src/components/character-creation/Step6_AttributeAllocation.vue`

---

## [0.2.34] - 2026-02-08

### 探索地图：当前位置图例改为红圈

- 右上角「当前位置」图例由蓝点改为**红圈**（透明底 + 红色描边 `#ef4444`），与地图上当前所在地的红色描边高亮一致。

#### 涉及文件

- `src/components/dashboard/MapPanel.vue`

---

## [0.2.33] - 2026-02-08

### 探索地图：滚轮放大对准目标结构

- **问题**：多个子结构并列时，滚轮放大即使对准某一结构，仍会进入「最上面」或视口内第一个结构。
- **修改**
  - 滚轮放大时记录**指针在 SVG 中的坐标**（用当前 viewportRectInSvg 与视口 rect 换算），存入 `wheelZoomFocusPointInSvg`。
  - watch 中入栈逻辑：若存在该焦点则用 `findDeepestContainingPoint(nodes, point, scale)`（只选**包含该点**且占比达标、有子节点的最深节点），否则沿用 `findDeepestOccupying`（视口相交）。
  - 整轮 for 循环共用同一焦点（循环外取一次），避免第二次迭代误用视口；清空 ref 改为 `nextTick`，避免同次缩放因 pan/scale 触发的第二次 watch 丢失焦点。
  - 坐标换算使用 `getBoundingClientRect()` 的宽高与 `vpX/vpY` 一致，避免与 viewportSize 偏差。

#### 涉及文件

- `src/components/dashboard/components/MapMinimap.vue`

---

## [0.2.32] - 2026-02-08

### 探索地图：色系、交互、教程与探索状态

- **命名**：坤舆图 → **探索地图**（侧栏、页面标题、路由标题、i18n 与使用说明弹窗已统一）。
- **色系与高亮**
  - 按**根节点**分 20 种色系，同一根及其所有子节点同色系；当前所在地用**红色描边**高亮（不再使用绿色）。
- **交互**
  - 区域放大后**双击空白处**（背景）回退到上一级并适配视口；回退到最外层时适配整张画布。
- **教程**
  - 地图页头部增加**教程按钮**（info 图标），点击弹出使用说明弹窗（参考判定窗口 info 设计）；内容含概述、缩放/平移/双击进入/双击回退/重置、图例与色系说明；支持暗色主题。
- **探索状态（仅 tooltip，不冲突色系与高亮）**
  - 地图节点**不再**用样式区分已探索/未探索；悬停时在 **tooltip** 中显示：**已探索** / **未探索** / **部分探索**。
  - **部分探索**：该地点名称不在探索记录中（精确匹配），但其**子结构中有**地点在探索记录中（精确匹配）时显示。
  - 探索判定全部改为**名称精确匹配**（不再使用子串匹配）。
  - 右上角图例移除「已探索」「未探索」，仅保留「当前位置」；使用说明弹窗中图例文案已更新。

#### 涉及文件

- `src/components/dashboard/MapPanel.vue`
- `src/components/dashboard/components/MapMinimap.vue`
- `src/views/GameView.vue`
- `src/components/dashboard/LeftSidebar.vue`
- `src/i18n/index.ts`

---

## [0.2.31] - 2026-02-08

### 坤舆图（地图）嵌套、视口与交互

- **嵌套层级一致性**（`locationMapUtils.ts`）
  - 细化时计算与「非内部」结构的 clearance 时排除当前 focus 的**祖先**，避免第二层在展开第三层时被压扁。
  - 细化 bbox/中心只计算「focus + 直接子 + 孙」，与前端可见范围一致。
- **细化视图与形状**
  - 细化时只渲染「当前 focus + 直接子节点 + 孙节点」，内层可见子节点的内部结构（框/圆）；有子节点一律用方框，`rx` 按半径比例（`Math.min(6, radius*0.25)`）避免小节点呈圆形。
- **钻取与缩放**
  - 双击节点：强制将 focus 栈设为「根→该节点」路径并适配视口，滚轮与双击行为一致。
  - 找「当前 focus」改为基于**与视口矩形相交**且占比 ≥ 入栈阈值，不再仅看视口中心，滚轮放大可正常进入深层节点（如青云城）。
  - 出栈仅按**占比阈值**（`FOCUS_OCCUPY_RATIO_POP` 0.16），移除按 scale 的强制出栈；缩小需缩到当前 focus 占视口 &lt; 16% 才回退一层。
- **最外层展开态与 pan**
  - `clampPan()` 仅在 **scale ≤ 1 且 未细化**（栈空）时归零 pan；细化状态下允许平移。
  - `scale < ZOOM_THRESHOLD_CHILDREN` 时若栈非空仍执行占比出栈逻辑，使最外层展开态与里层一致（可平移、需缩够才回退）。
- **视口与背景**
  - 视口尺寸用 ResizeObserver 取实际 DOM，viewBox 与占比计算按**实际视口宽高比**（`effectiveViewportInSvg`），避免固定 1200×800 导致放大后目标与背景占比错位。
  - 网格线 `vector-effect="non-scaling-stroke"`，线宽不随缩放变化。
  - 背景与网格改为**无限大**：100000×100000 矩形 + 100×100 重复 pattern，平移时始终有背景与网格。

#### 涉及文件

- `src/utils/locationMapUtils.ts`
- `src/components/dashboard/components/MapMinimap.vue`

---

## [0.2.30] - 2026-02-07

### 游戏变量编辑弹窗 UI 修复

- **问题**：编辑变量弹窗中变量名、变量值输入框与预览区内容在左侧贴边或裁切，JSON 首字符显示不全。
- **修改**：`GameVariableEditModal.vue` 样式调整——弹窗 `max-width` 增至 560px，`modal-content`/`modal-body` 使用 `box-sizing: border-box`；表单项与 `form-input`/`form-textarea` 增加水平内边距（1rem）、`box-sizing: border-box` 与 `min-width: 0`；变量值文本框增加 `overflow-x: auto`；预览区 `preview-content` 增加水平内边距、`text-align: left`、`direction: ltr`，避免内容贴边与裁切。

#### 涉及文件

- `src/components/dashboard/components/GameVariableEditModal.vue`

---

## [0.2.29] - 2026-02-07

### 大版本迁移：修仙命名 → 通用命名（不兼容旧存档）

- **数据与类型**
  - 灵根 → **特质**：Ming 模式下身份仅读写 `角色.身份.特质`，不再写入 `灵根`；特质支持完整对象结构（name/tier/description 等），开局创角数据正确写入。
  - 境界 → **地位**：属性与状态、NPC、提示词、UI 统一为「地位」；兼容读取旧键 `境界`。
  - 先天六司/后天六司 → **先天六维属性/后天六维属性**：类型、迁移、修复、校验、初始化与 UI 已统一；兼容读取旧键。
  - 气血/灵气/神识 → **体力/精力/洞察力**：属性路径与 UI 已统一；兼容读取旧键。
  - 灵石四档（下品/中品/上品/极品）→ **金钱四档（现金/铜/银/金）**：类型 `CurrencyFourTier`、`currencyDefaults.normalizeCurrency`、迁移/修复/校验、提示词、背包与人物详情/关系网络 UI 已统一。
  - 世界信息：移除大陆信息、势力信息与 `continents`（未使用）。
- **初始化与创角**
  - `characterInitialization`：Ming 分支仅写 `特质`；`deriveBaseFieldsFromDetails` 权威同步仅写 `特质`（Legacy 仍写 `灵根`）；随机判断改为 `isRandomTrait`，开局特质对象完整落入 角色.身份.特质。
  - 创角 store 已为 trait_id / selectedTrait / traits；App/CharacterCreation 仍可传 `spiritRoot` 入参，初始化内优先 `特质` 再兼容 `灵根`。
- **提示词与 AI**
  - CoT、dataDefinitionsMing、characterInitializationPromptsMing、locationNpcGenerationPromptsMing：路径与文案为 地位/特质/六维属性/体力/精力/洞察力/金钱.现金|铜|银|金。
  - AIBidirectionalSystem：状态摘要、世界主人档案、货币保护与功法技能默认消耗使用新命名。
- **UI 与 i18n**
  - 人物详情、关系网络、右侧栏、背包、创角预览/管理：地位、特质、六维属性、洞察力、金钱四档展示与兑换。
  - i18n：新增 地位、地位状态、现金/铜/银/金、六维属性、先天六维属性、天赋与六维属性、洞察力 等键。
- **其他**
  - stateChangeFormatter：货币与地位突破标题、洞察力路径。
  - 类型中 `CharacterBaseInfo.灵根` 保留为 `@deprecated` 仅兼容读取。

#### 涉及文件（选列）

- `src/types/game.d.ts`, `src/types/index.ts`
- `src/utils/currencyDefaults.ts`, `src/utils/saveMigration.ts`, `src/utils/dataRepair.ts`, `src/utils/dataValidation.ts`
- `src/utils/stateChangeFormatter.ts`
- `src/stores/gameStateStore.ts`, `src/stores/characterCreationStore.ts`, `src/stores/characterStore.ts`
- `src/composables/useGameData.ts`
- `src/services/characterInitialization.ts`, `src/services/offlineInitialization.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `src/utils/prompts/cot/cotCore.ts`, `src/utils/prompts/definitions/ming/dataDefinitionsMing.ts`
- `src/utils/prompts/tasks/characterInitializationPromptsMing.ts`, `src/utils/prompts/tasks/locationNpcGenerationPromptsMing.ts`
- `src/components/dashboard/InventoryPanel.vue`, `CharacterDetailsPanel.vue`, `RelationshipNetworkPanel.vue`, `RightSidebar.vue`, `LeftSidebar.vue`
- `src/components/character-creation/Step7_Preview.vue`, `CharacterManagement.vue`
- `src/i18n/index.ts`
- `docs/migration-plan-cultivation-to-ming.md`

---

## [0.2.28] - 2026-02-07

### 世界心跳功能落地与贡献指南

- **世界心跳 UI 与入口**：新增心跳面板（HeartbeatPanel）及路由 `/game/heartbeat`；侧栏与游戏内菜单添加入口；设置面板中心跳配置分组（周期、历史条数、遗忘回合数等）。
- **关系网络与数据**：关系网络面板扩展（在做事项、历史在做事项等）；类型与存档结构（game.d.ts、saveSchemaV3）支持心跳与 NPC 相关字段；数据验证（dataValidation）与提示词（worldHeartbeatPromptsMing、dataDefinitionsMing、cotCore、inlinePromptsMing）补全。
- **文档**：新增/纳入世界心跳实现计划（world-heartbeat-implementation-plan.md）与实现笔记（world-heartbeat-impl-notes.md）；i18n 新增心跳相关文案。
- **贡献指南**：CONTRIBUTING.md 增加「中文提交信息避免乱码」说明，约定使用 `git commit -F 文件` 从 UTF-8 文件读取提交信息，避免 Windows/PowerShell 下乱码。

#### 涉及文件

- `CONTRIBUTING.md`
- `docs/world-heartbeat-implementation-plan.md`
- `docs/world-heartbeat-impl-notes.md`
- `src/components/dashboard/HeartbeatPanel.vue`
- `src/components/dashboard/components/WorldHeartbeatWidget.vue`
- `src/components/dashboard/LeftSidebar.vue`
- `src/components/dashboard/SettingsPanel.vue`
- `src/components/dashboard/RelationshipNetworkPanel.vue`
- `src/components/dashboard/PromptAssemblyPanel.vue`
- `src/views/GameView.vue`
- `src/router/index.ts`
- `src/types/game.d.ts`
- `src/types/saveSchemaV3.ts`
- `src/utils/dataValidation.ts`
- `src/utils/prompts/cot/cotCore.ts`
- `src/utils/prompts/definitions/ming/dataDefinitionsMing.ts`
- `src/utils/prompts/definitions/ming/inlinePromptsMing.ts`
- `src/utils/prompts/tasks/worldHeartbeatPromptsMing.ts`
- `src/i18n/index.ts`

---

## [0.2.27] - 2026-02-07

### 世界心跳默认值调整与存档迁移补全

- **默认值**：世界心跳默认改为「每 5 回合更新、历史保留 10 条、遗忘回合 10」（原为 3/20/30）。新开档、迁移/修复时缺失字段及运行时回退均使用新默认。
- **统一位置**：`gameStateStore`（初始与加载归一化）、`saveMigration`（V3 归一与旧版迁移）、`dataRepair`、`worldHeartbeatService`（遗忘回合数/历史条数回退）、`AIBidirectionalSystem`（周期数值回退）已全部改为 5/10/10。
- **存档迁移**：V3 存档已有 `世界.状态.心跳` 对象但缺少字段时，`saveMigration` 现会补全 `周期数值`（5），保证存档/角色导入后写入 IndexedDB 的存档结构完整。存档与角色导入导出、系统设置导入导出行为已核对，运行正常。

#### 涉及文件

- `src/stores/gameStateStore.ts`
- `src/utils/saveMigration.ts`
- `src/utils/dataRepair.ts`
- `src/services/worldHeartbeatService.ts`
- `src/utils/AIBidirectionalSystem.ts`

---

## [0.2.26] - 2026-02-07

### 地点-NPC：追加时去重 + 校准顺序优化

- **背景**：人物移动时 NPC 会生成在新地点或与玩家同行移动，需更新 地点NPC：从原地点移除同名 NPC，保证有且只有一个同名 NPC；与现有双向校准兼容，且绝大多数只修改 地点NPC。若仅 关系 更新、地点 NPC 未更新，也需能从 关系 sync 到地点。
- **appendNpcsToLocation**
  - 在向某地点 地点NPC 追加名字**前**，先对每个名字调用 `removeNpcFromOtherLocations(saveData, npcName, locationDesc)`，再从该地点追加。
  - 效果：同行 NPC 移入新地点或在新地点生成时，会从其他地点的 地点NPC 中移除同名项；全局保证每个 NPC 名只出现在一个地点的列表中。仅修改 地点NPC。
- **calibrateNpcLocationSync 顺序调整**
  - 1. 关系 → 地点：仅根据 关系[npc].当前位置.描述 更新各地点的 地点NPC（从其它地点移除、加入该地点）；不写 关系。
  - 2. 地点去重：对仍出现在多处的 NPC 按「首次出现地点」保留一处；只改 地点NPC。
  - 3. 地点 → 关系：用 地点NPC 补全/修正 关系[npc].当前位置.描述；仅在此步写 关系。
  - 绝大多数场景只改 地点NPC；当仅 关系 更新、地点未更新时，步骤 1 仍能从 关系 sync 到地点。
- **设计文档**：在「每次更新地点 NPC 时移除其他地点的该 NPC」处注明已实现（appendNpcsToLocation + calibrateNpcLocationSync）。

#### 涉及文件

- `src/utils/locationUtils.ts`
- `docs/design note`

---

## [0.2.25] - 2026-02-07

### 地点-NPC 双向校准与设计文档

- **背景**：API 回写或修复存档时，「社交.关系[npc].当前位置」与「世界.信息.地点信息[地点].地点NPC」可能不一致（API 不一定同时正确写入两项），需在后端做一次同步与互补。
- **locationUtils**
  - 新增 `forEachLocationInTree`：遍历地点树中每个地点条目（含递归 内部）。
  - 新增 `removeNpcFromOtherLocations(saveData, npcName, keepAtLocationName)`：从除指定地点外的所有地点的 地点NPC 中移除该 NPC，保证同一 NPC 只出现在一个地点的列表中。
  - 新增 `calibrateNpcLocationSync(saveData)`：① 每个 NPC 只保留在一个地点的 地点NPC；② 根据 关系[npc].当前位置.描述 同步到对应地点的 地点NPC；③ 根据各地点的 地点NPC 补全/修正 关系[npc].当前位置.描述。
- **调用点**
  - `AIBidirectionalSystem`：API 回写后、时间规范化前调用 `calibrateNpcLocationSync`。
  - `dataRepair.repairSaveData`：修复 世界.信息.地点信息 后调用 `calibrateNpcLocationSync`。
- **设计文档（docs/design note）**
  - 地图 rescale 功能说明（外部与内部比例、嵌套适用）；
  - 每次更新地点 NPC 时需检查并移除其他地点中的该 NPC；
  - 禁止普通 NPC 进入玩家关系网络；
  - 七、NPC 之间的关系更新：周期性更新 NPC 关系，并更新记忆与情感记忆日志，可在世界心跳中执行。

#### 涉及文件

- `src/utils/locationUtils.ts`
- `src/utils/AIBidirectionalSystem.ts`
- `src/utils/dataRepair.ts`
- `docs/design note`

---

## [0.2.24] - 2026-02-07

### 提示词组装：仅保留一回合 + 导出

- **背景**：此前保留最近 20 条快照占用内存较多；实际只需查看当前回合的组装结果，历史需保存时再导出即可。
- **Store（promptAssemblyStore）**
  - 仅保留**当前一个回合**内的快照。以 flowName 判定回合边界：`主回合`、`分步第1步`、`开局第1步` 视为新回合开始，此时清空上一回合再记录；同回合内后续步骤（如 `分步第2步`、`开局第2步`）追加到当前回合。
  - 单回合内最多保留 10 条快照（防止异常增长）。
  - 新增 `getDataForExport()`，供面板将当前回合快照序列化为 JSON 并下载。
- **面板（PromptAssemblyPanel）**
  - 当前回合有多条快照时显示步骤 tab，可切换查看（如 分步第1步 / 分步第2步）；仅一条时不显示 tab。
  - 新增「导出」按钮，下载文件名为 `prompt-assembly-YYYY-MM-DDTHH-mm-ss.json`，内容含 `exportedAt` 与当前回合的 `snapshots` 数组。

#### 涉及文件

- `src/stores/promptAssemblyStore.ts`
- `src/components/dashboard/PromptAssemblyPanel.vue`

---

## [0.2.23] - 2026-02-06

### NPC 境界默认「凡人」

- **背景**：Prompt 清理后地点路人 NPC 结构不再强制包含境界，导致新生成 NPC 无境界字段，界面此前显示「未知」。
- **UI 默认值**
  - `RelationshipNetworkPanel.vue`：`getNpcRealm` 在 `境界` 缺失或无法解析时返回 **「凡人」**（不再返回「未知」）。
  - 关系网络列表卡片中境界行始终展示，不再因「未知」隐藏。
- **Prompt 可选字段**
  - `locationNpcGenerationPromptsMing.ts`：NPC 结构说明中增加可选字段 **境界?: string 或 {名称, 阶段}**，注明不填则界面显示「凡人」；若世界观有境界设定可填写，模型仍可选择性生成境界。

#### 涉及文件

- `src/utils/prompts/tasks/locationNpcGenerationPromptsMing.ts`
- `src/components/dashboard/RelationshipNetworkPanel.vue`

---

## [0.2.22] - 2026-02-06

### Prompt 清理计划落地：通用化用词、数据结构与 UI（docs/prompt-cleanup-plan.md）

- **删除的规则**
  - `businessRulesMing.ts`：移除「地点势力不重叠（铁律）」整段；删除 `CONFLICT_TURN_RULES` 整个 export。
  - `defaultPrompts.ts`：从 BUSINESS_RULES 数组中去掉 `CONFLICT_TURN_RULES`；业务规则描述改为「NPC、冲突、难度等业务规则」。
  - `promptAssembler.ts`：businessRules / worldStandards 的 add-cause 文案同步为「NPC、冲突、难度等业务规则」「属性、品质」。

- **货币：灵石→金钱**
  - **类型**：`game.d.ts` 新增 `CurrencyFourTier`；`Inventory` 与 NPC 背包支持 `金钱?`，`灵石?` 标为 `@deprecated`，读取时 金钱 ?? 灵石。
  - **Prompt/数据定义**：`dataDefinitionsMing`、`characterInitializationPromptsMing`、`locationNpcGenerationPromptsMing`、`inlinePromptsMing`、`coreRulesMing` 中背包/货币统一为「金钱」及四档（下品/中品/上品/极品）。
  - **运行时**：`useGameData`、`dataRepair`、`dataValidation`、`enhancedActionQueue`、`commandValidator`、`stateChangeFormatter`、`AIBidirectionalSystem` 支持 金钱 并兼容 灵石（读写、校验、防负值）。
  - **UI**：`InventoryPanel` 标签与兑换、`CharacterDetailsPanel` 金钱折算、`RelationshipNetworkPanel` 货币展示与 NPC 条目、i18n（金钱/金钱折算/金钱储备/兑换·分解文案）统一为「金钱」。

- **属性：气血→体力、灵气→精力；神识可选**
  - **类型**：`PlayerStatus` / NPC 属性 增加 `体力?`、`精力?`；NPC 属性中 气血/灵气 改为可选。
  - **Prompt**：`dataDefinitionsMing` 1.2、2.3 与 `locationNpcGenerationPromptsMing` NPC 结构为 体力/精力；不要求神识。
  - **校验与格式化**：`commandValidator`、`stateChangeFormatter` 支持 角色.属性.体力/精力.\*；`dataRepair`、`dataValidation` 修复时补全 体力/精力（缺则从 气血/灵气 推导），NPC 默认 体力/精力。
  - **AI 状态摘要**：`AIBidirectionalSystem` 核心状态与 owner 详情使用 体力??气血、精力??灵气；神识仅在有值时显示。
  - **角色生成与迁移**：`calculateInitialAttributes`、`prepareInitialData`、`finalizeAndSyncData` 写入 体力/精力（与 气血/灵气 同源）；`saveMigration` 的 `flatAttributes` 含 体力/精力。
  - **UI 核心数值**：`RightSidebar`（角色状态）、`CharacterDetailsPanel`（vitalsData）、`RelationshipNetworkPanel`（NPC 核心数值）展示 体力/精力（兼容 气血/灵气），神识仅在有数据时显示；i18n 增加 体力/精力。

- **品质系统通用**
  - `worldStandardsMing.ts`：QUALITY_SYSTEM 改为 普通|优良|稀有|史诗|传说|神话（grade 0–10）。
  - `dataDefinitionsMing`、`inlinePromptsMing` 物品品质与生成规则同步；`InventoryPanel`、`CharacterDetailsPanel` 的 PRESET_QUALITIES / qualityRank 支持新旧品质名。

- **灵根→特质（Ming）**
  - **数据定义**：`dataDefinitionsMing` 身份增加「特质」；`characterInitializationPromptsMing` COMMANDS_RULES_MING 随机项含「若特质为随机则 set 角色.身份.特质」。
  - **类型**：`CharacterBaseInfo` 增加 `特质?`，`灵根` 改为可选。
  - **开局合并**：`characterInitialization` 在 USE_MING_PROMPTS 下，若用户选了具体灵根（完整对象）则保留 `mergedBaseInfo.灵根` 为完整对象、`mergedBaseInfo.特质` 为名称；随机时用 AI 特质字符串。
  - **Prompt 完整信息**：`buildCharacterSelectionsSummaryMing`、`buildCharacterSelectionsSummary` 当 spiritRoot 为对象时输出完整字段（名称、品级、描述、修炼相关、特殊效果），避免发给 API 时丢失。
  - **UI 文案**：Ming 下人物详情、关系网络、角色管理、创建预览、数据校验弹窗等处标签由「灵根」改为「特质」；i18n 增加 无特质/未知特质/此特质。

- **CoT 与默认提示词**
  - `cotCore.ts`：保留 `getCotCorePrompt`（修仙版），新增 `getCotCorePromptMing`（仅 位置/时间/金钱/物品/关系/事件/体力/精力，无神识/修炼/渡劫/宗门）。
  - `defaultPrompts.ts`：当 USE_MING_PROMPTS 时 cotCore 使用 `getCotCorePromptMing`。

- **注释与 Legacy 标注**
  - `defaultPrompts.ts` worldStandards 描述改为「属性、品质」。
  - `businessRules.ts`、`dataDefinitions.ts`、`characterInitializationPrompts.ts` 文件头增加「Legacy: 仅当 USE_MING_PROMPTS=false 时使用」及简短说明。

#### 涉及文件

- 计划与文档：`docs/prompt-cleanup-plan.md`
- 提示词与规则：`definitions/ming/businessRulesMing.ts`、`dataDefinitionsMing.ts`、`coreRulesMing.ts`、`worldStandardsMing.ts`、`inlinePromptsMing.ts`、`tasks/characterInitializationPromptsMing.ts`、`characterInitializationPrompts.ts`、`tasks/locationNpcGenerationPromptsMing.ts`、`cot/cotCore.ts`、`promptAssembler.ts`、`services/defaultPrompts.ts`、`definitions/businessRules.ts`、`definitions/dataDefinitions.ts`
- 类型与数据：`types/game.d.ts`
- 服务与工具：`services/characterInitialization.ts`、`utils/dataRepair.ts`、`utils/dataValidation.ts`、`utils/saveMigration.ts`、`utils/commandValidator.ts`、`utils/stateChangeFormatter.ts`、`utils/AIBidirectionalSystem.ts`、`utils/enhancedActionQueue.ts`
- 前端与 i18n：`composables/useGameData.ts`、`i18n/index.ts`、`components/dashboard/CharacterDetailsPanel.vue`、`components/dashboard/RightSidebar.vue`、`components/dashboard/RelationshipNetworkPanel.vue`、`components/dashboard/InventoryPanel.vue`、`components/character-creation/CharacterManagement.vue`、`components/character-creation/Step7_Preview.vue`、`components/common/DataValidationErrorDialog.vue`

---

## [0.2.21] - 2026-02-06

### 六司属性通用化：根骨→体质、灵性→直觉

- **数据与类型**
  - 先天六司/后天六司键名统一为 **体质**、**直觉**、悟性、气运、魅力、心性。
  - `InnateAttributes`、`SixSiWeights`、`InitialGameData` 等类型与默认值、校验路径（commandValidator）、dataRepair/saveMigration/offlineInitialization/characterStore 均改为体质、直觉。
  - `dataDefinitionsMing` 身份中补充先天六司/后天六司定义（体质、直觉等）；legacy `dataDefinitions.ts`、`definitions/dataDefinitions.ts`、`definitions/textFormats.ts`、`dataDefinitions.ts` 中六司描述与示例同步改为体质/直觉。
  - `docs/save-schema-v3.md` 六司字段与示例更新为体质、直觉。

- **存档迁移与兼容**
  - `saveMigration`：在 V3 存档分支中增加六司键名迁移（根骨→体质、灵性→直觉），对主角身份与 `社交.关系` 下所有 NPC 执行后删除旧键。
  - 读取时兼容旧键：characterInitialization、CharacterDetailsPanel、RelationshipNetworkPanel、CharacterManagement 等处对 先天六司/后天六司 使用 `体质 ?? 根骨`、`直觉 ?? 灵性`，保证旧存档正常显示与计算。

- **前端与 i18n**
  - 创建流程（Step3/Step6/Step7）、角色详情、关系网络、HexagonChart、FormattedText、GameVariableFormatGuideModal 等展示与占位符统一为「体质」「直觉」。
  - i18n：移除所有以「根骨」「灵性」为键的条目，仅保留「体质」「直觉」及对应判定配比、加权说明等文案。
  - Step5 天赋目标占位符、AIGameMaster.d.ts 注释更新为体质/直觉。

- **Prompt 与文档**
  - `docs/prompt-cleanup-plan.md`：新增「六司属性：根骨→体质，灵性→直觉」一节，明确主角与 NPC 的 data structure / prompt / 前端修改范围及执行顺序；概述与执行建议中补充六司与迁移兼容说明。
  - `gameElementPrompts.ts` 中 attribute_modifiers 说明与示例改为体质/直觉；creationData 天赋 effects 中后天六司目标已为体质/直觉。

#### 涉及文件

- 类型：`types/game.d.ts`、`types/index.ts`、`types/AIGameMaster.d.ts`
- 数据结构与 prompt：`definitions/ming/dataDefinitionsMing.ts`、`definitions/dataDefinitions.ts`、`dataDefinitions.ts`、`definitions/textFormats.ts`、`tasks/gameElementPrompts.ts`
- 业务与迁移：`services/characterInitialization.ts`、`utils/saveMigration.ts`、`utils/dataRepair.ts`、`utils/commandValidator.ts`、`services/offlineInitialization.ts`、`stores/characterStore.ts`、`data/specialNpcs.ts`、`data/creationData.ts`
- 前端：`i18n/index.ts`、`views/CharacterCreation.vue`、`App.vue`、`components/character-creation/*`、`components/dashboard/*`、`components/common/HexagonChart.vue`、`components/common/FormattedText.vue`
- 文档：`docs/prompt-cleanup-plan.md`、`docs/save-schema-v3.md`

---

## [0.2.20] - 2026-02-06

### 存档与导入导出

- **存档系统与数据结构**
  - 核对存档格式 V3、迁移、校验与 gameStateStore 的 toSaveData/loadFromSaveData，确认与当前 game.d.ts 及 saveSchemaV3 一致，无需因近期数据结构更新而改版。
  - 导入/导出流程已使用迁移与 V3 校验，dadBundle 格式兼容旧版。

- **SavePanel 导出所有存档**
  - 修复「导出所有存档」从 IndexedDB 加载时使用错误 key 的问题：改为使用槽位 key（`save.id`），与「导出单个存档」「导出角色」一致；避免存档槽位 key（如「存档1」）与显示名（如「我的进度」）不一致时导出失败或数据错位。

#### 涉及文件

- `components/dashboard/SavePanel.vue`（exportSaves 使用 save.id || save.存档名 作为 loadSaveData 的槽位参数）

---

## [0.2.19] - 2026-02-06

### 坤舆图（minimap）性能优化（行为不变）

- **locationMapUtils.ts**
  - **layoutChildren**：按 parentId 预分组后单遍布局，由每节点 O(n) filter 改为整体 O(n)。
  - **refinedMap**：用单次 for 循环 `refinedMap.set(n.id, n)` 构建，减少临时数组。
  - **细化平移**：用递归 `applyDeltaToDescendants` 对后代应用 dx/dy，不再为每个子节点分配 `collectDescendantIds` 数组。
  - **细化子树 id + bbox**：单次 BFS 遍历同时填充 `refinedSubtreeIds` 并更新 bbox，不再先收集 id 再第二遍算 bbox。
  - **Set 直填**：新增 `addSubtreeIdsToSet`，`focusSubtreeIds` 与兄弟节点收集直接填 Set，避免 `collectDescendantIds` 返回数组再转 Set。

- **MapMinimap.vue**
  - 移除未使用的 `viewportSvgSize` 计算与传参，`mapData` 仅依赖 `focusStackRef` 与 `props.entries`，zoom/pan 不触发布局重算。
  - 将「按缩放过滤」与「按兄弟过滤」合并为单一 `nodesFiltered` 计算，单次 `filter` 完成，减少中间数组与一次计算。

#### 涉及文件

- `utils/locationMapUtils.ts`（layoutChildren 分组、addSubtreeIdsToSet、applyDeltaToDescendants、单遍 bbox、refinedMap 构建）
- `components/dashboard/components/MapMinimap.vue`（移除 viewportSvgSize、合并 nodesRaw/nodesFiltered）

---

## [0.2.18] - 2026-02-06

### 坤舆图（minimap）：细化缩放与视口适配

- **外部与内部同比例缩放**
  - 细化布局改为使用固定画布参考尺寸（`Math.min(CANVAS_WIDTH, CANVAS_HEIGHT)`），不再根据当前视口（canvas/scale）计算 `innerFocusRadius` 与 `childrenSpread`。
  - 放大/缩小时由 SVG viewBox 统一缩放整张图，外部结构与内部结构同步放大，不再出现「外部不变、内部放大」的效果。

- **Zoom out 细化退出阈值**
  - 新增 `ZOOM_THRESHOLD_REFINED`（1.4），专门控制细化（focus 栈）的启用与退出；子节点是否展开仍由 `ZOOM_THRESHOLD_CHILDREN`（1.2）控制。
  - 缩小到 scale &lt; 1.4 时先清空 focus 栈，避免退出细化时内部圈仍按细化布局绘制而跑到框外。

- **进入/更新细化时内部结构在屏幕内**
  - 布局返回「仅当前 focus 及其子级」的几何中心（`refinedSubtreeCenter`）与 bbox 宽高（`refinedSubtreeBbox`），同级/父级不参与。
  - 进入或更新细化（栈顶变化）时：先根据 bbox 计算「适配视口」所需 scale（留约 10% 边距），若当前 scale 过大则适当缩小；再平移使该中心对准视口中心，保证内部结构完整显示在屏幕内。

#### 涉及文件

- `utils/locationMapUtils.ts`（固定参考尺寸、refinedSubtreeCenter/refinedSubtreeBbox、ZOOM_THRESHOLD_REFINED）
- `components/dashboard/components/MapMinimap.vue`（细化退出阈值、进入/更新细化时 scale 适配与 pan 居中）

---

## [0.2.17] - 2026-02-05

### 提示词组装（调试）：多步骤、模组明细、Token 估算、记忆与 API 说明

- **多步骤与模组明细**
  - 由「最近一次」改为**最近 20 条**快照列表（`recentSnapshots`），可切换查看分步第 1 步、第 2 步、开局第 1/2 步等任一步骤。
  - 分步/开局各步骤在构建时按段收集真实模组（`onSection`），记录每段的 key、构成、生成原因、flow 引用、content；面板展示「本步骤使用的提示词模组」列表及每模组的上述元数据与内容。
  - 分步第 1 步模组：splitGenerationStep1、textFormatRules、worldStandards、statusSummary、narrativeState 等；第 2 步：splitGenerationStep2、cotCore（可选）、businessRules、dataDefinitions、textFormatRules、worldStandards、actionOptions（可选）、eventSystemRules、statusSummary、stateJson。开局第 1/2 步同理按段收集并展示。

- **Token 估算**
  - 新增 `utils/tokenEstimate.ts`：`estimateTokensForText(text)`（CJK≈1 token/字，非 CJK≈4 字符/token），与 aiService 估算方式一致。
  - 提示词全文标题显示「约 N tokens」；每个模组标题显示该模组内容的「约 N tokens」；步骤标签显示「共 X 个模组 · 约 Y tokens」（Y 为全文估算）。

- **本步骤发送的记忆（assistant 角色）**
  - `AssemblySnapshot` 新增可选字段 `memoryContent`、`apiCallDescription`。
  - 分步第 1 步录制时：将实际发送的短期记忆块（与 `buildSplitInjects` 中 assistant 内容一致）写入 `memoryContent`；面板在「提示词全文」下方增加区块「本步骤发送的记忆（assistant 角色）」，展示该内容并显示约 N tokens。
  - 分步第 2 步、开局第 1/2 步无记忆注入，不显示该区块。

- **本步骤对应的 API 调用说明**
  - 每条快照可带 `apiCallDescription`，说明该步骤对应哪一次 API 及各 role 内容来源。
  - 分步第 1 步：`第1次 API：role: system = 分步第1步；role: assistant = 记忆（如有）；role: user = 玩家输入`。
  - 分步第 2 步：`第2次 API：role: system = 分步第2步；role: user = 玩家输入 + 第1步返回正文`。
  - 开局第 1 步：`第1次 API：role: system = 开局第1步；role: user = 角色设定`。
  - 开局第 2 步：`第2次 API：role: system = 开局第2步；role: user = 开局用户提示 + 第1步正文`。
  - 面板在步骤元信息区展示「本步骤对应：……」完整说明。

#### 涉及文件

- `stores/promptAssemblyStore.ts`（AssemblySnapshot 增加 memoryContent、apiCallDescription；recentSnapshots 已存在）
- `utils/tokenEstimate.ts`（新增）
- `utils/AIBidirectionalSystem.ts`（分步/开局 buildSplit 按段 push 模组；record 时传入 memoryContent / apiCallDescription）
- `components/dashboard/PromptAssemblyPanel.vue`（步骤标签、全文/记忆/模组 token、API 说明、记忆区块）

---

## [0.2.16] - 2026-02-05

### 提示词管理：仅展示参与组装的提示词

- **透明度与显示逻辑**
  - 新增 `ASSEMBLY_PROMPT_KEYS`（defaultPrompts.ts），列出当前实际参与游戏组装的 19 个提示词 key。
  - 提示词管理面板仅显示上述 key，保证「所见即所用」；未在列表中的 key 仍存在于 `getSystemPrompts()`（导入兼容），但不在面板中展示。
  - 面板顶部增加说明：「以下提示词会在游戏中参与组装，可直接编辑、启用/禁用或调整权重」及当前显示数量。
  - `promptStorage.loadByCategory()` 按 `ASSEMBLY_PROMPT_KEYS` 过滤，并移除无提示词的分类。

- **Legacy 说明**
  - 在 defaultPrompts 注释中标明：`definitions/` 下非 ming 文件为旧版定义，本模块仅引用 `definitions/ming/*`。

#### 涉及文件

- `defaultPrompts.ts`、`promptStorage.ts`、`PromptManagementPanel.vue`

---

### 提示词组装（调试可视化）

- **功能**
  - 在系统设置中开启「调试模式」并保存后，侧边栏出现「提示词组装」入口。
  - 打开后面板展示**最近一次**发送给 API 的系统提示词：全文 + 各模组的「提示词构成 / 生成原因 / 在那个 flow 引用 / 内容」。
  - 支持主回合、分步第 1/2 步、开局第 1/2 步的录制；录制条件与侧栏可见性一致（`uiStore.debugMode`）。
  - 纯观察与复制，**不修改实际发送的 prompt**；promptAssembler 的 `onSection` 仅用于收集元数据，返回值与是否传入无关。

- **实现要点**
  - `promptAssemblyStore`：存 lastSnapshot（fullPrompt、modules、flowName、timestamp）。
  - `promptAssembler`：可选 `options.onSection` 回调，每段 push 时顺带调用，不改变拼接结果。
  - `AIBidirectionalSystem`：主流程与分步/开局流程在构建完 systemPrompt 后，若 `uiStore.debugMode` 则 `promptAssemblyStore.record(...)`。
  - 设置中调试模式与 `uiStore.debugMode` 同步，便于侧栏与录制一致。

- **UI**
  - 路由 `prompt-assembly`，面板 `PromptAssemblyPanel.vue`；无数据时显示说明（开启调试并发送一次请求后可见）。
  - 侧栏按钮描述缩短为「查看发送的提示词构成」，并增加 `min-width: 0` / `overflow-x: hidden` 避免横向溢出。

#### 涉及文件

- `stores/promptAssemblyStore.ts`、`stores/uiStore.ts`（debugMode 同步）
- `promptAssembler.ts`、`AIBidirectionalSystem.ts`
- `PromptAssemblyPanel.vue`、`LeftSidebar.vue`、`GameView.vue`、`SettingsPanel.vue`、`router/index.ts`、`i18n/index.ts`

---

## [0.2.15] - 2026-02-05

### 坤舆图：顶部增加返回按钮

地图页此前未纳入 GameView 的面板路由，打开时未显示带返回按钮的顶栏。将 `Map` 加入 `panelRoutes` 与 `panelTitles`（标题「坤舆图」、图标 Map），与背包、记忆中心、保存游戏等面板一致，顶部显示返回箭头与标题栏。

#### 涉及文件

- `GameView.vue`

---

## [0.2.14] - 2026-02-04

### NSFW：玩家法身与 NPC 私密档案逻辑统一

#### 变更摘要

- **玩家法身（角色.身体）与修仙版对齐**
  - 将 MING 版 `1.5 身体/法身` 的数据结构扩展为与修仙版一致：身高、体重、体脂率、三围、外观特征、敏感点、开发度、纹身与印记、胸部描述、私处描述、生殖器描述等字段。
  - 明确说明：仅当 `系统配置.nsfwMode=true` 且为酒馆端时，才会生成/更新 `角色.身体`；**游戏过程中可通过 `set 角色.身体` 或 `set 角色.身体.xxx` 更新法身数据**。

- **开局法身生成：强制使用 `角色.身体`**
  - 角色初始化提示词（MING 与修仙版）统一约定：
    - **唯一合法 key 为 `角色.身体`**，禁止在开局的 `tavern_commands` 中使用 `角色.身体部位开发`。
    - 初始 value 至少包含：身高、体重、三围、至少一项描述（胸部/私处/生殖器描述）、以及 **敏感点(string[])、开发度(Record<部位名,0-100>)、纹身与印记(string[])**。
  - 业务规则中原有「玩家身体部位开发（存储位置：`角色.身体部位开发`）」的说法改为：
    - 开局只写入 `角色.身体`，**`角色.身体部位开发` 仅供变量面板/扩展逻辑使用，不在初始化和常规 AI 指令中写入**。

- **法身 UI 提示优化**
  - `BodyStatsPanel` 在酒馆 + NSFW 开启但无法身数据时，会提示「成人内容已开启，当前存档尚未生成法身数据，请在酒馆中完善角色设定或重新创建角色」，避免误以为被“私密模式”隐藏。

- **地点路人 NPC：支持按 NSFW 配置生成私密档案**
  - 地点路人 NPC 生成提示词新增 `nsfwMode` 与 `nsfwGenderFilter` 输入：
    - 当 NSFW 开启且 NPC 性别符合过滤条件（all / female / male）时，要求为该 NPC 输出完整 `私密信息`（PrivacyProfile），字段包括：是否为处女/处男、身体部位数组（部位名称/敏感度/开发度/特征描述）、性格倾向、性取向、性癖好、性渴望程度、当前性状态、体液分泌状态、性交总次数、性伴侣名单、最近一次性行为时间、特殊体质等。
  - 仅在酒馆环境下追加一段 PrivacyProfile 字段说明到数据结构提示词中，帮助模型在 NSFW 模式下正确生成 NPC 私密档案。

#### 涉及文件

- 提示词与数据结构：`businessRules.ts`、`businessRulesMing.ts`、`dataDefinitions.ts`、`dataDefinitionsMing.ts`
- 角色初始化：`characterInitializationPrompts.ts`、`characterInitializationPromptsMing.ts`、`characterInitialization.ts`
- NPC 生成与执行逻辑：`locationNpcGenerationPromptsMing.ts`、`AIBidirectionalSystem.ts`、`locationUtils.ts`
- UI 与文案：`BodyStatsPanel.vue`、`i18n/index.ts`

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

- **原因**：`characterInitialization` 中的 `EnhancedWorldGenerator` stub 接收 `enhancedConfig`（来自 `characterCreationStore.selectedWorld` 的 name / era / description）但未使用，`buildStubWorldInfo()` 固定返回 世界名称/世界背景/世界纪元 的默认值。
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
