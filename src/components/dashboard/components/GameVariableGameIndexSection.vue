<template>
  <div class="game-index-section">
    <div class="section-header">
      <h3 class="section-title">实体与语义 (游戏索引)</h3>
      <p class="section-desc">实体与关系由 社交.关系+角色 派生；语义记忆由 LLM 在行动生成时产出并写入 系统.扩展.语义记忆。</p>
    </div>

    <div class="game-index-content">
      <!-- 关系图 -->
      <div class="subsection">
        <h4 class="subsection-title">{{ t('关系图') }}</h4>
        <GameEntityGraph
          v-if="entities.length > 0 || relationships.length > 0"
          :entities="entities"
          :relationships="relationships"
          :npcProfiles="socialRelations"
          :playerName="playerName"
        />
        <div v-else class="empty-hint">{{ t('暂无实体或关系') }}</div>
      </div>

      <!-- 实体与关系（由 社交.关系+角色 派生）-->
      <div class="subsection">
        <h4 class="subsection-title">实体与关系（由 社交.关系+角色 派生）</h4>
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
          <div class="triple-controls">
            <span class="control-label">排序</span>
            <select v-model="sortBy" class="control-select">
              <option value="subject">subject</option>
              <option value="predicate">predicate</option>
              <option value="object">object</option>
              <option value="importance">importance</option>
              <option value="timestamp">timestamp</option>
              <option value="category">category</option>
            </select>
            <select v-model="sortOrder" class="control-select">
              <option value="asc">升序</option>
              <option value="desc">降序</option>
            </select>
            <span class="control-label">筛选</span>
            <input v-model="filterSubject" class="control-input" placeholder="subject/object 包含" />
            <select v-model="filterCategory" class="control-select">
              <option value="">全部</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
            <input v-model.number="filterImportanceMin" type="number" class="control-input control-num" placeholder="重要度≥" min="1" max="10" />
            <label class="control-label control-check">
              <input v-model="groupBySubject" type="checkbox" /> 按 subject 分组
            </label>
          </div>
          <div class="list-caption">三元组 ({{ filteredTriples.length }}{{ groupBySubject ? ` · ${displayedGroups.length} 组` : '' }})</div>
          <template v-if="groupBySubject">
            <div v-for="g in displayedGroups" :key="g.subject" class="triple-group">
              <div class="group-head">{{ g.subject }}</div>
              <div v-for="(t, i) in g.triples" :key="i" class="triple-line">
                <span v-if="t.timestamp" class="triple-ts" :title="t.timestamp">{{ formatTripleTimestamp(t.timestamp) }}</span>
                <span class="triple-s">{{ t.subject }}</span>
                <span class="triple-p">{{ t.predicate }}</span>
                <span class="triple-o">{{ t.object }}</span>
                <span v-if="t.importance != null" class="triple-imp">重要度 {{ t.importance }}</span>
                <span v-if="t.category" class="triple-cat">{{ t.category }}</span>
                <button class="copy-btn" @click="copy(JSON.stringify(t))" title="复制">复制</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div v-for="(t, i) in displayedTriples" :key="i" class="triple-line">
              <span v-if="t.timestamp" class="triple-ts" :title="t.timestamp">{{ formatTripleTimestamp(t.timestamp) }}</span>
              <span class="triple-s">{{ t.subject }}</span>
              <span class="triple-p">{{ t.predicate }}</span>
              <span class="triple-o">{{ t.object }}</span>
              <span v-if="t.importance != null" class="triple-imp">重要度 {{ t.importance }}</span>
              <span v-if="t.category" class="triple-cat">{{ t.category }}</span>
              <button class="copy-btn" @click="copy(JSON.stringify(t))" title="复制">复制</button>
            </div>
          </template>
        </div>
        <div v-else class="empty-hint">暂无语义记忆</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  sortTriples,
  parseTripleTimestamp,
  type SortTriplesBy,
  type SortOrder,
} from '@/services/memoryRetrievalService'
import type { SemanticTriple } from '@/types/gameStateIndex'
import { toast } from '@/utils/toast'
import { useI18n } from '@/i18n'
import GameEntityGraph from './GameEntityGraph.vue'

const { t } = useI18n()

interface Props {
  gameIndexData?: {
    entities?: unknown[]
    relationships?: unknown[]
    semanticMemory?: { triples?: unknown[] } | null
  } | null
  socialRelations?: Record<string, { 出生?: unknown } | unknown>
  playerName?: string
}

const props = withDefaults(defineProps<Props>(), {
  gameIndexData: () => null,
  socialRelations: () => ({}),
  playerName: ''
})

const sortBy = ref<SortTriplesBy>('timestamp')
const sortOrder = ref<SortOrder>('desc')
const filterSubject = ref('')
const filterCategory = ref('')
const filterImportanceMin = ref<number | ''>('')
const groupBySubject = ref(false)

const entities = computed(() => {
  const arr = props.gameIndexData?.entities
  return Array.isArray(arr) ? arr : []
})

const relationships = computed(() => {
  const arr = props.gameIndexData?.relationships
  return Array.isArray(arr) ? arr : []
})

const triples = computed((): SemanticTriple[] => {
  const sm = props.gameIndexData?.semanticMemory
  const arr = Array.isArray(sm?.triples) ? sm.triples : []
  return arr.filter(
    (x): x is SemanticTriple =>
      !!x && typeof x === 'object' && typeof (x as any).subject === 'string' && typeof (x as any).predicate === 'string' && typeof (x as any).object === 'string'
  )
})

const categories = computed(() =>
  [...new Set(triples.value.map(t => t.category).filter(Boolean))].sort() as string[]
)

const filteredTriples = computed(() => {
  let out = triples.value
  const sub = filterSubject.value.trim()
  if (sub) {
    out = out.filter(t => (t.subject && t.subject.includes(sub)) || (t.object && t.object.includes(sub)))
  }
  if (filterCategory.value) {
    out = out.filter(t => t.category === filterCategory.value)
  }
  const imp = filterImportanceMin.value
  if (imp !== '' && typeof imp === 'number') {
    out = out.filter(t => typeof t.importance === 'number' && t.importance >= imp)
  }
  return out
})

const displayedTriples = computed(() => {
  if (groupBySubject.value) return [] // flat list not used when grouped
  return sortTriples(filteredTriples.value, sortBy.value, sortOrder.value)
})

const displayedGroups = computed(() => {
  if (!groupBySubject.value) return []
  const g = new Map<string, SemanticTriple[]>()
  for (const t of filteredTriples.value) {
    const s = t.subject || ''
    if (!g.has(s)) g.set(s, [])
    g.get(s)!.push(t)
  }
  const byTs = (a: SemanticTriple, b: SemanticTriple) => parseTripleTimestamp(b) - parseTripleTimestamp(a)
  const keys = Array.from(g.keys()).sort((a, b) => (sortOrder.value === 'asc' ? a.localeCompare(b) : b.localeCompare(a)))
  return keys.map(sub => ({ subject: sub, triples: (g.get(sub) || []).sort(byTs) }))
})

function formatTripleTimestamp(ts: string): string {
  if (ts.includes('T')) return ts.slice(0, 16).replace('T', ' ')
  return ts.replace(/-(\d{1,2})-(\d{1,2})$/, ' $1:$2')
}

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

.triple-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
  font-size: 0.8rem;
}
.control-label { color: var(--color-text-secondary); }
.control-select, .control-input {
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-code-bg, #1e1e1e);
  color: var(--color-text);
  font-size: 0.8rem;
}
.control-input.control-num { width: 4rem; }
.control-check { display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; }

.triple-group { margin-bottom: 0.5rem; }
.group-head {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary, #4a9eff);
  margin-bottom: 0.25rem;
  padding-left: 0.25rem;
}

.triple-ts { color: #6a9955; font-size: 0.72rem; }
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
