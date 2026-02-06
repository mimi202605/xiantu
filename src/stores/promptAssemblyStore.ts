/**
 * 提示词组装可视化 - 调试用
 * 记录最近多次发送给 API 的系统提示词及其模组构成（含分步第1/2步等），供「提示词组装」面板展示。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const MAX_RECENT_SNAPSHOTS = 20;

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
  /** 本步骤使用的提示词模组 */
  modules: PromptModule[];
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
    recentSnapshots.value = [
      { ...snapshot, timestamp: snapshot.timestamp || Date.now() },
      ...recentSnapshots.value
    ].slice(0, MAX_RECENT_SNAPSHOTS);
  }

  function clear() {
    recentSnapshots.value = [];
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
    clear
  };
});
