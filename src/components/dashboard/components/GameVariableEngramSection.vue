<template>
  <div class="engram-section">
    <div class="section-header">
      <h3 class="section-title">Engram 记忆 (系统.扩展.engramMemory)</h3>
      <p class="section-desc">事件、实体与关系由主回合 GM 响应后提取并写入；向量存于 IndexedDB，与实体/语义类似可实时查看。</p>
    </div>

    <div v-if="!engramData" class="empty-hint">暂无 Engram 数据（需启用 Engram 并经过主回合写入）</div>

    <div v-else class="engram-content">
      <!-- meta -->
      <div class="subsection">
        <h4 class="subsection-title">Meta</h4>
        <div class="subsection-body meta-grid">
          <span class="meta-item">schema_version: {{ engramData.meta?.schema_version ?? '-' }}</span>
          <span class="meta-item">embedding_model: {{ engramData.meta?.embedding_model || '-' }}</span>
          <span class="meta-item">vector_dim: {{ engramData.meta?.vector_dim ?? '-' }}</span>
          <span class="meta-item">last_trimmed_at: {{ engramData.meta?.last_trimmed_at ? formatTs(engramData.meta.last_trimmed_at) : '-' }}</span>
          <span class="meta-item">向量库: {{ vectorStore ? `已加载 (dim=${vectorStore.dim}, model=${vectorStore.model || '-'})` : vectorContext ? '加载中…' : '未提供 context' }}</span>
        </div>
      </div>

      <!-- events -->
      <div class="subsection">
        <h4 class="subsection-title">事件 ({{ events.length }})</h4>
        <div v-if="events.length > 0" class="subsection-body">
          <div v-for="(ev, i) in events" :key="ev.id || i" class="entry-card">
            <div class="entry-row">
              <span class="entry-id">{{ ev.id }}</span>
              <span class="entry-meta">time_anchor: {{ (ev.structured_kv as any)?.time_anchor || '-' }}</span>
              <span class="entry-meta">ts: {{ formatTs((ev as any).timestamp) }}</span>
              <span class="vector-badge" :class="{ has: hasEventVector(ev.id) }">
                {{ hasEventVector(ev.id) ? `向量 dim=${getEventVectorDim(ev.id)}` : '无向量' }}
              </span>
              <button class="copy-btn" @click="copy(JSON.stringify(ev))" title="复制">复制</button>
            </div>
            <div class="entry-summary">{{ (ev as any).summary || '-' }}</div>
            <details v-if="hasEventVector(ev.id)" class="embedding-details">
              <summary>embedding 预览</summary>
              <pre class="embedding-preview">{{ formatVectorPreview(getEventVector(ev.id)) }}</pre>
            </details>
          </div>
        </div>
        <div v-else class="empty-hint">暂无事件</div>
      </div>

      <!-- entities -->
      <div class="subsection">
        <h4 class="subsection-title">实体 ({{ entities.length }})</h4>
        <div v-if="entities.length > 0" class="subsection-body">
          <div v-for="(ent, i) in entities" :key="ent.id || i" class="entry-card">
            <div class="entry-row">
              <span class="entry-id">{{ ent.id }}</span>
              <span class="entity-name">{{ (ent as any).name || '-' }}</span>
              <span class="entity-type">{{ (ent as any).type || 'unknown' }}</span>
              <span class="vector-badge" :class="{ has: hasEntityVector(ent.id) }">
                {{ hasEntityVector(ent.id) ? `向量 dim=${getEntityVectorDim(ent.id)}` : '无向量' }}
              </span>
              <button class="copy-btn" @click="copy(JSON.stringify(ent))" title="复制">复制</button>
            </div>
            <div class="entry-desc">{{ (ent as any).description || '-' }}</div>
            <details v-if="hasEntityVector(ent.id)" class="embedding-details">
              <summary>embedding 预览</summary>
              <pre class="embedding-preview">{{ formatVectorPreview(getEntityVector(ent.id)) }}</pre>
            </details>
          </div>
        </div>
        <div v-else class="empty-hint">暂无实体</div>
      </div>

      <!-- relations -->
      <div class="subsection">
        <h4 class="subsection-title">关系 ({{ relations.length }})</h4>
        <div v-if="relations.length > 0" class="subsection-body">
          <div v-for="(r, i) in relations" :key="r.id || i" class="rel-line">
            <span class="rel-from">{{ (r as any).from_id }}</span>
            <span class="rel-pred">{{ (r as any).relation }}</span>
            <span class="rel-to">{{ (r as any).to_id }}</span>
            <span class="rel-conf">confidence {{ (r as any).confidence }}</span>
            <button class="copy-btn" @click="copy(JSON.stringify(r))" title="复制">复制</button>
          </div>
        </div>
        <div v-else class="empty-hint">暂无关系</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { loadEngramVectorStore } from '@/services/engram/vectorRepository'
import type { EngramVectorStore } from '@/services/engram/types'
import type { MingEngramMemory } from '@/types/game'
import { toast } from '@/utils/toast'
import { useI18n } from '@/i18n'

const { t } = useI18n()

interface Props {
  engramData?: MingEngramMemory | null
  vectorContext?: { characterId: string; slotId: string } | null
}

const props = withDefaults(defineProps<Props>(), {
  engramData: () => null,
  vectorContext: () => null
})

const vectorStore = ref<EngramVectorStore | null>(null)

watch(
  () => props.vectorContext,
  async (ctx) => {
    if (!ctx?.characterId || ctx?.slotId == null) {
      vectorStore.value = null
      return
    }
    try {
      vectorStore.value = await loadEngramVectorStore(ctx)
    } catch (e) {
      console.warn('[Engram Section] load vector store failed:', e)
      vectorStore.value = null
    }
  },
  { immediate: true }
)

const events = computed(() => {
  const arr = props.engramData?.events
  return Array.isArray(arr) ? arr : []
})

const entities = computed(() => {
  const arr = props.engramData?.entities
  return Array.isArray(arr) ? arr : []
})

const relations = computed(() => {
  const arr = props.engramData?.relations
  return Array.isArray(arr) ? arr : []
})

function hasEventVector(id: string | undefined): boolean {
  if (!id || !vectorStore.value?.eventVectors) return false
  const v = vectorStore.value.eventVectors[id]
  return Array.isArray(v) && v.length > 0
}

function getEventVector(id: string | undefined): number[] {
  if (!id || !vectorStore.value?.eventVectors) return []
  return vectorStore.value.eventVectors[id] ?? []
}

function getEventVectorDim(id: string | undefined): number {
  return getEventVector(id).length
}

function hasEntityVector(id: string | undefined): boolean {
  if (!id || !vectorStore.value?.entityVectors) return false
  const v = vectorStore.value.entityVectors[id]
  return Array.isArray(v) && v.length > 0
}

function getEntityVector(id: string | undefined): number[] {
  if (!id || !vectorStore.value?.entityVectors) return []
  return vectorStore.value.entityVectors[id] ?? []
}

function getEntityVectorDim(id: string | undefined): number {
  return getEntityVector(id).length
}

const PREVIEW_DIMS = 12

function formatVectorPreview(vec: number[]): string {
  if (!vec.length) return '(空)'
  const slice = vec.slice(0, PREVIEW_DIMS)
  return `[${slice.map((x) => x.toFixed(6)).join(', ')}${vec.length > PREVIEW_DIMS ? ', ...' : ''}]  (共 ${vec.length} 维)`
}

function formatTs(ts: number | string | undefined): string {
  if (ts == null) return '-'
  const n = typeof ts === 'string' ? Date.parse(ts) : ts
  if (Number.isNaN(n)) return String(ts)
  const d = new Date(n)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('已复制到剪贴板'))
  } catch {
    toast.error(t('复制失败'))
  }
}
</script>

<style scoped>
.engram-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  overflow: auto;
}

.section-header {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.section-title {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
}

.section-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.engram-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow: auto;
}

.subsection {
  background: var(--color-code-bg, #1e1e1e);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.subsection-title {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.subsection-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.8rem;
  font-family: 'Consolas', 'Monaco', monospace;
}

.meta-item {
  color: var(--color-text-secondary);
}

.entry-card {
  padding: 0.5rem 0.6rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  font-size: 0.8rem;
}

.entry-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
}

.entry-id {
  color: #9cdcfe;
  font-family: 'Consolas', 'Monaco', monospace;
}

.entry-meta {
  color: #6a9955;
  font-size: 0.75rem;
}

.entity-name {
  color: #ce9178;
  font-weight: 500;
}

.entity-type {
  color: #4ec9b0;
  font-size: 0.75rem;
}

.entry-summary,
.entry-desc {
  margin-top: 0.35rem;
  padding-left: 0.25rem;
  color: var(--color-text);
  line-height: 1.4;
}

.vector-badge {
  font-size: 0.72rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.vector-badge.has {
  background: rgba(74, 158, 255, 0.2);
  color: var(--color-primary, #4a9eff);
}

.embedding-details {
  margin-top: 0.4rem;
  font-size: 0.78rem;
}

.embedding-details summary {
  cursor: pointer;
  color: var(--color-text-secondary);
}

.embedding-preview {
  margin: 0.25rem 0 0 0;
  padding: 0.4rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 0.72rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.rel-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  font-family: 'Consolas', 'Monaco', monospace;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

.rel-from,
.rel-to {
  color: #9cdcfe;
}

.rel-pred {
  color: #c586c0;
}

.rel-conf {
  color: #4ec9b0;
  font-size: 0.75rem;
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.copy-btn {
  margin-left: auto;
  padding: 0.15rem 0.4rem;
  font-size: 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.copy-btn:hover {
  background: var(--color-primary-light, rgba(74, 158, 255, 0.15));
  color: var(--color-primary, #4a9eff);
}
</style>
