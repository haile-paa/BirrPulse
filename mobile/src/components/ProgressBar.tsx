import React from 'react';
import { View } from 'react-native';
import { colors } from '@/theme';

export function ProgressBar({ pct, color, height = 8, warn = true }: { pct: number; color?: string; height?: number; warn?: boolean }) {
  const p = Math.min(1, Math.max(0, pct));
  const c = color ?? (!warn ? colors.primary : pct >= 1 ? colors.expense : pct >= 0.8 ? colors.warn : colors.primary);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: '#E9F0EE', overflow: 'hidden' }}>
      <View style={{ height, borderRadius: height, backgroundColor: c, width: `${p * 100}%` }} />
    </View>
  );
}
