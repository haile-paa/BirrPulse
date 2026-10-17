import React from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { tr, useLang } from '@/i18n';

const ETHIOPIC = /[\u1200-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/;

/** Weight -> bundled Noto Sans Ethiopic family (loaded in app/_layout.tsx). */
const FAMILY: Record<string, string> = {
  normal: 'NotoSansEthiopic_400Regular',
  '400': 'NotoSansEthiopic_400Regular',
  '500': 'NotoSansEthiopic_500Medium',
  '600': 'NotoSansEthiopic_600SemiBold',
  '700': 'NotoSansEthiopic_700Bold',
  bold: 'NotoSansEthiopic_700Bold',
  '800': 'NotoSansEthiopic_700Bold',
  '900': 'NotoSansEthiopic_700Bold',
};

function translate(node: React.ReactNode): React.ReactNode {
  if (typeof node === 'string') return tr(node);
  if (Array.isArray(node)) return node.map((n) => (typeof n === 'string' ? tr(n) : n));
  return node;
}

function hasEthiopic(node: React.ReactNode): boolean {
  if (typeof node === 'string') return ETHIOPIC.test(node);
  if (Array.isArray(node)) return node.some((n) => typeof n === 'string' && ETHIOPIC.test(n));
  return false;
}

/**
 * Drop-in replacement for React Native's Text that translates plain string children into the current language.
 * Amharic text is rendered with a bundled Ethiopic font at an explicit weight: the Android system fallback font
 * is faux-bolded wider than it is measured, which clipped the last glyph of short labels (e.g. "ግባ" -> "ግ").
 */
export function Text({ children, style, ...rest }: TextProps) {
  useLang();
  const out = translate(children);
  if (!hasEthiopic(out)) return <RNText style={style} {...rest}>{out}</RNText>;
  const flat = StyleSheet.flatten(style) ?? {};
  const family = FAMILY[String(flat.fontWeight ?? 'normal')] ?? FAMILY.normal;
  return (
    <RNText
      {...rest}
      style={[
        style,
        { fontFamily: family, fontWeight: 'normal', includeFontPadding: false },
        // Ethiopic glyphs are tall; without an explicit line height the top/bottom can be shaved off.
        flat.fontSize && !flat.lineHeight ? { lineHeight: Math.round(flat.fontSize * 1.45) } : null,
      ]}>
      {out}
    </RNText>
  );
}
