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
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
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
import { ref, computed, watch } from 'vue';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-vue-next';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useI18n } from '@/i18n';
import {
  buildLocationMapNodes,
  ZOOM_THRESHOLD_CHILDREN,
  ZOOM_THRESHOLD_REFINED,
  FOCUS_OCCUPY_RATIO,
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

// 单一 zoom/pan 逻辑；缩放倍率可无限大
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const MIN_SCALE = 0.2;
const MAX_SCALE = 500;
const ZOOM_STEP = 0.2;
const ZOOM_WHEEL_FACTOR = 0.0012;

const CANVAS_W = 1200;
const CANVAS_H = 800;

/** 视口中心在当前布局下的 SVG 坐标 */
function viewportCenterInSvg(): { x: number; y: number } {
  const s = scale.value;
  return { x: (-panX.value + CANVAS_W / 2) / s, y: (-panY.value + CANVAS_H / 2) / s };
}

/** 节点在视口中占面积比例 (2*radius 为边长，视口 SVG 尺寸为 w/s * h/s) */
function nodeOccupyRatio(node: MapLocationNode, s: number): number {
  return (4 * node.radius * node.radius * s * s) / (CANVAS_W * CANVAS_H);
}

/** 在当前布局中找包含视口中心、有子节点且占屏足够的节点里最深的（半径最小） */
function findDeepestOccupying(
  nodes: MapLocationNode[],
  center: { x: number; y: number },
  s: number
): MapLocationNode | null {
  const candidates = nodes.filter(
    (n) =>
      n.childIds.length > 0 &&
      center.x >= n.x - n.radius &&
      center.x <= n.x + n.radius &&
      center.y >= n.y - n.radius &&
      center.y <= n.y + n.radius &&
      nodeOccupyRatio(n, s) >= FOCUS_OCCUPY_RATIO
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.radius < b.radius ? a : b));
}

/** 当前视口在 SVG 中的尺寸，用于细化时让内部结构保持在画面内 */
const viewportSvgSize = computed(() => ({
  width: CANVAS_W / scale.value,
  height: CANVAS_H / scale.value,
}));

function buildLayoutWithFocus(stack: string[]) {
  return buildLocationMapNodes(props.entries, {
    focusStack: stack,
    viewportSvgSize: viewportSvgSize.value,
  });
}

/** focus 栈（ref）：平移不取消细化；缩小满足阈值时仅出栈一层（先取消内部再取消外部） */
const focusStackRef = ref<string[]>([]);

watch(
  [() => scale.value, () => panX.value, () => panY.value, () => props.entries],
  () => {
    // zoom out：先退出细化（focus 栈），子节点显示由 ZOOM_THRESHOLD_CHILDREN 决定
    if (scale.value < ZOOM_THRESHOLD_REFINED) {
      focusStackRef.value = [];
      return;
    }
    if (scale.value < ZOOM_THRESHOLD_CHILDREN) return;
    const center = viewportCenterInSvg();
    const prevStack = focusStackRef.value;
    let stack = [...prevStack];
    let layout = buildLayoutWithFocus(stack);
    if (stack.length > 0) {
      const top = layout.nodeMap.get(stack[stack.length - 1]);
      if (!top || nodeOccupyRatio(top, scale.value) < FOCUS_OCCUPY_RATIO) {
        stack = stack.slice(0, -1);
        layout = buildLayoutWithFocus(stack);
      }
    }
    for (;;) {
      const node = findDeepestOccupying(layout.nodes, center, scale.value);
      if (!node || (stack.length > 0 && node.id === stack[stack.length - 1])) break;
      stack = [...stack, node.id];
      layout = buildLayoutWithFocus(stack);
    }
    // 进入或更新细化时，保证「仅当前 focus 及其子级」完整落在屏幕内：先适配视口再居中
    const refinedTopChanged =
      stack.length > 0 &&
      (prevStack.length === 0 || prevStack[prevStack.length - 1] !== stack[stack.length - 1]);
    if (refinedTopChanged && layout.refinedSubtreeCenter) {
      const { x: cx, y: cy } = layout.refinedSubtreeCenter;
      // 视口在 SVG 中的尺寸为 (CANVAS_W/scale, CANVAS_H/scale)，需能包住 bbox
      if (layout.refinedSubtreeBbox) {
        const { width: bw, height: bh } = layout.refinedSubtreeBbox;
        const scaleToFit = Math.min(CANVAS_W / bw, CANVAS_H / bh) * 0.9; // 约 10% 边距
        if (scale.value > scaleToFit) scale.value = Math.max(scaleToFit, ZOOM_THRESHOLD_REFINED);
      }
      const s = scale.value;
      panX.value = CANVAS_W / 2 - cx * s;
      panY.value = CANVAS_H / 2 - cy * s;
    }
    focusStackRef.value = stack;
  },
  { immediate: true }
);

const mapData = computed(() =>
  buildLocationMapNodes(props.entries, {
    focusStack: focusStackRef.value,
    viewportSvgSize: viewportSvgSize.value,
  })
);
const canvasWidth = computed(() => mapData.value.canvasWidth);
const canvasHeight = computed(() => mapData.value.canvasHeight);

/** 缩放达到阈值时展开子节点；否则只显示顶层 */
const nodesRaw = computed(() => {
  const all = mapData.value.nodes;
  if (scale.value >= ZOOM_THRESHOLD_CHILDREN) return all;
  return all.filter((n) => n.depth === 0);
});

/** 细化视图中不渲染当前栈顶的同层级兄弟，避免同层级结构侵入被放大结构 */
const nodesFiltered = computed(() => {
  const list = nodesRaw.value;
  const siblingIds = mapData.value.siblingIdsOfRefinedTop;
  if (!siblingIds || siblingIds.size === 0) return list;
  return list.filter((n) => !siblingIds.has(n.id));
});

/** 非细化节点先渲染，细化子树后渲染，避免其他结构盖住被放大结构 */
const nodes = computed(() => {
  const list = nodesFiltered.value;
  const ids = mapData.value.refinedSubtreeIds;
  if (!ids || ids.size === 0) return list;
  const other = list.filter((n) => !ids.has(n.id));
  const refined = list.filter((n) => ids.has(n.id));
  return [...other, ...refined];
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

/** scale<=1 时把 pan 归零，避免画布跑出视口 */
function clampPan() {
  if (scale.value <= 1) {
    panX.value = 0;
    panY.value = 0;
  }
}

/** 以视口内某点 (vpX, vpY) 为焦点进行缩放：保持该点对应的 SVG 坐标不变 */
function zoomAt(newScale: number, vpX: number, vpY: number) {
  const w = canvasWidth.value;
  const h = canvasHeight.value;
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    clampPan();
    return;
  }
  const vpW = rect.width;
  const vpH = rect.height;
  const s = scale.value;
  const sx = (vpX * w) / vpW - panX.value;
  const sy = (vpY * h) / vpH - panY.value;
  const sNorm = sx / s;
  const tNorm = sy / s;
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
  scale.value = next;
  panX.value = (vpX * w) / vpW - sNorm * next;
  panY.value = (vpY * h) / vpH - tNorm * next;
  clampPan();
}

function zoomIn() {
  const rect = viewportRef.value?.getBoundingClientRect();
  const vpX = rect ? rect.width / 2 : 0;
  const vpY = rect ? rect.height / 2 : 0;
  zoomAt(scale.value + ZOOM_STEP, vpX, vpY);
}
function zoomOut() {
  const rect = viewportRef.value?.getBoundingClientRect();
  const vpX = rect ? rect.width / 2 : 0;
  const vpY = rect ? rect.height / 2 : 0;
  zoomAt(scale.value - ZOOM_STEP, vpX, vpY);
}
function resetView() {
  scale.value = 1;
  panX.value = 0;
  panY.value = 0;
}

/** 滚轮：以指针位置为中心放大/缩小 */
function onWheel(e: WheelEvent) {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) return;
  const vpX = e.clientX - rect.left;
  const vpY = e.clientY - rect.top;
  const delta = -e.deltaY * ZOOM_WHEEL_FACTOR * scale.value;
  const next = scale.value + delta;
  zoomAt(next, vpX, vpY);
}

// 双指缩放：以双指中心为焦点
let pinchStartDist = 0;
let pinchStartScale = 1;
let pinchCenterX = 0;
let pinchCenterY = 0;

function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.hypot(dx, dy);
}
function getTouchCenter(touches: TouchList, rect: DOMRect): { x: number; y: number } {
  if (touches.length < 2) return { x: rect.width / 2, y: rect.height / 2 };
  const x = ((touches[0].clientX + touches[1].clientX) / 2) - rect.left;
  const y = ((touches[0].clientY + touches[1].clientY) / 2) - rect.top;
  return { x, y };
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    const rect = viewportRef.value?.getBoundingClientRect();
    if (rect) {
      pinchStartDist = getTouchDistance(e.touches);
      pinchStartScale = scale.value;
      const c = getTouchCenter(e.touches, rect);
      pinchCenterX = c.x;
      pinchCenterY = c.y;
    }
  }
}
function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2 && pinchStartDist > 0) {
    const rect = viewportRef.value?.getBoundingClientRect();
    if (!rect) return;
    const dist = getTouchDistance(e.touches);
    const ratio = dist / pinchStartDist;
    const next = pinchStartScale * ratio;
    const c = getTouchCenter(e.touches, rect);
    zoomAt(next, c.x, c.y);
  }
}
function onTouchEnd() {
  pinchStartDist = 0;
}

/** 双击：zoom+pan 使该结构占满屏幕并居中；bbox 含该节点及其子节点 */
function onNodeDblClick(node: MapLocationNode) {
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
  const pad = 48;
  const boxW = maxX - minX + 2 * pad;
  const boxH = maxY - minY + 2 * pad;
  const w = canvasWidth.value;
  const h = canvasHeight.value;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(w / boxW, h / boxH)));
  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;
  scale.value = newScale;
  panX.value = w / 2 - bboxCx * newScale;
  panY.value = h / 2 - bboxCy * newScale;
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
