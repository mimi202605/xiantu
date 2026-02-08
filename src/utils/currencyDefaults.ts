/**
 * 货币四档默认值与兼容旧键名（下品/中品/上品/极品 → 现金/铜/银/金）
 */
import type { CurrencyFourTier } from '@/types/game';

export const DEFAULT_CURRENCY: CurrencyFourTier = {
  现金: 0,
  铜: 0,
  银: 0,
  金: 0,
};

const LEGACY_TO_NEW: Record<string, keyof CurrencyFourTier> = {
  下品: '现金',
  中品: '铜',
  上品: '银',
  极品: '金',
};

/** 将旧键名（下品/中品/上品/极品）或新键名对象规范为新四档 */
export function normalizeCurrency(raw: unknown): CurrencyFourTier {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CURRENCY };
  const o = raw as Record<string, unknown>;
  const out: CurrencyFourTier = { ...DEFAULT_CURRENCY };
  for (const [key, newKey] of Object.entries(LEGACY_TO_NEW)) {
    const v = o[newKey] ?? o[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[newKey] = v;
  }
  return out;
}
