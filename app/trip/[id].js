import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius, shadow } from '../../src/lib/theme';
import { getTrip, listReceiptsByTrip, deleteTrip, getTripTagTotals } from '../../src/lib/db';
import { formatSEK } from '../../src/lib/fx';
import { EmptyState } from '../../src/components/EmptyState';

function enumerateDays(start, end) {
  if (!start) return [];
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  const days = [];
  const cur = new Date(s);
  while (cur <= e) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function prettyDay(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function TripDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [trip, setTrip] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [tagTotals, setTagTotals] = useState({ tags: [], untagged: 0 });

  const load = useCallback(async () => {
    const t = await getTrip(id);
    setTrip(t);
    if (t) {
      const [rs, tt] = await Promise.all([
        listReceiptsByTrip(id),
        getTripTagTotals(id),
      ]);
      setReceipts(rs);
      setTagTotals(tt);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!trip) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textSecondary }}>Laddar…</Text>
      </View>
    );
  }

  const total = receipts.reduce((sum, r) => sum + (r.total_sek ?? r.total ?? 0), 0);
  const days = enumerateDays(trip.start_date, trip.end_date);

  // Group receipts by day (trip_day if set, else purchased_at, else "okänd")
  const groups = new Map();
  const unassigned = [];
  for (const r of receipts) {
    const day = r.trip_day || r.purchased_at || null;
    if (day) {
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(r);
    } else {
      unassigned.push(r);
    }
  }

  const displayDays = days.length > 0 ? days : Array.from(groups.keys()).sort();

  const openScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: '/scan', params: { tripId: String(id) } });
  };

  const onDelete = () => {
    Alert.alert('Ta bort resa?', 'Kvitton i resan flyttas tillbaka till inboxen.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Ionicons name="trash-outline" size={22} color={c.danger} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <View style={[styles.hero, { backgroundColor: c.card }, shadow.card]}>
          <Text style={styles.emoji}>{trip.emoji || '✈️'}</Text>
          <Text style={[font.title1, { color: c.text, marginTop: spacing.sm }]}>{trip.name}</Text>
          {trip.start_date ? (
            <Text style={[font.callout, { color: c.textSecondary, marginTop: 2 }]}>
              {trip.end_date && trip.end_date !== trip.start_date
                ? `${trip.start_date} – ${trip.end_date}`
                : trip.start_date}
            </Text>
          ) : null}
          <View style={[styles.heroStats, { borderTopColor: c.separator }]}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[font.caption, { color: c.textSecondary }]}>KVITTON</Text>
              <Text style={[font.title2, { color: c.text, marginTop: 4 }]}>{receipts.length}</Text>
            </View>
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: c.separator }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[font.caption, { color: c.textSecondary }]}>TOTALT</Text>
              <Text style={[font.title2, { color: c.text, marginTop: 4 }]}>{formatSEK(total)}</Text>
            </View>
          </View>
        </View>

        {receipts.length === 0 ? (
          <View style={{ paddingTop: spacing.xl }}>
            <EmptyState
              icon="receipt-outline"
              title="Inga kvitton än"
              message="Skanna ett kvitto och lägg till det här från inboxen."
            />
          </View>
        ) : null}

        {tagTotals.tags.length > 0 || tagTotals.untagged > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.dayHeader, { color: c.textSecondary }]}>PER TAGG</Text>
            <View style={[styles.card, { backgroundColor: c.card, padding: spacing.lg, gap: spacing.md }]}>
              {(() => {
                const rows = [
                  ...tagTotals.tags.map((t) => ({ key: `t-${t.id}`, name: t.name, color: t.color, total: t.total })),
                  ...(tagTotals.untagged > 0
                    ? [{ key: 'untagged', name: 'Otaggat', color: c.textTertiary, total: tagTotals.untagged }]
                    : []),
                ];
                const max = Math.max(...rows.map((r) => r.total), 1);
                return rows.map((r) => (
                  <View key={r.key} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color }} />
                      <Text style={[font.body, { color: c.text, flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                      <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>{formatSEK(r.total)}</Text>
                    </View>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.separator, overflow: 'hidden' }}>
                      <View style={{
                        height: '100%',
                        width: `${Math.round((r.total / max) * 100)}%`,
                        backgroundColor: r.color,
                      }} />
                    </View>
                  </View>
                ));
              })()}
            </View>
          </View>
        ) : null}

        {displayDays.map((day) => {
          const dayReceipts = groups.get(day) || [];
          if (dayReceipts.length === 0 && days.length === 0) return null;
          return (
            <View key={day} style={{ marginTop: spacing.lg }}>
              <Text style={[styles.dayHeader, { color: c.textSecondary }]}>
                {prettyDay(day).toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: c.card }]}>
                {dayReceipts.length === 0 ? (
                  <Text style={{ ...font.callout, color: c.textTertiary, padding: spacing.lg }}>
                    Inga kvitton
                  </Text>
                ) : (
                  dayReceipts.map((r, i) => (
                    <ReceiptListItem key={r.id} receipt={r} isLast={i === dayReceipts.length - 1} c={c} router={router} />
                  ))
                )}
              </View>
            </View>
          );
        })}

        {unassigned.length > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.dayHeader, { color: c.textSecondary }]}>UTAN DATUM</Text>
            <View style={[styles.card, { backgroundColor: c.card }]}>
              {unassigned.map((r, i) => (
                <ReceiptListItem key={r.id} receipt={r} isLast={i === unassigned.length - 1} c={c} router={router} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={openScan}
        style={({ pressed }) => [
          styles.fab,
          shadow.floating,
          { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1, bottom: insets.bottom + spacing.lg },
        ]}
      >
        <Ionicons name="scan" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

function ReceiptListItem({ receipt, isLast, c, router }) {
  const sekValue = receipt.total_sek ?? receipt.total;
  return (
    <>
      <Pressable
        onPress={() => router.push(`/receipt/${receipt.id}`)}
        style={({ pressed }) => [styles.receiptRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
            {receipt.store || 'Okänd butik'}
          </Text>
          {receipt.purchased_at ? (
            <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>{receipt.purchased_at}</Text>
          ) : null}
        </View>
        <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>{formatSEK(sekValue)}</Text>
        <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
      </Pressable>
      {!isLast ? (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emoji: { fontSize: 56 },
  heroStats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  dayHeader: { ...font.footnote, letterSpacing: 0.5, marginLeft: spacing.sm, marginBottom: spacing.sm },
  receiptRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, gap: spacing.sm,
  },
});
