/**
 * @fileoverview
 * 地图布局工具：将地点树转换为带坐标的节点，用于 minimap 展示。
 * 顶层地点随机分布在画布上；子地点聚集在父地点附近，字号更小。
 * 位置与距离无实际意义，仅用于视觉呈现。
 */

import type { LocationEntry } from '@/types/game';

export interface MapLocationNode {
  entry: LocationEntry;
  /** 唯一标识（名称或路径） */
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
  /** 节点半径（用于布局与碰撞） */
  radius: number;
  /** 显示字号比例，顶层 1，子级递减 */
  fontSizeScale: number;
}

/** 画布默认尺寸（逻辑坐标） */
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
/** 顶层节点分布半径 */
const TOP_LEVEL_RADIUS = 280;
/** 子节点相对父节点的分布半径 */
const CHILD_OFFSET_RADIUS = 80;
/** 节点基础半径 */
const BASE_RADIUS = 24;
/** 子级半径衰减 */
const CHILD_RADIUS_SCALE = 0.7;

/**
 * 简单字符串哈希，用于确定性随机
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * 基于名称的伪随机数 [0, 1)
 */
function seededRandom(name: string, salt: number): number {
  const h = hashString(`${name}-${salt}`);
  return (h % 10000) / 10000;
}

/**
 * 递归收集所有节点（含子节点）
 */
function collectNodes(
  entries: LocationEntry[],
  parentId: string | null,
  depth: number,
  pathPrefix: string,
  result: MapLocationNode[],
  idSet: Set<string>
): void {
  if (!Array.isArray(entries)) return;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || typeof e !== 'object' || !e.名称) continue;
    const id = pathPrefix ? `${pathPrefix}/${e.名称}` : e.名称;
    if (idSet.has(id)) continue;
    idSet.add(id);

    const childIds: string[] = [];
    const childPrefix = id;
    const inner = e.内部;
    if (Array.isArray(inner) && inner.length > 0) {
      for (const c of inner) {
        if (c?.名称) childIds.push(childPrefix + '/' + c.名称);
      }
    }

    const fontSizeScale = depth === 0 ? 1 : Math.pow(CHILD_RADIUS_SCALE, depth);
    const radius = BASE_RADIUS * fontSizeScale;

    result.push({
      entry: e,
      id,
      x: 0,
      y: 0,
      depth,
      parentId,
      childIds,
      radius,
      fontSizeScale,
    });

    if (Array.isArray(inner)) {
      collectNodes(inner, id, depth + 1, childPrefix, result, idSet);
    }
  }
}

/**
 * 为顶层节点分配位置（围绕中心分布）
 */
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
 * 为子节点分配位置（在父节点附近）
 */
function layoutChildren(nodes: MapLocationNode[], nodeMap: Map<string, MapLocationNode>): void {
  for (const node of nodes) {
    if (node.depth === 0) continue;
    const parent = node.parentId ? nodeMap.get(node.parentId) : null;
    if (!parent) continue;

    const siblings = nodes.filter((n) => n.parentId === node.parentId);
    const idx = siblings.findIndex((n) => n.id === node.id);
    const total = siblings.length;
    const angle =
      (2 * Math.PI * idx) / total + seededRandom(node.entry.名称, 3) * 0.5;
    const r = CHILD_OFFSET_RADIUS * node.fontSizeScale + seededRandom(node.entry.名称, 4) * 20;
    node.x = parent.x + Math.cos(angle) * r;
    node.y = parent.y + Math.sin(angle) * r;
  }
}

/**
 * 将地点树转换为带坐标的节点列表
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
  const result: MapLocationNode[] = [];
  const idSet = new Set<string>();
  collectNodes(list, null, 0, '', result, idSet);

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
