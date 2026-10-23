import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen, IconButton, SectionHeader } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { LineChart } from '@/components/LineChart';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { TxRow } from '@/components/TxRow';
import { colors } from '@/theme';
import { formatBirr } from '@/lib/money';
import { categoryById } from '@/lib/categories';
import { useApp } from '@/store/useApp';
import { byCategory, live, rangeBounds, series, totals, type Range } from '@/services/insights';
import { t, tr, useLang } from '@/i18n';

const RANGES: readonly Range[] = ['Day', 'Week', 'Month', 'Year'];

export default function Stats() {
  useLang();
  const s = useApp();
  const ws = s.settings.workspace;
  const [range, setRange] = useState<Range>('Month');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const txs = useMemo(() => live(s.transactions, ws), [s.transactions, ws]);
  const data = useMemo(() => series(txs, range, kind), [txs, range, kind]);
  const { from, to } = useMemo(() => rangeBounds(range), [range]);
  const sum = useMemo(() => totals(txs, from, to), [txs, from, to]);
  const cats = useMemo(() => byCategory(txs, kind, from, to), [txs, kind, from, to]);
  const top = useMemo(
    () => txs.filter((t) => t.type === kind && !t.transferGroup && t.occurredAt >= from && t.occurredAt < to).sort((a, b) => b.amount - a.amount).slice(0, 3),
    [txs, kind, from, to],
  );
  const total = kind === 'expense' ? sum.expense : sum.income;
  const grand = cats.reduce((a, c) => a + c.total, 0) || 1;

  return (
    <Screen title="Statistics" back={false} tabs right={<IconButton name="document-text" onPress={() => router.push('/reports')} />}>
      <Segmented options={RANGES} value={range} onChange={setRange} variant="solid" />
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.totalLabel}>{t(kind === 'expense' ? 'Total spent · {range}' : 'Total received · {range}', { range: tr(range.toLowerCase()) })}</Text>
          <AnimatedNumber value={total} format={(v) => formatBirr(v)} style={styles.total} duration={600} />
        </View>
        <PressableScale onPress={() => setKind(kind === 'expense' ? 'income' : 'expense')} style={styles.drop}>
          <Text style={styles.dropText}>{kind === 'expense' ? 'Expense' : 'Income'}</Text>
          <Ionicons name="swap-vertical" size={14} color={colors.primaryDark} />
        </PressableScale>
      </View>

      <LineChart values={data.values} labels={data.labels} activeIndex={data.activeIndex} labelEvery={range === 'Month' ? 5 : 1} color={kind === 'expense' ? colors.primary : colors.income} />

      <SectionHeader title={kind === 'expense' ? 'Top spending' : 'Top income'} />
      {cats.length === 0 ? (
        <EmptyState icon="stats-chart-outline" title="Nothing to chart yet" text={t(kind === 'expense' ? 'No expenses in this {range}.' : 'No income in this {range}.', { range: tr(range.toLowerCase()) })} />
      ) : cats.map((c, i) => {
        const cat = categoryById(s.categories, c.categoryId);
        return (
          <View key={`${kind}-${c.categoryId}`} style={styles.catRow}>
            <CategoryIcon icon={cat.icon} color={cat.color} size={42} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.catTop}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={[styles.catAmount, { color: kind === 'expense' ? colors.expense : colors.income }]}>{formatBirr(c.total, { symbol: false })}</Text>
              </View>
              <ProgressBar pct={c.total / grand} color={cat.color} height={6} />
              <Text style={styles.catSub}>{t(c.count > 1 ? '{pct}% · {n} transactions' : '{pct}% · 1 transaction', { pct: Math.round((c.total / grand) * 100), n: c.count })}</Text>
            </View>
          </View>
        );
      })}

      {top.length > 0 ? (
        <View>
          <SectionHeader title="Biggest transactions" />
          {top.map((t, i) => <TxRow key={t.id} tx={t} index={i} categories={s.categories} accounts={s.accounts} />)}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, marginBottom: 6 },
  totalLabel: { fontSize: 12.5, color: colors.muted, fontWeight: '500' },
  total: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 2 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, height: 38, borderRadius: 12 },
  dropText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontSize: 15, fontWeight: '600', color: colors.text },
  catAmount: { fontSize: 14, fontWeight: '700' },
  catSub: { fontSize: 11.5, color: colors.muted, marginTop: 5 },
});
