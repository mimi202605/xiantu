# Ming 模式清理计划

> 逐步移除与 Ming 模式无关的逻辑和提示词，保持项目精简。采用非激进、分阶段的方式。

---

## 已完成的阶段

### Phase 1: 角色初始化使用 Ming 提示词 ✅
- 在 `characterInitializationPromptsMing.ts` 中新增 `buildCharacterInitializationPromptMing` 和 `buildCharacterSelectionsSummaryMing`
- `characterInitialization.ts` 根据 `USE_MING_PROMPTS` 选择 Ming 或非 Ming 版本
- 术语调整：灵根 → 特质（Ming 版）

### Phase 2: defaultPrompts 仅使用 Ming 定义 ✅
- 移除非 Ming 的 imports（coreRules, businessRules, textFormats, worldStandards, actionOptions, eventSystemRules, dataDefinitions, characterInitializationPrompts）
- 所有提示词内容改为直接使用 Ming 版本，移除 `USE_MING_PROMPTS ?` 三元分支

### Phase 3: promptAssembler 与 AIBidirectionalSystem 使用 Ming ✅
- `promptAssembler.ts`：`stripNsfwContent` → `stripNsfwContentMing`，`SAVE_DATA_STRUCTURE` → `SAVE_DATA_STRUCTURE_MING`
- `AIBidirectionalSystem.ts`：`stripNsfwContent` → `stripNsfwContentMing`
- `GameVariableFormatGuideModal.vue`：`getSaveDataStructureForEnv` → `getSaveDataStructureMingForEnv`

---

## 未来可移除的文件（待验证后删除）

以下文件在 Ming 模式下**不再被引用**，可作为后续清理候选。删除前需确认无其他间接引用。

### 提示词定义（definitions/）
| 文件 | 说明 |
|------|------|
| `actionOptions.ts` | 修仙版行动选项规则 |
| `businessRules.ts` | 修仙版业务规则（境界、宗门、功法等） |
| `coreRules.ts` | 修仙版核心规则（与 coreRulesMing 内容可能重叠） |
| `dataDefinitions.ts` | 修仙版存档结构定义 |
| `eventSystemRules.ts` | 修仙版事件系统规则 |
| `textFormats.ts` | 修仙版文本格式（战斗伤害等） |
| `worldStandards.ts` | 修仙版世界标准（境界属性等） |

### 任务提示词（tasks/）
| 文件 | 说明 |
|------|------|
| `characterInitializationPrompts.ts` | 修仙版角色初始化提示词 |

**注意**：`characterInitialization.ts` 仍保留对 `characterInitializationPrompts` 的 import，用于 `USE_MING_PROMPTS === false` 时的回退。若确定不再需要回退，可移除该 import 及三元分支。

### 其他可能未用
| 文件 | 说明 |
|------|------|
| `src/utils/prompts/dataDefinitions.ts` | 若与 `definitions/dataDefinitions.ts` 重复，可合并或删除 |
| `src/utils/prompts/cot/cotCore.ts` | 已改为使用 `textFormatsMing` 的 `DICE_ROLLING_RULES` |

---

## 联机 / 云模式相关（可选清理）

Ming 模式以单机为主，以下逻辑在单机模式下**不执行**，但保留不影响运行：

- `promptAssembler.ts` 中的 `isTraveling` 分支（联机穿越时注入 onlineModeRules 等）
- `defaultPrompts.ts` 中的 `onlineModeRules`、`onlineTravelContext`、`onlineWorldSync`、`onlineInteraction`
- `ModeSelection.vue` 中的联机模式 UI 与 `backendReady` 检测

若确定 Ming 版本永不支持联机，可考虑移除上述联机相关提示词和 UI。

---

## 删除前检查清单

1. 运行 `rg "from.*definitions/(actionOptions|businessRules|coreRules|dataDefinitions|eventSystemRules|textFormats|worldStandards)" src` 确认无引用
2. 运行 `rg "characterInitializationPrompts[^M]" src` 确认无引用（除 characterInitialization 的回退分支）
3. 运行 `npm run build` 确保构建通过
4. 运行关键流程（创角、开局、对话）做一次手动验证

---

## 回退说明

若需恢复非 Ming 提示词：

1. 在 `defaultPrompts.ts` 中恢复非 Ming 的 imports 和 `USE_MING_PROMPTS ?` 三元分支
2. 将 `USE_MING_PROMPTS` 设为 `false`
3. `characterInitialization.ts`、`promptAssembler.ts`、`AIBidirectionalSystem.ts`、`GameVariableFormatGuideModal.vue` 需相应恢复非 Ming 的 import 和调用
