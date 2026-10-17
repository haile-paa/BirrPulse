import { tr } from '@/i18n/core';

/** Money helpers. Amounts are integer minor units (cents) to avoid floating point errors. */
export const toMinor = (birr: number | string): number => {
  const n = typeof birr === 'string' ? parseFloat(birr.replace(/,/g, '')) : birr;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const toBirr = (minor: number): number => minor / 100;

export function formatBirr(minor: number, opts: { sign?: boolean; compact?: boolean; symbol?: boolean } = {}): string {
  const { sign = false, compact = false, symbol = true } = opts;
  const v = Math.abs(toBirr(minor));
  let s: string;
  if (compact && v >= 1000) {
    s = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  } else {
    s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const prefix = sign ? (minor < 0 ? '- ' : minor > 0 ? '+ ' : '') : minor < 0 ? '-' : '';
  return `${prefix}${symbol ? `${tr('ETB')} ` : ''}${s}`;
}
