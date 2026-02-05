/**
 * 提示词组装可视化 - 调试用
 * 记录最近一次发送给 API 的系统提示词及其模组构成，供「提示词组装」面板展示。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

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
  /** 各子模组 */
  modules: PromptModule[];
  /** 流程名称（如 主回合 / 分步第1步 / 记忆总结） */
  flowName: string;
  /** 记录时间 */
  timestamp: number;
}

export const usePromptAssemblyStore = defineStore('promptAssembly', () => {
  const lastSnapshot = ref<AssemblySnapshot | null>(null);

  const hasSnapshot = computed(() => lastSnapshot.value != null);
  const flowName = computed(() => lastSnapshot.value?.flowName ?? '');
  const fullPrompt = computed(() => lastSnapshot.value?.fullPrompt ?? '');
  const modules = computed(() => lastSnapshot.value?.modules ?? []);
  const timestamp = computed(() => lastSnapshot.value?.timestamp ?? 0);

  function record(snapshot: AssemblySnapshot) {
    lastSnapshot.value = snapshot;
  }

  function clear() {
    lastSnapshot.value = null;
  }

  return {
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
