import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius, shadow } from '../../src/lib/theme';
import { statsTotal, statsByStore } from '../../src/lib/db';
import { formatSEK } from '../../src/lib/fx';
import { EmptyState } from '../../src/components/EmptyState';

export default function StatsScreen() {
  const { c } = useTheme();
  const [total, setTotal] = useState({ count: 0, total_sek: 0 });
  const [byStore, setByStore] = useState([]);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([statsTotal(), statsByStore()]);
      setTotal(t || { count: 0, total_sek: 0 });
      setByStore(s || []);
    } catch (e) {
      console.warn('stats', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (total.count === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <EmptyState
          icon="stats-chart-outline"
          title="Ingen statistik än"
          message="Skanna dina första kvitton för att se statistik."
        />
      </View>
    );
  }

  const max = byStore[0]?.total_sek || 1;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.container}>
      <View style={[styles.hero, shadow.card, { backgroundColor: c.card }]}>
        <Text style={[styles.heroLabel, { color: c.textSecondary }]}>TOTALT SPENDERAT</Text>
        <Text style={[styles.heroAmount, { color: c.text }]}>{formatSEK(total.total_sek)}</Text>
        <Text style={[styles.heroSub, { color: c.textSecondary }]}>{total.count} kvitton</Text>
      </View>

      <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>PER BUTIK</Text>
      <View style={[styles.card, { backgroundColor: c.card }]}>
        {byStore.map((s, i) => (
          <View key={s.store}>
            <View style={styles.storeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.storeName, { color: c.text }]} numberOfLines={1}>{s.store}</Text>
                <View style={[styles.barBg, { backgroundColor: c.bg }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(6, Math.round((s.total_sek / max) * 100))}%`, backgroundColor: c.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.storeMeta, { color: c.textSecondary }]}>{s.count} kvitton</Text>
              </View>
              <Text style={[styles.storeAmount, { color: c.text }]}>{formatSEK(s.total_sek)}</Text>
            </View>
            {i < byStore.length - 1 ? (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator }} />
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.xl },
  heroLabel: { ...font.footnote, letterSpacing: 0.5 },
  heroAmount: { ...font.largeTitle, marginTop: spacing.sm },
  heroSub: { ...font.callout, marginTop: 4 },
  sectionHeader: { ...font.footnote, marginLeft: spacing.sm, marginBottom: spacing.sm, letterSpacing: 0.5 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  storeRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  storeName: { ...font.body, fontWeight: '600' },
  storeMeta: { ...font.caption, marginTop: 4 },
  storeAmount: { ...font.headline },
  barBg: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
