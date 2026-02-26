# 更新日志

## [MING] 通用版 0.2.95 (2026-02-19)

- **Prompt**：禁止使用「国外」「某城市」「某地点」「某办公室」「某区域」等泛指/占位地点名；`角色.位置.描述` 与 `世界.信息.地点信息` 必须为具体物理地点，push 地点信息时各级必须带 `描述`，并在主回合、地点 NPC 生成、世界心跳等所有流程中统一执行。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.94 (2026-02-19)

- **主回合失败/重试**：AI 抛错或响应结构校验未通过时不再应用指令、不写入 embedding，避免失败回合污染状态与后续记忆；新增共享 `aiResponseValidator`。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.93 (2026-02-19)

- **Prompt**：禁止将「离开中」「前往中」「移动中」「路上」等状态/过程或含「··」的路径作为 角色.位置 或 世界.信息.地点信息；仅限真实物理场所。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.92 (2026-02-19)

- **地点名称引号规范化与合并**：中文/英文/全角引号统一后合并重复地点；保存页新增「修复存档」；修复后同步 gameStateStore 再保存，确保写入合并结果；游戏中打开存档页可修复当前存档。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 1.0.6 (2026-02-19)

- **版本号**：游戏版本更新为 1.0.6（package.json、设置导出展示「天命 v1.0.6」）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.91 (2026-02-19)

- **全量导入/完整备份恢复**：IndexedDB 打开失败时自动重试（最多 3 次）；失败时给出明确提示（勿用无痕模式、关闭其他标签页、检查存储空间）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.89 (2026-02-19)

- **地位系统重构**：地位由境界式五字段改为社会地位/职位（名称 + 描述）；默认「还未揭露」；AI 在角色初始化、新地点 NPC 生成、世界心跳等流程中生成与更新地位；Engram 实体推荐字段增加 social_status。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.88 (2026-02-17)

- **Engram**：普通 NPC 不再写入实体/关系；新增 prune 逻辑，主回合写入后与 demote 后均排除普通 NPC 并同步修剪向量库；修复 demote 块内 characterStore 未定义错误。
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.87 (2026-02-17)

- **记忆中心**：已发送信息按回合唯一，同一回合重发时覆盖该回合记录，不再追加重复条（roundIndex + appendSentMessage 覆盖逻辑）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.86 (2026-02-17)

- **Prompt**：禁止将载具、飞行器、车内/船内/机舱内等非地点作为 角色.位置 或 世界.信息.地点信息；在载具中时写地面地点（出发地/目的地/途经地）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.85 (2026-02-17)

- **回退与 Rerank**：明确回退不修改 localStorage 与 API 管理，Rerank 配置不变；回退后若未触发 Rerank 多为候选为空。增加 Rerank 未执行时的 debug 日志与用户指南说明。
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.84 (2026-02-17)

- **地点结构（不兼容）**：地点信息改为仅「扁平数组 + 上级」建树，移除 `内部`；查找/遍历/补全/地图均按扁平处理；迁移时删除旧条目的 `内部`。
- **Prompt**：生成地点须生成全部父级（多级路径按层级依次 push）；位置更新与地点信息同步衔接；地图 NPC 请求增加地点结构修正与层级补全。
- **文档**：`map-test-data-locations.md` 规范更新。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.83 (2026-02-17)

- **Rerank 鉴权**：Rerank 请求增加 `Authorization: Bearer <apiKey>`（来自 API 管理当前 Rerank API），修复 401。
- **提示词组装**：主回合始终记录（不依赖调试模式）；启用分步时 主回合 与 分步1/2 共存，可切换查看；新增「Embedding 请求（本步骤）」「Rerank 请求（本步骤）」区块；分步视图下显示说明 hint。
- **游戏变量**：新增「Engram」数据类型，实时查看事件/实体/关系及对应 embedding 状态与预览。
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.82 (2026-02-16)

- **Engram 与 API 管理整合**：Embedding/Rerank 的 API 与模型统一在 API 管理 → 辅助功能中分配与编辑；系统设置中仅只读展示当前 API 与模型，总开关「启用 Engram 增强」仅此处有效。
- **Rerank 路径**：默认请求 `{base}/rerank`；API 配置支持可选「使用自定义路径」（如 `v1/rerank`）。
- **主回合回退**：回退时同步修剪向量库，仅保留回退后仍存在的事件/实体向量，避免死数据与重名实体向量冲突。
- **文档**：新增 `docs/ENGRAM_API_MANAGEMENT_USER_GUIDE.md`（实现范围、可配置项、回退与向量修剪说明、用户流程与开发参考）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.81 (2026-02-16)

- **Engram 迁移 Phase 7（设置面板补齐）**：
  - Engram 设置区新增 `rerank` 与 `trim` 全量参数控制（启用、阈值、窗口、预算等）。
  - hybrid 调优可在 UI 完成，不再依赖手改配置 JSON。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - `legacy` 默认行为保持不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.80 (2026-02-16)

- **Engram 迁移 Phase 6（可观测性与适配增强）**：
  - 在 `engram.debug` 下记录 hybrid 检索统计（含候选与向量命中）到 Prompt Assembly 数据模组，便于排查与调优。
  - `embeddingService` 增强 provider 适配：`ollama` / `cohere` 使用对应 embedding 接口，其余保持 OpenAI 兼容路径；`ollama` 支持无 key。
  - 所有失败路径继续回退 pseudo embedding，保持主流程非阻塞。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - `legacy` 默认行为保持不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.79 (2026-02-16)

- **Engram 迁移 Phase 5（关系图谱）**：
  - 新增 `MingEntityRelation` 与 `engramMemory.relations`，把实体间关系边纳入存储模型。
  - 写路径新增 `relationBuilder`：从事件和社交关系自动抽取并 upsert 关系边。
  - `unifiedRetriever` 接入关系边候选，hybrid 检索可直接使用图谱关系语境。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - `legacy` 默认行为保持不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.78 (2026-02-16)

- **Engram 迁移 Phase 4（实体向量化）**：
  - 主写路径向量化从“仅事件”升级为“事件 + 实体”，并持久化 `entityVectors`。
  - `unifiedRetriever` 新增实体向量召回与融合评分，hybrid 检索同时利用事件语义与实体语义。
  - 向量写入后同步回填实体 `is_embedded`，并记录实体向量统计变更。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - `legacy` 默认行为保持不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.77 (2026-02-16)

- **Engram 迁移 Phase 3（实体与裁剪）**：
  - 新增 `entityBuilder`，在事件落盘后自动抽取/更新 `engramMemory.entities`（角色、地点、概念）。
  - 新增 `trimEngramMemory` 并接入主写路径，按 `engram.trim` 配置裁剪历史事件，防止无界增长。
  - `unifiedRetriever` 接入 `engramMemory.entities` 候选，使 hybrid 检索可直接利用 Engram 实体图谱。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - `legacy` 默认行为保持不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.76 (2026-02-16)

- **Engram 迁移 Phase 2（向量化检索）**：
  - 新增 `embeddingService` 与 `rerankService`，完成 hybrid 模式的向量召回、分数融合与可选 rerank。
  - 主流程写路径新增事件向量落盘：`processGmResponse()` 在写入 `EventNode` 后增量写入独立向量索引（按角色+存档槽位隔离）。
  - `unifiedRetriever` 接入向量读取与融合排序，应用 `topK/minScore` 配置；异常自动降级，不阻塞主流程。
  - API 管理新增 `embedding` 功能分配项，可为向量化流程单独配置 API。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - `legacy` 默认行为保持不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.75 (2026-02-16)

- **Engram 迁移 Phase 1（可运行读写链路）**：
  - 新增 `eventBuilder`：将 GM 响应文本烧录为 `EventNode`，写入 `系统.扩展.engramMemory.events`。
  - 新增 `unifiedRetriever` + `injectionFormatter`：在 hybrid 模式下统一生成检索上下文（事件记忆、语义记忆、关系图谱、场景规则），并做 token/行数预算裁剪。
  - `AIBidirectionalSystem` 读路径接入模式门控：
    - `legacy`：保持原 `memoryRetrieve()`。
    - `hybrid`：改走 `unifiedRetrieve()`（替代检索入口，非共存双链路）。
  - `AIBidirectionalSystem` 写路径接入事件落盘：
    - `processGmResponse()` 在文本处理后追加 EventNode。
  - 分步生成（step1/step2）也接入统一记忆检索块，避免仅单步模式增强。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - 默认仍为 `legacy`，未开启 hybrid 时行为不变。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `ENGRAM_MIGRATION_IMPLEMENTATION_LOG.md`。

---

## [MING] 通用版 0.2.74 (2026-02-16)

- **Engram 迁移 Phase 0（基础设施）**：
  - 新增 `engramMemory` 类型与配置模型（`MingEngramConfig/MingEngramMemory/MingEventNode/MingEntityNode/MingEngramMeta`），并接入 `SystemConfig.engram`（可选、非破坏）。
  - 新增 `src/services/engram/` 骨架：`types.ts`、`config.ts`、`memoryRepository.ts`、`vectorRepository.ts`、`index.ts`。
  - `gameStateStore` 打通 `系统.扩展.engramMemory` 的加载/保存：`loadFromSaveData()` 读取并归一化；`toSaveData()` 持久化默认空结构；`resetState()` 清理运行态。
  - `dataRepair/saveMigration/saveValidationV3` 全链路兼容 `engramMemory`：修复、迁移、校验时不再丢失该字段。
  - 设置面板新增 `Engram` 区块（启用开关、legacy/hybrid、embedding provider/model/topK/minScore、debug），持久化到 `dad_game_settings.engram`。
  - 向量独立存储基础能力落地：`vectorRepository` 统一 `engram_vectors_{charId}_{slotId}` key 的读写。
- **稳定性验证**：
  - `npm run type-check` 通过。
  - IDE lint 检查通过。
  - legacy 默认值保持：`enabled=false` + `retrievalMode='legacy'`，不影响现有主流程。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)** 与 `docs/engram-migration-implementation-log.md`。

---

## [MING] 通用版 0.2.73 (2026-02-15)

- **API 超时**：流式请求 5 分钟超时、504 用户提示与调大代理建议；导出 API_TIMEOUT_MS。
- **中期记忆**：消费处（主流程 state、精炼、长期总结）统一使用 formatMidTermEntryForPrompt，保留相关角色与事件时间。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.72 (2026-02-15)

- **语义记忆**：按关联 NPC（key+名字）与重要程度发送；`relatedOnly` 默认仅发相关 triple；文档记录 consumer 与发送时机。
- **提示词组装**：主回合记录数据模组（核心状态、语义与实体、游戏状态 JSON、联机穿越）及短期记忆内容；面板展示提示词模组 + 数据模组列表。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.71 (2026-02-15)

- **中期记忆逻辑修订**：数据模型（ImplicitMidTermEntry、MidTermEntry、隐式中期对象数组）与迁移；主回合仅发短期+中期+长期、隐式中期不重复送入；step2 对象格式、精炼/长期总结双阈值与 triggerMidTermRefine/triggerMemorySummary；memoryHelpers、gameStateStore 溢出与 coerce、worldHeartbeatService 与 MainGamePanel 同步。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.70 (2026-02-15)

- **记忆中心**：配置界面分组与排版优化（短期/中期精炼/长期总结/自定义格式/手动操作）、「不删减时参与总结的条数」改为子区块展示、手动操作区 padding 统一；修复「测试」按钮添加中期记忆后「中期」tab 计数不同步问题（保存后从 store 重载）；短期转化使用配置上限。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.69 (2026-02-14)

- **回退重构**：回退 commit d960de6（AIBidirectionalSystem 模块化），恢复为单一文件实现，以修复角色初始化位置丢失、主回合不更新、提示词组装异常等根本性问题。后续功能（0.2.66–0.2.68）不受影响。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.68 (2026-02-14)

- **地图修复**：修复地图数据冗余导致节点重复显示的问题；增强 `collectFromTree` deduplication 逻辑。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.67 (2026-02-14)

- **位置选择优化**：人物信息编辑位置时支持下拉选择已知地点，并可切换为手动输入；优化交互与样式。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

## [MING] 通用版 0.2.66 (2026-02-14)

- **界面与工作流**：NPC 身体部位/私密信息支持行内编辑；Agent 工作流升级（Plan/Analyze）；修复 HTML 标签闭合。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

## [MING] 通用版 0.2.63 (2026-02-12)

- **NPC 优化**：新增重点 NPC 自动降级（配置阈值）、Prompt 过滤普通 NPC、新地点生成数量范围配置；关系网面板默认隐藏普通 NPC；Prompt 剔除心跳历史数据以减少 Token 消耗。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

## [MING] 通用版 0.2.62 (2026-02-12)

- **API 优化**：新增「世界心跳」与「NPC生成」独立 API 配置与开关；修复重试次数不生效与 URL 路径重复 `/v1` 问题；新增 <600ms 快速失败保护（不重试本地错误）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

## [MING] 通用版 0.2.58 (2026-02-11)

- **回溯强化**：对话回滚统一化（Round/Heartbeat/Narrative/NPC/Map 均回滚至 `上次对话`）；`canRollback` 适配 IndexedDB（Slot 存在即允许回滚 / 延迟加载）；回滚后清理 undo 历史与 ActionQueue；详细 Toast 提示变更差异。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

## [MING] 通用版 0.2.57 (2026-02-11)

- **视频背景**：封面视频背景由 `ming_background_horizontal.mp4` 更换为 `ming_background_video.mp4`（Gemini Veo 生成）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.56 (2026-02-08)

- **世界心跳**：修复加载后不触发（loadFromSaveData 按 truthy 解析 启用）；dataRepair 保留原心跳配置并规范 启用；周期判定 truthy + 诊断日志；npc.记忆总结 非数组时规范再拼接，避免 TypeError 导致手动/周期心跳失败。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.55 (2026-02-08)

- **角色创建/预设**：预设名称占位与导入提示统一为「特质」表述；预设数据保留 spiritRoot 键名兼容旧文件。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.54 (2026-02-08)

- **记忆中心**：新增「已发送信息」tab，记录玩家发给 API 的原文并支持复制，仅供查阅、不参与 prompt；复制增加 execCommand 兜底。
- **Prompt**：NPC 私密档案（PrivacyProfile）补全「最近一次性行为时间」与逻辑一致性说明；身体部位中特殊印记改为可选描述。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.53 (2026-02-08)

- **视频背景**：全屏背景视频由 `ming_background_wide.mp4` 更换为 `ming_background_horizontal.mp4`；VideoBackground 默认 src 同步更新，移除旧宽屏资源。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.52 (2026-02-08)

- **资源与版本**：新增全屏视频背景资源 `public/ming_background_wide.mp4`；游戏版本号升级为 1.0.2（package.json，界面 APP_VERSION 同步）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.51 (2026-02-08)

- **视频背景**：修复 VideoBackground 四周边框黑边问题；容器使用 100vw/100vh 填满视口，视频使用 min-width/min-height 与 object-fit: cover，并略微放大裁掉可能内嵌的 letterbox。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.50 (2026-02-08)

- **游戏版本**：package.json 版本号由 1.0.0 升级为 1.0.1（界面与构建产物中的 APP_VERSION 同步更新）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.49 (2026-02-08)

- **界面品牌与链接**：游戏内顶栏标题由「仙途」改为「天命」；左下角 GitHub 与教程/赞助内链接改为本仓库（michael2221807/ming）；赞助支持弹窗移除支付宝/微信二维码，改为 GitHub Star 按钮；教程标题改为「天命教程」。
- **地位显示**：顶栏玩家名旁、续前世因缘存档卡片、右侧栏、角色详情、存档面板中，境界改为地位（数据用 地位 ?? 境界 兼容旧档）；统一用 名称·阶段 或 名称 格式化显示。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.48 (2026-02-08)

- **README**：自动构建表格中 GitHub Pages 触发条件改为仅「推送 v\* tag」。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.47 (2026-02-08)

- **README 自动构建与部署**：重写为触发方式表格（v\* tag → Release/Docker/Pages，main → Pages，push/PR → CI）；补充 GitHub Pages 访问地址、Source 须选 Actions、environment protection 报错处理；注明可手动运行 Pages/Docker 工作流。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.46 (2026-02-08)

- **GitHub Pages 源码展示 EJS 问题**：index.html 移除 EJS 模板语法，改为占位 `<base href="__BASE_PATH__" data-build-replace>`；webpack 增加 BaseTagReplacePlugin 在构建时根据 BASE_PATH 替换或移除该标签；README 注明 Pages 须选择 GitHub Actions 作为 Source 部署构建产物。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.45 (2026-02-08)

- **gameStateStore**：存档加载中 `relationships` 未再赋值，改为 `const`。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.44 (2026-02-08)

- **类型与数据结构对齐**：修复 type-check 报错，代码与当前类型定义一致。境界→地位、气血/灵气/神识→体力/精力/洞察力、后天六司→后天六维属性；specialNpcs（NpcProfile 属性/背包/地位/特质）、offlineInitialization、worldHeartbeatService、characterStore、dataRepair、characterCreationStore 等已按新 schema 更新。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.43 (2026-02-08)

- **GitHub Pages**：修复部署后空白页；构建时设置 BASE_PATH（如 `/ming/`），publicPath 与 `<base href>` 使资源在子路径正确加载；新增 404.html 作 SPA 回退；README 注明 Pages 访问地址。
- **构建产物**：生产环境打包输出由 `XianTu.js` 更名为 `ming.js`。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.42 (2026-02-08)

- **README 致谢**：文末增加致谢小节，注明 MING 基于 [仙途（XianTu）](https://github.com/qianye60/XianTu) 衍生，感谢千叶大佬原作与开源。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.41 (2026-02-08)

- **README 功能概览**：突出 MING 与原版差异——强化 NPC 与世界的互动；前置 NPC 与关系网、动态地图与探索、世界心跳三块，再接 AI 叙事与通用框架等。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.40 (2026-02-08)

- **README**：封面与主题截图改为本地 `public/`（天命-cover.jpg、天命-dark.png、天命-light.png）；标题与功能概览按天命/MING 通用版与 changelog 更新；visitors/stars/forks 改为占位 `your-username/ming` 便于替换。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.39 (2026-02-08)

- **亮色主题**：降低亮度、加强边框可见性（全局 token 柔光；创角各步与 step-selection 统一用变量）；创角主区与模式选择主区改为半透明 + 毛玻璃，与暗色一致透出视频背景。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.38 (2026-02-08)

- **封面与模式选择**：主标题「仙途」改为「天命」（保留样式）；副标题与「择一道途」改为天命意象（命数自定前路在握、择一天命）；模式卡片与按钮改为独行己命/共书天命等表述，并补充 i18n。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.37 (2026-02-08)

- **封面背景**：默认视频文件名改为 `ming_background.mp4`（仍置于 `public/`），VideoBackground 默认 src 与 public/README 已同步。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.36 (2026-02-08)

- **封面背景本地化**：封面视频改为优先使用本地 `public/background.mp4`；新增 `public/` 静态目录，构建时复制到 dist，开发时由 devServer 提供；VideoBackground 默认 src 改为 `./background.mp4`；新增 copy-webpack-plugin 依赖。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.35 (2026-02-08)

- **创角流程**：天道点界面统一改为「天命点」；Step1/Step2 起显示剩余天命点；七步进度改为四字诗意命名（万象择一、禀赋天成、因果前缘、性灵所钟、才情所钟、命格初成、一览终章）并补充 i18n。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.34 (2026-02-08)

- **探索地图**：右上角「当前位置」图例改为红圈（透明底 + 红色描边），与地图上当前所在地高亮一致。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.33 (2026-02-08)

- **探索地图**：修复滚轮放大时对准目标结构仍进入错误结构的问题；改为以指针在 SVG 中的位置选「包含该点的最深节点」入栈，整轮循环共用同一焦点、nextTick 清空，并用视口 rect 做坐标换算。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.32 (2026-02-08)

- **探索地图（原坤舆图）**：按根节点分 20 色系（同根及子节点同色）、当前所在地红色描边高亮；区域放大后双击空白回退上一级；地图页增加教程按钮与使用说明弹窗；重命名为「探索地图」；探索状态仅于悬停 tooltip 显示（已探索/未探索/部分探索，名称精确匹配），移除右上角已探索/未探索图例并更新说明文案。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.31 (2026-02-08)

- **坤舆图（地图）**：嵌套层级一致性（细化时排除祖先的 clearance，避免第二层被压扁）；细化视图只渲染 focus + 直接子 + 孙、有子节点显示方框（rx 按半径比例）；滚轮/双击均可正常钻取，视口用「与视口相交」判定；缩小仅按占比出栈、最外层展开态可平移且不因 scale 强制回退；视口与 viewBox 按实际 DOM 比例、无限背景与网格。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.30 (2026-02-07)

- **游戏变量编辑弹窗 UI**：修复变量名、变量值与预览区内容贴边/左侧裁切问题；弹窗略加宽，输入框与预览区增加水平内边距与 box-sizing，支持横向滚动。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.29 (2026-02-07)

- **大版本迁移：修仙命名 → 通用命名（不兼容旧存档）**：灵根→特质（Ming 仅读写 特质）、境界→地位、先天/后天六司→六维属性、气血/灵气/神识→体力/精力/洞察力、灵石四档→金钱（现金/铜/银/金）；类型/迁移/修复/校验/初始化/提示词/UI/i18n/stateChangeFormatter 已统一；开局特质保留完整对象结构写入 角色.身份.特质。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.28 (2026-02-07)

- **世界心跳功能落地**：心跳面板与路由、侧栏与设置中心跳配置、关系网络扩展（在做事项等）、类型与提示词与数据验证补全、实现计划与笔记文档；贡献指南增加中文提交信息避免乱码说明。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.27 (2026-02-07)

- **世界心跳默认值**：默认改为每 5 回合更新、历史 10 条、遗忘 10 回合（原 3/20/30）；store、迁移、修复、服务与回退值已统一；存档迁移在已有心跳对象时补全 `周期数值`，导入导出正常。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.26 (2026-02-07)

- **地点-NPC：追加时去重 + 校准顺序优化**：`appendNpcsToLocation` 在追加前从其他地点的 地点NPC 中移除同名 NPC，保证全局有且只有一个同名 NPC（同行 NPC 移入新地点时从原地点去掉）。`calibrateNpcLocationSync` 调整顺序：先 关系→地点（只改地点NPC），再地点去重，最后 地点→关系（绝大多数只改地点NPC）；地点未更新时从关系 sync 到地点仍成立。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.25 (2026-02-07)

- **地点-NPC 双向校准**：新增 `calibrateNpcLocationSync`（locationUtils），保证「关系[npc].当前位置」与「世界.信息.地点信息[地点].地点NPC」一致；API 回写与数据修复时均执行校准；设计文档更新（地图 rescale、地点 NPC 去重、关系网络与 NPC 关系更新等）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.24 (2026-02-07)

- **提示词组装（调试）**：内存仅保留当前一个回合内的快照（主回合单条，或 分步第1步+分步第2步 等）；新回合开始自动清空上一回合。面板支持当前回合内多步切换；新增「导出」按钮，可下载当前回合快照为 JSON 保存。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.23 (2026-02-06)

- **NPC 境界默认「凡人」**：境界不再强制生成时，关系网络与详情中未带境界的 NPC 显示默认「凡人」；Ming 地点路人 NPC 结构说明中境界改为可选字段（不填则界面显示凡人）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.22 (2026-02-06)

- **Prompt 清理计划落地**：灵石→金钱、气血→体力/灵气→精力（神识可选）、品质系统通用、灵根→特质；删除地点势力不重叠与冲突回合制规则；CoT 通用版（getCotCorePromptMing）；角色生成与迁移写入 体力/精力；UI 核心数值与货币/特质文案全面通用化；Legacy 提示词文件头标注。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.21 (2026-02-06)

- **六司属性通用化**：根骨→体质、灵性→直觉。数据与类型（InnateAttributes、六司定义与示例）、存档迁移（V3 下主角与 NPC 六司键名迁移+兼容读取）、前端与 i18n（创建/详情/关系网络/判定说明等仅用体质、直觉）、prompt 与文档（prompt-cleanup-plan、save-schema-v3）已全部更新。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.20 (2026-02-06)

- **存档与导入导出**：核对存档系统与当前数据结构一致；修复 SavePanel「导出所有存档」使用槽位 key（save.id）从 IndexedDB 加载，与单档/角色导出一致，避免槽位名与显示名不一致时导出错误。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.19 (2026-02-06)

- **坤舆图（minimap）性能**：布局与组件优化，行为不变。locationMapUtils：子节点布局 O(n²)→O(n)、细化块内单次遍历建 bbox、递归平移替代数组收集、Set 直填；MapMinimap：移除未用 viewportSvgSize 依赖、合并过滤为单次遍历。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.18 (2026-02-06)

- **坤舆图（minimap）**：细化放大时外部与内部同比例缩放（布局用固定参考尺寸，不再随视口变化）；zoom out 提高细化退出阈值，避免内部圈跑到框外；进入/更新细化时自动将「当前 focus 及其子级」适配视口并居中，保证内部结构完整显示在屏幕内（同级/父级不参与）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.17 (2026-02-05)

- **提示词组装（调试）**：支持最近 20 条步骤切换；每步展示真实模组明细（构成/生成原因/flow/内容）；全文与每模组显示约 N tokens；新增「本步骤发送的记忆」区块（分步第 1 步的 assistant 记忆）及「本步骤对应的 API 调用」说明（system/assistant/user 各 role 来源）。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.16 (2026-02-05)

- **提示词管理**：仅展示参与游戏组装的提示词（ASSEMBLY_PROMPT_KEYS），面板增加透明度说明与数量；过滤未使用分类，不改变实际发送内容。
- **提示词组装（调试）**：调试模式开启后侧栏出现「提示词组装」，可查看最近一次发送给 API 的提示词全文及各模组构成；主回合 / 分步 / 开局均支持录制，纯观察不修改 prompt。

详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.15 (2026-02-05)

坤舆图：地图页顶部增加返回按钮，与背包、记忆中心等面板一致（将 Map 路由纳入 panelRoutes/panelTitles）。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.14 (2026-02-04)

NSFW 玩家法身与 NPC 私密档案逻辑统一：

- 将 MING 版 `1.5 身体/法身` 扩展为与修仙版一致的完整结构（含敏感点、开发度、纹身与印记等），并明确游戏中可通过 `set 角色.身体` 或子路径更新。
- 角色初始化提示词与业务规则统一为：开局仅允许用 `角色.身体` 写入玩家法身，禁止使用 `角色.身体部位开发`；初始 value 至少包含身高/体重/三围/描述以及敏感点、开发度、纹身与印记。
- 地点路人 NPC 生成提示词接入 NSFW 配置（`nsfwMode` / `nsfwGenderFilter`），在符合条件时要求生成完整 `私密信息`（PrivacyProfile）。
- 法身 UI 在 NSFW 开启但无数据时提供更清晰的提示文案，避免误判为“私密模式”隐藏。  
  详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.13 (2026-02-02)

坤舆图：修复有子地点时方框与圆同时显示（v-if/v-else 配对修正）。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.12 (2026-02-01)

坤舆图 minimap 展示：树形列表改为 minimap 风格，支持缩放/平移与悬停详情；getNpcsAtLocation 回退仅完全相等匹配，支持回退时更新地点的 地点NPC。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.11 (2026-02-01)

修复 push 世界.信息.地点信息 不生效：dataRepair 确保 世界.信息.地点信息 存在；executeCommand 为 地点信息 push 增加特殊处理，显式初始化路径后再写入。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.9 (2026-01-31)

地图系统与 NPC 类型（Phase 1）：递归地点结构、探索记录、地点 NPC 存于各地点内、重点/普通 NPC 区分与升级逻辑、坤舆图 UI；修复地点信息生成 prompt（开局与更换地点时主动 push）。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.8 (2026-01-31)

Ming 模式清理：defaultPrompts、promptAssembler、AIBidirectionalSystem、characterInitialization 等统一使用 Ming 提示词；移除非 Ming 的 imports 与三元分支。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.7 (2026-01-28)

移除 game_entities，关系图仅由 社交.关系 派生；确保 NpcProfile.关系 在创角/加载时初始化，游戏变量与人物关系→原始数据可正确展示。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.6 (2026-01-28)

修复创角时世界信息未写入 游戏变量→世界信息：`EnhancedWorldGenerator` stub 现使用创角界面所选世界的 name / era / description 填入 世界.信息，不再固定为默认占位。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.4 (2026-01-28)

三千大道系统移除：类型、Store、校验、初始化、迁移、UI、队列与 i18n 中与 Dao 相关逻辑均已清理。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.3 (2026-01-28)

世界事件·事件类型对齐通用版：开关与自定义事件类型改为 势力冲突/局势变化/重大发现/人物风波（+特殊NPC）；类型定义、生成回退与格式说明同步更新。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.2 (2026-01-28)

游戏变量·实体与语义：**关系图**（Cytoscape 可视化、缩放/拖拽/恢复布局、标签显隐）、主角节点显示 角色.身份.名字、NPC 悬停显示 人物关系.出生。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

---

## [MING] 通用版 0.2.0 (2026-01-27)

MING 通用版更新：游戏状态索引与语义记忆、NPC 境界校验修复、游戏变量展示。详见 **[CHANGELOG_MING.md](./CHANGELOG_MING.md)**。

- **游戏状态索引与语义记忆**：LLM 在分步第 2 步输出 `game_entities`、`semantic_memory`，落盘到 `系统.扩展`，每回合按相关度/关系/时间·重要性检索后注入提示词，减少 token、增强长期一致性。
- **游戏变量展示**：新增「实体与语义」Tab，展示 `游戏实体索引`（实体、关系）与 `语义记忆`（三元组），支持复制与编辑回写。
- **修复**：MING 下 NPC 不再因缺少「境界」被 `commandValueValidator` 拒绝。

---

## V3.7.4 正式版&网页版 (2026-01-02)

### 🔧 关键修复

- **指令格式统一**：修复提示词中指令示例格式错误（旧格式 `action|key|value` → 正确JSON格式 `{"action":"...", "key":"...", "value":...}`），大幅减少AI生成格式错误
- **物品属性修改修复**：修复修改物品子属性时（如描述、使用效果）被误判为"物品必须是对象类型"的验证错误
- **功法生成修复**：优化功法物品的预处理和验证逻辑，确保功法技能数组正确生成

### ✨ 新功能

- **API测试功能**：新增API连接测试，可在配置后验证API可用性
- **分步提示词自定义**：支持自定义分步生成的提示词配置

---

## V3.7.0 正式版&网页版 (2026-01-01)

### 🧠 分步生成

- **开局/对话均支持分步生成**：第1步先出正文（可流式），第2步再出 `mid_term_memory` / `tavern_commands` / `action_options`（非流式，更快更稳）
- **分步提示词强化**：分步模式使用专用思维链格式，并补齐核心输出规则，减少 JSON 跑偏

---

## V3.6.7 正式版&网页版 (2026-01-01)

### 🧹 输出清理

- **自定义正则删标签**：新增可配置正则规则，对 AI 输出的显示文本做删除/清理（流式/非流式、网页版/酒馆版均生效），且不影响 AI JSON 解析

---

## V3.6.6 正式版&网页版 (2026-01-01)

### 🧩 关键修复

- **开局流式/非流式开关修复**：创角最终预览页可正确切换并生效
- **游戏内“流式传输”开关生效**：设置面板与实际对话流式开关统一
- **流式请求兼容增强**：自动识别不支持 SSE 的接口并降级为非流式，避免“开局生成失败”
- **上下文长度保护**：根据估算输入自动下调 `maxTokens`，输入过长给出明确报错提示
- **失败返回主页重新开始**：开局生成失败后可直接回到主页重开

---

## V3.6.5 正式版&网页版 (2025-12-29)

### 🎯 提示词与格式升级

- **启用新版输出格式**：强制 `"<thinking>...</thinking>" + ```json` 结构（text/mid_term_memory/tavern_commands，action_options按设置可选）
- **解析与校验更容错**：修复常见格式波动导致的“格式出错”（未闭合标签、全角分隔符、数字字符串/数组字段等）

### 🐛 Bug修复

- **人物关系丢失修复**：NPC条目缺少 `名字` 时不再被数据修复清理（用键名回填并保留展示）
- **关系/私密信息面板优化**：私密信息分组展示、长列表折叠，减少“看起来少/不显示”的误判

---

## V3.6.3 正式版&网页版 (2025-12-28)

### ✨ 体验优化

- **环境识别增强**：提升嵌入式环境检测稳定性（支持父/顶层窗口、延迟注入）
- **模式入口修复**：嵌入式环境下“联机共修”入口可用（仍保持原位置与命名）

### 🎯 系统优化

- **AI服务默认策略**：嵌入式环境强制使用内置接口，非嵌入环境默认自定义API
- **界面精简**：非嵌入环境隐藏嵌入式环境专属功能与相关字段（不影响嵌入模式）
- **设置面板回归**：恢复“行动选项”开关，避免误删与功能回退

### 🐛 Bug修复

- 修复无激活存档时，部分场景保存会重复弹出“没有激活的存档，无法保存！”
- 修复部分组件类型推断导致的 TS 报错（行动选项配置项）

---

## V3.6.2 正式版&网页版 (2025-11-28)

## 统一兑换码 `仙途`

## 网页端网址：https://www.ddct.top/

注意：记得切换为自定义API请求，请求路径删去后面的`/v1`

## 统一酒馆和网页版js文件路径，最新版请下载下面的角色卡，云更新也会更新到这张卡

## 多多点赞，你们的点赞是我更新的动力，我就不写多少多少赞更新了

### 🎨 界面全面升级

- **角色创建流程视觉重构**：全新深色玻璃拟态风格！
  - Step1 世界选择：重构布局和交互体验（+450行修改）
  - Step2 天资选择：优化卡片样式和动画效果（+279行修改）
  - Step3 出身选择：统一按钮样式，优化响应式布局（+287行修改）
  - Step4 灵根选择：改进组合选择模式UI（+210行修改）
  - Step5 天赋选择：统一顶部按钮风格（+188行修改）
  - Step6 属性分配：优化控件样式和交互（+172行修改）
  - Step7 最终预览：全新预览卡片设计（+331行修改）

- **角色管理面板增强**
  - 新增单个存档导出功能（每个存档旁边的导出按钮）
  - 统一存档导入/导出格式，移除冗余兼容代码
  - 修复导入存档时重复出现 `_1`后缀的问题

- **模式选择页面优化**
  - 新增深色玻璃拟态风格适配
  - 优化卡片悬停效果和过渡动画

### 🗺️ 地图系统优化

- **手机端双指缩放修复**
  - 修复移动端地图双指缩放失效问题
  - 优化触摸事件处理逻辑
  - 改进缩放中心点计算

### 🎯 系统优化

- **存档系统重构**
  - 统一存档导出格式：`{ type: 'saves', saves: [...] }`
  - 统一角色导出格式：`{ type: 'character', character: {...} }`
  - 简化导入逻辑，移除多格式兼容代码
  - 修复存档元数据与完整数据分离导致的问题

- **提示词系统精简**
  - 重构角色初始化提示词（-466行冗余代码）
  - 优化默认提示词结构

- **样式系统统一**
  - 统一所有Step组件的顶部按钮样式
  - 统一深色/亮色主题颜色变量
  - 优化滚动条样式一致性

### 🐛 Bug修复

- 修复存档导入时出现重复存档的问题
- 修复移动端地图缩放不响应的问题
- 修复角色创建步骤间样式不一致的问题
- 修复设置面板部分选项显示异常

---

## V3.6 正式版 (2025-11-28)

### 🎨 界面全面升级

- **角色创建流程视觉重构**：全新深色玻璃拟态风格！
  - Step1 世界选择：重构布局和交互体验（+450行修改）
  - Step2 天资选择：优化卡片样式和动画效果（+279行修改）
  - Step3 出身选择：统一按钮样式，优化响应式布局（+287行修改）
  - Step4 灵根选择：改进组合选择模式UI（+210行修改）
  - Step5 天赋选择：统一顶部按钮风格（+188行修改）
  - Step6 属性分配：优化控件样式和交互（+172行修改）
  - Step7 最终预览：全新预览卡片设计（+331行修改）

- **角色管理面板增强**
  - 新增单个存档导出功能（每个存档旁边的导出按钮）
  - 统一存档导入/导出格式，移除冗余兼容代码
  - 修复导入存档时重复出现`_1`后缀的问题

- **模式选择页面优化**
  - 新增深色玻璃拟态风格适配
  - 优化卡片悬停效果和过渡动画

### 🗺️ 地图系统优化

- **手机端双指缩放修复**
  - 修复移动端地图双指缩放失效问题
  - 优化触摸事件处理逻辑
  - 改进缩放中心点计算

### 🎯 系统优化

- **存档系统重构**
  - 统一存档导出格式：`{ type: 'saves', saves: [...] }`
  - 统一角色导出格式：`{ type: 'character', character: {...} }`
  - 简化导入逻辑，移除多格式兼容代码
  - 修复存档元数据与完整数据分离导致的问题

- **提示词系统精简**
  - 重构角色初始化提示词（-466行冗余代码）
  - 优化默认提示词结构

- **样式系统统一**
  - 统一所有Step组件的顶部按钮样式
  - 统一深色/亮色主题颜色变量
  - 优化滚动条样式一致性

### 🐛 Bug修复

- 修复存档导入时出现重复存档的问题
- 修复移动端地图缩放不响应的问题
- 修复角色创建步骤间样式不一致的问题
- 修复设置面板部分选项显示异常
- 修复角色创建页面视频背景被遮挡的问题

---

## V3.5 正式版 (2025-11-27)

### 🚀 重大更新

- **全新提示词管理系统**：玩家现可完全掌控AI行为！
  - 新增提示词管理面板（`PromptManagementPanel.vue`，620行）
  - 支持分类浏览：核心请求、总结请求、生成类、初始化提示词
  - 支持单项编辑、重置、导入/导出全部提示词
  - 实时标记修改状态，一键恢复默认
  - 完整的提示词存储服务（`promptStorage.ts`，181行）

- **自定义API支持**：摆脱酒馆限制，直连AI服务！
  - 新增统一AI服务层（`aiService.ts`，420行）
  - 支持酒馆模式（SillyTavern）和自定义API模式双切换
  - 自定义API支持OpenAI兼容格式，可配置：
    - API地址、密钥、模型选择
    - 温度参数（0-2）、最大Token数
    - 自动获取可用模型列表
  - 流式传输、记忆总结模式、开局生成模式均可配置

### ✨ 功能增强

- **设置面板全面升级**
  - 新增AI服务配置区块，集中管理所有AI相关设置
  - 文字大小改为滑块式调节（12-24px精确控制）
  - 新增酒馆连接状态检测
  - 界面更加直观易用

- **模式选择页面重构**
  - 全新视觉设计，更符合仙侠美学
  - 优化卡片布局和交互体验
  - 修复图标居中偏移问题

- **关系网络面板优化**
  - 改进NPC关系显示逻辑
  - 优化数据结构定义

### 🎯 系统优化

- **提示词引擎重构**
  - 新增默认提示词集合（`defaultPrompts.ts`，353行）
  - 优化CoT思维链核心逻辑
  - 精简冗余规则定义
  - 改进文本格式渲染

- **双向通信系统优化**
  - 重构`AIBidirectionalSystem.ts`（389行修改）
  - 提升AI响应稳定性和准确性

- **任务系统增强**
  - 优化任务存储和状态管理
  - 改进任务面板交互

### 🐛 Bug修复

- 修复模式选择页图标可能偏移的问题
- 修复记忆中心面板部分功能异常
- 修复存档面板数据同步问题
- 修复物品栏交互bug
- 修复云数据同步组件问题
- 修复角色初始化流程中的小问题

### 📝 其他

- 新增内置预设「炼气之神」3.81版本
- 优化国际化翻译支持
- 清理冗余代码和未使用的导入

---

## V3.2 正式版 (2025-11-11)

### 🚀 重大更新

- **重构全新地图系统**：朝天大陆游戏地图正式上线！
  - 新增 [`GameMapPanel.vue`](src/components/dashboard/GameMapPanel.vue) 游戏地图面板组件（914行新代码）
  - 新增 [`gameMapManager.ts`](src/utils/gameMapManager.ts) 地图管理器（1057行）
  - 新增 [`coordinateConverter.ts`](src/utils/coordinateConverter.ts) 坐标转换工具
  - 新增 [`gameMap.ts`](src/types/gameMap.ts) 地图类型定义
  - 支持地图缩放、拖拽、地点交互等功能
  - 精美的SVG图标（洞府/宗门/城镇/秘境）
  - 完整的地点信息展示和交互系统

### 🎯 系统优化

- **角色创建流程优化**
  - 优化世界选择界面（Step1）
  - 改进天赋档次选择逻辑（Step2）
  - 重构出生地选择界面（Step3，+167行）
  - 优化灵根选择流程（Step4，+55行）
  - 改进天赋选择界面（Step5，+58行）

- **提示词系统强化**
  - **任务系统开关控制**：新增 [`questSystemRules.ts`](src/utils/prompts/definitions/questSystemRules.ts)（92行）
  - **行动选项规范**：优化行动选项生成逻辑和数量控制
  - **CoT思维链**：改进核心思维链提示词（+41行修改）
  - **业务规则**：完善业务规则定义（+19行修改）
  - **角色初始化**：优化角色初始化提示词（+45行修改）
  - **世界生成**：重构世界生成提示词（+197行修改）

- **灵石系统修复**
  - 移除不合理的验证限制
  - 新增执行保护，防止灵石变成负数
  - 优化装备加成应用逻辑（+29行修改）

- **数据验证增强**
  - 改进指令验证器逻辑
  - 优化命令格式检查

### ✨ 功能增强

- **预设系统**：新增"【仙途】专用预设.json"（1072行）
- **路由优化**：改进路由配置
- **地点类型扩展**：完善地点类型定义（+42行）

### 🐛 Bug修复

- 修复灵石可能变成负数的问题
- 修复AI可能忽略行动选项数量要求的问题
- 修复任务系统关闭时仍可能生成任务的问题
- 修复角色创建流程中的多个bug
- 修复装备加成计算错误

### 📦 依赖更新

- 更新 package.json 和 package-lock.json
- 优化项目依赖配置

### 📝 文档完善

- 新增"地图系统重构计划.md"（679行）
- 更新游戏介绍页面

---

## V3.1.5 正式版 (2025-11-11)

### 🎯 核心优化

- **提示词系统重构**：大幅精简CoT思维链结构，优化业务规则和数据定义
- **游戏变量面板增强**：改进数据编辑和显示逻辑
- **物品系统优化**：完善物品栏交互和数据处理
- **主游戏面板改进**：优化游戏流程和用户体验

### 🐛 Bug修复

- 修复游戏变量面板数据同步问题
- 修复物品栏显示和操作相关bug
- 修复提示词结构导致的AI响应异常
- 修复数据定义和格式化相关问题
- 清理冗余预设文件

### 📝 文档更新

- 更新CHANGELOG记录所有版本变更

---

## V3.1 正式版 (2025-11-09)

### 🚀 核心更新

- **判定系统重构**：移除骰点，完全基于属性、境界和加成
- **记忆系统优化**：改进记忆总结流程和存储机制
- **预设系统增强**：优化预设保存和加载机制
- **思维链优化**：精简CoT提示词结构，提升AI响应效率
- **文本格式精简**：优化文本格式定义，提升渲染性能

### 🐛 Bug修复

- 修复判定逻辑错误
- 修复文本解析和渲染问题
- 修复预设加载失败问题
- 修复记忆总结数据污染

---

## V3.0.8 正式版 (2025-11-09)

- 精简CoT提示词结构，减少代码冗余
- 优化文本格式定义和FormattedText组件
- 修复文本解析和判定卡片显示问题

---

## V3.0 正式版 (2025-11-08)

### 🚀 核心更新

- **思维链系统**：引入CoT v3.0，简化思维链流程
- **判定系统**：完全基于属性、境界和加成，移除随机性
- **提示词优化**：新增600+行业务规则(境界压制/NPC人格/宏大概念约束/修炼细节等)
- **AI系统增强**：容错解析、流式传输、指令验证、记忆总结Raw模式

### ✨ 功能增强

- 关系网络面板重构，支持NPC记忆总结和关系可视化
- 记忆中心优化，支持导出小说格式
- 存档系统改进，增强验证和修复机制
- 游戏变量面板支持数据编辑
- FormattedText组件重构，新增判定规则帮助

### 🐛 Bug修复

- 修复指令执行导致的存档损坏
- 修复NPC数据结构、记忆总结污染、状态效果移除等问题
- 修复技能掌握度、时间推进、装备加成计算错误

---

## V2.8 正式版 (2025-10-29)

### 🚀 核心亮点：开放性与智能化

- **开放性预设导入/导出**：游戏从业界领先的单机体验，正式升级为**开放式社区创作平台**。玩家现在可以自由地分享、导入和导出包含世界观、文风、规则的完整游戏预设，开启无限可能的社区创作时代！
- **思维链内核 (CoT) 驱动**：重构了底层的提示词引擎，引入**思维链（Chain of Thought）**机制。AI的决策逻辑不再是简单的指令响应，而是模拟“思考”过程，使其行为更合理、更智能、更符合逻辑。
- **【仙途 3.0】预设实装**：游戏内容内核迎来“大版本”迭代，实装全新的 3.0 预设，带来更丰富的世界观、更完善的规则和更具沉浸感的叙事风格。

### ✨ 功能与体验增强

- **真·流式响应**：重构AI响应机制，实现真正的逐字流式输出，剧情生成如丝般顺滑，告别长时间等待。
- **指令安全验证系统**：引入强大的指令验证与修复模块，AI生成的所有指令在执行前都会经过严格校验，极大地提升了游戏稳定性，杜绝了因AI指令错误导致的存档损坏问题。
- **核心RPG系统增强**：
  - **记忆中心**：功能全面升级，玩家可更精细地管理角色记忆。
  - **关系网络**：功能增强，更直观地展示NPC间的复杂关系。
  - **判定系统优化**：判定更加规范和强大，完全基于角色实力。
- **行动队列优化**：优化了玩家连续指令的处理逻辑，响应更高效、更稳定。
- **任务系统**：增加任务删除按钮，管理更便捷。
- **开局流程**：删除了开局时无效的自定义选项，流程更顺畅。

### 🧹 项目维护

- **文档清理**：移除了过时的架构计划文档，标志着项目重构工作的圆满完成。

---

## V2.6.8 正式版 (2025-10-26)

- 修复开局出生种族选择
- 修复开局某些中转API生成失败
- 修复随机灵根、随机出生不被替换
- 修复状态效果不被移除
- 修复身体部位开发不显示描述
- 修复功法技能不解锁
- 修复NPC 私密资料几个显示错误
- 修复记忆转化问题
- 修复存档无法新建
- 增加记忆中心导出为小说模式
- 增加存档数据可以任意修改变量
- 优化任务系统，尊重用户选择，不强制做任务
- 优化提示词
- ...

---

## V2.6 正式版 (2025-10-26)

- 修复bug，优化游戏体验

---

## V2.5 正式版 (2025-10-24)

- 重构代码逻辑，抛弃酒馆变量
- 预设加载
- 任务系统
- 开局选项扩展
- 玩家NSFW信息

---

## V2.0 Beta (2025-10-15)

- 修复物品丢弃失败等bug...
- 优化提示词结构、强化JSON结构生成
- 其他...

---

## V1.9 Beta (2025-10-13)

- 修复已知bug
- 优化提示词结构、强化JSON结构生成
- 其他...

---

## V1.8 Beta (2025-10-10)

- 修复bug
- 优化提示词结构
- 增加适配预设

---

## V1.6 Beta (2025-10-09)

- 修复所有已知bug
- 增加角色管理页面导入存档

---

## V1.5 Beta (2025-10-08)

- 修复已知所有bug，增强命令提示词
- 增加重Roll、人物18+模块
- 将本地localstore存储改为浏览器IndexedDB，加快速度，存储空间

---

## V1.0 Beta (2025-10-04)

- 完整的角色创建系统
- 智能判定系统（含境界、装备、大道、功法加成）
- 自动存档+上次对话备份
- 三千大道系统
- 动态剧情生成
- 格式化文本渲染（环境、心理、对话、判定卡片）

---

## V0.1 Alpha (2025-09-18)

- 完善基础框架
- 初始化选择界面
- 各种数据类型格式
- UI设计
- 游戏主体搭建
