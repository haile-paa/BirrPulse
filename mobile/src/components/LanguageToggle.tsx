import React from 'react';
import { StyleSheet, Text as RNText, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '@/i18n';
import { useApp } from '@/store/useApp';
import { PressableScale } from './PressableScale';

/** Small pill that switches between English and አማርኛ. Shown on sign-in and onboarding where there is no settings screen yet. */
export function LanguageToggle({ style }: { style?: StyleProp<ViewStyle> }) {
  const lang = useLang();
  return (
    <PressableScale onPress={() => useApp.getState().setSettings({ language: lang === 'en' ? 'am' : 'en' })} style={[styles.pill, style]} hitSlop={8}>
      <Ionicons name="language" size={15} color="#fff" />
      <RNText style={styles.text}>{lang === 'en' ? 'አማርኛ' : 'English'}</RNText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, height: 34, borderRadius: 17 },
  text: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
