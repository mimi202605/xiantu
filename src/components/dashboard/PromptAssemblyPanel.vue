<template>
  <div class="prompt-assembly-panel">
    <div class="panel-header compact">
      <div class="panel-title-compact">
        <span class="title-text">🔍 提示词组装</span>
      </div>
      <div class="panel-actions">
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
      <p>暂无数据。请开启<strong>调试模式</strong>（系统设置 → 调试模式），并进行一次游戏请求（主回合、分步生成或开局）后，此处将显示最近一次发送给 API 的提示词构成。</p>
    </div>

    <template v-else>
      <div class="assembly-meta">
        <span class="flow-badge">{{ flowName }}</span>
        <span class="time-text">{{ timeText }}</span>
      </div>

      <div class="assembly-content">
        <section class="section-full">
          <h3 class="section-title">提示词全文</h3>
          <pre class="block-content full-prompt">{{ fullPrompt }}</pre>
        </section>

        <section v-for="(mod, index) in modules" :key="mod.key + index" class="section-module">
          <h3 class="section-title">提示词模组{{ index + 1 }}：{{ mod.key }}</h3>
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
import { computed } from 'vue';

const store = usePromptAssemblyStore();
const { hasSnapshot, flowName, fullPrompt, modules, timestamp } = storeToRefs(store);

const timeText = computed(() => {
  if (!timestamp.value) return '';
  const d = new Date(timestamp.value);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
});

function clearSnapshot() {
  store.clear();
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

.assembly-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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

.assembly-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}

.section-full,
.section-module {
  margin-bottom: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-surface);
}

.section-title {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%);
  border-bottom: 1px solid var(--color-border);
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
