import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius, shadow } from '../../src/lib/theme';
import { statsOverall, statsMonthly, statsByStore, statsTopTags } from '../../src/lib/db';
import { formatSEK } from '../../src/lib/fx';
import { EmptyState } from '../../src/components/EmptyState';

const MONTH_LABELS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function lastTwelveMonths() {
  const months = [];
  const now = new Date();
  now.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key: `${y}-${m}`, monthIndex: d.getMonth(), year: y });
  }
  return months;
}

export default function StatsScreen() {
  const { c } = useTheme();
  const [overall, setOverall] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [stores, setStores] = useState([]);
  const [topTags, setTopTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [o, m, s, t] = await Promise.all([
        statsOverall(),
        statsMonthly(),
        statsByStore(),
        statsTopTags(5),
      ]);
      setOverall(o);
      setMonthly(m);
      setStores(s.slice(0, 5));
      setTopTags(t);
    } catch (e) {
      console.warn('stats load', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading && !overall) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.textSecondary} />
      </View>
    );
  }

  if (!overall || overall.receipt_count === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <EmptyState
          icon="stats-chart-outline"
          title="Ingen statistik än"
          message="Skanna dina första kvitton så visas statistik här."
        />
      </View>
    );
  }

  const monthMap = new Map(monthly.map((m) => [m.month, m]));
  const months = lastTwelveMonths().map((m) => ({
    ...m,
    total: monthMap.get(m.key)?.total || 0,
  }));
  const maxMonth = Math.max(...months.map((m) => m.total), 1);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: c.card }, shadow.card]}>
        <Text style={[font.caption, { color: c.textSecondary, letterSpacing: 0.5 }]}>TOTALT SPENDERAT</Text>
        <Text
          style={[font.largeTitle, { color: c.text, marginTop: spacing.xs }]}
          accessibilityLabel={`Totalt spenderat ${Math.round(overall.total)} kronor`}
        >
          {formatSEK(overall.total)}
        </Text>
        <View style={[styles.heroStats, { borderTopColor: c.separator }]}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[font.caption, { color: c.textSecondary }]}>KVITTON</Text>
            <Text style={[font.title2, { color: c.text, marginTop: 4 }]}>{overall.receipt_count}</Text>
          </View>
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: c.separator }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[font.caption, { color: c.textSecondary }]}>RESOR</Text>
            <Text style={[font.title2, { color: c.text, marginTop: 4 }]}>{overall.trip_count}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>12 MÅNADER</Text>
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={styles.barChart}>
            {months.map((m) => {
              const h = Math.max(2, (m.total / maxMonth) * 100);
              return (
                <View key={m.key} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.bar, { height: `${h}%`, backgroundColor: m.total > 0 ? c.accent : c.separator }]}
                      accessibilityLabel={`${MONTH_LABELS[m.monthIndex]} ${m.year}: ${Math.round(m.total)} kronor`}
                    />
                  </View>
                  <Text
                    style={[font.caption, { color: c.textSecondary, marginTop: 4 }]}
                    numberOfLines={1}
                  >
                    {MONTH_LABELS[m.monthIndex]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {stores.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>TOPP 5 BUTIKER</Text>
          <View style={[styles.card, { backgroundColor: c.card }]}>
            {stores.map((s, i) => (
              <View key={s.store}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                      {s.store}
                    </Text>
                    <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                      {s.count} {s.count === 1 ? 'kvitto' : 'kvitton'}
                    </Text>
                  </View>
                  <Text
                    style={[font.body, { color: c.text, fontWeight: '600' }]}
                    accessibilityLabel={`${s.store}: ${Math.round(s.total_sek)} kronor`}
                  >
                    {formatSEK(s.total_sek)}
                  </Text>
                </View>
                {i < stores.length - 1 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {topTags.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>TOPP 5 TAGGAR</Text>
          <View style={[styles.card, { backgroundColor: c.card }]}>
            {topTags.map((t, i) => (
              <View key={t.id}>
                <View style={styles.row}>
                  <View style={[styles.avatar, { backgroundColor: t.color }]}>
                    <Text style={{ ...font.footnote, color: '#fff', fontWeight: '700' }}>
                      {t.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                      {t.receipt_count} {t.receipt_count === 1 ? 'kvitto' : 'kvitton'}
                    </Text>
                  </View>
                  <Text
                    style={[font.body, { color: c.text, fontWeight: '600' }]}
                    accessibilityLabel={`${t.name}: ${Math.round(t.total)} kronor`}
                  >
                    {formatSEK(t.total)}
                  </Text>
                </View>
                {i < topTags.length - 1 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 60 }} />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: { ...font.footnote, letterSpacing: 0.5, marginLeft: spacing.sm, marginBottom: spacing.sm },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 3,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    height: 120,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 2,
  },
});
