# 实体索引与语义记忆整合方案

> 目标：1) **移除 game_entities**，关系图 **仅** 由 **`社交.关系`**（含 NpcProfile.`关系`）与 角色 派生，实体与 NPC–NPC 关系的写入 **统一** 经 **tavern_commands**；2) 对 **semantic_memory（语义记忆）** 的落盘位置做调研与选型，给出推荐后再实现。

### 快速结论

| 项目 | 结论 |
|------|------|
| **NPC 实体** | 只存于 `社交.关系`；**不再使用 `game_entities`**（entities 与 relationships 均移除） |
| **Player–NPC 关系** | 从 `社交.关系[K].与玩家关系` **推导**，不单独存边 |
| **NPC–NPC 关系** | 存入 **NpcProfile 内的 `关系?: Record<string, string>`**；**仅**经 **tavern_commands** 写（如 `set 社交.关系.张三.关系.李四` 或 `set 社交.关系.张三.关系` 对象合并）；**不再**使用 `game_entities.relationships` |
| **关系图** | 实体与边 **全部** 由 `社交.关系`（含 与玩家关系、关系）+ 角色 **派生**，检索逻辑不变；写入 **统一** 走 tavern_commands，无单独 LLM 输出通道 |
| **检索 (# 相关实体 / # 关系)** | 数据源：`社交.关系` + 角色；从 与玩家关系 与 各 NPC 的 关系 派生边数组，算法保持不变 |
| **语义记忆落盘** | 短期保持 `系统.扩展.语义记忆`；可选后续迁到 `社交.记忆.语义三元组` 或 `系统.语义记忆` |

---

## 一、移除 game_entities，关系图仅由 社交.关系 派生

### 1.1 现状与目标

| 维度 | 社交.关系（沿用并扩展） | game_entities（移除） |
|------|-------------------------|------------------------|
| **结构** | `Record<string, NpcProfile>`，NpcProfile 新增 `关系?: Record<string, string>` | ~~`{ entities, relationships }`~~ |
| **实体** | 仅 NPC，含 名字/与玩家关系/好感度/关系/… | ~~entities：不再使用~~ |
| **关系** | `与玩家关系`（player↔NPC）+ `关系`（NPC↔NPC，按节点存在本 NPC 档案内） | ~~relationships：不再使用~~ |
| **写入** | **统一** `tavern_commands`：set 社交.关系.{npc}、set 社交.关系.{npc}.关系.{其他}、set 社交.关系.{npc}.关系 对象合并 等 | ~~Step2 `game_entities` → mergeInto扩展~~ |
| **读出** | `buildNarrativeState` 全量进 prompt；`memoryRetrieve` 从 社交.关系 + 角色 **派生** 实体与边，做图遍历与格式化 | ~~readFrom扩展 → gameEntityIndex~~ |

### 1.2 设计原则

- **存储形态**：NPC 实体 **只** 存在于 `社交.关系`；**NPC–NPC 关系** 存于 **每个 NpcProfile 内的 `关系` 字段**（按节点分布），不再使用单独的平铺边表。
- **检索与注入**：`# 相关实体`、`# 关系` 的生成逻辑（BFS、maxLines、格式化）**保持**，仅数据源改为从 `社交.关系`（含 与玩家关系、关系）与 角色 推导。
- **Player–NPC 关系**：统一从 `社交.关系[K].与玩家关系` **推导**，不单独存边。
- **NPC–NPC 关系**：由 **`社交.关系[fromId].关系[toId]`** 表示，即「fromId 对 toId 的关系」只存在于 fromId 的档案里，单一真相来源，且与 NpcProfile 一起读写、迁移。

### 1.3 新结构：NpcProfile 内 `关系`（按节点分布）

在 **NpcProfile** 中新增可选字段 **`关系?: Record<string, string>`**：

- **含义**：本 NPC 对**其他 NPC** 的关系；key = 对方在 `社交.关系` 中的键名（NPC 名），value = 关系标签（如 `"师徒"`、`"仇敌"`、`"同门"`）。
- **边的方向**：`社交.关系[A].关系[B] = "x"` 表示有向边 `(fromId=A, toId=B, relationship=x)`；仅存在 A 的档案中，不要求在 B 的档案中存反向。
- **与 与玩家关系 的分工**：`与玩家关系` 表示本 NPC 对**玩家**的关系；`关系` 只表示对**其他 NPC** 的关系。

```ts
// NpcProfile 新增（放在 与玩家关系 附近）
与玩家关系: string;
关系?: Record<string, string>;  // 本 NPC 对其他 NPC 的关系；key=对方名字，value=关系标签
```

- **数量**：可对单 NPC 的 `关系` 做上限（例如 50），避免单点膨胀；全局不再需要平铺边表。
- **去重**：同一对 (A, B) 只存于 A 的 `关系[B]`，自然无重复。

### 1.4 实体与关系的来源（合并后）

| 用途 | 原来源 | 合并后来源 |
|------|--------|------------|
| **NPC 实体** | `game_entities.entities` (type=npc) | `社交.关系` 的 key→{ id: key, name: 名字, type: "npc" } |
| **Player 实体** | `game_entities.entities` (id=player) 或按 name 找 | 固定 `{ id: "player", name: 角色.身份.名字, type: "player" }` |
| **Player–NPC 边** | `game_entities.relationships` | **推导**：对每个 `K in 社交.关系`，`{ fromId: K, toId: "player", relationship: 社交.关系[K].与玩家关系 }` |
| **NPC–NPC 边** | `game_entities.relationships` | **推导**：对每个 K，遍历 `社交.关系[K].关系` 的每个 key B，若 `B in 社交.关系`，则 `{ fromId: K, toId: B, relationship: 社交.关系[K].关系[B] }` |

- **Location / Item / Event / Faction**：  
  图中仅保留 player + NPC；若 `关系` 的 key 不在 `社交.关系`，检索推导边时可**忽略**该条，避免悬空节点。后续若支持「某人在某地」等，可再考虑在 `关系` 中允许 `loc_xxx` 等并约定节点来源，本阶段不引入。

### 1.5 写入（Populate）：仅 tavern_commands

**NPC 与 关系 的写入** 全部经 **tavern_commands**，**不再** 使用 `game_entities`。

**NPC 数据**

- `set 社交.关系.{NPC名}` 全量；`add`/`push` 子路径（好感度、记忆等）— 不变。  
- 创建 NPC 时，可在 value 中直接带 **`关系`**，如 `set 社交.关系.张三` `{ 名字, 性别, ..., 与玩家关系, 关系: { "李四": "师徒" } }`。

**NPC–NPC 关系（`社交.关系[fromId].关系[toId]`）**

- **单条**：`set 社交.关系.张三.关系.李四` `"师徒"` — 若 `关系` 不存在则先建 `{}`，再写 key；`delete 社交.关系.张三.关系.李四` 可删除一条。
- **整块合并**：`set 社交.关系.张三.关系` `{ "李四": "徒弟", "王五": "仇敌" }` — 与**既有** `关系` **合并**（`{ ...existing, ...value }`），不整体替换。清空整块用 `delete 社交.关系.张三.关系`。
- **单 NPC 上限（可选）**：对 `关系` 的 key 数量做上限（如 50），超过时按插入顺序或最近使用裁剪；实现时在 `set`/合并 处检查即可。

**`mergeInto扩展` 与 Step2**

- **`game_entities` 从 Step2 输出中移除**；`mergeInto扩展` **不再** 处理 `game_entities`，**仅** 处理 **semantic_memory**（见第二节）。  
- 关系图 **完全** 由 社交.关系（经 tavern_commands 更新）派生，无单独合并逻辑。

**完全移除 game_entities 的好处**

- **单一写入通道**：实体与关系都经 **tavern_commands**，AI 只需掌握一种输出形态，减少格式错误与漏填。  
- **单一真相来源**：图仅从 **社交.关系** 派生，无 game_entities 与 社交.关系 的同步问题。  
- **实现更简单**：无需 `mergeInto扩展` 对 relationships 的过滤、去重、写 社交.关系；`GameEntitiesOutput`、`GM_Response.game_entities`、parse 对 `game_entities` 的解析均可删除。

### 1.6 检索（Retrieve）的改动

- **输入**：仍为 `saveData` + `RetrievalContext`（playerName, locationDesc, recentNpcNames, maxLines）。
- **数据来源**：
  - `社交.关系`：NPC 列表、`与玩家关系`、每个 NPC 的 `关系`；
  - `角色.身份.名字`：player 的 name。
- **构建 `entityById`（仅 player + NPC）**：
  - `"player"` → `{ id: "player", name: 角色.身份.名字 || "玩家", type: "player" }`；
  - 对每个 `K in 社交.关系`：`K` → `{ id: K, name: 社交.关系[K].名字 || K, type: "npc" }`。
- **构建 `relationships`（用于 buildGraph）**：
  - **Player–NPC**：对每个 `K in 社交.关系`，若 `与玩家关系` 存在，则  
    `{ fromId: K, toId: "player", relationship: 社交.关系[K].与玩家关系 }`；
  - **NPC–NPC**：对每个 `K in 社交.关系`，遍历 `社交.关系[K].关系` 的每个 key `B`，若 `B in 社交.关系`，则  
    `{ fromId: K, toId: B, relationship: 社交.关系[K].关系[B] }`。
- **后续**：`buildGraph`、`bfsHops`、`resolveIds`、`entityLines`、`byRelTriples`、`formatTriples` 等 **逻辑不变**，仅把原来的 `gameEntityIndex.entities` / `gameEntityIndex.relationships` 换成上面两个派生结构。  
- **`resolveIds`**：  
  - `startNames = [playerName, ...recentNpcNames]`；  
  - 映射到 id：`"player"` 或 角色.身份.名字 → `"player"`；若 name 在 `社交.关系` 的 key 或 `社交.关系[k].名字` 中，则 → 对应的 key（作为 id）。  
  - `entityById` / `byName` 从 社交.关系 生成。

### 1.7 需要改动的模块

| 模块 | 改动摘要 |
|------|----------|
| **game.d.ts（NpcProfile）** | 在 与玩家关系 附近增加 `关系?: Record<string, string>`（本 NPC 对其他 NPC；key=对方名字，value=关系标签）。 |
| **gameStateStore** | **移除** `gameEntityIndex`；`关系` 已内含于 `社交.关系`；`loadFromSaveData` / `toSaveData` 仍只读写在 `社交.关系`。 |
| **gameStateIndexer** | `mergeInto扩展`：**删除** 对 `game_entities` 的处理，**仅** 处理 **semantic_memory**；入参可简化为 `{ semantic_memory }` 或保留 `{ game_entities?, semantic_memory? }` 且对 `game_entities` 忽略。`readFrom扩展` 只返回 `semanticMemory`。 |
| **memoryRetrievalService** | 不再从 `readFrom扩展` 取 `gameEntityIndex`；从 `saveData.社交.关系`、`saveData.角色` 按 1.6 **派生** `entityById` 与 `relationships`，其余检索逻辑不变。 |
| **AIBidirectionalSystem** | **不再** 向 `mergeInto扩展` 传入 `game_entities`（或传入 undefined 被忽略）；**移除** 从 `parsedStep2` / `parseAIResponse` 到 `gmResponse.game_entities` 的传递；`executeCommand`：当 `set 社交.关系.{npc}.关系` 且 value 为 plain object 时，**合并**进既有 `关系`；`processPlayerAction` 里 `memoryRetrieve` 的调用不变。 |
| **parseAIResponse / standardize** | **删除** 对 `obj.game_entities` 的提取与 `gm.game_entities` 的赋值。 |
| **inlinePromptsMing（Step2 / Init Step2）** | **从输出格式中移除 `game_entities`**；Step2 格式改为 `{"mid_term_memory","tavern_commands","action_options","semantic_memory"}`。增加说明：NPC–NPC 关系 **仅** 经 **tavern_commands**，如 `set 社交.关系.张三.关系.李四` `"师徒"` 或 `set 社交.关系.张三.关系` `{ "李四":"徒弟" }`（合并）；创建 NPC 时也可在 `set 社交.关系.{npc}` 的 value 中带 `关系`。 |
| **dataDefinitionsMing** | 删除「系统.扩展.游戏实体索引」与 `game_entities`；在 社交.关系 / NpcProfile 中增加 **`关系`**（本 NPC 对其他 NPC；**仅** 经 tavern_commands：`set 社交.关系.{npc}.关系.{其他}` 或 `set 社交.关系.{npc}.关系` 对象合并，或创建 NPC 时在 value 中带 `关系`）。 |
| **GameVariableGameIndexSection / GameVariablePanel** | 实体与关系：从 `社交.关系`（含 与玩家关系、关系）+ 角色 **派生**；删除对 `gameEntityIndex` 的引用。 |
| **GameEntityGraph** | `entities`/`relationships` 接口不变，由上游从 社交.关系 派生后传入；`npcProfiles` 仍从 `社交.关系` 传入。 |
| **GameVariablePanel.mapSavePathToStorePath** | 删除 `系统.扩展.游戏实体索引` → `gameEntityIndex`；`社交.关系.xxx.关系` 作为 `社交.关系` 子路径。 |
| **types/gameStateIndex.ts** | **删除** `GameEntitiesOutput`、`GameEntityIndex` 的对外使用；`EntityRelationship` 可保留为 memoryRetrievalService 等内部推导用的形态。 |
| **types/AIGameMaster.d.ts** | **删除** `GM_Response.game_entities`。 |

### 1.8 迁移与兼容

- **旧档（一次迁移）**：在 **存档迁移或 load 时**，若存在 `系统.扩展.游戏实体索引`：  
  - **entities**：忽略；  
  - **relationships**：对每条 `{ fromId, toId, relationship }`，若 `fromId`、`toId` 均在 `keys(社交.关系)` 且非 player–NPC，则执行：  
    `社交.关系[fromId].关系 = 社交.关系[fromId].关系 || {}`；  
    `社交.关系[fromId].关系[toId] = relationship`；  
    其余丢弃。  
  - 迁移后可从 `系统.扩展` 中删除 `游戏实体索引`（或读档时忽略）。  
- **`关系`**：若某 NpcProfile 无 `关系`，视为 `{}`；推导边时用 `社交.关系[K].关系 || {}`。

### 1.9 删除与简化

- **删除**：`系统.扩展.游戏实体索引`、`gameEntityIndex` 的 store 与读写、`readFrom扩展` 的 `gameEntityIndex` 返回；**`game_entities` 整个通道**：Step2 输出、`GM_Response.game_entities`、`parseAIResponse` 对 `game_entities` 的解析、`mergeInto扩展` 对 `game_entities` 的处理；`GameEntitiesOutput`、`GameEntityIndex` 的 LLM/输出 用途。  
- **保留**：`EntityRelationship` 作 memoryRetrievalService 等内部推导边数组的形态（可选）；`mergeInto扩展` **仅** 处理 **semantic_memory**。  
- **新增**：NpcProfile 的 `关系`；`executeCommand` 对 `set 社交.关系.{npc}.关系` 且 value 为 object 时的 **合并** 语义；在 Step2 / dataDefinitions 中明确 **仅用 tavern_commands 写 关系**。

---

## 二、语义记忆（semantic_memory）的落盘位置

### 2.1 为何不宜放进 社交.关系

- 语义记忆是 `(subject, predicate, object)` 的**事实**，如 `(张三, 是, 玩家的师父)`、`(玩家, 在, 青城山获得玉佩)`。  
- **subject/object** 不限于 NPC：玩家、地点、物品、事件等，无法用 `社交.关系` 的 key（NPC 名）作为主维度。  
- 若按「与某 NPC 相关」拆到 `社交.关系.张三.语义记忆`，则跨 NPC 或玩家中心的三元组要么重复存储，要么难以归属，查询与合并都会变复杂。  
- 结论：**不合并进 社交.关系**。

### 2.2 选项对比

| 选项 | 路径 | 优点 | 缺点 |
|------|------|------|------|
| **A. 保持现状** | `系统.扩展.语义记忆` | 已有实现；移除 game_entities 后 扩展 仅剩 语义记忆 | `系统.扩展` 名不副实（只剩一类数据）；若未来 扩展 再增项，可接受 |
| **B. 并入 社交.记忆** | `社交.记忆.语义三元组` | 与 短期/中期/长期/隐式中期 同属「记忆」； 社交.记忆 已规定为「AI 不可通过 tavern_commands 修改」 | 社交.记忆 现为 `{ 短期, 中期, 长期, 隐式中期 }`，语义三元组结构不同（`{ triples }`）；需在 dataDefinitions 单独说明「语义三元组只读、由 step2 写入」 |
| **C. 提升到 系统 一层** | `系统.语义记忆` | 与 `系统.配置`、`系统.历史` 并列，含义清晰；可为后续「系统级记忆」留空间 | 需在 系统 下新增一级 key；toSaveData/loadFromSaveData、迁移、`readFrom扩展` 的调用处需改为读 `系统.语义记忆` |
| **D. 放入 世界** | `世界.状态.语义记忆` 或 `世界.语义记忆` | 三元组多描述世界/剧情事实，与「世界状态」相关 | 世界 多表达地理、势力、地点等；「张三 是 玩家师父」更偏社交，放 世界 略偏；`世界.状态` 在 schema 中为可选/可重建 |

### 2.3 推荐

- **短期（与 移除 game_entities 一起做）**：**选项 A — 保持 `系统.扩展.语义记忆`**。  
  - 移除 game_entities 后 `系统.扩展` 只含 `语义记忆`，结构更简单；`mergeInto扩展` 仅处理 semantic_memory，`readFrom扩展` 只返回 semanticMemory。  
  - 若希望「扩展」二字更贴切，可后续将 `系统.扩展` 改名为 `系统.语义记忆` 并做一次迁移（等价于选项 C 的扁平版：`系统.扩展` → `系统.语义记忆`，原 `扩展.语义记忆` 提升为 `系统.语义记忆`）。

- **若希望「记忆」在领域上更统一**：**选项 B — `社交.记忆.语义三元组`**。  
  - 在 `社交.记忆` 下增加 `语义三元组?: { triples: SemanticTriple[] }`，与 短期/中期/长期/隐式中期 并列。  
  - 需修改：dataDefinitions（说明 语义三元组 只读、由 step2 写入）、gameStateStore（从 `社交.记忆.语义三元组` 读写 `semanticMemory`）、gameStateIndexer（合并到 `社交.记忆.语义三元组`）、memoryRetrievalService（从 `社交.记忆.语义三元组` 读）、迁移与 `mapSavePathToStorePath`。  
  - 优点：所有「记忆」都在 社交.记忆；缺点：记忆 下混合「字符串数组」与「结构化 triples」，需在文档中写清。

- **若希望 系统 更清晰、 扩展 弃用**：**选项 C — `系统.语义记忆`**。  
  - 新增 `系统.语义记忆: { triples }`；`系统.扩展` 可在此次或后续移除（合并后已无 游戏实体索引，若 扩展 仅剩 语义记忆，可直接迁到 `系统.语义记忆` 并删除 `扩展`）。  
  - 需要：toSaveData/loadFromSaveData、merge 的目标路径、read、迁移、mapSavePathToStorePath 全部从 `系统.扩展.语义记忆` 改为 `系统.语义记忆`。

**建议**：  
- 第一步采用 **选项 A**，完成 game_entities 的移除（关系图仅由 社交.关系 派生），语义记忆仍放在 `系统.扩展.语义记忆`，减少同时改动的范围。  
- 若之后决定统一「记忆」或精简「系统.扩展」，再单独做一次 **B 或 C** 的迁移。

---

## 三、实现顺序建议

1. **Phase 1：移除 game_entities，关系图仅由 社交.关系 派生**  
   - 1.1 在 NpcProfile（game.d.ts）增加 `关系?: Record<string, string>`；  
   - 1.2 修改 `mergeInto扩展`：**删除** 对 `game_entities` 的处理，**仅** 处理 **semantic_memory**；  
   - 1.3 修改 `memoryRetrievalService`：从 `社交.关系`（含 与玩家关系、关系）+ `角色` **派生** entities 与 relationships；  
   - 1.4 在 `executeCommand` 中：当 `set 社交.关系.{npc}.关系` 且 value 为 plain object 时，**合并**进既有 `关系`；  
   - 1.5 **从 Step2 / Init Step2 输出中移除 `game_entities`**；在 inlinePrompts、dataDefinitions 中说明 **仅用 tavern_commands 写 关系**（`set 社交.关系.{npc}.关系.{其他}` 或 `set 社交.关系.{npc}.关系` 对象合并，或创建 NPC 时在 value 中带 `关系`）；  
   - 1.6 在 `parseAIResponse`、`GM_Response`、AIBidirectionalSystem 的 gmResponse 构造与 `mergeInto扩展` 调用中 **删除 `game_entities`**；  
   - 1.7 调整 GameVariable / GameEntityGraph、mapSavePathToStorePath（删除 游戏实体索引 映射；关系 从 社交.关系 派生）；  
   - 1.8 旧档迁移（load/迁移器）：`游戏实体索引.relationships` → `社交.关系[fromId].关系[toId]`（按 1.8）；  
   - 1.9 移除 `gameEntityIndex`、`系统.扩展.游戏实体索引`、`GameEntitiesOutput`、`GM_Response.game_entities` 的读写与 UI，改为从 社交.关系 派生。

2. **Phase 2：语义记忆落盘（可选，若不做则保持 系统.扩展.语义记忆）**  
   - 若选 B：把 `系统.扩展.语义记忆` 迁到 `社交.记忆.语义三元组`，并更新 merge/read/store/映射/迁移；  
   - 若选 C：迁到 `系统.语义记忆`，删除 `系统.扩展` 或清空其内容并弃用。

3. **Phase 3：文档与 CHANGELOG**  
   - 更新 save-schema-v3（NpcProfile 增加 `关系`）、dataDefinitions、CHANGELOG_MING，记录 **game_entities 的完全移除**、关系图仅由 社交.关系 派生、NPC–NPC 关系仅经 tavern_commands 写、以及语义记忆路径（若变动）。

---

## 四、附录：与现有检索/合并的对应关系

- **entityById / entities**：  
  - 原：`gameEntityIndex.entities`。  
  - 新：`[ player 节点 ] + [ 社交.关系 的 k → { id:k, name:名字, type:"npc" } ]`。

- **relationships（用于 buildGraph 与 # 关系）**：  
  - 原：`gameEntityIndex.relationships`。  
  - 新：从 `与玩家关系` 推导的 player–NPC 边 + 从各 `社交.关系[K].关系` 推导的 NPC–NPC 边（仅保留 toId 在 社交.关系 的边）。

- **resolveIds(recentNpcNames, …)**：  
  - 原：经 `entityById`、`byName`、`entities` 解析。  
  - 新：`entityById`/`byName` 从 社交.关系 构建；`recentNpcNames` 仍为 `Object.keys(社交.关系).slice(0,10)`（逻辑不变）。

- **关系写入（无 Step2 合并）**：  
  - 原：`game_entities.relationships` → `mergeInto扩展` → `游戏实体索引.relationships`。  
  - 新：**仅** 经 **tavern_commands** 写 `社交.关系[fromId].关系[toId]`（`set 社交.关系.{npc}.关系.{其他}` 或 `set 社交.关系.{npc}.关系` 对象合并）；`game_entities` 已移除，不再有 Step2 的 relationship 合并。

- **GameVariable「实体与语义」**：  
  - 实体列表：从 社交.关系 派生（并加 player）；关系列表：从 与玩家关系 + 各 `社交.关系[K].关系` 派生；  
  - 语义记忆：仍为 `系统.扩展.语义记忆`（或按 Phase 2 迁到 社交.记忆 / 系统.语义记忆）。

---

## 五、语义记忆：排序、检索与可视化

> 当 triples 数量增加时，需要按 **subject**、**timestamp**、**importance** 等做排序与筛选，以 **选择性** 抽取相关记忆注入提示词，并在 **可视化** 中支持同类能力。

### 5.1 现状

- **SemanticTriple**：`subject`, `predicate`, `object`；可选 `timestamp?: string`，`importance?: number`，`category?: string`。
- **检索**：`queryByTimeImportance(store, 15)`：`recency = t.timestamp ? 1 : 0.5`（二值，无真实时间衰减），`score = importance × recency`，按 score 降序取 15；**未**按 subject/object 与上下文（player、recentNpcNames）加权重。
- **合并**：`mergeTriples` 直接 append；LLM 可填 `timestamp`、`importance`，提示词未强制，**合并时也未自动补** `timestamp`。
- **可视化**：`GameVariableGameIndexSection` 按 triples 数组顺序展示；显示 importance、category，**不显示 timestamp**；**无**排序、筛选、分组。

### 5.2 设计目标

1. **按 subject 的排序与筛选**：支持按 subject 排序、按 subject 包含过滤，便于数据增多后检索与查看。  
2. **timestamp 与 importance 用于选择性抽取**：用 **真实时间衰减**（timestamp 越旧，recency 越低）与 importance 综合排序；数据量增长时仍只取 top N，保证 token 有界。  
3. **检索时结合上下文**：若 subject 或 object 属于 玩家、recentNpcNames 等，适当 **加权**，使与当前场景更相关的 triples 优先。  
4. **可视化**：复用同一套排序维度与规则；支持按 subject / predicate / object / importance / timestamp / category 排序、升/降序；可选筛选、分组，便于排查与浏览。

### 5.3 约定与类型

**timestamp**

- **格式**：建议 **ISO8601**（如 `2026-01-15T12:00:00.000Z`）或与 **元数据.时间** 同形的可排序串（如 `"年-月-日-时-分"` 或 `"YYYY-MM-DD-HH-mm"`），便于解析、比较与排序。  
- **写入**：LLM 在 `semantic_memory.triples` 中可填 `timestamp`；若 **未填**，**合并时**（`mergeTriples` 或 `mergeInto扩展` 的 semantic 分支）自动补：  
  - 优先用 `元数据.时间` 转成上述可排序串；若无，用 `new Date().toISOString()`。  
- **SemanticTriple** 保持 `timestamp?: string`；在 gameStateIndex 或共享 util 中约定「可排序 timestamp」的解析与比较规则。

**importance、category**

- 保持现有 `importance?: number`（1–10）、`category?: string`；在排序、筛选、检索中统一使用。

### 5.4 检索（memoryRetrievalService）增强

**recency（真实时间衰减）**

- 从 `saveData` 取「当前」参考时间：`元数据.时间` 或 `new Date()`；将 `元数据.时间` 转为可与 `timestamp` 比较的数值或字典序串。  
- 对每个 triple：  
  - 若 `t.timestamp` 存在：解析为可比较值，与参考时间求「时间差」（如秒、分钟、或游戏内 ticks），`age = max(0, 差)`；  
  - `recency = decay(age)`，例如 `exp(-age / halflife)` 或 `1 / (1 + ageInTurns)`；halflife / ageInTurns 可配置（如 10 回合、若干分钟）。  
  - 若 `t.timestamp` 不存在：`recency = 0.2`（或一固定低值），视为最旧。  

**subject/object 与上下文**

- 上下文集合：`ctxIds = { "玩家", ctx.playerName, "player", ...(ctx.recentNpcNames || []) }`（去重、去空）。  
- 对每个 triple：若 `t.subject` 或 `t.object` 属于 `ctxIds`，则 `contextBoost = 1 + β`（如 β=0.5）；否则 `contextBoost = 1`。  
- **综合分**：`score = contextBoost × importance × recency`（importance 缺省 5）；按 score 降序取 top 15（或可配置 limit）。  

**与现有 `retrieve` 的衔接**

- 将原 `queryByTimeImportance(store, 15)` 替换为上述新实现（如 `querySemanticTriples(store, ctx, { limit: 15, now, halflifeTurns })`）；  
- `retrieve` 的 `# 语义记忆` 块仍为 `formatTriples(selected, ctx.playerName)`，maxLines 等逻辑不变。

### 5.5 排序工具（检索与可视化复用）

在 `memoryRetrievalService` 或共享 util 中提供：

- **`parseTripleTimestamp(t: SemanticTriple, now?: 元数据.时间 | Date): number`**  
  - 将 `t.timestamp` 解析为可比较数值（如 Unix ms 或 `YYYYMMDDHHmm`）；无则返回 0 或 -Infinity。  

- **`sortTriples(triples: SemanticTriple[], by: 'subject'|'predicate'|'object'|'importance'|'timestamp'|'category', order: 'asc'|'desc', now?: ...): SemanticTriple[]`**  
  - 按 `by` 排序；`importance`、`timestamp` 需处理缺省（importance 缺省 5；timestamp 缺省视为最旧）。  
  - 可供 `querySemanticTriples` 内部与 `GameVariableGameIndexSection` 共用。

### 5.6 可视化（GameVariableGameIndexSection 语义记忆块）

- **展示**：每条 triple 增加 **timestamp**（若有），格式化为可读（如 `YYYY-MM-DD HH:mm` 或 游戏内时间串）。  
- **排序**：  
  - 下拉：按 **subject** | predicate | object | importance | **timestamp** | category；  
  - 顺序：升序 / 降序；  
  - 默认：**按 timestamp 降序**（最新在前），无 timestamp 的排到最后。  
- **筛选（可选，按需实现）**：  
  - subject 包含：文本输入，`subject` 或 `object` 包含即保留；  
  - category：下拉或多选；  
  - importance ≥：滑块或输入；  
  - timestamp 区间：若格式统一，可提供起止（先支持「全部」即可）。  
- **按 subject 分组（可选）**：  
  - 开关「按 subject 分组」：分组后按 subject 排序，同组内再按 timestamp 降序；  
  - 便于数据多时按人物/主体浏览。

### 5.7 合并时自动补 timestamp

在 **gameStateIndexer** 的 `mergeTriples` 或调用处（处理 `incoming.semantic_memory.triples` 时）：

- 对每条 `t`：若 `!t.timestamp`，则  
  - `t = { ...t, timestamp: 元数据.时间 ? formatGameTimeToSortable(元数据.时间) : new Date().toISOString() }`；  
- 再 `combined.push(t)`。  
- `formatGameTimeToSortable`：如 `"{年}-{月}-{日}-{小时}-{分钟}"` 或转为 ISO（若 元数据.时间 有「基准真实时间」映射则用 ISO 更稳）。  

这样新写入的 triple 都带 timestamp，旧数据无则 recency 取低值，检索与排序行为一致。

### 5.8 Step2 / 数据定义

- 在 **inlinePromptsMing** 的 `semantic_memory` 说明中：  
  - 建议填 **`timestamp`**（ISO 或与 元数据.时间 同形）和 **`importance`**，便于检索与可视化；若未填，**系统在合并时会自动补 timestamp**。  
- **dataDefinitionsMing** 中 语义记忆 / SemanticTriple：  
  - 注明 `timestamp`、`importance`、`category` 用于 **排序与选择性抽取**；  
  - 检索按 importance×recency×上下文 取 top N；可视化可同样按这些维度排序、筛选、分组。

### 5.9 需要改动的模块

| 模块 | 改动摘要 |
|------|----------|
| **gameStateIndexer** | 在合并 `semantic_memory.triples` 时，对缺 `timestamp` 的项自动补（元数据.时间 或 `new Date().toISOString()`）。 |
| **memoryRetrievalService** | 实现真实 **recency 衰减**（解析 timestamp、与「当前」比较、`decay(age)`）；实现 **contextBoost**（subject/object ∈ 玩家、recentNpcNames）；`queryByTimeImportance` 替换为 `querySemanticTriples(store, ctx, opts)` 或在其内实现新逻辑；提供 **`sortTriples`**（及可选 `parseTripleTimestamp`）供检索与 UI 复用。 |
| **GameVariableGameIndexSection** | 语义记忆：展示 **timestamp**；增加 **排序**（subject / predicate / object / importance / timestamp / category，升序/降序，默认 timestamp 降序）；**筛选**（subject 包含、category、importance 下限、可选时间区间）；**按 subject 分组**（可选）；使用 `sortTriples` 或同规则。 |
| **inlinePromptsMing / dataDefinitionsMing** | 在 semantic_memory / SemanticTriple 说明中补充：`timestamp`、`importance` 用于排序与选择性抽取；未填 timestamp 时由系统合并时自动补。 |
| **types/gameStateIndex.ts** | `SemanticTriple.timestamp` 注释中约定：建议 ISO 或与 元数据.时间 同形的可排序串；`importance`、`category` 用于排序与筛选。 |

### 5.10 实现顺序建议（在 Phase 1 之后或并行）

1. **5.1** 在 gameStateIndexer 合并 semantic 时 **自动补 timestamp**；  
2. **5.2** 在 memoryRetrievalService 实现 **recency 衰减 + contextBoost**，替换 `queryByTimeImportance`；  
3. **5.3** 实现 **sortTriples**（及时间解析）并用于检索与 UI；  
4. **5.4** 在 GameVariableGameIndexSection 语义记忆块加 **排序、timestamp 展示、筛选、分组**；  
5. **5.5** 更新 inlinePrompts、dataDefinitions、SemanticTriple 注释。
