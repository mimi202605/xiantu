<template>
  <div class="game-index-section">
    <div class="section-header">
      <h3 class="section-title">实体与语义 (游戏索引)</h3>
      <p class="section-desc">游戏实体索引与语义记忆，由 LLM 在行动生成时产出并写入 系统.扩展。</p>
    </div>

    <div class="game-index-content">
      <!-- 游戏实体索引 -->
      <div class="subsection">
        <h4 class="subsection-title">游戏实体索引 (系统.扩展.游戏实体索引)</h4>
        <div v-if="entities.length > 0 || relationships.length > 0" class="subsection-body">
          <div v-if="entities.length > 0" class="entity-list">
            <div class="list-caption">实体 ({{ entities.length }})</div>
            <div v-for="(e, i) in entities" :key="e.id || i" class="entity-card">
              <span class="entity-id">{{ e.id || '-' }}</span>
              <span class="entity-type">{{ e.type || 'other' }}</span>
              <span class="entity-name">{{ e.name || '-' }}</span>
              <span v-if="e.tags && e.tags.length" class="entity-tags">{{ (e.tags || []).join(', ') }}</span>
              <button class="copy-btn" @click="copy(JSON.stringify(e))" title="复制">复制</button>
            </div>
          </div>
          <div v-if="relationships.length > 0" class="rel-list">
            <div class="list-caption">关系 ({{ relationships.length }})</div>
            <div v-for="(r, i) in relationships" :key="i" class="rel-line">
              <span class="rel-from">{{ r.fromId }}</span>
              <span class="rel-pred">{{ r.relationship }}</span>
              <span class="rel-to">{{ r.toId }}</span>
              <button class="copy-btn" @click="copy(JSON.stringify(r))" title="复制">复制</button>
            </div>
          </div>
        </div>
        <div v-else class="empty-hint">暂无实体或关系</div>
      </div>

      <!-- 语义记忆 -->
      <div class="subsection">
        <h4 class="subsection-title">语义记忆 (系统.扩展.语义记忆)</h4>
        <div v-if="triples.length > 0" class="subsection-body">
          <div class="list-caption">三元组 ({{ triples.length }})</div>
          <div v-for="(t, i) in triples" :key="i" class="triple-line">
            <span class="triple-s">{{ t.subject }}</span>
            <span class="triple-p">{{ t.predicate }}</span>
            <span class="triple-o">{{ t.object }}</span>
            <span v-if="t.importance != null" class="triple-imp">重要度 {{ t.importance }}</span>
            <span v-if="t.category" class="triple-cat">{{ t.category }}</span>
            <button class="copy-btn" @click="copy(JSON.stringify(t))" title="复制">复制</button>
          </div>
        </div>
        <div v-else class="empty-hint">暂无语义记忆</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { toast } from '@/utils/toast'
import { useI18n } from '@/i18n'

const { t } = useI18n()

interface Props {
  gameIndexData?: {
    gameEntityIndex?: { entities?: unknown[]; relationships?: unknown[] } | null
    semanticMemory?: { triples?: unknown[] } | null
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  gameIndexData: () => null
})

const entities = computed(() => {
  const idx = props.gameIndexData?.gameEntityIndex
  return Array.isArray(idx?.entities) ? idx.entities : []
})

const relationships = computed(() => {
  const idx = props.gameIndexData?.gameEntityIndex
  return Array.isArray(idx?.relationships) ? idx.relationships : []
})

const triples = computed(() => {
  const sm = props.gameIndexData?.semanticMemory
  return Array.isArray(sm?.triples) ? sm.triples : []
})

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('已复制到剪贴板'))
  } catch {
    toast.error(t('复制失败'))
  }
}
</script>

<style scoped>
.game-index-section {
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

.game-index-content {
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
  gap: 0.75rem;
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.list-caption {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.entity-list,
.rel-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.entity-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.8rem;
  font-family: 'Consolas', 'Monaco', monospace;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
}

.entity-id { color: #9cdcfe; }
.entity-type { color: #4ec9b0; font-size: 0.75rem; }
.entity-name { color: #ce9178; font-weight: 500; }
.entity-tags { color: #d7ba7d; font-size: 0.75rem; }

.rel-line,
.triple-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  font-family: 'Consolas', 'Monaco', monospace;
  background: rgba(255,255,255,0.03);
  border-radius: 4px;
}

.rel-from, .rel-to { color: #9cdcfe; }
.rel-pred { color: #c586c0; }

.triple-s { color: #9cdcfe; }
.triple-p { color: #dcdcaa; }
.triple-o { color: #ce9178; }
.triple-imp { color: #4ec9b0; font-size: 0.75rem; }
.triple-cat { color: #d7ba7d; font-size: 0.75rem; }

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
  background: var(--color-primary-light, rgba(74,158,255,0.15));
  color: var(--color-primary, #4a9eff);
}
</style>
