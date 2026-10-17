import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { colors } from '@/theme';
import { Button } from './Button';

export function EmptyState({ icon, title, text, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={styles.wrap}>
      <View style={styles.circle}><Ionicons name={icon} size={34} color={colors.primary} /></View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {action ? <Button title={action} onPress={onAction} variant="soft" style={{ marginTop: 16, height: 46 }} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  circle: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  text: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
