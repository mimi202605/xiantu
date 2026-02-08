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
        @dblclick="onBackgroundDblClick"
      >
        <defs>
          <filter id="location-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <!-- 按根节点分色系：每个最外层一种色，其内部结构同色系 -->
          <linearGradient id="location-bg-family-0" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(245, 158, 11, 0.32)" />
            <stop offset="100%" stop-color="rgba(245, 158, 11, 0.1)" />
          </linearGradient>
          <linearGradient id="location-bg-family-1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(59, 130, 246, 0.25)" />
            <stop offset="100%" stop-color="rgba(59, 130, 246, 0.08)" />
          </linearGradient>
          <linearGradient id="location-bg-family-2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(20, 184, 166, 0.28)" />
            <stop offset="100%" stop-color="rgba(20, 184, 166, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(139, 92, 246, 0.28)" />
            <stop offset="100%" stop-color="rgba(139, 92, 246, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(244, 63, 94, 0.28)" />
            <stop offset="100%" stop-color="rgba(244, 63, 94, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(249, 115, 22, 0.3)" />
            <stop offset="100%" stop-color="rgba(249, 115, 22, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-6" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(132, 204, 22, 0.28)" />
            <stop offset="100%" stop-color="rgba(132, 204, 22, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-7" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(6, 182, 212, 0.28)" />
            <stop offset="100%" stop-color="rgba(6, 182, 212, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-8" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(99, 102, 241, 0.28)" />
            <stop offset="100%" stop-color="rgba(99, 102, 241, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-9" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(16, 185, 129, 0.28)" />
            <stop offset="100%" stop-color="rgba(16, 185, 129, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-10" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(14, 165, 233, 0.28)" />
            <stop offset="100%" stop-color="rgba(14, 165, 233, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-11" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(217, 70, 239, 0.28)" />
            <stop offset="100%" stop-color="rgba(217, 70, 239, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-12" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(234, 179, 8, 0.3)" />
            <stop offset="100%" stop-color="rgba(234, 179, 8, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-13" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(37, 99, 235, 0.28)" />
            <stop offset="100%" stop-color="rgba(37, 99, 235, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-14" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(22, 163, 74, 0.28)" />
            <stop offset="100%" stop-color="rgba(22, 163, 74, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-15" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(100, 116, 139, 0.28)" />
            <stop offset="100%" stop-color="rgba(100, 116, 139, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-16" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(234, 88, 12, 0.28)" />
            <stop offset="100%" stop-color="rgba(234, 88, 12, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-17" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(168, 85, 247, 0.28)" />
            <stop offset="100%" stop-color="rgba(168, 85, 247, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-18" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(250, 204, 21, 0.3)" />
            <stop offset="100%" stop-color="rgba(250, 204, 21, 0.09)" />
          </linearGradient>
          <linearGradient id="location-bg-family-19" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(236, 72, 153, 0.28)" />
            <stop offset="100%" stop-color="rgba(236, 72, 153, 0.09)" />
          </linearGradient>
          <!-- 当前所在地高亮：仅红色描边 -->
          <linearGradient id="location-bg-current" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(239, 68, 68, 0.2)" />
            <stop offset="100%" stop-color="rgba(239, 68, 68, 0.06)" />
          </linearGradient>
          <!-- 无限网格：100x100 一格，平铺到极大范围 -->
          <pattern
            id="infinite-grid"
            x="0"
            y="0"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 0 V 100 M 0 0 H 100 M 100 0 V 100 M 0 100 H 100"
              fill="none"
              stroke="var(--color-text-muted)"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
              opacity="0.15"
            />
          </pattern>
        </defs>
        <!-- 无限大背景 -->
        <rect
          x="-50000"
          y="-50000"
          width="100000"
          height="100000"
          fill="var(--color-surface-light, #1e293b)"
        />
        <!-- 无限网格（与背景同范围） -->
        <rect
          x="-50000"
          y="-50000"
          width="100000"
          height="100000"
          fill="url(#infinite-grid)"
        />
        <!-- Location nodes：有内部结构用框，无则用圆 -->
        <g
          v-for="node in nodes"
          :key="node.id"
          class="location-node"
          :class="{
            current: isCurrent(node.entry.名称),
            'has-children': node.childIds.length > 0,
            'layer-outer': node.depth === 0,
          }"
          :transform="`translate(${node.x}, ${node.y})`"
          @mouseenter="onNodeHover(node, $event)"
          @mouseleave="tooltipNode = null"
          @dblclick.stop="onNodeDblClick(node)"
        >
          <!-- 有子地点：方框（rx 按半径比例缩小，防止小节点因 rx 过大而变成圆形） -->
          <template v-if="node.childIds.length > 0">
            <rect
              :x="-node.radius"
              :y="-node.radius"
              :width="node.radius * 2"
              :height="node.radius * 2"
              :rx="Math.min(6, node.radius * 0.25)"
              :fill="getNodeFill(node)"
              :stroke="getNodeStroke(node)"
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
              :rx="Math.min(6, node.radius * 0.25)"
              fill="url(#location-bg-current)"
              stroke="#ef4444"
              stroke-width="2"
              stroke-opacity="0.9"
            />
          </template>
          <!-- 无子地点：圆 -->
          <template v-else>
            <circle
              :r="node.radius"
              cx="0"
              cy="0"
              :fill="getNodeFill(node)"
              :stroke="getNodeStroke(node)"
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
              stroke="#ef4444"
              stroke-width="2"
              stroke-opacity="0.9"
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
        <div class="tooltip-status">
          {{ explorationStatusLabel(tooltipNode) }}
        </div>
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-vue-next';
import { useGameStateStore } from '@/stores/gameStateStore';
import { useI18n } from '@/i18n';
import {
  buildLocationMapNodes,
  ZOOM_THRESHOLD_CHILDREN,
  ZOOM_THRESHOLD_REFINED,
  FOCUS_OCCUPY_RATIO_POP,
  ZOOM_THRESHOLD_POP_BY_SCALE,
  FOCUS_OCCUPY_RATIO_ENTER,
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

/** 实际 DOM 视口尺寸（与背景/画布同比例参与视口与占比计算，避免固定 1200x800 导致放大后占比错位） */
const viewportSize = ref({ width: CANVAS_W, height: CANVAS_H });
let resizeObserver: ResizeObserver | null = null;
function updateViewportSize() {
  const el = viewportRef.value;
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      viewportSize.value = { width: rect.width, height: rect.height };
    }
  }
}
onMounted(() => {
  updateViewportSize();
  resizeObserver = new ResizeObserver(updateViewportSize);
  const el = viewportRef.value;
  if (el) resizeObserver.observe(el);
});
onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

/** 按实际视口宽高比得到「可见区域」在画布中的宽高（与 viewBox 一致，目标区域与背景占比正确） */
function effectiveViewportInSvg(): {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const s = scale.value;
  const vp = viewportSize.value;
  const baseW = CANVAS_W / s;
  const baseH = CANVAS_H / s;
  const vpRatio = vp.width / vp.height;
  const canvasRatio = CANVAS_W / CANVAS_H;
  let vw: number;
  let vh: number;
  if (vpRatio >= canvasRatio) {
    vw = baseW;
    vh = baseW / vpRatio;
  } else {
    vh = baseH;
    vw = baseH * vpRatio;
  }
  const centerX = (-panX.value + CANVAS_W / 2) / s;
  const centerY = (-panY.value + CANVAS_H / 2) / s;
  return {
    x: centerX - vw / 2,
    y: centerY - vh / 2,
    width: vw,
    height: vh,
    centerX,
    centerY,
  };
}

/** 视口中心在当前布局下的 SVG 坐标 */
function viewportCenterInSvg(): { x: number; y: number } {
  const { centerX, centerY } = effectiveViewportInSvg();
  return { x: centerX, y: centerY };
}

/** 当前视口在 SVG 中的矩形（与 viewBox 可见区域一致） */
function viewportRectInSvg(): { x: number; y: number; width: number; height: number } {
  const { x, y, width, height } = effectiveViewportInSvg();
  return { x, y, width, height };
}

/** 节点在视口中占面积比例（使用与实际 viewBox 一致的可见区域面积） */
function nodeOccupyRatio(node: MapLocationNode, s: number): number {
  const { width: vw, height: vh } = effectiveViewportInSvg();
  const viewportArea = vw * vh;
  const nodeArea = 4 * node.radius * node.radius;
  return viewportArea > 0 ? nodeArea / viewportArea : 0;
}

/** 节点包围盒与矩形是否相交 */
function nodeIntersectsRect(
  node: MapLocationNode,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  const nx1 = node.x - node.radius;
  const nx2 = node.x + node.radius;
  const ny1 = node.y - node.radius;
  const ny2 = node.y + node.radius;
  const rx2 = rect.x + rect.width;
  const ry2 = rect.y + rect.height;
  return !(nx2 < rect.x || nx1 > rx2 || ny2 < rect.y || ny1 > ry2);
}

/** 点是否在节点包围盒内（方/圆统一按外接矩形） */
function nodeContainsPoint(node: MapLocationNode, px: number, py: number): boolean {
  return (
    px >= node.x - node.radius &&
    px <= node.x + node.radius &&
    py >= node.y - node.radius &&
    py <= node.y + node.radius
  );
}

/**
 * 找「当前视口内」占屏足够、有子节点的最深节点（半径最小）。
 * 用「与视口相交」代替「包含视口中心」：滚轮以鼠标为中心缩放时屏幕中心会偏移，仅用中心会漏选（如放大青云城时中心可能仍在青云域）。
 */
function findDeepestOccupying(
  nodes: MapLocationNode[],
  viewportRect: { x: number; y: number; width: number; height: number },
  s: number
): MapLocationNode | null {
  const candidates = nodes.filter(
    (n) =>
      n.childIds.length > 0 &&
      nodeIntersectsRect(n, viewportRect) &&
      nodeOccupyRatio(n, s) >= FOCUS_OCCUPY_RATIO_ENTER
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.radius < b.radius ? a : b));
}

/**
 * 找「包含指定点」且占屏足够、有子节点的最深节点（半径最小）；用于滚轮对准目标放大时进入正确结构。
 */
function findDeepestContainingPoint(
  nodes: MapLocationNode[],
  point: { x: number; y: number },
  s: number
): MapLocationNode | null {
  const candidates = nodes.filter(
    (n) =>
      n.childIds.length > 0 &&
      nodeContainsPoint(n, point.x, point.y) &&
      nodeOccupyRatio(n, s) >= FOCUS_OCCUPY_RATIO_ENTER
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.radius < b.radius ? a : b));
}

function buildLayoutWithFocus(stack: string[]) {
  return buildLocationMapNodes(props.entries, { focusStack: stack });
}

/** 从根到当前节点的 focus 路径，用于双击时强制「钻取到此节点」 */
function getPathFromRoot(
  node: MapLocationNode,
  nodeMap: Map<string, MapLocationNode>
): string[] {
  const path: string[] = [];
  let n: MapLocationNode | undefined = node;
  while (n) {
    path.unshift(n.id);
    n = n.parentId ? nodeMap.get(n.parentId) : undefined;
  }
  return path;
}

/** focus 栈（ref）：平移不取消细化；缩小满足阈值时仅出栈一层（先取消内部再取消外部） */
const focusStackRef = ref<string[]>([]);

/** 滚轮放大时指针在 SVG 中的位置，用于进入「对准的目标」结构而非视口内第一个；watch 消费后清空 */
const wheelZoomFocusPointInSvg = ref<{ x: number; y: number } | null>(null);

watch(
  [
    () => scale.value,
    () => panX.value,
    () => panY.value,
    () => props.entries,
    () => viewportSize.value.width,
    () => viewportSize.value.height,
  ],
  () => {
    // 缩放很低时（≤ ZOOM_THRESHOLD_POP_BY_SCALE）每轮只出栈一层；其余用占比阈值出栈，降低缩小灵敏度，各层统一
    if (scale.value < ZOOM_THRESHOLD_POP_BY_SCALE) {
      if (focusStackRef.value.length > 0) {
        focusStackRef.value = focusStackRef.value.slice(0, -1);
      }
      return;
    }
    if (scale.value < ZOOM_THRESHOLD_CHILDREN) return;
    const viewportRect = viewportRectInSvg();
    const prevStack = focusStackRef.value;
    let stack = [...prevStack];
    let layout = buildLayoutWithFocus(stack);
    // 当前栈顶占视口不足时出栈一层（每轮至多一层）；用较低占比阈值，需缩得更多才回退
    if (stack.length > 0) {
      const top = layout.nodeMap.get(stack[stack.length - 1]);
      if (!top || nodeOccupyRatio(top, scale.value) < FOCUS_OCCUPY_RATIO_POP) {
        stack = stack.slice(0, -1);
        layout = buildLayoutWithFocus(stack);
      }
    }
    const zoomFocusPoint = wheelZoomFocusPointInSvg.value;
    for (;;) {
      const node = zoomFocusPoint
        ? findDeepestContainingPoint(layout.nodes, zoomFocusPoint, scale.value)
        : findDeepestOccupying(layout.nodes, viewportRect, scale.value);
      if (!node || (stack.length > 0 && node.id === stack[stack.length - 1])) break;
      stack = [...stack, node.id];
      layout = buildLayoutWithFocus(stack);
    }
    if (zoomFocusPoint) nextTick(() => { wheelZoomFocusPointInSvg.value = null; });
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
  buildLocationMapNodes(props.entries, { focusStack: focusStackRef.value })
);
const canvasWidth = computed(() => mapData.value.canvasWidth);
const canvasHeight = computed(() => mapData.value.canvasHeight);

/**
 * 按缩放与细化过滤。
 * 细化时（focus 栈非空）：渲染「当前 focus + 直接子节点 + 孙节点」，
 *   即内层能看到直接子节点的内部结构（框/圆），再深的后代不显示，需继续钻取。
 * 非细化时：按子节点阈值显示。
 */
const nodesFiltered = computed(() => {
  const all = mapData.value.nodes;
  const stack = focusStackRef.value;
  const nodeMap = mapData.value.nodeMap;

  // 细化模式：focus + 直接子 + 孙（两层子级，内层能显示「子节点的内部结构」）
  if (stack.length > 0) {
    const topFocusId = stack[stack.length - 1];
    const topFocus = nodeMap.get(topFocusId);
    if (topFocus) {
      const visibleIds = new Set<string>([topFocusId, ...topFocus.childIds]);
      for (const cid of topFocus.childIds) {
        const child = nodeMap.get(cid);
        if (child?.childIds?.length) {
          child.childIds.forEach((gid) => visibleIds.add(gid));
        }
      }
      return all.filter((n) => visibleIds.has(n.id));
    }
  }

  // 非细化：缩放足够时显示所有层级，否则只显示顶层
  const showAllLevels = scale.value >= ZOOM_THRESHOLD_CHILDREN;
  if (showAllLevels) return all;
  return all.filter((n) => n.depth === 0);
});

const nodes = computed(() => nodesFiltered.value);

/** 最外层节点 id 有序列表，用于稳定分配色系索引 */
const rootIdsOrdered = computed(() => {
  const all = mapData.value.nodes;
  return all.filter((n) => n.depth === 0).map((n) => n.id).sort((a, b) => a.localeCompare(b));
});

function getRootId(node: MapLocationNode): string {
  if (node.depth === 0) return node.id;
  const parent = node.parentId ? mapData.value.nodeMap.get(node.parentId) : null;
  return parent ? getRootId(parent) : node.id;
}

/** 节点所属色系索引（0~19），同一根节点及其所有后代同色系，支持复杂地图 */
const LOCATION_FAMILY_COUNT = 20;
function getFamilyIndex(node: MapLocationNode): number {
  const rootId = getRootId(node);
  const idx = rootIdsOrdered.value.indexOf(rootId);
  return idx >= 0 ? idx % LOCATION_FAMILY_COUNT : 0;
}

const LOCATION_FAMILY_STROKES = [
  '#f59e0b',
  '#3b82f6',
  '#14b8a6',
  '#8b5cf6',
  '#f43f5e',
  '#f97316',
  '#84cc16',
  '#06b6d4',
  '#6366f1',
  '#10b981',
  '#0ea5e9',
  '#d946ef',
  '#eab308',
  '#2563eb',
  '#16a34a',
  '#64748b',
  '#ea580c',
  '#a855f7',
  '#facc15',
  '#ec4899',
] as const;

function getNodeFill(node: MapLocationNode): string {
  return `url(#location-bg-family-${getFamilyIndex(node)})`;
}
function getNodeStroke(node: MapLocationNode): string {
  return LOCATION_FAMILY_STROKES[getFamilyIndex(node)] ?? LOCATION_FAMILY_STROKES[0];
}

const exploredSet = computed(() => {
  const rec = gameStateStore.explorationRecord;
  return new Set(Array.isArray(rec) ? rec : []);
});
const currentLocationDesc = computed(
  () => gameStateStore.location?.描述 ?? ''
);

/** 仅精确匹配：该地点名称是否在探索记录中 */
function isExploredExact(name: string): boolean {
  return exploredSet.value.has(name);
}

/** 是否有任意后代在探索记录中（精确匹配） */
function hasExploredDescendant(node: MapLocationNode): boolean {
  const nodeMap = mapData.value.nodeMap;
  const set = exploredSet.value;
  for (const cid of node.childIds) {
    const c = nodeMap.get(cid);
    if (c) {
      if (set.has(c.entry.名称)) return true;
      if (hasExploredDescendant(c)) return true;
    }
  }
  return false;
}

/** 探索状态：已探索 / 部分探索（自己有子节点且子结构有人探索过但自己未探索）/ 未探索；均按名称精确匹配 */
function getExplorationStatus(node: MapLocationNode): 'explored' | 'partial' | 'unexplored' {
  if (isExploredExact(node.entry.名称)) return 'explored';
  if (node.childIds.length > 0 && hasExploredDescendant(node)) return 'partial';
  return 'unexplored';
}

function explorationStatusLabel(node: MapLocationNode): string {
  const status = getExplorationStatus(node);
  if (status === 'explored') return t('已探索');
  if (status === 'partial') return t('部分探索');
  return t('未探索');
}
function isCurrent(name: string): boolean {
  const desc = currentLocationDesc.value;
  return Boolean(
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

/** viewBox 与 effectiveViewportInSvg 一致，使目标区域与背景占比正确（且与视口宽高比一致，无黑边时逻辑视口即实际可见区域） */
const svgViewBox = computed(() => {
  const { x, y, width, height } = effectiveViewportInSvg();
  return `${x} ${y} ${width} ${height}`;
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

/** 滚轮：以指针位置为中心放大/缩小；放大时记录指针在 SVG 中的位置，供 watch 进入对准的目标结构 */
function onWheel(e: WheelEvent) {
  const rect = viewportRef.value?.getBoundingClientRect();
  if (!rect) return;
  const vpX = e.clientX - rect.left;
  const vpY = e.clientY - rect.top;
  const delta = -e.deltaY * ZOOM_WHEEL_FACTOR * scale.value;
  const next = scale.value + delta;
  if (delta > 0) {
    const vrect = viewportRectInSvg();
    const vw = rect.width;
    const vh = rect.height;
    if (vw > 0 && vh > 0) {
      wheelZoomFocusPointInSvg.value = {
        x: vrect.x + (vpX / vw) * vrect.width,
        y: vrect.y + (vpY / vh) * vrect.height,
      };
    }
  }
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

/** 双击：钻取到该节点（强制 focus 栈为根→该节点），并用该节点子树的 bbox 适配视口 */
function onNodeDblClick(node: MapLocationNode) {
  const nodeMap = mapData.value.nodeMap;
  const path = getPathFromRoot(node, nodeMap);
  focusStackRef.value = path;
  const layout = buildLayoutWithFocus(path);
  if (layout.refinedSubtreeBbox && layout.refinedSubtreeCenter) {
    const { width: bw, height: bh } = layout.refinedSubtreeBbox;
    const scaleToFit = Math.min(CANVAS_W / bw, CANVAS_H / bh) * 0.9;
    const newScale = Math.max(
      ZOOM_THRESHOLD_REFINED,
      Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleToFit))
    );
    scale.value = newScale;
    const { x: cx, y: cy } = layout.refinedSubtreeCenter;
    panX.value = CANVAS_W / 2 - cx * newScale;
    panY.value = CANVAS_H / 2 - cy * newScale;
  }
  clampPan();
}

/** 双击区域外（空白）：回退到上一级 focus，并适配视口；节点上已用 .stop 阻止冒泡 */
function onBackgroundDblClick() {
  if (focusStackRef.value.length === 0) return;
  focusStackRef.value = focusStackRef.value.slice(0, -1);
  const stack = focusStackRef.value;
  const layout = buildLayoutWithFocus(stack);
  if (stack.length > 0 && layout.refinedSubtreeBbox && layout.refinedSubtreeCenter) {
    const { width: bw, height: bh } = layout.refinedSubtreeBbox;
    const scaleToFit = Math.min(CANVAS_W / bw, CANVAS_H / bh) * 0.9;
    const newScale = Math.max(
      ZOOM_THRESHOLD_REFINED,
      Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleToFit))
    );
    scale.value = newScale;
    const { x: cx, y: cy } = layout.refinedSubtreeCenter;
    panX.value = CANVAS_W / 2 - cx * newScale;
    panY.value = CANVAS_H / 2 - cy * newScale;
  } else {
    // 回退到最外层：适配整张画布
    const { canvasWidth: cw, canvasHeight: ch } = layout;
    const scaleToFit = Math.min(CANVAS_W / cw, CANVAS_H / ch) * 0.9;
    scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleToFit));
    panX.value = CANVAS_W / 2 - (cw / 2) * scale.value;
    panY.value = CANVAS_H / 2 - (ch / 2) * scale.value;
  }
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
  /* 最外层节点描边色，可与主题统一覆盖 */
  --color-map-outer: #f59e0b;
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
}

.tooltip-status {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 4px;
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
