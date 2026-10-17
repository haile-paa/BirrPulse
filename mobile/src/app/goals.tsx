import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, IconButton } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { formatBirr, toMinor } from '@/lib/money';
import { addDays, fmtDate, startOfDay } from '@/lib/format';
import { useApp } from '@/store/useApp';
import type { Goal } from '@/types';
import { t, tr, useLang } from '@/i18n';

const ICONS = ['phone-portrait', 'car', 'school', 'home', 'airplane', 'book', 'laptop', 'flag'] as const;

export default function Goals() {
  useLang();
  const s = useApp();
  const goals = s.goals.filter((g) => !g.deleted);
  const [sheet, setSheet] = useState<'new' | null>(null);
  const [add, setAdd] = useState<Goal | null>(null);
  const [amt, setAmt] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [months, setMonths] = useState('6');
  const [icon, setIcon] = useState<string>('flag');

  return (
    <Screen title="Savings goals" right={<IconButton name="add" onPress={() => setSheet('new')} />}>
      {goals.length === 0 ? <EmptyState icon="flag-outline" title="Save for what matters" text="A phone, a car, school fees. Set a target and see how much to put aside each month." action="Create a goal" onAction={() => setSheet('new')} /> : null}
      {goals.map((g, i) => {
        const pct = g.target > 0 ? g.saved / g.target : 0;
        const monthsLeft = g.deadline ? Math.max(1, Math.ceil((g.deadline - Date.now()) / (30 * 86400000))) : null;
        const perMonth = monthsLeft ? Math.max(0, Math.ceil((g.target - g.saved) / monthsLeft)) : null;
        return (
          <Animated.View key={g.id} entering={FadeInDown.delay(i * 80).springify().damping(18)} style={styles.card}>
            <View style={styles.top}>
              <CategoryIcon icon={g.icon} color={colors.primary} size={46} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{g.name}</Text>
                <Text style={styles.sub}>{t('{saved} of {target}', { saved: formatBirr(g.saved), target: formatBirr(g.target) })}</Text>
              </View>
              {pct >= 1 ? <Animated.View entering={ZoomIn.springify()}><Ionicons name="checkmark-circle" size={28} color={colors.income} /></Animated.View> : <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>}
            </View>
            <ProgressBar pct={pct} warn={false} height={10} />
            {perMonth != null && pct < 1 ? <Text style={styles.hint}>{t('Save {amount} per month to reach it by {date}.', { amount: formatBirr(perMonth), date: fmtDate(g.deadline!) })}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Add money" variant="soft" icon="add" style={{ flex: 1, height: 44 }} onPress={() => { setAmt(''); setAdd(g); }} />
              <PressableScale onPress={() => s.deleteGoal(g.id)} style={styles.del}><Ionicons name="trash-outline" size={19} color={colors.expense} /></PressableScale>
            </View>
          </Animated.View>
        );
      })}

      <BottomSheet visible={sheet === 'new'} onClose={() => setSheet(null)} title="New goal">
        <Field label="Goal" value={name} onChangeText={setName} placeholder="e.g. New phone" />
        <Field label="Target amount" value={target} onChangeText={(t) => setTarget(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" />
        <Field label="Months to reach it" value={months} onChangeText={setMonths} keyboardType="number-pad" />
        <View style={styles.icons}>{ICONS.map((ic) => (
          <PressableScale key={ic} onPress={() => setIcon(ic)} style={[styles.iconPick, icon === ic && { backgroundColor: colors.primary }]}><Ionicons name={ic} size={20} color={icon === ic ? '#fff' : colors.primary} /></PressableScale>
        ))}</View>
        <Button title="Create goal" style={{ marginTop: 14 }} onPress={() => { const t = toMinor(target); if (!name.trim() || t <= 0) return; s.saveGoal({ name: name.trim(), target: t, icon, deadline: addDays(startOfDay(Date.now()), (parseInt(months, 10) || 6) * 30) }); setName(''); setTarget(''); setSheet(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }} />
      </BottomSheet>
      <BottomSheet visible={!!add} onClose={() => setAdd(null)} title={add ? t('Add to {name}', { name: add.name }) : ''}>
        <Field label="Amount" value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" autoFocus />
        <Button title="Save" onPress={() => { const a = toMinor(amt); if (add && a > 0) { s.contribute(add.id, a); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); } setAdd(null); }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 16, marginBottom: 14, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  pct: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
  hint: { fontSize: 12.5, color: colors.primaryDark, backgroundColor: colors.primarySoft, padding: 10, borderRadius: 12, overflow: 'hidden' },
  del: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconPick: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
