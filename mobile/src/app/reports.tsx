import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Screen } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/Button';
import { colors } from '@/theme';
import { formatBirr } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { categoryById } from '@/lib/categories';
import { useApp } from '@/store/useApp';
import { byCategory, debtSummary, live, monthlyCashflow, rangeBounds, savingsSuggestion, totals, type Range } from '@/services/insights';
import { t, tr, alertT, useLang } from '@/i18n';

const RANGES: readonly Range[] = ['Week', 'Month', 'Year'];

function Stat({ label, value, icon, color, i }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; color: string; i: number }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}><Ionicons name={icon} size={18} color={color} /></View>
      <Text style={styles.statK}>{label}</Text>
      <AnimatedNumber value={value} format={(v) => formatBirr(v, { compact: true })} style={styles.statV} duration={700} />
    </View>
  );
}

export default function Reports() {
  useLang();
  const s = useApp();
  const ws = s.settings.workspace;
  const [range, setRange] = useState<Range>('Month');
  const txs = useMemo(() => live(s.transactions, ws), [s.transactions, ws]);
  const { from, to } = rangeBounds(range);
  const tot = useMemo(() => totals(txs, from, to), [txs, from, to]);
  const cats = useMemo(() => byCategory(txs, 'expense', from, to), [txs, from, to]);
  const flow = useMemo(() => monthlyCashflow(txs), [txs]);
  const debts = debtSummary(s.debts, ws);
  const tip = savingsSuggestion(txs);
  const maxFlow = Math.max(1, ...flow.flatMap((f) => [f.income, f.expense]));
  const biz = ws === 'business';

  const exportPdf = async () => {
    try {
      const rows = cats.map((c) => `<tr><td>${categoryById(s.categories, c.categoryId).name}</td><td style="text-align:right">${formatBirr(c.total)}</td></tr>`).join('');
      const html = `<html><body style="font-family:Helvetica;padding:32px;color:#16302D"><h2 style="color:#3A8D87">BirrPulse ${biz ? 'business ' : ''}report</h2>
        <p>${range} · ${fmtDate(from)} to ${fmtDate(to - 1)}</p>
        <p>Income: <b>${formatBirr(tot.income)}</b><br/>Expenses: <b>${formatBirr(tot.expense)}</b><br/>Net: <b>${formatBirr(tot.net)}</b><br/>Deposits: ${formatBirr(tot.deposits)}<br/>Withdrawals: ${formatBirr(tot.withdrawals)}<br/>Transaction fees: ${formatBirr(tot.fees)}</p>
        <h3>Spending by category</h3><table width="100%">${rows}</table>
        <p style="color:#8A9895;font-size:11px">Figures are calculated from tracked transactions and are estimates, not verified bank statements.</p></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch { alertT('Could not create the report'); }
  };

  return (
    <Screen title={biz ? 'Business report' : 'Financial report'}>
      <Segmented options={RANGES} value={range} onChange={setRange} variant="solid" />
      <View style={styles.grid}>
        <Stat i={0} label="Income" value={tot.income} icon="arrow-down" color={colors.income} />
        <Stat i={1} label="Expenses" value={tot.expense} icon="arrow-up" color={colors.expense} />
        <Stat i={2} label="Deposits" value={tot.deposits} icon="download" color="#4A90D9" />
        <Stat i={3} label="Withdrawals" value={tot.withdrawals} icon="cash" color="#B66DD1" />
        <Stat i={4} label="Fees paid" value={tot.fees} icon="receipt" color={colors.warn} />
        <Stat i={5} label={biz ? 'Est. profit' : 'Net'} value={tot.net} icon="analytics" color={colors.primary} />
      </View>

      {biz ? (
        <>
          <Text style={styles.h}>Cash flow · last 6 months</Text>
          <View style={styles.flow}>
            {flow.map((f, i) => (
              <View key={f.label + i} style={styles.flowCol}>
                <View style={styles.bars}>
                  <ProgressBarV value={f.income / maxFlow} color={colors.income} delay={i * 60} />
                  <ProgressBarV value={f.expense / maxFlow} color={colors.expense} delay={i * 60 + 40} />
                </View>
                <Text style={styles.flowL}>{f.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.debtRow}>
            <View style={{ flex: 1 }}><Text style={styles.statK}>Customers owe</Text><Text style={[styles.statV, { color: colors.income }]}>{formatBirr(debts.owedToMe, { compact: true })}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.statK}>Owed to suppliers</Text><Text style={[styles.statV, { color: colors.expense }]}>{formatBirr(debts.iOwe, { compact: true })}</Text></View>
          </View>
          <Text style={styles.disc}>Estimated profit is income minus expenses from tracked transactions. It is not an accounting statement.</Text>
        </>
      ) : null}

      <Text style={styles.h}>Where the money went</Text>
      {cats.length === 0 ? <Text style={styles.disc}>No expenses in this period.</Text> : cats.slice(0, 6).map((c, i) => {
        const cat = categoryById(s.categories, c.categoryId);
        return (
          <View key={c.categoryId} style={styles.catRow}>
            <CategoryIcon icon={cat.icon} color={cat.color} size={38} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}><Text style={styles.catName}>{cat.name}</Text><Text style={styles.catAmt}>{formatBirr(c.total, { symbol: false })}</Text></View>
              <ProgressBar pct={c.total / (tot.expense || 1)} color={cat.color} height={6} />
            </View>
          </View>
        );
      })}

      {tip ? (
        <View style={styles.tip}><Ionicons name="bulb" size={20} color={colors.primaryDark} /><Text style={styles.tipText}>{t('Reducing {category} by 10% would save about {saving} a month.', { category: tr(categoryById(s.categories, tip.categoryId).name), saving: formatBirr(tip.saving) })}</Text></View>
      ) : null}
      <Button title="Export as PDF" icon="share-outline" onPress={exportPdf} style={{ marginTop: 18 }} />
      <Text style={styles.disc}>Balances shown in the app are verified only when taken from a bank SMS. Reports use tracked transactions.</Text>
    </Screen>
  );
}

function ProgressBarV({ value, color, delay }: { value: number; color: string; delay: number }) {
  return <View style={{ width: 10, height: Math.max(3, value * 96), backgroundColor: color, borderRadius: 5 }} />;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { width: '48%', flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statK: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  statV: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 2 },
  h: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 22, marginBottom: 10 },
  flow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 130, paddingHorizontal: 4 },
  flowCol: { alignItems: 'center', gap: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 100 },
  flowL: { fontSize: 11, color: colors.muted },
  debtRow: { flexDirection: 'row', marginTop: 16, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  catName: { fontSize: 14, fontWeight: '600', color: colors.text },
  catAmt: { fontSize: 13, fontWeight: '700', color: colors.text },
  tip: { flexDirection: 'row', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14, marginTop: 16, alignItems: 'center' },
  tipText: { flex: 1, color: colors.primaryDeep, fontSize: 13.5, lineHeight: 19 },
  disc: { fontSize: 11.5, color: colors.muted, marginTop: 10, lineHeight: 16 },
});
