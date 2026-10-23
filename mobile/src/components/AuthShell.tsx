import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/theme';
import { HeaderScene } from './Header';
import { Logo } from './Logo';
import { LanguageToggle } from './LanguageToggle';
import { useLang, tr } from '@/i18n';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  useLang();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.primary }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <HeaderScene style={{ paddingTop: insets.top + 28, paddingBottom: 64, paddingHorizontal: 24 }}>
        <LanguageToggle style={{ position: 'absolute', top: insets.top + 12, right: 20 }} />
        <View><Logo size={58} /></View>
        <Text style={styles.title}>{tr(title)}</Text>
        <Text style={styles.sub}>{tr(subtitle)}</Text>
      </HeaderScene>
      <View style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {children}
          <View style={{ height: 8 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 22 },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 6, lineHeight: 21 },
  sheet: { flex: 1, marginTop: -radius.xl, backgroundColor: '#fff', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
});
