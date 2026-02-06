/**
 * @fileoverview
 * 地图布局工具：将地点树转换为带坐标的节点，用于 minimap 展示。
 * 支持「细化」：当 focus 到某结构时改为外部大、内部小，避免拥挤；可递归细化（focus 到内部结构时继续细化）。
 */

import type { LocationEntry } from '@/types/game';

export interface MapLocationNode {
  entry: LocationEntry;
  /** 唯一标识（名称） */
  id: string;
  /** SVG 坐标 x */
  x: number;
  /** SVG 坐标 y */
  y: number;
  /** 层级深度，0=顶层 */
  depth: number;
  /** 父节点 id，顶层为 null */
  parentId: string | null;
  /** 子节点 id 列表 */
  childIds: string[];
  /** 节点半径 */
  radius: number;
  /** 显示字号比例，顶层 1，子级明显更小 */
  fontSizeScale: number;
}

/** 画布默认尺寸 */
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
/** 顶层节点分布半径 */
const TOP_LEVEL_RADIUS = 280;
/** 子节点在父节点内部的分布半径（小，使子节点藏于父内） */
const CHILD_INSIDE_RADIUS = 35;
/** 顶层节点基础半径 */
const BASE_RADIUS = 28;
/** 子级半径与字号明显缩小（0.35 = 子节点约为父的 1/3） */
const CHILD_SCALE = 0.35;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRandom(name: string, salt: number): number {
  const h = hashString(`${name}-${salt}`);
  return (h % 10000) / 10000;
}

/**
 * 从扁平数组按 上级 构建树：顶层=无上级或上级不在列表中；子=上级匹配父名称
 */
function buildTreeFromFlat(flat: LocationEntry[]): Map<string, LocationEntry[]> {
  const byParent = new Map<string, LocationEntry[]>();
  const nameSet = new Set(flat.map((e) => e.名称).filter(Boolean));

  for (const e of flat) {
    if (!e?.名称) continue;
    const parentName = e.上级 && nameSet.has(e.上级) ? e.上级 : null;
    const key = parentName ?? '__root__';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(e);
  }
  return byParent;
}

/**
 * 递归收集节点（支持 上级 树与 内部 嵌套）
 */
function collectFromTree(
  entries: LocationEntry[],
  parentId: string | null,
  depth: number,
  byParent: Map<string, LocationEntry[]>,
  result: MapLocationNode[],
  idSet: Set<string>
): void {
  for (const e of entries) {
    if (!e?.名称 || idSet.has(e.名称)) continue;
    idSet.add(e.名称);

    const childrenFrom内部 = Array.isArray(e.内部) ? e.内部 : [];
    const childrenFrom上级 = byParent.get(e.名称) ?? [];
    const allChildren = [...childrenFrom内部];
    for (const c of childrenFrom上级) {
      if (c?.名称 && !allChildren.some((x) => x?.名称 === c.名称)) {
        allChildren.push(c);
      }
    }
    const childIds = allChildren.map((c) => c?.名称).filter(Boolean) as string[];

    const fontSizeScale = depth === 0 ? 1 : Math.pow(CHILD_SCALE, depth);
    const radius = BASE_RADIUS * fontSizeScale;

    result.push({
      entry: e,
      id: e.名称,
      x: 0,
      y: 0,
      depth,
      parentId,
      childIds,
      radius,
      fontSizeScale,
    });

    if (allChildren.length > 0) {
      collectFromTree(allChildren, e.名称, depth + 1, byParent, result, idSet);
    }
  }
}

function layoutTopLevel(nodes: MapLocationNode[]): void {
  const topLevel = nodes.filter((n) => n.depth === 0);
  const n = topLevel.length;
  for (let i = 0; i < n; i++) {
    const node = topLevel[i];
    const angle = (2 * Math.PI * i) / n + seededRandom(node.entry.名称, 1) * 0.3;
    const r = TOP_LEVEL_RADIUS + seededRandom(node.entry.名称, 2) * 60;
    node.x = CANVAS_WIDTH / 2 + Math.cos(angle) * r;
    node.y = CANVAS_HEIGHT / 2 + Math.sin(angle) * r;
  }
}

/**
 * 子节点藏于父节点内部：小半径、紧贴父中心分布，放大时可见
 */
function layoutChildren(nodes: MapLocationNode[], nodeMap: Map<string, MapLocationNode>): void {
  for (const node of nodes) {
    if (node.depth === 0) continue;
    const parent = node.parentId ? nodeMap.get(node.parentId) : null;
    if (!parent) continue;

    const siblings = nodes.filter((n) => n.parentId === node.parentId);
    const idx = siblings.findIndex((n) => n.id === node.id);
    const total = siblings.length;
    const angle = (2 * Math.PI * idx) / total + seededRandom(node.entry.名称, 3) * 0.4;
    const r = CHILD_INSIDE_RADIUS * node.fontSizeScale;
    node.x = parent.x + Math.cos(angle) * r;
    node.y = parent.y + Math.sin(angle) * r;
  }
}

/** 细化布局：外部更大、内部更集中，比例应用于所有层级（外部及有内部结构的内部结构） */
const REFINED_FOCUS_RATIO = 0.48;
const REFINED_CHILDREN_SPREAD_RATIO = 0.26;
const REFINED_SPREAD_MIN = 40;
const REFINED_FOCUS_RADIUS_MIN = 80;
/** 内部图标缩小：叶子子节点与有子节点的子节点半径、字号 */
const REFINED_CHILD_RADIUS = 12;
const REFINED_CHILD_CONTAINER_RADIUS = 18;
const REFINED_CHILD_FONT_SCALE = 0.5;
/** 细化簇与「非内部」结构之间至少保留的间隙 */
const REFINED_CLUSTER_MARGIN = 24;

/** 收集某节点的所有后代 id（不含自身） */
function collectDescendantIds(
  nodeMap: Map<string, MapLocationNode>,
  nodeId: string,
  out: string[] = []
): string[] {
  const node = nodeMap.get(nodeId);
  if (!node) return out;
  for (const cid of node.childIds) {
    out.push(cid);
    collectDescendantIds(nodeMap, cid, out);
  }
  return out;
}

/** 当前 focus 及其后代的 id 集合（用于排除「非内部」节点） */
function focusSubtreeIds(focusId: string, nodeMap: Map<string, MapLocationNode>): Set<string> {
  const set = new Set<string>([focusId]);
  for (const id of collectDescendantIds(nodeMap, focusId)) set.add(id);
  return set;
}

/** 细化簇相对 focus 中心的最大延伸半径（focus 框 + 最远子节点） */
function clusterRadius(focusR: number, spread: number): number {
  return Math.max(focusR, spread + REFINED_CHILD_CONTAINER_RADIUS);
}

export interface BuildLocationMapOptions {
  /** 当前聚焦栈：栈顶为最内层，每层应用「外部大、内部小」细化 */
  focusStack?: string[];
  /** 预留：细化布局使用固定画布参考尺寸，不与 zoom 绑定，保证外部与内部同比例随 viewBox 缩放 */
  viewportSvgSize?: { width: number; height: number };
}

/**
 * 将地点转换为带坐标的节点列表。
 * 当 focusStack 非空时，对栈中每个节点应用细化：该节点变大，其子节点在周围展开且变小（避免拥挤）。
 */
export function buildLocationMapNodes(
  entries: (LocationEntry | unknown)[] | undefined,
  options?: BuildLocationMapOptions
): {
  nodes: MapLocationNode[];
  nodeMap: Map<string, MapLocationNode>;
  canvasWidth: number;
  canvasHeight: number;
  /** 当前细化子树 id 集合（栈顶及其后代），用于渲染时置顶 */
  refinedSubtreeIds?: Set<string>;
  /** 当前栈顶的兄弟及其后代 id 集合，细化视图中不渲染以免同层级/兄弟分支侵入被放大结构 */
  siblingIdsOfRefinedTop?: Set<string>;
  /** 细化子树（仅当前 focus 及其子级）的几何中心，用于将内部结构平移到视口内 */
  refinedSubtreeCenter?: { x: number; y: number };
  /** 细化子树 bbox 宽高，用于进入细化时放大到能完整显示在屏幕内 */
  refinedSubtreeBbox?: { width: number; height: number };
} {
  const list = Array.isArray(entries)
    ? (entries.filter((e) => e && typeof e === 'object') as LocationEntry[])
    : [];
  const byParent = buildTreeFromFlat(list);
  const rootEntries = byParent.get('__root__') ?? [];
  const roots = rootEntries.length > 0 ? rootEntries : list;
  const result: MapLocationNode[] = [];
  const idSet = new Set<string>();
  collectFromTree(roots, null, 0, byParent, result, idSet);

  layoutTopLevel(result);
  const nodeMap = new Map(result.map((n) => [n.id, n]));
  layoutChildren(result, nodeMap);

  const focusStack = options?.focusStack ?? [];
  if (focusStack.length === 0) {
    return {
      nodes: result,
      nodeMap,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
    };
  }

  const refinedSubtreeIds = new Set<string>();

  /** 使用固定参考尺寸计算细化布局，使外部与内部在画布上比例固定，zoom 时由 viewBox 统一缩放，实现「外部+内部同比例放大」 */
  const minViewportSide = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT);
  const innerFocusRadius = Math.max(
    REFINED_FOCUS_RADIUS_MIN,
    minViewportSide * REFINED_FOCUS_RATIO
  );
  const childrenSpread = Math.max(
    REFINED_SPREAD_MIN,
    minViewportSide * REFINED_CHILDREN_SPREAD_RATIO
  );
  /** 从内到外逐级放大：最内层用 innerFocusRadius，每往外一层 +childrenSpread，保证外部始终比内部大 */
  const focusRadii: number[] = [];
  let r = innerFocusRadius;
  for (let i = focusStack.length - 1; i >= 0; i--) {
    focusRadii[i] = r;
    r += childrenSpread;
  }

  const nodes = result.map((n) => ({ ...n }));
  const refinedMap = new Map(nodes.map((n) => [n.id, n]));

  for (let level = 0; level < focusStack.length; level++) {
    const focusId = focusStack[level];
    const focus = refinedMap.get(focusId);
    if (!focus || focus.childIds.length === 0) continue;
    const subtreeIds = focusSubtreeIds(focusId, refinedMap);
    let focusR = focusRadii[level];
    let spread = childrenSpread;
    const maxClusterR = clusterRadius(focusR, spread);
    let minClearance = Infinity;
    for (const node of refinedMap.values()) {
      if (subtreeIds.has(node.id)) continue;
      const dist = Math.hypot(node.x - focus.x, node.y - focus.y);
      const clearance = dist - node.radius - REFINED_CLUSTER_MARGIN;
      if (clearance < minClearance) minClearance = clearance;
    }
    const minClusterR = REFINED_FOCUS_RADIUS_MIN + REFINED_SPREAD_MIN;
    if (minClearance < maxClusterR) {
      const targetR = Math.max(minClusterR, minClearance);
      const scale = targetR / maxClusterR;
      focusR = Math.max(REFINED_FOCUS_RADIUS_MIN, focusR * scale);
      spread = Math.max(REFINED_SPREAD_MIN, childrenSpread * scale);
    }
    focus.radius = focusR;
    focus.fontSizeScale = 1;
    const n = focus.childIds.length;
    for (let i = 0; i < n; i++) {
      const cid = focus.childIds[i];
      const child = refinedMap.get(cid);
      if (!child) continue;
      const oldX = child.x;
      const oldY = child.y;
      const angle = (2 * Math.PI * i) / n + seededRandom(child.entry.名称, 3) * 0.3;
      const newX = focus.x + Math.cos(angle) * spread;
      const newY = focus.y + Math.sin(angle) * spread;
      const dx = newX - oldX;
      const dy = newY - oldY;
      child.x = newX;
      child.y = newY;
      child.radius =
        child.childIds.length > 0 ? REFINED_CHILD_CONTAINER_RADIUS : REFINED_CHILD_RADIUS;
      child.fontSizeScale = REFINED_CHILD_FONT_SCALE;
      for (const descId of collectDescendantIds(refinedMap, cid)) {
        const d = refinedMap.get(descId);
        if (d) {
          d.x += dx;
          d.y += dy;
        }
      }
    }
  }

  const topFocusId = focusStack[focusStack.length - 1];
  const topFocus = refinedMap.get(topFocusId);
  refinedSubtreeIds.add(topFocusId);
  for (const id of collectDescendantIds(refinedMap, topFocusId)) refinedSubtreeIds.add(id);

  /** 仅当前 focus 及其子级的 bbox 中心，用于平移到视口内（同级/父级不参与） */
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of refinedSubtreeIds) {
    const n = refinedMap.get(id);
    if (!n) continue;
    minX = Math.min(minX, n.x - n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  }
  const refinedSubtreeCenter =
    minX <= maxX && minY <= maxY
      ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
      : undefined;
  /** 细化子树 bbox 宽高，用于计算「适配视口」所需的最小 scale */
  const refinedSubtreeBbox =
    minX <= maxX && minY <= maxY
      ? { width: maxX - minX, height: maxY - minY }
      : undefined;

  /** 当前栈顶的兄弟及其所有后代：细化视图中不渲染，避免同层级及其子结构侵入被放大结构 */
  const siblingIdsOfRefinedTop = new Set<string>();
  if (topFocus?.parentId != null) {
    for (const node of refinedMap.values()) {
      if (node.parentId === topFocus.parentId && node.id !== topFocusId) {
        siblingIdsOfRefinedTop.add(node.id);
        for (const descId of collectDescendantIds(refinedMap, node.id)) siblingIdsOfRefinedTop.add(descId);
      }
    }
  }

  return {
    nodes,
    nodeMap: refinedMap,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    refinedSubtreeIds,
    siblingIdsOfRefinedTop,
    refinedSubtreeCenter,
    refinedSubtreeBbox,
  };
}

/** 缩放阈值：超过此值自动展开并显示子节点（显示内部结构） */
export const ZOOM_THRESHOLD_CHILDREN = 1.2;

/**
 * 细化（focus 栈）阈值：低于此值不进行细化放大（避免 zoom out 时仍保持细化导致“圈在框外”的过渡观感）
 * 说明：子节点是否渲染由 ZOOM_THRESHOLD_CHILDREN 控制；细化仅在更高倍率下启用。
 */
export const ZOOM_THRESHOLD_REFINED = 1.4;

/** 某结构占视口面积比例超过此值时视为「focus」并应用细化（入栈）；低于此值则允许出栈（缩小时分层级逐层取消） */
export const FOCUS_OCCUPY_RATIO = 0.35;
