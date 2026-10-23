import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { colors, shadow } from '@/theme';
import { PressableScale } from './PressableScale';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home-outline', 'home'],
  stats: ['stats-chart-outline', 'stats-chart'],
  wallet: ['wallet-outline', 'wallet'],
  profile: ['person-outline', 'person'],
};

function Item({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const [off, on] = ICONS[name] ?? ICONS.index;
  return (
    <PressableScale haptic={false} onPress={onPress} style={styles.item}>
      <Ionicons name={focused ? on : off} size={24} color={focused ? colors.primary : '#A9B6B3'} />
      {focused ? <View style={styles.dot} /> : <View style={[styles.dot, { opacity: 0 }]} />}
    </PressableScale>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const press = (i: number) => {
    const r = routes[i];
    const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
    if (state.index !== i && !ev.defaultPrevented) { Haptics.selectionAsync().catch(() => {}); navigation.navigate(r.name, r.params); }
  };
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        {routes.slice(0, 2).map((r, i) => <Item key={r.key} name={r.name} focused={state.index === i} onPress={() => press(i)} />)}
        <View style={styles.fabSlot} />
        {routes.slice(2).map((r, i) => <Item key={r.key} name={r.name} focused={state.index === i + 2} onPress={() => press(i + 2)} />)}
      </View>
      <View style={styles.fabWrap} pointerEvents="box-none">
        <PressableScale onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); router.push('/add'); }} haptic={false} scaleTo={0.9} style={[styles.fab, shadow.card]}>
          <Ionicons name="add" size={32} color="#fff" />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, shadowColor: '#0E3B37', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10 },
  item: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 4 },
  fabSlot: { width: 72 },
  fabWrap: { position: 'absolute', top: -26, left: 0, right: 0, alignItems: 'center' },
  fab: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
});
