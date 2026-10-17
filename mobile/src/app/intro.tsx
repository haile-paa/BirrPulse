import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HeaderScene } from '@/components/Header';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Text } from '@/components/Text';
import { useLang } from '@/i18n';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';

const SLIDES: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; text: string }> = [
  { icon: 'chatbubbles', title: 'Your bank SMS, organised', text: 'BirrPulse reads supported bank messages on your phone and turns them into income, expenses, deposits and withdrawals.' },
  { icon: 'pie-chart', title: 'See where every birr goes', text: 'Budgets, savings goals and clear reports show what you earn, what you spend and what is left.' },
  { icon: 'people', title: 'Debts and business, too', text: 'Track money you borrowed or lent, bills coming up, and keep business and personal money apart.' },
];

function Dot({ active }: { active: boolean }) {
  const s = useAnimatedStyle(() => ({ width: withSpring(active ? 26 : 8, { damping: 16 }), backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.4)' }));
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, s]} />;
}

/** First screen for anyone who is not signed in (first launch and after logging out). Leads to Register. */
export default function Intro() {
  useLang();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const [step, setStep] = useState(0);
  const last = step === SLIDES.length - 1;
  if (user) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="light" />
      <HeaderScene style={{ flex: 1, paddingTop: insets.top }}>
        <LanguageToggle style={{ position: 'absolute', top: insets.top + 12, right: 20, zIndex: 5 }} />
        <Animated.View key={step} entering={FadeInRight.springify().damping(18)} exiting={FadeOutLeft.duration(160)} style={styles.slide}>
          <View style={styles.iconCircle}><Ionicons name={SLIDES[step].icon} size={64} color="#fff" /></View>
          <Text style={styles.title}>{SLIDES[step].title}</Text>
          <Text style={styles.text}>{SLIDES[step].text}</Text>
        </Animated.View>
        <View style={styles.dots}>{SLIDES.map((_, i) => <Dot key={i} active={i === step} />)}</View>
      </HeaderScene>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Button title={last ? 'Get started' : 'Next'} onPress={() => (last ? router.push('/(auth)/register') : setStep(step + 1))} />
        {last ? (
          <PressableScale haptic={false} onPress={() => router.push('/(auth)/login')} style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={styles.link}>I already have an account</Text>
          </PressableScale>
        ) : (
          <PressableScale haptic={false} onPress={() => router.push('/(auth)/register')} style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={styles.skip}>Skip intro</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 148, height: 148, borderRadius: 74, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 18 },
  footer: { paddingHorizontal: 24, paddingTop: 20, backgroundColor: '#fff' },
  skip: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  link: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
});
