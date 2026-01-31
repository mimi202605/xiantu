# 世界·地图·NPC 详细实现计划

> 基于 `plan-world-npc-comprehensive.md`，结合 codebase 现状，制定可执行的实现计划。旨在补全上一轮实现中的遗漏。

---

## 一、Phase 1 总览

| 子阶段 | 内容 | 预估 |
|--------|------|------|
| 1.1 | 类型定义与数据结构 | 1 天 |
| 1.2 | NPC 类型过滤逻辑（deriveFrom社交关系、RelationshipNetworkPanel、recentNpcNames） | 1 天 |
| 1.3 | GameVariablePanel 排序、buildNarrativeState 注入规则 | 1 天 |
| 1.4 | 地图数据结构（LocationEntry、探索记录、地点NPC） | 1 天 |
| 1.5 | 数据迁移、executeCommand、dataDefinitions | 1 天 |
| 1.6 | 预留接口、联调与回归 | 0.5 天 |

---

## 二、Phase 1.1：类型定义与数据结构

### 2.1 `game.d.ts` 修改

**文件**：`src/types/game.d.ts`

#### 2.1.1 NpcProfile 新增 `类型`

```ts
// 在 NpcProfile 的「社交关系」区域，与 与玩家关系 并列
类型?: "重点" | "普通";  // 必填（新建时）；旧存档缺省视为 "重点"
```

- **位置**：在 `与玩家关系` 之后、`关系` 之前
- **可选**：用 `?` 以兼容旧存档；新建 NPC 时由 validateAndRepairNpcProfile 补全为 `"重点"`

#### 2.1.2 LocationEntry 与 WorldLocation 扩展

**新增**：`LocationEntry` 接口（与 `WorldLocation` 兼容，用于新建地点）

```ts
/** 地点条目（递归结构，用于地图系统） */
export interface LocationEntry {
  名称: string;
  描述?: string;
  上级?: string;         // 父地点名称，根节点无
  内部?: LocationEntry[]; // 子地点，递归
}
```

**扩展**：`WorldLocation` 增加可选字段

```ts
// 在现有 WorldLocation 中增加
上级?: string;
内部?: LocationEntry[];  // 或 WorldLocation[]，与 LocationEntry 结构一致
```

- **兼容**：旧 `WorldLocation` 无 `上级`、`内部` 时视为顶层地点

#### 2.1.3 LocationEntry 新增 `地点NPC`

```ts
// 在 LocationEntry 中增加（存于各地点内，可追溯各地点的 NPC）
地点NPC?: string[];  // 本地的 NPC 名列表；玩家离开后重点 NPC 会离开，普通 NPC 留守
```

#### 2.1.4 探索记录存储

- **路径**：`世界.状态.探索记录`
- **类型**：`string[]`（已探索的地点名称）
- **说明**：`世界.状态` 当前在 toSaveData 中为 `{}`，需扩展

### 2.2 `saveSchemaV3.ts` / `gameStateStore` 修改

**文件**：`src/types/saveSchemaV3.ts`、`src/stores/gameStateStore.ts`

- **SaveDataV3**：`世界: { 信息: WorldInfo; 状态?: { 探索记录?: string[] } }`
- **GameState**：新增 `explorationRecord: string[] | null`
- **loadFromSaveData**：从 `v3?.世界?.状态?.探索记录` 读取，缺省为 `[]`
- **toSaveData**：`世界: { 信息: this.worldInfo, 状态: { 探索记录: this.explorationRecord ?? [] } }`

### 2.3 `dataValidation.ts` 修改

**文件**：`src/utils/dataValidation.ts`

- **validateAndRepairNpcProfile**：若 `类型` 缺失或非法，设为 `"重点"`
- **位置**：在修复 `与玩家关系` 之后增加：

```ts
if (repairedNpc.类型 !== '重点' && repairedNpc.类型 !== '普通') {
  repairedNpc.类型 = '重点';
}
```

### 2.4 `dataRepair.ts` 修改

**文件**：`src/utils/dataRepair.ts`

- 在 `repairSaveData` 中，对每个 NPC 补全 `类型`：若缺失则设为 `"重点"`
- 在 `repairNpc` 中，同上

---

## 三、Phase 1.2：NPC 类型过滤逻辑

### 3.1 `deriveFrom社交关系` 修改

**文件**：`src/services/memoryRetrievalService.ts`

**修改**：

1. 函数签名：接受 `Record<string, NpcProfile>`，其中 `NpcProfile` 含 `类型`
2. 实体过滤：仅当 `npc.类型 === "重点"` 时加入 `entities`
3. 边过滤：仅当 `fromId` 与 `toId` 均在 `entities` 中（即均为重点 NPC）时加入 `relationships`
4. 关系中的普通 NPC：若 A（重点）的 `关系[B]` 存在且 B 为普通 NPC，不输出边 A→B

**实现**：

```ts
export function deriveFrom社交关系(
  社交关系: Record<string, { 名字?: string; 与玩家关系?: string; 关系?: Record<string, string>; 类型?: string }> | null | undefined,
  角色身份: { 名字?: string } | null | undefined
): DerivedEntityIndex {
  const entities: GameEntity[] = [];
  const relationships: EntityRelationship[] = [];
  const rels = 社交关系 && typeof 社交关系 === 'object' ? 社交关系 : {};
  const playerName = 角色身份?.名字 || '玩家';
  entities.push({ id: 'player', name: playerName, type: 'player' });

  // 仅重点 NPC 作为实体
  const importantNpcIds = new Set<string>();
  for (const K of Object.keys(rels)) {
    const npc = rels[K];
    if (!npc || typeof npc !== 'object') continue;
    const 类型 = (npc as any).类型;
    if (类型 !== '重点' && 类型 !== '普通') {
      importantNpcIds.add(K); // 缺省视为重点
    } else if (类型 === '重点') {
      importantNpcIds.add(K);
    }
  }

  for (const K of importantNpcIds) {
    const npc = rels[K];
    if (!npc || typeof npc !== 'object') continue;
    entities.push({ id: K, name: npc.名字 ?? K, type: 'npc' });
    const 与玩家关系 = npc.与玩家关系;
    if (与玩家关系 != null && String(与玩家关系)) {
      relationships.push({ fromId: K, toId: 'player', relationship: String(与玩家关系) });
    }
    const 关系 = npc.关系;
    if (关系 && typeof 关系 === 'object') {
      for (const B of Object.keys(关系)) {
        if (!importantNpcIds.has(B)) continue; // 仅输出两端均为重点的边
        const lab = 关系[B];
        if (lab != null && typeof lab === 'string') relationships.push({ fromId: K, toId: B, relationship: lab });
      }
    }
  }
  return { entities, relationships };
}
```

### 3.2 `RelationshipNetworkPanel` 人物列表过滤

**文件**：`src/components/dashboard/RelationshipNetworkPanel.vue`

**修改**：`relationshipStats` 或 `filteredRelationships` 的 computed

- 当前：`Object.entries(raw)` 遍历所有 NPC
- 修改：仅保留 `类型 === "重点"` 的 NPC（缺省视为重点）

```ts
// 在 relationshipStats 的 list 构建中
for (const [key, value] of entries) {
  // ... 现有校验 ...
  const npc = value as any;
  const 类型 = npc.类型;
  if (类型 === '普通') continue; // 跳过普通 NPC
  list.push({ ...npc, 名字: finalName } as NpcProfile);
}
```

### 3.3 `recentNpcNames` 修改

**文件**：`src/utils/AIBidirectionalSystem.ts`

**当前**：`recentNpcNames: Object.keys(stateForAI.社交?.关系 || {}).slice(0, 10)`

**修改**：仅取重点 NPC 的 key，且需结合「玩家所在地点」的 NPC（见 3.4）

```ts
// 1. 重点 NPC：类型==="重点" 或 类型 缺失
const importantNpcNames = Object.entries(stateForAI.社交?.关系 || {})
  .filter(([, npc]) => {
    const t = (npc as any)?.类型;
    return t !== '普通';
  })
  .map(([k]) => k);

// 2. 玩家所在地点的 NPC（从 地点NPC 或 社交.关系 按 当前位置.描述 匹配）
const playerLocDesc = (stateForAI.角色?.位置 as any)?.描述;
const npcsAtLocation = getNpcsAtLocation(stateForAI, playerLocDesc);

// 3. 合并去重，重点 NPC 优先，最多 10 个
const recentNpcNames = [...new Set([...importantNpcNames, ...npcsAtLocation])].slice(0, 10);
```

- **依赖**：需实现 `getNpcsAtLocation(saveData, locationDesc): string[]`（见 3.5）

---

## 四、Phase 1.3：GameVariablePanel 排序与 buildNarrativeState 注入

### 4.1 GameVariablePanel 社交.关系 排序

**文件**：`src/components/dashboard/GameVariablePanel.vue`

**修改**：`socialRelations` 或传给子组件的 `社交.关系` 数据

- 当前：`socialRelations = gameStateStore.relationships ?? {}`
- 需求：展示时**排序**，重点在前、普通在后

**实现**：在 `GameVariableSaveDataSection` 或 `TreeNode` 的父级，对 `社交.关系` 的 key 排序后再渲染。

- **方案 A**：在 `GameVariablePanel` 中提供 `sortedSocialRelations` computed，按 `类型` 排序 key，再按 `好感度` 等二次排序
- **方案 B**：在 `GameVariableSaveDataSection` 的 `displaySaveData` 中，对 `社交` 下的 `关系` 做排序

**推荐**：在 `GameVariableSaveDataSection` 的 `displaySaveData` 中，对 `社交.关系` 的 key 排序：

```ts
// displaySaveData 中，对 社交.关系 排序
const 关系 = (v3 as any).社交?.关系;
if (关系 && typeof 关系 === 'object') {
  const keys = Object.keys(关系);
  const sortedKeys = keys.sort((a, b) => {
    const ta = (关系[a] as any)?.类型;
    const tb = (关系[b] as any)?.类型;
    if (ta === '普通' && tb !== '普通') return 1;
    if (ta !== '普通' && tb === '普通') return -1;
    return ((关系[b] as any)?.好感度 ?? 0) - ((关系[a] as any)?.好感度 ?? 0);
  });
  const sorted关系: Record<string, unknown> = {};
  for (const k of sortedKeys) sorted关系[k] = 关系[k];
  (result as any).社交 = { ...(result as any).社交, 关系: sorted关系 };
}
```

- **注意**：`TreeNode` 使用 `v-for="(value, key) in displaySaveData"` 遍历顶层；`社交` 是顶层 key，其 value 是对象。要排序 `社交.关系`，需在构建 `displaySaveData` 时对 `社交.关系` 做排序后的对象。但 `displaySaveData` 返回的是 `{ 元数据, 角色, 社交, 世界, 系统 }`，`社交` 来自 `v3.社交`。所以需要在 `社交` 内部对 `关系` 做排序。即 `社交: { ...v3.社交, 关系: sorted关系 }`。

### 4.2 `getNpcsAtLocation` 实现

**文件**：新建 `src/utils/locationUtils.ts` 或放入 `memoryRetrievalService.ts`

```ts
/**
 * 获取某地点的 NPC 名列表。
 * 优先从 世界.信息.地点NPC[地点名称] 读取；
 * 若无，则从 社交.关系 中按 当前位置.描述 匹配（包含或相等）。
 */
export function getNpcsAtLocation(saveData: Record<string, unknown>, locationDesc?: string): string[] {
  if (!locationDesc || typeof locationDesc !== 'string') return [];
  const 地点NPC = (saveData?.世界 as any)?.信息?.地点NPC;
  if (地点NPC && typeof 地点NPC === 'object' && Array.isArray(地点NPC[locationDesc])) {
    return 地点NPC[locationDesc];
  }
  const 关系 = (saveData?.社交 as any)?.关系;
  if (!关系 || typeof 关系 !== 'object') return [];
  const result: string[] = [];
  for (const [name, npc] of Object.entries(关系)) {
    const desc = (npc as any)?.当前位置?.描述;
    if (typeof desc === 'string' && (desc === locationDesc || desc.includes(locationDesc) || locationDesc.includes(desc))) {
      result.push(name);
    }
  }
  return result;
}
```

- **匹配规则**：精确相等，或一方包含另一方（需防误匹配，可先做精确匹配）

### 4.3 `retrieve` 与 `buildNarrativeState` 的 NPC 注入规则

**文件**：`src/services/memoryRetrievalService.ts`、`src/utils/AIBidirectionalSystem.ts`

**规则**（来自 plan 3.4）：

1. **玩家处于该 NPC 所在地点**：将 `getNpcsAtLocation` 返回的 NPC 加入注入范围
2. **被提及**：主故事/指令中显式提到某 NPC 名时注入（需解析，可后续实现）
3. **重点 NPC 关系网内的普通 NPC**：以摘要形式注入（如 "A 认识 B（路人）"）

**当前**：`retrieve` 的 `ctx.recentNpcNames` 由调用方传入。调用方为 `AIBidirectionalSystem`，需传入正确的 `recentNpcNames`（见 3.3）。

**注入逻辑**：`retrieve` 内部使用 `deriveFrom社交关系`，已过滤为仅重点 NPC。但 `# 相关实体` 和 `# 关系` 只含重点 NPC。**玩家所在地点的普通 NPC** 需单独注入到 prompt。这可能在 `buildNarrativeState` 或 `assembleSystemPrompt` 中处理——将「当前地点的 NPC 列表」作为额外块注入。

**实现**：在 `AIBidirectionalSystem` 的 prompt 组装中，增加「当前地点 NPC」块：

```ts
const npcsAtLocation = getNpcsAtLocation(stateForAI, playerLocDesc);
if (npcsAtLocation.length > 0) {
  // 从 社交.关系 取这些 NPC 的摘要，注入到 prompt
  const npcSummaries = npcsAtLocation.map(name => {
    const npc = (stateForAI.社交?.关系 as any)?.[name];
    if (!npc) return null;
    return `- ${name}：${npc.与玩家关系 || '路人'}，${npc.当前外貌状态 || ''}`;
  }).filter(Boolean);
  if (npcSummaries.length > 0) {
    // 追加到 retrievalBlock 或单独块
    retrievalBlock += `\n# 当前地点人物\n${npcSummaries.join('\n')}`;
  }
}
```

- **注意**：`retrievalBlock` 来自 `memoryRetrieve`，其 `# 相关实体` 和 `# 关系` 已过滤。当前地点 NPC 可能已在 `recentNpcNames` 中——若 `recentNpcNames` 包含 `npcsAtLocation`，则 `retrieve` 会通过 BFS 包含这些 NPC。但 `deriveFrom社交关系` 只输出重点 NPC，所以**普通 NPC 不会出现在 # 相关实体 和 # 关系**。因此需**单独注入**当前地点的普通 NPC 摘要。

---

## 五、Phase 1.4：地图数据结构

### 5.1 `gameStateStore` 扩展

- **explorationRecord**：`string[] | null`，从 `世界.状态.探索记录` 读写
- **loadFromSaveData**：`this.explorationRecord = Array.isArray(v3?.世界?.状态?.探索记录) ? deepCopy(v3.世界.状态.探索记录) : [];`
- **toSaveData**：`世界: { 信息: this.worldInfo, 状态: { 探索记录: this.explorationRecord ?? [] } }`

### 5.2 `executeCommand` 支持新路径

**文件**：`src/utils/AIBidirectionalSystem.ts`

- `push 世界.状态.探索记录`：value 为地点名称（string），若不在数组中则 push
- 地点NPC 存于各地点内：`push 世界.信息.地点信息` 时 value 可带 `地点NPC: [NPC名]`；`set 世界.信息.地点信息[i].地点NPC` 更新
- `push 世界.信息.地点信息`：value 为 `LocationEntry`，push 到数组
- `push 世界.信息.地点信息[i].内部`：value 为 `LocationEntry`，push 到 `内部` 数组
- **难点**：`地点信息[i]` 的 `i` 为索引，若用名称查找需遍历。可支持 `set 世界.信息.地点信息` 整体替换，或提供 `findLocationIndexByName` 辅助。

**建议**：Phase 1 先支持 `push 世界.信息.地点信息` 和 `push 世界.状态.探索记录`；子地点的 `push 世界.信息.地点信息[i].内部` 可后续实现，或由 LLM 在 `push 世界.信息.地点信息` 时直接带 `内部` 数组。

### 5.3 探索记录更新时机

- **触发**：玩家位置变化时（`set 角色.位置`）
- **逻辑**：若 `角色.位置.描述` 不在 `探索记录` 中，则 `push 世界.状态.探索记录` 该描述
- **实现位置**：在 `executeCommand` 处理 `set 角色.位置` 时，同步更新 `世界.状态.探索记录`；或 `processGmResponse` 执行完所有 commands 后，根据最终 `角色.位置.描述` 更新探索记录

---

## 六、Phase 1.5：数据迁移、executeCommand、dataDefinitions

### 6.1 存档迁移

**文件**：`src/utils/saveMigration.ts`

- 若存档无 `世界.状态.探索记录`，设为 `[]`
- 若 NPC 无 `类型`，设为 `"重点"`
- 旧存档若有 `世界.信息.地点NPC`（Record），迁移到各地点内的 `地点NPC`

### 6.2 `executeCommand` 路径支持

- `set 社交.关系.{npc}.类型`：允许
- `push 世界.状态.探索记录`：需确保 `世界.状态` 存在；若 path 为 `世界.状态.探索记录`，get 时若不存在则初始化为 `[]`
- `set 世界.信息.地点信息[i].地点NPC`：允许
- `push 世界.信息.地点信息`：允许

### 6.3 `dataDefinitionsMing` 更新

**文件**：`src/utils/prompts/definitions/ming/dataDefinitionsMing.ts`

- **NPC 结构**：增加 `类型: "重点"|"普通"`，说明主线/剧情新建为 `"重点"`，地点背景 NPC 为 `"普通"`
- **地点信息**：增加 `上级`、`内部`（递归），`push 世界.信息.地点信息` 示例
- **探索记录**：说明 `push 世界.状态.探索记录`（系统维护，LLM 一般不直接写）
- **地点 NPC**：说明 `地点NPC` 存于各地点内；push 地点时可带 `地点NPC: [NPC名]`；玩家离开后重点 NPC 会离开，普通 NPC 留守

### 6.4 `inlinePromptsMing` 更新

- 创建 NPC 时需带 `类型`；若为故事中出现的，填 `"重点"`
- 地点相关：进入新地点时 `push 世界.信息.地点信息`，可带 `地点NPC: [NPC名]`；地点NPC 存于各地点内

---

## 七、Phase 1.6：预留接口与联调

### 7.1 预留接口

**文件**：新建 `src/utils/worldHeartbeat.ts`（或放入现有 utils）

```ts
/** 预留：获取 NPC 更新优先级列表 */
export function getNpcUpdatePriority(saveData: Record<string, unknown>, worldEvent?: unknown): string[] {
  const 关系 = (saveData?.社交 as any)?.关系;
  if (!关系 || typeof 关系 !== 'object') return [];
  return Object.keys(关系).filter(k => (关系[k] as any)?.类型 === '重点');
}

/** 获取某地点的 NPC 名列表 */
export { getNpcsAtLocation } from './locationUtils';
```

### 7.2 升级逻辑：普通 → 重点

**触发**：`processGmResponse` 后扫描 tavern_commands

- 若存在 `push 社交.关系.{npc}.记忆` 或 `add 社交.关系.{npc}.好感度` 等与某 NPC 的互动指令
- 且该 NPC 当前 `类型 === "普通"`
- 则追加 `set 社交.关系.{npc}.类型 "重点"`

**实现**：在 `processGmResponse` 末尾，遍历执行的 commands，检测与 NPC 的互动，若 NPC 为普通则升级。

---

## 八、Phase 2：NPC 对话系统（概要）

- `RelationshipNetworkPanel`：新增「对话」tab
- `apiManagementStore`：新增 `npc_dialogue` 功能类型
- NPC 对话 prompt、调用逻辑、结束时的 memory takeaway + 更新指令
- 指令白名单校验
- 普通 NPC 对话后升级为重点

（详细步骤见 `plan-world-npc-comprehensive.md` 第四节）

---

## 九、易遗漏点检查清单

| 项目 | 位置 | 说明 |
|------|------|------|
| NpcProfile.类型 默认值 | validateAndRepairNpcProfile, dataRepair | 缺省 `"重点"` |
| deriveFrom社交关系 过滤 | memoryRetrievalService | 仅重点 NPC 作为实体和边 |
| recentNpcNames 过滤 | AIBidirectionalSystem | 仅重点 + 当前地点 NPC |
| getNpcsAtLocation | 新建 locationUtils | 地点NPC 优先，否则按 当前位置.描述 匹配 |
| 当前地点普通 NPC 注入 | AIBidirectionalSystem | 单独块注入摘要 |
| RelationshipNetworkPanel 列表 | RelationshipNetworkPanel | 仅展示重点 NPC |
| GameVariable 社交.关系 排序 | GameVariableSaveDataSection | 重点在前、普通在后 |
| explorationRecord 读写 | gameStateStore | 世界.状态.探索记录 |
| 地点NPC 读写 | worldInfo | 世界.信息.地点NPC |
| executeCommand 新路径 | AIBidirectionalSystem | 探索记录、地点NPC、类型 |
| 探索记录更新 | processGmResponse | 角色.位置 变化时 push |
| 升级逻辑 | processGmResponse | NPC 互动后 普通→重点 |
| dataDefinitions | dataDefinitionsMing | 类型、地点、探索记录、地点NPC |
| inlinePrompts | inlinePromptsMing | NPC 创建带 类型 |
| 存档迁移 | saveMigration | 类型、探索记录、地点NPC 默认值 |

---

## 十、测试要点

1. **旧存档加载**：无 `类型` 的 NPC 显示为重点，可正常游戏
2. **人物关系 UI**：仅显示重点 NPC；普通 NPC 不出现
3. **游戏变量**：社交.关系 展示时重点在前
4. **实体与关系图**：仅含重点 NPC
5. **当前地点**：玩家在某地点时，该地点的普通 NPC 被注入 prompt
6. **新建 NPC**：LLM 创建 NPC 时带 `类型`，校验可补全
7. **探索记录**：角色.位置 变化时，新地点加入探索记录
8. **升级**：与普通 NPC 互动后，其变为重点并出现在人物关系列表
