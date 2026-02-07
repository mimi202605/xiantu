<template>
  <div class="prompt-assembly-panel">
    <div class="panel-header compact">
      <div class="panel-title-compact">
        <span class="title-text">🔍 提示词组装</span>
      </div>
      <div class="panel-actions">
        <button v-if="hasSnapshot" class="action-btn-compact" @click="exportSnapshot" title="导出为 JSON 保存">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button v-if="hasSnapshot" class="action-btn-compact" @click="clearSnapshot" title="清除记录">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="assembly-hint" v-if="!hasSnapshot">
      <p>暂无数据。请开启<strong>调试模式</strong>（系统设置 → 调试模式），并进行一次游戏请求（主回合、分步生成或开局）后，此处将显示发送给 API 的提示词构成（含分步第1步、第2步等）。</p>
    </div>

    <template v-else>
      <!-- 当前回合内可能有多条快照（如 分步第1步、分步第2步），可切换查看 -->
      <div class="step-tabs" v-if="recentSnapshots.length > 1">
        <button
          v-for="(snap, idx) in recentSnapshots"
          :key="idx"
          class="step-tab"
          :class="{ active: selectedIndex === idx }"
          @click="selectedIndex = idx"
        >
          <span class="step-tab-name">{{ snap.flowName }}</span>
          <span class="step-tab-time">{{ formatTime(snap.timestamp) }}</span>
          <span class="step-tab-modules">共 {{ snap.modules.length }} 个模组 · 约 {{ tokensForSnapshot(snap) }} tokens</span>
        </button>
      </div>

      <div class="assembly-meta" v-if="selectedSnapshot">
        <span class="flow-badge">{{ selectedSnapshot.flowName }}</span>
        <span class="time-text">{{ formatTime(selectedSnapshot.timestamp) }}</span>
        <span class="modules-summary">本步骤使用的提示词模组：{{ selectedSnapshot.modules.map(m => m.key).join('、') }}</span>
        <span class="api-call-desc" v-if="selectedSnapshot.apiCallDescription" :title="selectedSnapshot.apiCallDescription">
          本步骤对应：{{ selectedSnapshot.apiCallDescription }}
        </span>
      </div>

      <div class="assembly-content" v-if="selectedSnapshot">
        <section class="section-full">
          <h3 class="section-title">
            提示词全文
            <span class="token-badge">约 {{ fullPromptTokens }} tokens</span>
          </h3>
          <pre class="block-content full-prompt">{{ selectedSnapshot.fullPrompt }}</pre>
        </section>

        <section class="section-memory" v-if="selectedSnapshot.memoryContent">
          <h3 class="section-title">
            本步骤发送的记忆（assistant 角色）
            <span class="token-badge">约 {{ memoryTokens }} tokens</span>
          </h3>
          <pre class="block-content memory-content">{{ selectedSnapshot.memoryContent }}</pre>
        </section>

        <h3 class="section-title modules-heading">本步骤使用的提示词模组（共 {{ selectedSnapshot.modules.length }} 个）</h3>
        <section v-for="(mod, index) in selectedSnapshot.modules" :key="mod.key + index" class="section-module">
          <h3 class="section-title">
            提示词模组{{ index + 1 }}：{{ mod.key }}
            <span class="token-badge">约 {{ getModuleTokens(mod) }} tokens</span>
          </h3>
          <dl class="module-meta">
            <dt>提示词构成：</dt>
            <dd>{{ mod.构成 }}</dd>
            <dt>生成原因：</dt>
            <dd>{{ mod.生成原因 }}</dd>
            <dt>在那个 flow 引用：</dt>
            <dd>{{ mod.flow引用 }}</dd>
          </dl>
          <pre class="block-content module-content">{{ mod.content }}</pre>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePromptAssemblyStore } from '@/stores/promptAssemblyStore';
import { estimateTokensForText } from '@/utils/tokenEstimate';
import { computed, ref, watch } from 'vue';
import type { AssemblySnapshot, PromptModule } from '@/stores/promptAssemblyStore';

const store = usePromptAssemblyStore();
const { hasSnapshot, recentSnapshots } = storeToRefs(store);

const selectedIndex = ref(0);

const selectedSnapshot = computed<AssemblySnapshot | null>(() => {
  const list = recentSnapshots.value;
  const idx = selectedIndex.value;
  return list[idx] ?? null;
});

const fullPromptTokens = computed(() => {
  const snap = selectedSnapshot.value;
  return snap ? estimateTokensForText(snap.fullPrompt) : 0;
});

const memoryTokens = computed(() => {
  const snap = selectedSnapshot.value;
  return snap?.memoryContent ? estimateTokensForText(snap.memoryContent) : 0;
});

function getModuleTokens(mod: PromptModule): number {
  return estimateTokensForText(mod.content);
}

function tokensForSnapshot(snap: AssemblySnapshot): number {
  return estimateTokensForText(snap.fullPrompt);
}

watch(recentSnapshots, (list) => {
  if (list.length > 0 && selectedIndex.value >= list.length) {
    selectedIndex.value = 0;
  }
}, { immediate: true });

function formatTime(ts: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function clearSnapshot() {
  store.clear();
  selectedIndex.value = 0;
}

function exportSnapshot() {
  const data = store.getDataForExport();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompt-assembly-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.prompt-assembly-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--color-background);
}

.panel-header.compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.panel-title-compact {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn-compact:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.assembly-hint {
  flex: 1;
  min-height: 120px;
  padding: 1.5rem 1rem;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.assembly-hint p {
  margin: 0;
}

.assembly-hint strong {
  color: var(--color-primary);
}

.step-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.step-tab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.step-tab:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-hover);
}

.step-tab.active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.15);
  color: var(--color-primary);
}

.step-tab-name {
  font-weight: 600;
}

.step-tab-time {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.step-tab-modules {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

.assembly-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 0.85rem;
}

.flow-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: var(--color-primary);
  color: white;
  font-weight: 500;
}

.time-text {
  color: var(--color-text-secondary);
}

.modules-summary,
.api-call-desc {
  width: 100%;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.api-call-desc {
  margin-top: 0.25rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
}

.modules-heading {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.assembly-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}

.section-full,
.section-memory,
.section-module {
  margin-bottom: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-surface);
}

.memory-content {
  max-height: 280px;
}

.section-title {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.token-badge {
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.module-meta {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
}

.module-meta dt {
  margin: 0;
  font-weight: 500;
  color: var(--color-text);
}

.module-meta dd {
  margin: 0;
}

.block-content {
  margin: 0;
  padding: 1rem;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  background: var(--color-background);
  color: var(--color-text);
  border-radius: 0 0 8px 8px;
}

.full-prompt {
  max-height: 500px;
}

.module-content {
  max-height: 300px;
}
</style>
