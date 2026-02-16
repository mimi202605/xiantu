/**
 * 提示词组装可视化 - 调试用
 * 仅保留当前一个回合内的多条快照（如 主回合 单条，或 分步第1步+分步第2步）；新回合开始时清空上一回合。导出用于保存历史。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/** 标记「新回合开始」的 flowName：见到则清空上一回合，只保留本回合内的快照 */
const ROUND_START_FLOW_NAMES = ['主回合', '分步第1步', '开局第1步'] as const;
/** 单回合内最多保留的快照数（主回合=1，分步=2，开局=2，预留记忆总结等） */
const MAX_SNAPSHOTS_PER_ROUND = 10;

export interface PromptModule {
  /** 模组 key（如 coreOutputRules） */
  key: string;
  /** 提示词构成（简短说明） */
  构成: string;
  /** 生成原因 */
  生成原因: string;
  /** 在哪个 flow 引用 */
  flow引用: string;
  /** 模组内容 */
  content: string;
}

export interface AssemblySnapshot {
  /** 完整系统提示词（发送给 API 的全文） */
  fullPrompt: string;
  /** 本步骤使用的提示词模组（来自 assembleSystemPrompt 等） */
  modules: PromptModule[];
  /** 本步骤注入的数据模组（游戏状态、语义记忆、核心状态速览等，用于调试核对是否发送） */
  dataModules?: PromptModule[];
  /** 流程名称（如 主回合 / 分步第1步 / 分步第2步 / 记忆总结） */
  flowName: string;
  /** 记录时间 */
  timestamp: number;
  /** 本步骤发送的记忆内容（assistant 角色，如短期记忆；无则省略） */
  memoryContent?: string;
  /** 本步骤对应的 API 调用说明（如：第1次 API：system=分步第1步, assistant=记忆, user=玩家输入） */
  apiCallDescription?: string;
}

export const usePromptAssemblyStore = defineStore('promptAssembly', () => {
  const recentSnapshots = ref<AssemblySnapshot[]>([]);

  const hasSnapshot = computed(() => recentSnapshots.value.length > 0);
  const lastSnapshot = computed(() => recentSnapshots.value[0] ?? null);
  const flowName = computed(() => lastSnapshot.value?.flowName ?? '');
  const fullPrompt = computed(() => lastSnapshot.value?.fullPrompt ?? '');
  const modules = computed(() => lastSnapshot.value?.modules ?? []);
  const timestamp = computed(() => lastSnapshot.value?.timestamp ?? 0);

  function record(snapshot: AssemblySnapshot) {
    const isNewRound = ROUND_START_FLOW_NAMES.includes(
      snapshot.flowName as (typeof ROUND_START_FLOW_NAMES)[number]
    );
    const withTs = { ...snapshot, timestamp: snapshot.timestamp || Date.now() };
    if (isNewRound) {
      recentSnapshots.value = [withTs];
    } else {
      recentSnapshots.value = [withTs, ...recentSnapshots.value].slice(0, MAX_SNAPSHOTS_PER_ROUND);
    }
  }

  function clear() {
    recentSnapshots.value = [];
  }

  /** 供导出使用：返回当前快照数据（含时间戳），可序列化为 JSON 并下载 */
  function getDataForExport(): { exportedAt: string; snapshots: AssemblySnapshot[] } {
    return {
      exportedAt: new Date().toISOString(),
      snapshots: [...recentSnapshots.value]
    };
  }

  return {
    recentSnapshots,
    lastSnapshot,
    hasSnapshot,
    flowName,
    fullPrompt,
    modules,
    timestamp,
    record,
    clear,
    getDataForExport
  };
});
