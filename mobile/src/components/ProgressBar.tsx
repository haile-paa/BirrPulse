import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '@/theme';

export function ProgressBar({ pct, color, height = 8, warn = true }: { pct: number; color?: string; height?: number; warn?: boolean }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(Math.min(1, Math.max(0, pct)), { duration: 800, easing: Easing.out(Easing.cubic) }); }, [pct, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const c = color ?? (!warn ? colors.primary : pct >= 1 ? colors.expense : pct >= 0.8 ? colors.warn : colors.primary);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: '#E9F0EE', overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: c }, bar]} />
    </View>
  );
}
