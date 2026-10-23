import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { colors } from '@/theme';
import { fmtRelativeDay, fmtTime } from '@/lib/format';
import { useApp } from '@/store/useApp';
import type { AppNotification } from '@/types';
import { useLang } from '@/i18n';

const ICON: Record<AppNotification['kind'], [keyof typeof Ionicons.glyphMap, string]> = {
  budget: ['pie-chart', '#F2A33A'], bill: ['receipt', '#4A90D9'], debt: ['people', '#B66DD1'], spending: ['trending-up', colors.expense], goal: ['flag', colors.income], info: ['information-circle', colors.primary],
};

export default function Notifications() {
  useLang();
  const list = useApp((s) => s.notifications);
  useEffect(() => { const t = setTimeout(() => useApp.getState().markAllRead(), 1200); return () => clearTimeout(t); }, []);
  return (
    <Screen title="Notifications">
      {list.length === 0 ? <EmptyState icon="notifications-outline" title="You're all caught up" text="Budget limits, bills and repayment reminders will show up here." /> : null}
      {list.map((n, i) => {
        const [icon, color] = ICON[n.kind];
        return (
          <View key={n.id} style={[styles.row, !n.read && { backgroundColor: '#F4FAF9' }]}>
            <View style={[styles.icon, { backgroundColor: `${color}22` }]}><Ionicons name={icon} size={20} color={color} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.body}>{n.body}</Text>
              <Text style={styles.time}>{fmtRelativeDay(n.at)} · {fmtTime(n.at)}</Text>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, marginBottom: 8 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11.5, color: '#A9B6B3', marginTop: 4 },
});
