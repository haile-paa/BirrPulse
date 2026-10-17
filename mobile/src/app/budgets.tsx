import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Screen, IconButton } from '@/components/Header';
import { ProgressBar } from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { CategoryPicker } from '@/components/CategoryPicker';
import { Segmented } from '@/components/Segmented';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { colors } from '@/theme';
import { formatBirr, toMinor, toBirr } from '@/lib/money';
import { categoryById } from '@/lib/categories';
import { useApp } from '@/store/useApp';
import { budgetUsage, live, safeToSpend } from '@/services/insights';
import type { Budget, Period } from '@/types';
import { t, tr, useLang } from '@/i18n';

const PERIODS = ['daily', 'weekly', 'monthly'] as const;

export default function Budgets() {
  useLang();
  const s = useApp();
  const ws = s.settings.workspace;
  const [edit, setEdit] = useState<Budget | 'new' | null>(null);
  const txs = useMemo(() => live(s.transactions, ws), [s.transactions, ws]);
  const budgets = s.budgets.filter((b) => !b.deleted && b.workspace === ws);
  const safe = safeToSpend({ budgets: s.budgets, txs, accounts: s.accounts, ws, payday: s.settings.payday });

  return (
    <Screen title="Budgets" right={<IconButton name="add" onPress={() => setEdit('new')} />}>
      <Animated.View entering={FadeInDown.springify()} style={styles.hero}>
        <Text style={styles.heroLabel}>Safe to spend per day</Text>
        <Text style={styles.heroValue}>{formatBirr(safe.perDay)}</Text>
        <Text style={styles.heroSub}>{t(safe.fromBudget ? '{amount} left in your monthly budget over {n} day(s)' : '{amount} tracked balance over {n} day(s)', { amount: formatBirr(Math.max(0, safe.remaining)), n: safe.days })}</Text>
      </Animated.View>
      {budgets.length === 0 ? <EmptyState icon="pie-chart-outline" title="No budgets yet" text="Set a daily, weekly or monthly limit to get alerts at 80% and 100%." action="Create a budget" onAction={() => setEdit('new')} /> : null}
      {budgets.map((b, i) => {
        const u = budgetUsage(b, txs);
        const cat = b.categoryId ? categoryById(s.categories, b.categoryId) : null;
        return (
          <Animated.View key={b.id} layout={LinearTransition.springify()} entering={FadeInDown.delay(i * 70).springify().damping(18)}>
            <PressableScale onPress={() => setEdit(b)} scaleTo={0.98} style={styles.card}>
              <View style={styles.top}>
                <CategoryIcon icon={cat?.icon ?? 'wallet'} color={cat?.color ?? colors.primary} size={42} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{cat?.name ?? 'Overall spending'}</Text>
                  <Text style={styles.sub}>{b.period}</Text>
                </View>
                <Text style={[styles.pct, u.pct >= 1 && { color: colors.expense }]}>{Math.round(u.pct * 100)}%</Text>
              </View>
              <ProgressBar pct={u.pct} />
              <Text style={styles.line}>{t(u.remaining >= 0 ? '{spent} of {limit} · {rest} left' : '{spent} of {limit} · {rest} over', { spent: formatBirr(u.spent, { symbol: false }), limit: formatBirr(u.limit), rest: formatBirr(Math.abs(u.remaining)) })}</Text>
            </PressableScale>
          </Animated.View>
        );
      })}
      <BudgetSheet edit={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}

function BudgetSheet({ edit, onClose }: { edit: Budget | 'new' | null; onClose: () => void }) {
  const s = useApp();
  const existing = edit && edit !== 'new' ? edit : null;
  const [cat, setCat] = useState<string | null | undefined>(undefined);
  const [period, setPeriod] = useState<Period | undefined>(undefined);
  const [limit, setLimit] = useState<string | undefined>(undefined);
  const catV = cat === undefined ? existing?.categoryId ?? null : cat;
  const periodV = period ?? existing?.period ?? 'monthly';
  const limitV = limit ?? (existing ? String(toBirr(existing.limit)) : '');
  const reset = () => { setCat(undefined); setPeriod(undefined); setLimit(undefined); onClose(); };
  return (
    <BottomSheet visible={!!edit} onClose={reset} title={existing ? 'Edit budget' : 'New budget'}>
      <Text style={styles.sheetLabel}>APPLIES TO</Text>
      <PressableScale onPress={() => setCat(null)} style={[styles.overall, catV === null && { borderColor: colors.primary, backgroundColor: '#F2FAF8' }]}><Text style={styles.name}>Overall spending</Text></PressableScale>
      <View style={{ height: 8 }} />
      <CategoryPicker categories={s.categories.filter((c) => c.kind === 'expense')} value={catV} onChange={setCat} />
      <View style={{ height: 14 }} />
      <Segmented options={PERIODS} value={periodV} onChange={setPeriod} />
      <Field label="Limit" value={limitV} onChangeText={(t) => setLimit(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" prefix="ETB" placeholder="0.00" style={{ marginTop: 14 }} />
      <Button title="Save budget" onPress={() => { const l = toMinor(limitV); if (l <= 0) return; s.saveBudget({ id: existing?.id, categoryId: catV, period: periodV, limit: l }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); s.refreshAlerts(); reset(); }} />
      {existing ? <Button title="Delete budget" variant="danger" style={{ marginTop: 10, height: 46 }} onPress={() => { s.deleteBudget(existing.id); reset(); }} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primarySoft, borderRadius: 22, padding: 18, marginBottom: 14 },
  heroLabel: { color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  heroValue: { color: colors.primaryDeep, fontSize: 30, fontWeight: '800', marginTop: 4 },
  heroSub: { color: colors.primaryDark, fontSize: 12.5, marginTop: 4 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, marginTop: 12, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, textTransform: 'capitalize', marginTop: 2 },
  pct: { fontSize: 18, fontWeight: '800', color: colors.primaryDark },
  line: { fontSize: 12.5, color: colors.muted },
  sheetLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, marginBottom: 8 },
  overall: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, padding: 14, alignItems: 'center' },
});
