import { AM, AM_PATTERNS } from './am';
import { getLang } from './lang';

/** Translates a complete UI string. Unknown strings are returned unchanged, so English is always the fallback. */
export function tr(s: string): string {
  if (getLang() === 'en' || !s) return s;
  const core = s.trim();
  if (!core) return s;
  const lead = s.slice(0, s.length - s.trimStart().length);
  const trail = s.slice(s.trimEnd().length);
  const hit = AM[core];
  if (hit !== undefined) return lead + hit + trail;
  for (const [re, fn] of AM_PATTERNS) {
    const m = re.exec(core);
    if (m) return lead + fn(m) + trail;
  }
  return s;
}

/** Translates a sentence with {placeholders}; the key is the English template. */
export function t(key: string, params?: Record<string, string | number>): string {
  const base = getLang() === 'en' ? key : (AM[key] ?? key);
  return params ? base.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? '')) : base;
}
