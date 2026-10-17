import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { fmtDate } from '@/lib/format';

/** The product rule: a calculated balance must never look like a verified bank balance. */
export function BalanceBadge({ verified, at, dark }: { verified: boolean; at?: number | null; dark?: boolean }) {
  const bg = verified ? (dark ? 'rgba(255,255,255,0.22)' : '#E3F5EC') : dark ? 'rgba(255,200,120,0.28)' : '#FFF3DF';
  const fg = verified ? (dark ? '#fff' : colors.income) : dark ? '#FFE2B0' : '#B7791F';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Ionicons name={verified ? 'shield-checkmark' : 'calculator'} size={12} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{verified ? 'Verified' : 'Calculated'}{verified && at ? ` · ${fmtDate(at)}` : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
});
