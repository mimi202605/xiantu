<template>
  <div class="settings-section">
    <div class="section-header">
      <h4 class="section-title">🧠 记忆增强（Engram）</h4>
    </div>

    <div class="settings-list">
      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">启用 Engram 增强</label>
          <span class="setting-desc">关闭时完全保留 legacy 记忆流程，不改变现有行为。</span>
        </div>
        <div class="setting-control">
          <label class="setting-switch">
            <input type="checkbox" :checked="config.enabled" @change="onToggleEnabled" />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">检索模式</label>
          <span class="setting-desc">legacy 为原流程；hybrid 由统一检索器替代旧检索流程。</span>
        </div>
        <div class="setting-control">
          <select class="setting-select" :value="config.retrievalMode" @change="onModeChange">
            <option value="legacy">legacy</option>
            <option value="hybrid">hybrid</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">启用向量检索</label>
          <span class="setting-desc">开启后使用 embedding 语义召回，关闭时仅走图谱/规则维度。</span>
        </div>
        <div class="setting-control">
          <label class="setting-switch">
            <input type="checkbox" :checked="config.embedding.enabled" @change="onToggleEmbedding" />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Embedding Provider</label>
          <span class="setting-desc">向量服务提供商。</span>
        </div>
        <div class="setting-control">
          <select class="setting-select" :value="config.embedding.provider" @change="onProviderChange">
            <option value="openai">openai</option>
            <option value="ollama">ollama</option>
            <option value="vllm">vllm</option>
            <option value="cohere">cohere</option>
            <option value="jina">jina</option>
            <option value="voyage">voyage</option>
            <option value="custom">custom</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Embedding Model</label>
          <span class="setting-desc">向量模型名称。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="text" :value="config.embedding.model" @input="onModelInput" />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">TopK</label>
          <span class="setting-desc">向量候选召回上限。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="1" max="200" :value="config.embedding.topK" @input="onTopKInput" />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Min Score</label>
          <span class="setting-desc">向量最低相似度阈值（0-1）。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="0" max="1" step="0.05" :value="config.embedding.minScore" @input="onMinScoreInput" />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">调试面板</label>
          <span class="setting-desc">开启后可在后续版本查看检索候选与分数细节。</span>
        </div>
        <div class="setting-control">
          <label class="setting-switch">
            <input type="checkbox" :checked="config.debug === true" @change="onToggleDebug" />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MingEngramConfig } from '@/types/game';
import { DEFAULT_ENGRAM_CONFIG, normalizeEngramConfig } from '@/services/engram/config';

const props = defineProps<{
  modelValue?: MingEngramConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: MingEngramConfig): void;
  (e: 'change'): void;
}>();

const config = computed(() => normalizeEngramConfig(props.modelValue ?? DEFAULT_ENGRAM_CONFIG));

const withUpdate = (updater: (next: MingEngramConfig) => void) => {
  const next = normalizeEngramConfig(config.value);
  updater(next);
  emit('update:modelValue', normalizeEngramConfig(next));
  emit('change');
};

const onToggleEnabled = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  withUpdate((next) => {
    next.enabled = checked;
  });
};

const onModeChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value === 'hybrid' ? 'hybrid' : 'legacy';
  withUpdate((next) => {
    next.retrievalMode = value;
  });
};

const onToggleEmbedding = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  withUpdate((next) => {
    next.embedding.enabled = checked;
  });
};

const onProviderChange = (event: Event) => {
  const provider = (event.target as HTMLSelectElement).value;
  withUpdate((next) => {
    if (
      provider === 'openai' ||
      provider === 'ollama' ||
      provider === 'custom' ||
      provider === 'vllm' ||
      provider === 'cohere' ||
      provider === 'jina' ||
      provider === 'voyage'
    ) {
      next.embedding.provider = provider;
    }
  });
};

const onModelInput = (event: Event) => {
  const model = (event.target as HTMLInputElement).value;
  withUpdate((next) => {
    next.embedding.model = model;
  });
};

const onTopKInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  withUpdate((next) => {
    next.embedding.topK = Number.isFinite(value) ? value : next.embedding.topK;
  });
};

const onMinScoreInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  withUpdate((next) => {
    next.embedding.minScore = Number.isFinite(value) ? value : next.embedding.minScore;
  });
};

const onToggleDebug = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  withUpdate((next) => {
    next.debug = checked;
  });
};
</script>

<style scoped>
.config-input {
  padding: 0.45rem 0.65rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  width: 140px;
}

.config-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

[data-theme='dark'] .config-input {
  background: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}
</style>
