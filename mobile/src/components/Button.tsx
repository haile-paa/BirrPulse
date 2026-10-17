import React from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '@/theme';
import { PressableScale } from './PressableScale';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'soft' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: Props) {
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.expense : colors.primaryDark;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        variant === 'primary' && [{ backgroundColor: colors.primaryDark }, shadow.card],
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: '#fff' },
        variant === 'soft' && { backgroundColor: colors.primarySoft },
        variant === 'danger' && { backgroundColor: '#FDECEC' },
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
          <Text style={[styles.text, { color: fg }]}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { height: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 22 },
  text: { fontSize: 16, fontWeight: '600' },
});
