# 大版本迁移计划：修仙数据结构 → 通用 Ming 结构

> 目标：将代码库中残留的修仙相关数据名与结构统一迁移为通用命名；移除未使用的世界信息字段。**不保证对旧存档的兼容。**

---

## 一、术语与数据映射总表（已确认）

| 旧（修仙） | 新（通用/Ming） | 说明 |
|-----------|----------------|----------------|
| 灵根 | 特质 | 角色身份字段；开局页先用 creationData 灵根内容 populate，数据名与存档一致为「特质」 |
| 先天六司 / 后天六司 | 先天六维属性 / 后天六维属性 | **数据结构更名**；六项键名保留：体质、直觉、悟性、气运、魅力、心性 |
| 境界 | 地位 | **统一使用地位**，数据结构与引用全部改为「地位」 |
| 气血 | 体力 | 数值对 `{当前, 上限}`，主角与 NPC 统一 |
| 灵气 | 精力 | 同上 |
| 神识 | 洞察力 | **数据结构更名**，保留用途 |
| 灵石 / 金钱四档 | 金钱，四档改为 现金/铜/银/金 | 四档键名：下品→现金，中品→铜，上品→银，极品→金 |
| 大陆信息 / continents | **移除** | 开局已不生成，完全删除此数据结构 |
| 势力信息 | **移除** | 同上 |

---

## 二、涉及文件与修改点（按模块）

### 2.1 类型定义 `src/types/`

- **game.d.ts**
  - `InnateAttributes` 注释/文档：六司 → 六维属性。
  - `InnateAttributesEnglish`：保留 root_bone/spirituality 等键名（或统一为 constitution/intuition 等，可选）。
  - `AttributeBonus`：`气血上限`/`灵气上限`/`神识上限` → `体力上限`/`精力上限`（神识可选保留）。
  - `PlayerStatus`：`气血`/`灵气`/`神识` → `体力`/`精力`（神识可选）；`境界` → `地位`（或保留 `境界` 并加 deprecated，非 Ming 用）。
  - `PlayerAttributes`：同上。
  - `Inventory`：`灵石` 仅保留为 `@deprecated`，主键为 `金钱`；若统一叫「金币」可增加类型别名或注释。
  - `NpcProfile`：`境界`/`灵根`/`先天六司` 已 deprecated → 统一为 `地位`/`特质`/`先天六维属性`/`后天六维属性`；`属性` 内 `气血`/`灵气`/`神识` → `体力`/`精力`。
  - `CharacterBaseInfo`：`灵根` → `特质`（主），`灵根` 保留 deprecated；`先天六司`/`后天六司` → `先天六维属性`/`后天六维属性`。
  - `WorldInfo`：删除 `大陆信息`、`continents`、`势力信息` 字段（或标记 deprecated 并逐步删引用）。
  - `WorldContinent` / `WorldFaction`：若不再使用，可移入 legacy 文件或删除。
  - `Realm`：改名为 `地位`（Status/Rank）或保留 `Realm` 仅给非 Ming；相关 `RealmLevel`、`RealmStage` 等可保留或重命名。
  - 修炼/功法/宗门相关类型：已标注退役的可保留不写，或集中到 `legacy.d.ts`。

- **index.ts**
  - `SpiritRoot`：可保留类型用于「特质」的完整结构（开局页用）；或重命名为 `Trait` 并保留字段兼容。
  - `WorldInfo`：与 game.d.ts 一致，移除 `大陆信息`/`势力信息`。

### 2.2 默认值与迁移 `src/utils/`

- **saveMigration.ts**
  - 默认角色/世界：`灵根` → `特质`，`先天六司`/`后天六司` → `先天六维属性`/`后天六维属性`，`气血`/`灵气`/`神识` → `体力`/`精力`，`境界` → `地位`，`灵石` → `金钱`（或 `金币`）。
  - 根骨/灵性迁移逻辑：已改为体质/直觉，可保留或删除。
  - 世界默认：不再写 `大陆信息`/`势力信息`。

- **dataRepair.ts**
  - 所有 `先天六司`/`后天六司` → `先天六维属性`/`后天六维属性`。
  - `气血`/`灵气`/`神识` → `体力`/`精力`（神识按策略保留或删）。
  - `境界` → `地位`；`灵根` → `特质`；`灵石` → `金钱`。
  - 突破描述等修仙文案：可改为通用文案或保留为「地位突破」描述。
  - 世界 repair：不再补全 `大陆信息`/`势力信息`。

- **dataValidation.ts**
  - 校验路径与默认值：同上替换；货币用 `金钱`，不再 fallback 到 `灵石`（或仅兼容读取一次）。
  - 境界校验：改为地位或移除。

### 2.3 游戏状态与存档 `src/stores/`、`src/composables/`

- **gameStateStore.ts**
  - 读取/写入：`灵根` → `特质`，`境界` → `地位`，六司 → 六维属性，气血/灵气/神识 → 体力/精力，`灵石` → `金钱`。
  - 若仍有 cultivation/technique 相关字段，仅保留兼容或删除。

- **characterStore.ts**
  - 存档序列化/反序列化：同上字段名替换；日志中的「灵石」改为「金钱/金币」。

- **useGameData.ts**
  - 货币：统一用 `金钱`，不再使用 `灵石` 键名（读取兼容可保留一次）。

### 2.4 AI 与提示词 `src/utils/prompts/`、`src/utils/AIBidirectionalSystem.ts`

- **cotCore.ts**
  - Ming 版 CoT：已用 体力/精力/金钱；若有残留 境界/灵根/六司/气血/灵气/神识/灵石/渡劫/宗门，全部改为 地位/特质/六维属性/体力/精力/金钱。

- **dataDefinitionsMing.ts**
  - 文档与示例：六司 → 六维属性，特质已替代灵根，金钱已替代灵石；删除或改写「势力信息」章节。

- **inlinePromptsMing.ts / businessRulesMing.ts / eventSystemRulesMing.ts**
  - 势力冲突等：若保留「势力」为事件类型描述（非数据结构），可保留文案；否则改为「组织/阵营冲突」等通用表述。
  - 数据路径：所有 `角色.背包.灵石` → `角色.背包.金钱`；`角色.属性.气血/灵气/神识` → `角色.属性.体力/精力`；`角色.身份.灵根` → `角色.身份.特质`；六司 → 六维属性。

- **characterInitializationPromptsMing.ts**
  - 特质/灵根：统一写特质；`availableContinents` 若来自 `大陆信息`，改为从「地点信息」推导或移除该参数。

- **AIBidirectionalSystem.ts**
  - 状态摘要、判定数据、NPC 档案：气血/灵气/神识 → 体力/精力；境界 → 地位；灵根 → 特质；六司 → 六维属性；灵石 → 金钱；灵气浓度可改为「环境强度」等通用名或保留仅非 Ming。

### 2.5 世界生成与初始化 `src/services/`

- **characterInitialization.ts**
  - `buildStubWorldInfo`：不再包含 `大陆信息`、`势力信息`。
  - `initializeCharacter` 等：不再依赖 `世界.信息.大陆信息` / `势力信息`；若原先有 `availableContinents`，改为从 `地点信息` 抽取或删除该逻辑。
  - 灵根/特质：写入 `角色.身份.特质`，兼容读取 `灵根` 仅用于一次迁移。

- **offlineInitialization.ts**
  - 默认世界信息：同上，移除 大陆信息/势力信息。

### 2.6 界面与 i18n

- **CharacterCreation.vue / Step4_SpiritRootSelection.vue**
  - 你要求：开局灵根页面**保留现有 populate 数据**，只做**数据名字替换**（如「灵根」→「特质」），灵根内部结构可保留。
  - 因此：Step4 的 `spiritRoots` 数据源和 SpiritRoot 结构可保留；文案与 store 中的 key 改为「特质」相关（如 `selectedTrait`、`trait_id`、预设特质等）。
  - 若 store 仍用 `spirit_root_id` / `selectedSpiritRoot`，可保留内部名或改为 `trait_id` / `selectedTrait`，与存档字段「特质」一致。

- **CharacterDetailsPanel.vue / RelationshipNetworkPanel.vue / RightSidebar.vue**
  - 显示：灵根 → 特质，境界 → 地位，六司 → 六维属性，气血/灵气/神识 → 体力/精力，灵石 → 金币/金钱。

- **InventoryPanel.vue**
  - 货币：统一使用 `金钱`，文案「灵石」→「金币」或「金钱」。

- **i18n/index.ts**
  - 所有「灵根/境界/六司/气血/灵气/神识/灵石/修炼/功法/宗门」相关 key 的文案改为通用（特质/地位/六维属性/体力/精力/金币等）；保留的 key 名可不变，仅改翻译文本。

### 2.7 数据与校验

- **data/creationData.ts**
  - 本地灵根列表：可保留为「特质」预设数据，仅改展示名（如「灵根」→「特质」）；字段名若对外是 `灵根` 可改为 `特质` 或保留内部用 `SpiritRoot` 类型）。

- **dataValidation.ts / dataRepair.ts**
  - 见 2.2；并确保 NPC、主角的默认与校验都使用新字段名。

### 2.8 其他

- **stateChangeFormatter.ts**：路径中的 灵石 → 金钱，气血/灵气/神识 → 体力/精力。
- **commandValidator.ts**：允许的 key 列表：`角色.背包.金钱.*`，不再列 `角色.背包.灵石.*`（或仅兼容旧指令一次）。
- **enhancedActionQueue.ts**：货币用 `金钱`。
- **RelationshipNetworkPanel / CharacterDetailsPanel**：`getNpcRealm` → `getNpcStatus`/`getNpc地位`，`getNpcSpiritRoot` → `getNpcTrait`；显示「寿元」等可保留。
- **locationNpcGenerationPromptsMing.ts**：境界 → 地位（可选），背包货币 → 金钱。

---

## 三、需要你确认的点

1. **金币与四档**  
   当前 Ming 已用 `金钱`，四档为 下品/中品/上品/极品。是否统一展示为「金币」并保留四档，还是四档也改名为 铜/银/金/宝钞 等？

2. **六维属性键名**  
   体质/直觉/悟性/气运/魅力/心性 是否全部保留不改？只把「六司」改为「六维属性」？

3. **境界 vs 地位**  
   「境界」改为「地位」后，非 Ming 模式是否仍用同一结构但字段名保留为 `境界`（即两套字段名按模式切换），还是全局统一为 `地位`？

4. **大陆信息 / 势力信息的依赖**  
   `availableContinents` 目前来自 `世界.信息.大陆信息`，用于角色初始化提示词。移除大陆信息后，是否：  
   - 直接删除「大陆」相关提示与参数，仅用「地点信息」；或  
   - 从 `地点信息` 中推导「区域/大陆」列表再传入？

5. **神识**  
   Ming 是否完全移除神识（删除字段），还是保留字段但在 Ming 提示词中不使用？

6. **开局 Step4 的 store/API 命名**  
   ✅ 改为与存档一致：`trait_id`、`selectedTrait`、`traits`；列表仍用 creationData 的灵根内容 populate（creationData.ts 暂不修改）。

---

## 四、已完成的修改（本次会话）

- **类型**：`game.d.ts`、`index.ts` — 四档→现金/铜/银/金，六司→六维属性，境界→地位，神识→洞察力，移除大陆/势力；`CurrencyFourTier`、`PlayerStatus`、`NpcProfile`、`CharacterBaseInfo`、`WorldInfo` 等已更新。
- **迁移与修复**：`saveMigration.ts`、`dataRepair.ts`、`dataValidation.ts` — 默认值与路径、货币 `normalizeCurrency`、身份/属性/关系 NPC 规范。
- **工具**：`currencyDefaults.ts`（`DEFAULT_CURRENCY`、`normalizeCurrency`）。
- **Stores /  composables**：`gameStateStore`（特质/地位/后天六维属性）、`useGameData`（地位、金钱四档）。
- **校验与队列**：`commandValidator`（体力/精力/洞察力、金钱.现金/铜/银/金、地位、后天六维属性）、`enhancedActionQueue`（默认货币）。

**待完成**：characterCreationStore（trait_id/selectedTrait/traits）、characterInitialization/offlineInitialization（大陆/势力、金钱/属性）、AIBidirectionalSystem 与提示词、UI（Step4/CharacterDetails/RelationshipNetwork/Inventory 等）、i18n（现金/铜/银/金、六维属性、地位、洞察力）、stateChangeFormatter、以及 creationData 与各 prompt 中残留的旧键名/文案。

---

## 五、建议执行顺序

1. **类型与默认值**：先改 `game.d.ts`、`index.ts`，再改 `saveMigration.ts`、`dataRepair.ts`、`dataValidation.ts` 的默认值与路径。  
2. **存档与状态**：`gameStateStore`、`characterStore`、`useGameData`。  
3. **AI 与提示词**：cot、dataDefinitions、inlinePrompts、characterInitialization、AIBidirectionalSystem。  
4. **世界信息**：移除 大陆信息/势力信息 的类型与所有使用处（含 characterInitialization、offlineInitialization）。  
5. **UI 与 i18n**：创角 Step4、详情与关系面板、背包、i18n。  
6. **收尾**：commandValidator、stateChangeFormatter、enhancedActionQueue 等零散引用；全局搜索 灵根/六司/境界/气血/灵气/神识/灵石/大陆信息/势力信息 做一次遗漏检查。

---

## 五、检索关键词（便于查漏）

- 灵根、特质、SpiritRoot  
- 六司、先天六司、后天六司、六维属性、InnateAttributes  
- 境界、地位、Realm  
- 气血、灵气、神识、体力、精力  
- 灵石、金钱、金币、CurrencyFourTier  
- 大陆信息、势力信息、continents、WorldContinent、WorldFaction、availableContinents  

确认上述 6 个问题后，可以按该计划分步改；有新增文件或模块再按同一映射表对齐即可。
