<template>
  <div class="entity-graph-wrap">
    <div class="graph-toolbar">
      <label class="toggle-labels">
        <input v-model="showLabels" type="checkbox" />
        <span>{{ t('显示标签') }}</span>
      </label>
      <button type="button" class="restore-btn" @click="restoreLayout">
        {{ t('恢复默认') }}
      </button>
    </div>
    <div ref="containerRef" class="graph-container" />
    <div
      v-show="tooltipText"
      class="graph-node-tooltip"
      :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
    >
      {{ tooltipText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Cytoscape from 'cytoscape'
import { useI18n } from '@/i18n'

const { t } = useI18n()

interface GameEntityLike {
  id?: string
  type?: string
  name?: string
  [k: string]: unknown
}

interface EntityRelationshipLike {
  fromId?: string
  toId?: string
  relationship?: string
  [k: string]: unknown
}

/** 人物关系 (社交.关系): 名 -> { 出生?: string|{名称?,描述?} }，用于悬停显示 出生 作描述 */
type NpcProfiles = Record<string, { 出生?: string | { 名称?: string; 描述?: string; name?: string; description?: string } } | unknown>

const props = withDefaults(
  defineProps<{
    entities?: GameEntityLike[]
    relationships?: EntityRelationshipLike[]
    npcProfiles?: NpcProfiles
    /** 主角名字 (角色.身份.名字)，用于 player 节点显示 */
    playerName?: string
  }>(),
  { entities: () => [], relationships: () => [], npcProfiles: () => ({}), playerName: '' }
)

const containerRef = ref<HTMLDivElement | null>(null)
const showLabels = ref(true)
const tooltipText = ref('')
const tooltipX = ref(0)
const tooltipY = ref(0)

let cy: ReturnType<typeof Cytoscape> | null = null

function collectIds(): Set<string> {
  const ids = new Set<string>()
  for (const e of props.entities) {
    const id = e?.id
    if (id != null && String(id).trim()) ids.add(String(id))
  }
  for (const r of props.relationships) {
    const a = r?.fromId
    const b = r?.toId
    if (a != null && String(a).trim()) ids.add(String(a))
    if (b != null && String(b).trim()) ids.add(String(b))
  }
  return ids
}

function entityName(id: string): string {
  if (id === 'player') {
    const n = (props.playerName && String(props.playerName).trim()) || ''
    return n || '玩家'
  }
  const e = props.entities.find((x) => String(x?.id) === id)
  return (e?.name != null ? String(e.name) : id) || id
}

function entityType(id: string): string {
  const e = props.entities.find((x) => String(x?.id) === id)
  return (e?.type != null ? String(e.type) : 'other') || 'other'
}

/** 人物关系.出生 -> 描述字符串 */
function formatOrigin(o: unknown): string {
  if (o == null) return ''
  if (typeof o === 'string') return o
  if (typeof o === 'object' && o !== null) {
    const x = o as Record<string, unknown>
    return String(x.描述 ?? x.description ?? x.名称 ?? x.name ?? '') || ''
  }
  return ''
}

function getDescriptionForNode(node: { data: (k: string) => unknown }): string {
  const name = String(node.data('name') ?? '')
  const id = String(node.data('id') ?? '')
  const profiles = props.npcProfiles ?? {}
  const cand = [name, id, id.replace(/^[a-z]+_/, '')]
  for (const k of cand) {
    if (!k) continue
    const p = profiles[k]
    if (p != null && typeof p === 'object' && '出生' in p) {
      const s = formatOrigin((p as { 出生?: unknown }).出生)
      if (s) return s
    }
  }
  return ''
}

function buildElements(): { nodes: Cytoscape.ElementDefinition[]; edges: Cytoscape.ElementDefinition[] } {
  const ids = collectIds()
  const nodes: Cytoscape.ElementDefinition[] = []
  const edges: Cytoscape.ElementDefinition[] = []

  for (const id of ids) {
    nodes.push({
      data: {
        id,
        name: entityName(id),
        type: entityType(id)
      }
    })
  }

  const seen = new Set<string>()
  props.relationships.forEach((r, i) => {
    const fromId = r?.fromId != null ? String(r.fromId) : ''
    const toId = r?.toId != null ? String(r.toId) : ''
    const rel = (r?.relationship != null ? String(r.relationship) : '') || '?'
    if (!fromId || !toId) return
    const eid = `e_${fromId}_${toId}_${i}_${rel}`
    if (seen.has(eid)) return
    seen.add(eid)
    if (!ids.has(fromId)) {
      nodes.push({ data: { id: fromId, name: entityName(fromId), type: 'other' } })
      ids.add(fromId)
    }
    if (!ids.has(toId)) {
      nodes.push({ data: { id: toId, name: entityName(toId), type: 'other' } })
      ids.add(toId)
    }
    edges.push({
      data: { id: eid, source: fromId, target: toId, relationship: rel }
    })
  })

  return { nodes, edges }
}

const NODE_COLORS: Record<string, string> = {
  npc: '#4a9eff',
  location: '#4ec9b0',
  item: '#ce9178',
  event: '#c586c0',
  faction: '#d7ba7d',
  other: '#6a737d'
}

function buildStyle(show: boolean): Cytoscape.Stylesheet[] {
  const baseNode: Record<string, string | number> = {
    'label': show ? 'data(name)' : '',
    'color': '#1e1e1e',
    'text-valign': 'center',
    'text-halign': 'center',
    'font-size': '10px',
    'text-margin-y': 2,
    'text-wrap': 'wrap',
    'text-max-width': '120px',
    'width': 72,
    'height': 40,
    'border-width': 1,
    'border-color': 'rgba(255,255,255,0.4)',
    'text-events': 'no',
    'background-color': NODE_COLORS.other
  }
  const styles: Cytoscape.Stylesheet[] = [
    { selector: 'node', style: baseNode },
    { selector: 'node[type="npc"]', style: { 'background-color': NODE_COLORS.npc } },
    { selector: 'node[type="location"]', style: { 'background-color': NODE_COLORS.location } },
    { selector: 'node[type="item"]', style: { 'background-color': NODE_COLORS.item } },
    { selector: 'node[type="event"]', style: { 'background-color': NODE_COLORS.event } },
    { selector: 'node[type="faction"]', style: { 'background-color': NODE_COLORS.faction } },
    {
      selector: 'edge',
      style: {
        'label': show ? 'data(relationship)' : '',
        'font-size': '9px',
        'color': 'rgba(255,255,255,0.9)',
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': 'rgba(255,255,255,0.6)',
        'line-color': 'rgba(255,255,255,0.5)',
        'width': 1.5,
        'text-events': 'no'
      }
    }
  ]
  return styles
}

function runLayout() {
  if (!cy) return
  const layout = cy.layout({
    name: 'cose',
    animate: 'end',
    animationDuration: 300,
    nodeDimensionsIncludeLabels: true,
    idealEdgeLength: 80,
    nodeOverlap: 20
  })
  layout.run()
  layout.on('layoutstop', () => {
    cy!.fit(undefined, 50)
  })
}

function restoreLayout() {
  runLayout()
}

function applyLabelStyle(show: boolean) {
  if (!cy) return
  cy.nodes().style('label', show ? 'data(name)' : '')
  cy.edges().style('label', show ? 'data(relationship)' : '')
}

function bindNodeHover(cytoscapeInstance: NonNullable<typeof cy>) {
  cytoscapeInstance.on('mouseover', 'node', (evt) => {
    const node = evt.target
    const desc = getDescriptionForNode(node)
    if (!desc) return
    const e = evt.originalEvent as MouseEvent
    tooltipText.value = desc
    tooltipX.value = e.clientX + 12
    tooltipY.value = e.clientY + 12
  })
  cytoscapeInstance.on('mouseout', 'node', () => {
    tooltipText.value = ''
  })
}

function initOrUpdate() {
  if (!containerRef.value) return
  const { nodes, edges } = buildElements()
  const elements = [...nodes, ...edges]

  if (elements.length === 0) {
    if (cy) {
      cy.destroy()
      cy = null
    }
    return
  }

  if (!cy) {
    cy = Cytoscape({
      container: containerRef.value,
      elements,
      style: buildStyle(showLabels.value),
      minZoom: 0.2,
      maxZoom: 4,
      wheelSensitivity: 0.3,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    })
    bindNodeHover(cy)
    runLayout()
  } else {
    cy.elements().remove()
    cy.add(elements)
    applyLabelStyle(showLabels.value)
    runLayout()
  }
}

watch(
  () => [props.entities, props.relationships] as const,
  () => {
    initOrUpdate()
  },
  { deep: true }
)

watch(showLabels, (v) => {
  applyLabelStyle(v)
})

onMounted(() => {
  initOrUpdate()
})

onUnmounted(() => {
  if (cy) {
    cy.destroy()
    cy = null
  }
})
</script>

<style scoped>
.entity-graph-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.toggle-labels {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.toggle-labels input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-primary, #4a9eff);
}

.restore-btn {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-code-bg, #1e1e1e);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.restore-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text);
}

.graph-container {
  min-height: 320px;
  height: 40vh;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-code-bg, #1e1e1e);
}

.graph-node-tooltip {
  position: fixed;
  z-index: 10000;
  max-width: 280px;
  padding: 6px 10px;
  background: var(--color-code-bg, #1e1e1e);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--color-text);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
