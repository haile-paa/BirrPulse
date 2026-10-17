import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { colors, radius } from '@/theme';
import { PressableScale } from './PressableScale';
import { useLang, tr } from '@/i18n';

export function HeaderScene({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx="88%" cy="-6%" r="150" stroke="#fff" strokeOpacity={0.09} strokeWidth={26} fill="none" />
        <Circle cx="-6%" cy="70%" r="110" stroke="#fff" strokeOpacity={0.07} strokeWidth={22} fill="none" />
      </Svg>
      {children}
    </LinearGradient>
  );
}

export function IconButton({ name, onPress, badge, tone = 'light' }: { name: keyof typeof Ionicons.glyphMap; onPress?: () => void; badge?: boolean; tone?: 'light' | 'dark' }) {
  return (
    <PressableScale onPress={onPress} style={[styles.iconBtn, tone === 'dark' && { backgroundColor: colors.primarySoft }]} hitSlop={8}>
      <Ionicons name={name} size={20} color={tone === 'light' ? '#fff' : colors.primaryDark} />
      {badge ? <View style={styles.dot} /> : null}
    </PressableScale>
  );
}

interface ScreenProps {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof import('react-native').RefreshControl>>;
  /** Extra space at the bottom so content clears the floating tab bar. */
  tabs?: boolean;
}

/** Teal header with curved white sheet, as in the design reference. */
export function Screen({ title, back = true, right, header, children, scroll = true, contentStyle, refreshControl, tabs }: ScreenProps) {
  useLang();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <StatusBar style="light" />
      <HeaderScene style={{ paddingTop: insets.top + 10, paddingBottom: header ? 56 : 44 }}>
        <View style={styles.titleRow}>
          {back ? <IconButton name="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} /> : <View style={{ width: 40 }} />}
          <Animated.Text entering={FadeIn.duration(350)} style={styles.title} numberOfLines={1}>{tr(title ?? '')}</Animated.Text>
          <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
        </View>
        {header}
      </HeaderScene>
      <Animated.View entering={FadeInDown.duration(380).springify().damping(20)} style={styles.sheet}>
        {scroll ? (
          <ScrollView
            refreshControl={refreshControl}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ padding: 20, paddingBottom: tabs ? 130 : 40 }, contentStyle]}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </Animated.View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <PressableScale onPress={onAction} haptic={false} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '600', marginHorizontal: 8 },
  sheet: { flex: 1, marginTop: -radius.xl, backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFB04D', borderWidth: 1.5, borderColor: colors.primary },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  sectionAction: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
