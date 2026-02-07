# 世界心跳实现进度笔记

- 计划文档：`world-heartbeat-implementation-plan.md`
- **重要**：`上次主回合更新回合` 仅在主回合应用 tavern_commands 后写入，心跳应用命令绝不写入。

## Phase 1 进度
- [x] types/game.d.ts：SaveMetaV3.回合序号、NpcProfile 在做事项/心跳锁定/上次主回合更新回合、HeartbeatRecord/WorldHeartbeatConfig
- [x] dataRepair：元数据.回合序号、世界.状态.心跳 默认；createMinimalSaveDataV3 含回合序号与心跳
- [x] saveMigration：V3 normalize 时补 回合序号、心跳；migrated 元数据/世界.状态 含之
- [x] dataValidation：repairNpc 补 在做事项、心跳锁定 默认
- [x] gameStateStore：roundNumber、worldHeartbeat 状态；loadFromSaveData/toSaveData/reset 同步

## Phase 2 进度
- [x] 数据定义 dataDefinitionsMing：在做事项 字段与示例；cotCore / inlinePromptsMing：主回合可更新 在做事项
- [x] AIBidirectionalSystem：主回合 apply 后根据 社交.关系.* 命令写 上次主回合更新回合；主回合结束时 元数据.回合序号 +1；npcInteractionPaths 含 在做事项
- [x] 关系面板：Tab「在做事项」；卡片与详情中心跳锁定 toggle（Lock/Unlock）；toggleHeartbeatLock / isHeartbeatLocked

## Phase 3 进度
- [x] 心跳候选选择 selectHeartbeatCandidates（排除锁定与遗忘；周期/事件/手动 模式）
- [x] 心跳 prompt worldHeartbeatPromptsMing.ts；runSingleHeartbeat（快照→AI→applyCommandsOnly→校准→记录）
- [x] AIBidirectionalSystem.applyCommandsOnly；事件触发在 maybeTriggerScheduledWorldEvent 内；周期触发现在 processGmResponse 返回后

## Phase 4 进度
- [x] WorldHeartbeatWidget：列表可展开、手动触发、全部回溯、单条回溯；嵌入 GameVariableWorldInfoSection
- [x] 设置面板「世界心跳」分组：启用、每 N 回合、历史条数、遗忘回合数；读写 gameStateStore.worldHeartbeat，变更时 persistWorldHeartbeat
- [x] i18n：世界心跳相关文案
