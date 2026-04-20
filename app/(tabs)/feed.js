import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, RefreshControl, Pressable,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius, shadow } from '../../src/lib/theme';
import { listFeedReceipts, sumReceiptsForMonth } from '../../src/lib/db';
import { formatSEK } from '../../src/lib/fx';
import { EmptyState } from '../../src/components/EmptyState';
import { Button } from '../../src/components/Button';

const MONTH_LABELS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'];

function toDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function sectionize(receipts) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const groups = new Map();
  const order = [];

  function push(key, item) {
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(item);
  }

  for (const r of receipts) {
    const d = toDate(r.purchased_at || r.created_at);
    const effective = d || today;
    let key;
    if (sameDay(effective, today)) key = 'Idag';
    else if (sameDay(effective, yesterday)) key = 'Igår';
    else if (effective >= weekStart) key = 'Denna vecka';
    else if (effective >= monthStart) key = 'Tidigare denna månad';
    else key = `${MONTH_LABELS[effective.getMonth()]} ${effective.getFullYear()}`;
    push(key, r);
  }

  return order.map((title) => ({ title, data: groups.get(title) }));
}

export default function FeedScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [receipts, setReceipts] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const [rows, monthRow] = await Promise.all([
      listFeedReceipts(),
      sumReceiptsForMonth(now.getFullYear(), now.getMonth() + 1),
    ]);
    setReceipts(rows);
    setMonthTotal(monthRow?.total || 0);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(() => sectionize(receipts), [receipts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/scan');
  };

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.push('/trips')}
        accessibilityRole="button"
        accessibilityLabel="Gå till resor"
        style={({ pressed }) => [
          styles.quickCard,
          shadow.card,
          { backgroundColor: c.card, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="airplane-outline" size={22} color={c.accent} />
        <Text style={[font.body, { color: c.text, fontWeight: '600', flex: 1 }]}>Resor</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
      </Pressable>
      <View style={[styles.quickCard, shadow.card, { backgroundColor: c.card }]}>
        <Ionicons name="calendar-outline" size={22} color={c.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[font.footnote, { color: c.textSecondary }]}>Denna månad</Text>
          <Text
            style={[font.title3, { color: c.text, fontWeight: '700' }]}
            accessibilityLabel={`Denna månad, ${Math.round(monthTotal)} kronor`}
          >
            {formatSEK(monthTotal)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: c.bg }]}>
      <Text style={[font.footnote, { color: c.textSecondary, fontWeight: '600', letterSpacing: 0.5 }]}>
        {String(section.title).toUpperCase()}
      </Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const sekValue = item.total_sek ?? item.total;
    const persons = item.persons || [];
    return (
      <Pressable
        onPress={() => router.push(`/receipt/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${item.store || 'Okänd butik'}, ${Math.round(sekValue || 0)} kronor${persons.length ? `, ${persons.map((p) => p.name).join(', ')}` : ''}`}
        style={({ pressed }) => [
          styles.row, { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
          <Ionicons name="receipt" size={20} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
            {item.store || 'Okänd butik'}
          </Text>
          <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {item.purchased_at || '–'}
            {item.trip_name ? `  ·  ${item.trip_emoji || '✈️'} ${item.trip_name}` : ''}
          </Text>
          {persons.length > 0 ? (
            <View style={styles.personsRow}>
              {persons.slice(0, 3).map((p) => (
                <View key={p.id} style={[styles.personDot, { backgroundColor: p.color }]}>
                  <Text style={styles.personInitial}>{p.name.slice(0, 1).toUpperCase()}</Text>
                </View>
              ))}
              {persons.length > 3 ? (
                <Text style={[font.caption, { color: c.textSecondary, marginLeft: 4 }]}>
                  +{persons.length - 3}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
          {formatSEK(sekValue)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <SectionList
        sections={sections}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={header}
        contentContainerStyle={receipts.length === 0 ? styles.emptyWrap : styles.listContent}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 64 }} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="Inga kvitton än"
            message="Skanna ditt första för att komma igång."
          >
            <Button title="Skanna kvitto" onPress={openScan} />
          </EmptyState>
        }
      />
      {receipts.length > 0 ? (
        <Pressable
          onPress={openScan}
          accessibilityLabel="Skanna nytt kvitto"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.fab,
            shadow.floating,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1, bottom: insets.bottom + spacing.lg },
          ]}
        >
          <Ionicons name="scan" size={26} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: spacing.xxl },
  emptyWrap: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  quickCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 64,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  personsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  personDot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  personInitial: { fontSize: 10, color: '#fff', fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
});
