<template>
  <div class="map-minimap" ref="containerRef">
    <div class="map-controls">
      <button type="button" class="zoom-btn" @click="zoomIn" :title="t('放大')">
        <ZoomIn :size="18" />
      </button>
      <button type="button" class="zoom-btn" @click="zoomOut" :title="t('缩小')">
        <ZoomOut :size="18" />
      </button>
      <button type="button" class="zoom-btn" @click="resetView" :title="t('重置视图')">
        <Maximize2 :size="18" />
      </button>
    </div>
    <div
      class="map-viewport"
      ref="viewportRef"
      @wheel.prevent="onWheel"
      @mousedown="onPanStart"
    >
      <svg
        class="map-svg"
        :viewBox="svgViewBox"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
      >
        <defs>
          <filter id="location-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="location-bg-top" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(59, 130, 246, 0.25)" />
            <stop offset="100%" stop-color="rgba(59, 130, 246, 0.08)" />
          </linearGradient>
          <linearGradient id="location-bg-current" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(34, 197, 94, 0.35)" />
            <stop offset="100%" stop-color="rgba(34, 197, 94, 0.12)" />
          </linearGradient>
        </defs>
        <!-- Background -->
        <rect
          x="0"
          y="0"
          :width="canvasWidth"
          :height="canvasHeight"
          fill="var(--color-surface-light, #1e293b)"
          rx="8"
        />
        <!-- Subtle grid -->
        <g opacity="0.15">
          <line
            v-for="i in 12"
            :key="'v' + i"
            :x1="(i * canvasWidth) / 12"
            :y1="0"
            :x2="(i * canvasWidth) / 12"
            :y2="canvasHeight"
            stroke="var(--color-text-muted)"
            stroke-width="0.5"
          />
          <line
            v-for="i in 8"
            :key="'h' + i"
            :x1="0"
            :y1="(i * canvasHeight) / 8"
            :x2="canvasWidth"
            :y2="(i * canvasHeight) / 8"
            stroke="var(--color-text-muted)"
            stroke-width="0.5"
          />
        </g>
        <!-- Location nodes：有内部结构用框，无则用圆 -->
        <g
          v-for="node in nodes"
          :key="node.id"
          class="location-node"
          :class="{
            explored: isExplored(node.entry.名称),
            current: isCurrent(node.entry.名称),
            'has-children': node.childIds.length > 0,
          }"
          :transform="`translate(${node.x}, ${node.y})`"
          @mouseenter="onNodeHover(node, $event)"
          @mouseleave="tooltipNode = null"
          @dblclick.stop="onNodeDblClick(node)"
        >
          <!-- 有子地点：方框 -->
          <template v-if="node.childIds.length > 0">
            <rect
              :x="-node.radius"
              :y="-node.radius"
              :width="node.radius * 2"
              :height="node.radius * 2"
              rx="6"
              fill="url(#location-bg-top)"
              stroke="var(--color-primary)"
              :stroke-width="isCurrent(node.entry.名称) ? 3 : 1.5"
              stroke-opacity="0.6"
              filter="url(#location-glow)"
              class="location-shape"
            />
            <rect
              v-if="isCurrent(node.entry.名称)"
              :x="-node.radius"
              :y="-node.radius"
              :width="node.radius * 2"
              :height="node.radius * 2"
              rx="6"
              fill="url(#location-bg-current)"
              stroke="var(--color-success)"
              stroke-width="2"
              stroke-opacity="0.8"
            />
          </template>
          <!-- 无子地点：圆 -->
          <template v-else>
            <circle
              :r="node.radius"
              cx="0"
              cy="0"
              fill="url(#location-bg-top)"
              stroke="var(--color-primary)"
              :stroke-width="isCurrent(node.entry.名称) ? 3 : 1.5"
              stroke-opacity="0.6"
              filter="url(#location-glow)"
              class="location-shape"
            />
            <circle
              v-if="isCurrent(node.entry.名称)"
              :r="node.radius"
              cx="0"
              cy="0"
              fill="url(#location-bg-current)"
              stroke="var(--color-success)"
              stroke-width="2"
              stroke-opacity="0.8"
            />
          </template>
          <text
            class="location-label"
            x="0"
            y="0"
            :font-size="12 * node.fontSizeScale"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="var(--color-text)"
          >
            {{ node.entry.名称 }}
          </text>
        </g>
      </svg>
    </div>
    <!-- Tooltip (positioned relative to map-minimap) -->
    <Transition name="tooltip-fade">
      <div
        v-if="tooltipNode"
        class="map-tooltip"
        :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
      >
        <div class="tooltip-title">{{ tooltipNode.entry.名称 }}</div>
        <div v-if="tooltipNode.entry.描述" class="tooltip-desc">
          {{ tooltipNode.entry.描述 }}
        </div>
        <div v-if="tooltipNpcs.length" class="tooltip-npcs">
          <span class="tooltip-label">{{ t('在场') }}:</span>
          {{ tooltipNpcs.join('、') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-vue-next';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useI18n } from '@/i18n';
import {
  buildLocationMapNodes,
  ZOOM_THRESHOLD_CHILDREN,
  type MapLocationNode,
} from '@/utils/locationMapUtils';
import { getNpcsAtLocation } from '@/utils/locationUtils';
import type { LocationEntry } from '@/types/game';

const { t } = useI18n();
const gameStateStore = useGameStateStore();
const containerRef = ref<HTMLDivElement | null>(null);
const viewportRef = ref<HTMLDivElement | null>(null);

const props = defineProps<{
  entries: (LocationEntry | unknown)[];
}>();

const mapData = computed(() => buildLocationMapNodes(props.entries));
const canvasWidth = computed(() => mapData.value.canvasWidth);
const canvasHeight = computed(() => mapData.value.canvasHeight);

// Zoom & pan（需在 nodes 之前定义，因 nodes 依赖 scale）
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const MIN_SCALE = 0.3;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.25;

/** 缩放时：仅顶层可见；放大后子节点展开 */
const nodes = computed(() => {
  const all = mapData.value.nodes;
  if (scale.value >= ZOOM_THRESHOLD_CHILDREN) return all;
  return all.filter((n) => n.depth === 0);
});

const exploredSet = computed(() => {
  const rec = gameStateStore.explorationRecord;
  return new Set(Array.isArray(rec) ? rec : []);
});
const currentLocationDesc = computed(
  () => gameStateStore.location?.描述 ?? ''
);

function isExplored(name: string): boolean {
  if (exploredSet.value.has(name)) return true;
  for (const explored of exploredSet.value) {
    if (explored.includes(name) || name.includes(explored)) return true;
  }
  return false;
}
function isCurrent(name: string): boolean {
  const desc = currentLocationDesc.value;
  return (
    desc === name ||
    (desc && name && (desc.includes(name) || name.includes(desc)))
  );
}

const saveDataForNpcs = computed(() => gameStateStore.toSaveData());
const tooltipNpcs = computed(() => {
  if (!tooltipNode.value || !saveDataForNpcs.value) return [];
  return getNpcsAtLocation(
    saveDataForNpcs.value as Record<string, unknown>,
    tooltipNode.value.entry.名称,
    { updateStoreOnFallback: true }
  );
});

const svgViewBox = computed(() => {
  const w = canvasWidth.value;
  const h = canvasHeight.value;
  const s = scale.value;
  const vw = w / s;
  const vh = h / s;
  const x = -panX.value / s;
  const y = -panY.value / s;
  return `${x} ${y} ${vw} ${vh}`;
});

/** 限制拖拽边界，防止画布被拖出视口 */
function clampPan() {
  const s = scale.value;
  const w = canvasWidth.value;
  const h = canvasHeight.value;
  if (s <= 1) {
    panX.value = 0;
    panY.value = 0;
    return;
  }
  const minPanX = w * (1 - s);
  const minPanY = h * (1 - s);
  panX.value = Math.max(minPanX, Math.min(0, panX.value));
  panY.value = Math.max(minPanY, Math.min(0, panY.value));
}

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, scale.value + ZOOM_STEP);
  clampPan();
}
function zoomOut() {
  scale.value = Math.max(MIN_SCALE, scale.value - ZOOM_STEP);
  clampPan();
}
function resetView() {
  scale.value = 1;
  panX.value = 0;
  panY.value = 0;
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  scale.value = Math.max(
    MIN_SCALE,
    Math.min(MAX_SCALE, scale.value + delta)
  );
  clampPan();
}

/** 双击上级地点：放大至占满屏幕 */
function onNodeDblClick(node: MapLocationNode) {
  if (node.childIds.length === 0) return;
  const all = mapData.value.nodes;
  const nodeMap = mapData.value.nodeMap;
  let minX = node.x - node.radius;
  let maxX = node.x + node.radius;
  let minY = node.y - node.radius;
  let maxY = node.y + node.radius;
  for (const cid of node.childIds) {
    const c = nodeMap.get(cid);
    if (!c) continue;
    minX = Math.min(minX, c.x - c.radius);
    maxX = Math.max(maxX, c.x + c.radius);
    minY = Math.min(minY, c.y - c.radius);
    maxY = Math.max(maxY, c.y + c.radius);
  }
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  const pad = 40;
  const targetScale = Math.min(
    (canvasWidth.value - pad * 2) / boxW,
    (canvasHeight.value - pad * 2) / boxH,
    MAX_SCALE
  );
  const newScale = Math.max(ZOOM_THRESHOLD_CHILDREN, Math.min(MAX_SCALE, targetScale));
  scale.value = newScale;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  panX.value = canvasWidth.value / 2 - cx * newScale;
  panY.value = canvasHeight.value / 2 - cy * newScale;
  clampPan();
}

let isPanning = false;
let startX = 0;
let startY = 0;
let startPanX = 0;
let startPanY = 0;

function onPanStart(e: MouseEvent) {
  if (e.button !== 0) return;
  isPanning = true;
  startX = e.clientX;
  startY = e.clientY;
  startPanX = panX.value;
  startPanY = panY.value;
  const onMove = (ev: MouseEvent) => {
    if (!isPanning) return;
    panX.value = startPanX + ev.clientX - startX;
    panY.value = startPanY + ev.clientY - startY;
    clampPan();
  };
  const onUp = () => {
    isPanning = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// Tooltip
const tooltipNode = ref<MapLocationNode | null>(null);
const tooltipX = ref(0);
const tooltipY = ref(0);

function onNodeHover(node: MapLocationNode, e: MouseEvent) {
  tooltipNode.value = node;
  updateTooltipPos(e);
}
function updateTooltipPos(e: MouseEvent) {
  const rect = containerRef.value?.getBoundingClientRect();
  if (rect) {
    tooltipX.value = e.clientX - rect.left + 12;
    tooltipY.value = e.clientY - rect.top + 12;
  }
}
function onMouseMove(e: MouseEvent) {
  if (tooltipNode.value) updateTooltipPos(e);
}
function onMouseLeave() {
  tooltipNode.value = null;
}
</script>

<style scoped>
.map-minimap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.map-controls {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-light);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.zoom-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.map-viewport {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  min-height: 0;
}

.map-viewport:active {
  cursor: grabbing;
}

.map-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.location-node {
  cursor: pointer;
  transition: opacity 0.15s;
}

.location-node:hover .location-shape {
  stroke-opacity: 1;
}

.location-node.explored .location-shape {
  stroke-opacity: 0.8;
}

.location-node.unexplored .location-shape {
  stroke-opacity: 0.35;
  filter: none;
}

.location-node.current .location-label {
  font-weight: 700;
  fill: var(--color-success);
}

.location-label {
  pointer-events: none;
  user-select: none;
}

.map-tooltip {
  position: absolute;
  z-index: 100;
  max-width: 280px;
  padding: 10px 14px;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  font-size: 0.85rem;
  pointer-events: none;
}

.tooltip-title {
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.tooltip-desc {
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  line-height: 1.4;
}

.tooltip-npcs {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.tooltip-label {
  margin-right: 4px;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
