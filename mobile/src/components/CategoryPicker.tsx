import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import type { Category } from '@/types';
import { PressableScale } from './PressableScale';

export function CategoryPicker({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <View style={styles.grid}>
      {categories.map((c, i) => {
        const on = c.id === value;
        return (
          <View key={c.id} style={styles.cell}>
            <PressableScale onPress={() => onChange(c.id)} style={[styles.tile, on && { backgroundColor: `${c.color}22`, borderColor: c.color }]}>
              <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={20} color={on ? c.color : colors.muted} />
              <Text style={[styles.name, on && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>{c.name}</Text>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '25%', padding: 4 },
  tile: { height: 72, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  name: { fontSize: 10.5, color: colors.muted, fontWeight: '500' },
});
