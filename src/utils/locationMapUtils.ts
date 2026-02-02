/**
 * @fileoverview
 * 地图布局工具：将地点树转换为带坐标的节点，用于 minimap 展示。
 * 支持扁平数组（通过 上级 建树）与嵌套 内部 结构。
 * 顶层地点围绕中心分布；子地点更小，藏于父地点内部，放大时展开。
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

/**
 * 将地点转换为带坐标的节点列表。
 * 支持扁平数组（通过 上级 建树）与 内部 嵌套。
 */
export function buildLocationMapNodes(entries: (LocationEntry | unknown)[] | undefined): {
  nodes: MapLocationNode[];
  nodeMap: Map<string, MapLocationNode>;
  canvasWidth: number;
  canvasHeight: number;
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

  return {
    nodes: result,
    nodeMap,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
  };
}

/** 缩放阈值：超过此值才显示子节点（放大时展开） */
export const ZOOM_THRESHOLD_CHILDREN = 1.4;
