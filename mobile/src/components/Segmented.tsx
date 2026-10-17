import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import { PressableScale } from './PressableScale';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  /** solid = teal active pill (statistics), soft = white active pill on grey track (wallet). */
  variant?: 'solid' | 'soft';
}

export function Segmented<T extends string>({ options, value, onChange, variant = 'soft' }: Props<T>) {
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const idx = Math.max(0, options.indexOf(value));
  const segW = w > 0 ? (w - 8) / options.length : 0;
  useEffect(() => { x.value = withSpring(idx * segW, { damping: 18, stiffness: 220 }); }, [idx, segW, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const solid = variant === 'solid';
  return (
    <View style={[styles.track, solid ? styles.trackSolid : styles.trackSoft]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {segW > 0 ? <Animated.View style={[styles.pill, { width: segW, backgroundColor: solid ? colors.primaryDark : '#fff' }, !solid && styles.pillShadow, pill]} /> : null}
      {options.map((o) => (
        <PressableScale key={o} haptic={false} scaleTo={0.97} style={styles.item} onPress={() => { if (o !== value) { Haptics.selectionAsync().catch(() => {}); onChange(o); } }}>
          <Text style={[styles.label, { color: o === value ? (solid ? '#fff' : colors.primaryDark) : colors.muted }]}>{o}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 24, padding: 4 },
  trackSolid: { backgroundColor: 'transparent' },
  trackSoft: { backgroundColor: '#EEF3F2' },
  pill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 20 },
  pillShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  item: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
});
