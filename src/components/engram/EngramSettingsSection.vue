<template>
  <div class="engram-settings-section settings-section">
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

      <div class="subsection-divider" aria-hidden="true"></div>
      <p class="subsection-label">向量检索</p>
      <p class="engram-api-hint">在「API 管理」→ 辅助功能 中为 Embedding / Rerank 分配 API，此处仅显示当前配置。</p>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">启用向量检索</label>
          <span class="setting-desc">开启后使用 embedding 语义召回，关闭时仅走图谱/规则维度。总开关关闭时本项不生效。</span>
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
          <label class="setting-name">当前 Embedding API</label>
          <span class="setting-desc">只读，来自 API 管理中的「Embedding向量化」分配。</span>
        </div>
        <div class="setting-control">
          <span class="api-readonly">{{ embeddingApiDisplay }}</span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Embedding Model</label>
          <span class="setting-desc">只读，来自 API 管理中当前 Embedding API 的模型。</span>
        </div>
        <div class="setting-control">
          <span class="api-readonly">{{ embeddingModelDisplay }}</span>
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
          <span class="setting-desc">向量最低相似度阈值（0–1）。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="0" max="1" step="0.05" :value="config.embedding.minScore" @input="onMinScoreInput" />
        </div>
      </div>

      <div class="subsection-divider" aria-hidden="true"></div>
      <p class="subsection-label">Rerank</p>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">启用 Rerank</label>
          <span class="setting-desc">开启后对召回候选进行二次重排（可选）。总开关关闭时本项不生效。</span>
        </div>
        <div class="setting-control">
          <label class="setting-switch">
            <input type="checkbox" :checked="config.rerank.enabled" @change="onToggleRerank" />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">当前 Rerank API</label>
          <span class="setting-desc">只读，来自 API 管理中的「Rerank重排」分配，其 URL 作为重排端点。</span>
        </div>
        <div class="setting-control">
          <span class="api-readonly">{{ rerankApiDisplay }}</span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Rerank Model</label>
          <span class="setting-desc">只读，来自 API 管理中当前 Rerank API 的模型（可留空使用服务默认）。</span>
        </div>
        <div class="setting-control">
          <span class="api-readonly">{{ rerankModelDisplay }}</span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Rerank TopN</label>
          <span class="setting-desc">重排窗口输出上限。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="1" max="100" :value="config.rerank.topN" @input="onRerankTopNInput" />
        </div>
      </div>

      <div class="subsection-divider" aria-hidden="true"></div>
      <p class="subsection-label">Trim（记忆裁剪）</p>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">启用 Trim</label>
          <span class="setting-desc">按策略裁剪历史事件，防止记忆无限增长。</span>
        </div>
        <div class="setting-control">
          <label class="setting-switch">
            <input type="checkbox" :checked="config.trim.enabled" @change="onToggleTrim" />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Trim Trigger</label>
          <span class="setting-desc">count：按条数；token：按估算 token。</span>
        </div>
        <div class="setting-control">
          <select class="setting-select" :value="config.trim.trigger" @change="onTrimTriggerChange">
            <option value="count">count</option>
            <option value="token">token</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Trim Token Limit</label>
          <span class="setting-desc">触发 token 模式时的预算上限。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="200" max="200000" :value="config.trim.tokenLimit" @input="onTrimTokenLimitInput" />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Trim Count Limit</label>
          <span class="setting-desc">触发 count 模式时保留的事件条数上限。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="10" max="20000" :value="config.trim.countLimit" @input="onTrimCountLimitInput" />
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <label class="setting-name">Keep Recent</label>
          <span class="setting-desc">无论何种 trim 策略都优先保留的最新事件条数。</span>
        </div>
        <div class="setting-control">
          <input class="config-input" type="number" min="1" max="500" :value="config.trim.keepRecent" @input="onTrimKeepRecentInput" />
        </div>
      </div>

      <div class="subsection-divider" aria-hidden="true"></div>

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
import { useAPIManagementStore } from '@/stores/apiManagementStore';

const props = defineProps<{
  modelValue?: MingEngramConfig;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: MingEngramConfig): void;
  (e: 'change'): void;
}>();

const apiStore = useAPIManagementStore();
const config = computed(() => normalizeEngramConfig(props.modelValue ?? DEFAULT_ENGRAM_CONFIG));

const embeddingApiDisplay = computed(() => {
  const api = apiStore.getAPIForType('embedding');
  if (!api) return '未分配';
  return api.name ? `${api.name}${api.url ? ` · ${api.url}` : ''}` : (api.url || '未分配');
});

const rerankApiDisplay = computed(() => {
  const api = apiStore.getAPIForType('rerank');
  if (!api) return '未分配';
  const endpoint = apiStore.getRerankEndpointUrl();
  const urlDisplay = endpoint || api.url || '';
  return api.name ? `${api.name}${urlDisplay ? ` · ${urlDisplay}` : ''}` : (urlDisplay || '未分配');
});

const embeddingModelDisplay = computed(() => {
  const api = apiStore.getAPIForType('embedding');
  const model = api?.model?.trim();
  return model || '未设置';
});

const rerankModelDisplay = computed(() => {
  const api = apiStore.getAPIForType('rerank');
  const model = api?.model?.trim();
  return model || '未设置';
});

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

const onToggleRerank = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  withUpdate((next) => {
    next.rerank.enabled = checked;
  });
};

const onRerankTopNInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  withUpdate((next) => {
    next.rerank.topN = Number.isFinite(value) ? value : next.rerank.topN;
  });
};

const onToggleTrim = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  withUpdate((next) => {
    next.trim.enabled = checked;
  });
};

const onTrimTriggerChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value === 'token' ? 'token' : 'count';
  withUpdate((next) => {
    next.trim.trigger = value;
  });
};

const onTrimTokenLimitInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  withUpdate((next) => {
    next.trim.tokenLimit = Number.isFinite(value) ? value : next.trim.tokenLimit;
  });
};

const onTrimCountLimitInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  withUpdate((next) => {
    next.trim.countLimit = Number.isFinite(value) ? value : next.trim.countLimit;
  });
};

const onTrimKeepRecentInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  withUpdate((next) => {
    next.trim.keepRecent = Number.isFinite(value) ? value : next.trim.keepRecent;
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
.engram-settings-section.settings-section {
  margin-bottom: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.engram-settings-section .section-header {
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.engram-settings-section .section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.engram-settings-section .settings-list {
  padding: 0.5rem;
}

.engram-settings-section .setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  transition: background 0.2s ease;
}

.engram-settings-section .setting-item:hover {
  background: #f8fafc;
}

.engram-settings-section .setting-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.engram-settings-section .setting-name {
  font-weight: 500;
  color: #1e293b;
  cursor: pointer;
}

.engram-settings-section .setting-desc {
  font-size: 0.875rem;
  color: #64748b;
}

.engram-settings-section .setting-control {
  display: flex;
  align-items: center;
}

.subsection-divider {
  height: 1px;
  margin: 0.5rem 1.25rem;
  background: #e2e8f0;
}

.subsection-label {
  margin: 0.75rem 1.25rem 0.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.engram-api-hint {
  margin: 0.25rem 1.25rem 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
}

.engram-settings-section .api-readonly {
  font-size: 0.875rem;
  color: #64748b;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.engram-settings-section .setting-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: white;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 12px;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s ease;
  appearance: none;
  min-width: 120px;
}

.engram-settings-section .setting-select:hover {
  border-color: #94a3b8;
}

.engram-settings-section .setting-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.engram-settings-section .setting-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.engram-settings-section .setting-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.engram-settings-section .switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.2s;
  border-radius: 24px;
}

.engram-settings-section .switch-slider::before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

.engram-settings-section input:checked + .switch-slider {
  background-color: #3b82f6;
}

.engram-settings-section input:checked + .switch-slider::before {
  transform: translateX(20px);
}

.engram-settings-section .config-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: white;
  color: #374151;
  font-size: 0.875rem;
  min-width: 80px;
  max-width: 140px;
  transition: border-color 0.2s ease;
}

.engram-settings-section .config-input:hover {
  border-color: #94a3b8;
}

.engram-settings-section .config-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.engram-settings-section .config-input-wide {
  max-width: 100%;
  width: 280px;
}

/* 深色主题（与主设置面板一致） */
[data-theme='dark'] .engram-settings-section.settings-section {
  background: #1e293b;
  border-color: #475569;
}

[data-theme='dark'] .engram-settings-section .section-header {
  background: #334155;
  border-bottom-color: #475569;
}

[data-theme='dark'] .engram-settings-section .section-title,
[data-theme='dark'] .engram-settings-section .setting-name {
  color: #f1f5f9;
}

[data-theme='dark'] .engram-settings-section .setting-desc {
  color: #94a3b8;
}

[data-theme='dark'] .subsection-label {
  color: #94a3b8;
}

[data-theme='dark'] .engram-api-hint {
  color: #94a3b8;
}

[data-theme='dark'] .engram-settings-section .api-readonly {
  color: #94a3b8;
}

[data-theme='dark'] .subsection-divider {
  background: #475569;
}

[data-theme='dark'] .engram-settings-section .setting-item:hover {
  background: #334155;
}

[data-theme='dark'] .engram-settings-section .setting-select,
[data-theme='dark'] .engram-settings-section .config-input {
  background-color: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}

[data-theme='dark'] .engram-settings-section .setting-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23e5e7eb' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
}

[data-theme='dark'] .engram-settings-section .setting-select:hover,
[data-theme='dark'] .engram-settings-section .config-input:hover {
  border-color: #6b7280;
}

[data-theme='dark'] .engram-settings-section .switch-slider {
  background-color: #4b5563;
}
</style>
