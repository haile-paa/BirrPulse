import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HeaderScene, IconButton, SectionHeader } from '@/components/Header';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { BalanceBadge } from '@/components/BalanceBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { TxRow } from '@/components/TxRow';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { CategoryIcon } from '@/components/CategoryIcon';
import { colors, radius, shadow } from '@/theme';
import { formatBirr } from '@/lib/money';
import { greeting, fmtDate, fmtRelativeDay } from '@/lib/format';
import { categoryById } from '@/lib/categories';
import { useApp } from '@/store/useApp';
import { debtSummary, dueBills, incomeReceived, live, monthTotals, payCycle, safeToSpend, savingsSuggestion, spentSince, totalBalance } from '@/services/insights';
import { runBackgroundWork } from '@/services/runtime';
import { isSmsSupported } from '@/sms/smsService';
import { t, tr, useLang } from '@/i18n';

/** Employee: "N days left until the salary from <company>". Student: the same for the allowance. */
function IncomeCard() {
  const settings = useApp((s) => s.settings);
  const transactions = useApp((s) => s.transactions);
  const type = settings.userType;
  const txs = useMemo(() => live(transactions, settings.workspace), [transactions, settings.workspace]);
  if (type !== 'employee' && type !== 'student') return null;

  const employee = type === 'employee';
  const { payday, incomeAmount, incomeSource } = settings;
  const title = employee
    ? incomeSource ? t('Salary from {name}', { name: incomeSource }) : tr('Salary')
    : incomeSource ? t('Allowance from {name}', { name: incomeSource }) : tr('Allowance');

  if (!payday) {
    return (
      <PressableScale onPress={() => router.push('/(tabs)/profile')} style={[styles.income, shadow.soft]}>
        <View style={styles.incomeTop}>
          <Ionicons name={employee ? 'briefcase' : 'wallet'} size={20} color={colors.primaryDark} />
          <Text style={styles.incomeTitle}>{title}</Text>
        </View>
        <Text style={styles.incomeSub}>{tr('Add your payday to see how many days are left.')}</Text>
      </PressableScale>
    );
  }

  const cycle = payCycle(payday);
  const got = incomeReceived(txs, cycle.prev, type);
  const spent = spentSince(txs, cycle.prev);
  return (
    <PressableScale onPress={() => router.push('/(tabs)/profile')} haptic={false} scaleTo={0.99} style={[styles.income, shadow.soft]}>
      <View style={styles.incomeTop}>
        <Ionicons name={employee ? 'briefcase' : 'wallet'} size={20} color={colors.primaryDark} />
        <Text style={styles.incomeTitle} numberOfLines={1}>{title}</Text>
      </View>
      <View style={styles.incomeMid}>
        <Text style={styles.days}>{cycle.daysLeft === 0 ? tr('Payday is today') : t(cycle.daysLeft === 1 ? '1 day left' : '{n} days left', { n: cycle.daysLeft })}</Text>
        <Text style={styles.incomeSub}>{incomeAmount ? `${formatBirr(incomeAmount, { compact: true })} · ` : ''}{fmtDate(cycle.next)}</Text>
      </View>
      <ProgressBar pct={cycle.elapsedPct} warn={false} height={7} />
      <View style={styles.incomeRow}>
        <Text style={styles.incomeSmall}>{t('Spent since last payday: {amount}', { amount: formatBirr(spent, { compact: true }) })}</Text>
        {got ? <Text style={[styles.incomeSmall, { color: colors.income, fontWeight: '700' }]}>{tr('Received')} ✓</Text> : null}
      </View>
    </PressableScale>
  );
}

export default function Home() {
  useLang();
  const insets = useSafeAreaInsets();
  const s = useApp();
  const ws = s.settings.workspace;
  const biz = s.settings.userType === 'business';
  const [refreshing, setRefreshing] = useState(false);

  const txs = useMemo(() => live(s.transactions, ws), [s.transactions, ws]);
  const bal = useMemo(() => totalBalance(s.accounts, s.transactions, ws), [s.accounts, s.transactions, ws]);
  const month = useMemo(() => monthTotals(txs), [txs]);
  const safe = useMemo(() => safeToSpend({ budgets: s.budgets, txs, accounts: s.accounts, ws, payday: s.settings.payday }), [s.budgets, txs, s.accounts, ws, s.settings.payday]);
  const bills = useMemo(() => dueBills(s.bills.filter((b) => b.workspace === ws)), [s.bills, ws]);
  const tip = useMemo(() => savingsSuggestion(txs), [txs]);
  const debts = useMemo(() => debtSummary(s.debts, ws), [s.debts, ws]);
  const unread = s.notifications.filter((n) => !n.read).length;
  const recent = txs.slice(0, 5);

  const onRefresh = useCallback(async () => { setRefreshing(true); await runBackgroundWork(); setRefreshing(false); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} progressViewOffset={insets.top} />}>
        <HeaderScene style={{ paddingTop: insets.top + 14, paddingBottom: 26, borderBottomLeftRadius: 38, borderBottomRightRadius: 38 }}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.hello}>{greeting()},</Text>
              <Text style={styles.name}>{s.settings.userName || 'there'}</Text>
            </View>
            <IconButton name="notifications" badge={unread > 0} onPress={() => router.push('/notifications')} />
          </View>

          <View style={[styles.card, shadow.card]}>
            <View style={styles.cardTop}>
              <Text style={styles.cardLabel}>Total balance</Text>
              <BalanceBadge verified={bal.allVerified} dark />
            </View>
            <AnimatedNumber value={bal.amount} format={(v) => formatBirr(v)} style={styles.balance} />
            <View style={styles.pair}>
              <View style={styles.half}>
                <View style={[styles.arrow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Ionicons name="arrow-down" size={14} color="#fff" /></View>
                <View>
                  <Text style={styles.halfLabel}>Income · this month</Text>
                  <AnimatedNumber value={month.income} format={(v) => formatBirr(v, { compact: true })} style={styles.halfValue} />
                </View>
              </View>
              <View style={styles.half}>
                <View style={[styles.arrow, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Ionicons name="arrow-up" size={14} color="#fff" /></View>
                <View>
                  <Text style={styles.halfLabel}>Expenses · this month</Text>
                  <AnimatedNumber value={month.expense} format={(v) => formatBirr(v, { compact: true })} style={styles.halfValue} />
                </View>
              </View>
            </View>
          </View>
        </HeaderScene>

        <View style={{ paddingHorizontal: 20 }}>
          <IncomeCard />

          {!s.settings.smsEnabled && isSmsSupported() ? (
            <PressableScale onPress={() => router.push('/(tabs)/profile')} style={styles.notice}>
              <Ionicons name="chatbubbles" size={20} color="#B7791F" />
              <Text style={styles.noticeText}>{tr('Turn on SMS tracking so your bank messages are added automatically.')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#B7791F" />
            </PressableScale>
          ) : null}

          {s.unparsed.length > 0 ? (
            <PressableScale onPress={() => router.push('/sms-review')} style={styles.notice}>
              <Ionicons name="alert-circle" size={20} color="#B7791F" />
              <Text style={styles.noticeText}>{t(s.unparsed.length > 1 ? '{n} bank messages could not be read. Tap to review.' : '1 bank message could not be read. Tap to review.', { n: s.unparsed.length })}</Text>
              <Ionicons name="chevron-forward" size={18} color="#B7791F" />
            </PressableScale>
          ) : null}

          <View style={styles.tiles}>
            <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="speedometer" size={20} color={colors.primaryDark} />
              <Text style={styles.tileLabel}>Safe to spend / day</Text>
              <Text style={styles.tileValue}>{formatBirr(safe.perDay, { compact: true })}</Text>
              <Text style={styles.tileSub}>{t('{n} day(s) to go', { n: safe.days })}</Text>
            </View>
            <PressableScale onPress={() => router.push('/budgets')} style={[styles.tile, { backgroundColor: '#FFF4E2' }]}>
              <Ionicons name="pie-chart" size={20} color="#B7791F" />
              <Text style={styles.tileLabel}>Budgets</Text>
              <Text style={styles.tileValue}>{s.budgets.filter((b) => !b.deleted && b.workspace === ws).length}</Text>
              <Text style={styles.tileSub}>Tap to manage</Text>
            </PressableScale>
          </View>

          {biz ? (
            <View style={styles.tiles}>
              <PressableScale onPress={() => router.push('/debts')} style={[styles.tile, { backgroundColor: '#E3F5EC' }]}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.income} />
                <Text style={styles.tileLabel}>Customers owe you</Text>
                <Text style={[styles.tileValue, { color: colors.income }]}>{formatBirr(debts.owedToMe, { compact: true })}</Text>
              </PressableScale>
              <PressableScale onPress={() => router.push('/debts')} style={[styles.tile, { backgroundColor: '#FDECEC' }]}>
                <Ionicons name="arrow-up-circle" size={20} color={colors.expense} />
                <Text style={styles.tileLabel}>You owe suppliers</Text>
                <Text style={[styles.tileValue, { color: colors.expense }]}>{formatBirr(debts.iOwe, { compact: true })}</Text>
              </PressableScale>
            </View>
          ) : null}

          <SectionHeader title="Transactions history" action="See all" onAction={() => router.push('/(tabs)/wallet')} />
          {recent.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No transactions yet" text="Allow SMS tracking, add a transaction by hand, or try the sample bank messages."
              action="Load sample messages" onAction={() => s.loadDemo()} />
          ) : recent.map((tx, i) => <TxRow key={tx.id} tx={tx} index={i} categories={s.categories} accounts={s.accounts} />)}

          {bills.length > 0 ? (
            <>
              <SectionHeader title="Bills coming up" action="Pay" onAction={() => router.push('/(tabs)/wallet')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
                {bills.map((b) => {
                  const c = categoryById(s.categories, b.categoryId);
                  return (
                    <View key={b.id} style={[styles.billCard, shadow.soft]}>
                      <CategoryIcon icon={b.icon} color={c.color} size={40} />
                      <Text style={styles.billName} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.billAmount}>{formatBirr(b.amount)}</Text>
                      <Text style={[styles.billDue, b.nextDue < Date.now() - 86400000 && { color: colors.expense }]}>{fmtRelativeDay(b.nextDue)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {tip ? (
            <View style={styles.tip}>
              <Ionicons name="bulb" size={22} color={colors.primaryDark} />
              <Text style={styles.tipText}>
                {t('You spent {amount} on {category} this month. Cutting it by 10% would save about {saving}.', { amount: formatBirr(tip.current), category: tr(categoryById(s.categories, tip.categoryId).name), saving: formatBirr(tip.saving) })}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  hello: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  card: { marginHorizontal: 20, marginTop: 20, borderRadius: radius.lg, padding: 18, backgroundColor: colors.primaryDark },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  balance: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 8 },
  pair: { flexDirection: 'row', marginTop: 18, gap: 10 },
  half: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  halfLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10.5 },
  halfValue: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 1 },
  income: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: 18, borderWidth: 1, borderColor: colors.line, gap: 10 },
  incomeTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incomeTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  incomeMid: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  days: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  incomeSub: { fontSize: 12.5, color: colors.muted },
  incomeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  incomeSmall: { fontSize: 12, color: colors.muted },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF3DF', padding: 12, borderRadius: 14, marginTop: 16 },
  noticeText: { flex: 1, color: '#8A5A12', fontSize: 13, fontWeight: '500' },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 18 },
  tile: { flex: 1, borderRadius: 20, padding: 14 },
  tileLabel: { fontSize: 12, color: colors.muted, marginTop: 10, fontWeight: '500' },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
  tileSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  billCard: { width: 138, backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  billName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 10 },
  billAmount: { fontSize: 13, color: colors.text, marginTop: 2 },
  billDue: { fontSize: 12, color: colors.muted, marginTop: 4 },
  tip: { flexDirection: 'row', gap: 12, backgroundColor: colors.primarySoft, borderRadius: 18, padding: 14, marginTop: 22, alignItems: 'center' },
  tipText: { flex: 1, color: colors.primaryDeep, fontSize: 13.5, lineHeight: 20 },
});
