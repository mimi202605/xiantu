import type { GameTime } from '@/types/game';

const DAYS_IN_MONTH = 30;
const MONTHS_IN_YEAR = 12;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = HOURS_IN_DAY * MINUTES_IN_HOUR;
const MINUTES_IN_MONTH = DAYS_IN_MONTH * MINUTES_IN_DAY;
const MINUTES_IN_YEAR = MONTHS_IN_YEAR * MINUTES_IN_MONTH;

/**
 * 标准化游戏时间，处理分钟、小时、天和月的进位。
 * @param time 要标准化的GameTime对象。
 * @returns 一个新的、已标准化的GameTime对象。
 */
export function normalizeGameTime(time: GameTime): GameTime {
  let { 年, 月, 日, 小时, 分钟 } = time;

  if (分钟 >= MINUTES_IN_HOUR) {
    小时 += Math.floor(分钟 / MINUTES_IN_HOUR);
    分钟 %= MINUTES_IN_HOUR;
  }

  if (小时 >= HOURS_IN_DAY) {
    日 += Math.floor(小时 / HOURS_IN_DAY);
    小时 %= HOURS_IN_DAY;
  }

  while (日 > DAYS_IN_MONTH) {
    月 += 1;
    日 -= DAYS_IN_MONTH;
  }

  if (月 > MONTHS_IN_YEAR) {
    年 += Math.floor((月 - 1) / MONTHS_IN_YEAR);
    月 = ((月 - 1) % MONTHS_IN_YEAR) + 1;
  }

  return { 年, 月, 日, 小时, 分钟 };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/**
 * 将 GameTime 转为可排序字符串，格式 YYYY-MM-DD-HH-mm，便于解析、比较与作为 triple.timestamp。
 */
export function gameTimeToSortable(gt: GameTime): string {
  return `${gt.年}-${pad(gt.月)}-${pad(gt.日)}-${pad(gt.小时)}-${pad(gt.分钟)}`;
}

/**
 * 将 GameTime 转为近似「总游戏分钟」，用于与 gameTimeStringToMinutes 的结果做差求 age。
 */
export function gameTimeToMinutes(gt: GameTime): number {
  return gt.年 * MINUTES_IN_YEAR + gt.月 * MINUTES_IN_MONTH + gt.日 * MINUTES_IN_DAY + gt.小时 * MINUTES_IN_HOUR + gt.分钟;
}

/**
 * 解析 game-time 风格的可排序串 "Y-M-D-H-m" 为近似「总游戏分钟」用于计算 age/recency。
 * 与 gameTimeToSortable 配套；非此格式返回 null。
 */
export function gameTimeStringToMinutes(s: string): number | null {
  const parts = s.trim().split('-');
  if (parts.length < 5) return null;
  const 年 = parseInt(parts[0], 10);
  const 月 = parseInt(parts[1], 10);
  const 日 = parseInt(parts[2], 10);
  const 小时 = parseInt(parts[3], 10);
  const 分钟 = parseInt(parts[4], 10);
  if (Number.isNaN(年) || Number.isNaN(月) || Number.isNaN(日) || Number.isNaN(小时) || Number.isNaN(分钟)) return null;
  return 年 * MINUTES_IN_YEAR + 月 * MINUTES_IN_MONTH + 日 * MINUTES_IN_DAY + 小时 * MINUTES_IN_HOUR + 分钟;
}