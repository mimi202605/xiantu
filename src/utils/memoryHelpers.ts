/**
 * 记忆格式与消费辅助：隐性中期格式、中期条目内容提取、按相关角色过滤。
 */
import type { ImplicitMidTermEntry, MidTermEntry } from '@/types/game'

/** 从中期记忆条目标题或对象中取出用于显示/发送的字符串 */
export function getMidTermContent(entry: MidTermEntry): string {
  if (typeof entry === 'string') return entry
  return (entry as { 记忆主体: string }).记忆主体 ?? ''
}

/** 判断中期记忆条目是否已精炼 */
export function isMidTermRefined(entry: MidTermEntry): boolean {
  if (typeof entry === 'string') return false
  return !!(entry as { 已精炼?: boolean }).已精炼
}

/** 从隐式中期条目中取出相关角色集合（含名字变体） */
function getRelevantNames(entry: ImplicitMidTermEntry): Set<string> {
  const names = (entry.相关角色 || []).filter((n): n is string => typeof n === 'string' && n.trim() !== '')
  const set = new Set(names.map((n) => n.trim()))
  if (entry.记忆主体) {
    const body = entry.记忆主体
    if (body.includes('玩家')) set.add('玩家')
  }
  return set
}

/**
 * 仅保留与当前上下文相关的隐式中期记忆（相关角色与 playerName / recentNpcNames 有交集）。
 * 与语义记忆消费逻辑类似：按相关角色过滤。
 */
export function filterImplicitMidTermByRelevantCharacters(
  entries: ImplicitMidTermEntry[],
  playerName: string,
  recentNpcNames: string[]
): ImplicitMidTermEntry[] {
  const relevant = new Set<string>()
  if (playerName && playerName.trim()) relevant.add(playerName.trim())
  relevant.add('玩家')
  for (const n of recentNpcNames) {
    if (n && typeof n === 'string' && n.trim()) relevant.add(n.trim())
  }
  return entries.filter((entry) => {
    const names = getRelevantNames(entry)
    for (const r of relevant) {
      if (names.has(r)) return true
    }
    for (const n of names) {
      if (relevant.has(n)) return true
    }
    return false
  })
}

/** 将隐式中期记忆格式化为供 prompt 使用的多行文本（时间 + 记忆主体） */
export function formatImplicitMidTermForPrompt(entries: ImplicitMidTermEntry[], maxLines = 15): string[] {
  const lines: string[] = []
  const limit = Math.min(entries.length, maxLines)
  for (let i = Math.max(0, entries.length - limit); i < entries.length; i++) {
    const e = entries[i]
    const time = e.事件时间 ? `[${e.事件时间}] ` : ''
    lines.push(`${time}${e.记忆主体 || ''}`.trim())
  }
  return lines.filter(Boolean)
}

/** 兼容：将旧版 string[] 隐式中期转为 ImplicitMidTermEntry[] 供消费逻辑使用 */
export function normalizeImplicitMidTermForConsumption(
  raw: (ImplicitMidTermEntry | string)[] | undefined
): ImplicitMidTermEntry[] {
  if (!Array.isArray(raw)) return []
  const out: ImplicitMidTermEntry[] = []
  for (const v of raw) {
    if (typeof v === 'string' && v.trim()) {
      out.push({ 相关角色: [], 事件时间: '', 记忆主体: v.trim() })
    } else if (v && typeof v === 'object' && typeof (v as ImplicitMidTermEntry).记忆主体 === 'string') {
      out.push(v as ImplicitMidTermEntry)
    }
  }
  return out
}
