import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius, shadow } from '../../src/lib/theme';
import {
  getTrip, listReceiptsByTrip, deleteTrip,
  getTripTagTotals, getTripDailyTotals, getTripStoreStats,
} from '../../src/lib/db';
import { formatSEK } from '../../src/lib/fx';
import { EmptyState } from '../../src/components/EmptyState';
import { SegmentedControl } from '../../src/components/SegmentedControl';

function prettyDay(iso, opts = {}) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('sv-SE', {
    weekday: opts.weekday || 'long',
    day: 'numeric',
    month: opts.monthShort ? 'short' : 'long',
  });
}

export default function TripDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const [trip, setTrip] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [tagTotals, setTagTotals] = useState({ tags: [], untagged: 0 });
  const [dailyTotals, setDailyTotals] = useState([]);
  const [storeStats, setStoreStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('overview');

  const load = useCallback(async () => {
    const t = await getTrip(id);
    setTrip(t);
    if (t) {
      const [rs, tt, dt, ss] = await Promise.all([
        listReceiptsByTrip(id),
        getTripTagTotals(id),
        getTripDailyTotals(id),
        getTripStoreStats(id),
      ]);
      setReceipts(rs);
      setTagTotals(tt);
      setDailyTotals(dt);
      setStoreStats(ss);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!trip && loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.textSecondary} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textSecondary }}>Resan hittades inte.</Text>
      </View>
    );
  }

  const total = receipts.reduce((sum, r) => sum + (r.total_sek ?? r.total ?? 0), 0);

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

  const segmentOptions = [
    { value: 'overview', label: 'Översikt' },
    { value: 'days', label: 'Dagar' },
    { value: 'people', label: 'Personer' },
    { value: 'stores', label: 'Butiker' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              onPress={onDelete}
              accessibilityLabel="Ta bort resa"
              accessibilityRole="button"
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Ionicons name="trash-outline" size={22} color={c.danger} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
      >
        <Hero trip={trip} receipts={receipts} total={total} loading={loading} c={c} />

        <View style={{ marginTop: spacing.lg }}>
          <SegmentedControl
            options={segmentOptions}
            value={segment}
            onChange={setSegment}
          />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          {segment === 'overview' && (
            <OverviewView
              receipts={receipts}
              total={total}
              tagTotals={tagTotals}
              dailyTotals={dailyTotals}
              storeStats={storeStats}
              onScan={openScan}
              c={c}
            />
          )}
          {segment === 'days' && (
            <DaysView
              trip={trip}
              receipts={receipts}
              dailyTotals={dailyTotals}
              c={c}
              router={router}
            />
          )}
          {segment === 'people' && (
            <PeopleView
              tagTotals={tagTotals}
              total={total}
              tripId={id}
              c={c}
              router={router}
            />
          )}
          {segment === 'stores' && (
            <StoresView storeStats={storeStats} c={c} />
          )}
        </View>
      </ScrollView>

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
    </View>
  );
}

function Hero({ trip, receipts, total, loading, c }) {
  return (
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
          {loading ? (
            <ActivityIndicator color={c.textSecondary} style={{ marginTop: 4 }} />
          ) : (
            <Text
              style={[font.title2, { color: c.text, marginTop: 4 }]}
              accessibilityLabel={`Totalt ${Math.round(total)} kronor`}
            >
              {formatSEK(total)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function OverviewView({ receipts, total, tagTotals, dailyTotals, storeStats, onScan, c }) {
  if (receipts.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="Inga kvitton än"
        message="Skanna ett kvitto för att börja spåra spenderingar i resan."
      >
        <Pressable
          onPress={onScan}
          accessibilityRole="button"
          accessibilityLabel="Skanna nytt kvitto"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="scan" size={20} color="#fff" />
          <Text style={{ ...font.headline, color: '#fff' }}>Skanna kvitto</Text>
        </Pressable>
      </EmptyState>
    );
  }

  const topDay = [...dailyTotals].sort((a, b) => b.total - a.total)[0];
  const topStore = storeStats[0];
  const tagRows = [
    ...tagTotals.tags.map((t) => ({ key: `t-${t.id}`, name: t.name, color: t.color, total: t.total })),
    ...(tagTotals.untagged > 0
      ? [{ key: 'untagged', name: 'Otaggat', color: c.textTertiary, total: tagTotals.untagged }]
      : []),
  ];
  const tagTotalSum = tagRows.reduce((s, r) => s + r.total, 0);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.statCardLarge, { backgroundColor: c.card }]}>
        <Text style={[font.caption, { color: c.textSecondary, letterSpacing: 0.5 }]}>TOTALT SPENDERAT</Text>
        <Text
          style={[font.largeTitle, { color: c.text, marginTop: spacing.xs }]}
          accessibilityLabel={`Totalt spenderat ${Math.round(total)} kronor`}
        >
          {formatSEK(total)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatCard
          label="Dyraste dag"
          value={topDay ? formatSEK(topDay.total) : '–'}
          sub={topDay ? prettyDay(topDay.day, { weekday: 'short', monthShort: true }) : 'Ingen data'}
          c={c}
        />
        <StatCard
          label="Topp-butik"
          value={topStore ? formatSEK(topStore.total) : '–'}
          sub={topStore ? topStore.store : 'Ingen data'}
          c={c}
        />
      </View>

      {tagRows.length > 0 && tagTotalSum > 0 ? (
        <View style={[styles.sectionCard, { backgroundColor: c.card }]}>
          <Text style={[font.caption, { color: c.textSecondary, letterSpacing: 0.5, marginBottom: spacing.md }]}>
            FÖRDELNING
          </Text>
          <View
            style={[styles.stackBar, { backgroundColor: c.separator }]}
            accessibilityLabel={`Fördelning: ${tagRows.map((r) => `${r.name} ${Math.round((r.total / tagTotalSum) * 100)} procent`).join(', ')}`}
          >
            {tagRows.map((r) => (
              <View
                key={r.key}
                style={{
                  width: `${(r.total / tagTotalSum) * 100}%`,
                  height: '100%',
                  backgroundColor: r.color,
                }}
              />
            ))}
          </View>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {tagRows.map((r) => (
              <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color }} />
                <Text style={[font.body, { color: c.text, flex: 1 }]}>{r.name}</Text>
                <Text style={[font.callout, { color: c.textSecondary }]}>
                  {Math.round((r.total / tagTotalSum) * 100)}%
                </Text>
                <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
                  {formatSEK(r.total)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatCard({ label, value, sub, c }) {
  return (
    <View style={[styles.statCard, { backgroundColor: c.card }]}>
      <Text style={[font.caption, { color: c.textSecondary, letterSpacing: 0.5 }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[font.title3, { color: c.text, marginTop: spacing.xs }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

function DaysView({ trip, receipts, dailyTotals, c, router }) {
  if (receipts.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="Inga dagar att visa"
        message="När du lagt till kvitton visas spenderingar per dag här."
      />
    );
  }

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

  const daysToShow = [...new Set([
    ...enumerateDays(trip.start_date, trip.end_date),
    ...groups.keys(),
  ])].sort();

  const maxDayTotal = Math.max(...dailyTotals.map((d) => d.total), 1);

  return (
    <View style={{ gap: spacing.md }}>
      {dailyTotals.length > 0 ? (
        <View style={[styles.sectionCard, { backgroundColor: c.card }]}>
          <Text style={[font.caption, { color: c.textSecondary, letterSpacing: 0.5, marginBottom: spacing.md }]}>
            PER DAG
          </Text>
          <View style={styles.barChart}>
            {dailyTotals.map((d) => {
              const h = Math.max(4, (d.total / maxDayTotal) * 100);
              return (
                <View key={d.day} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.bar, { height: `${h}%`, backgroundColor: c.accent }]}
                      accessibilityLabel={`${prettyDay(d.day)}: ${Math.round(d.total)} kronor`}
                    />
                  </View>
                  <Text style={[font.caption, { color: c.textSecondary, marginTop: 4 }]} numberOfLines={1}>
                    {new Date(d.day + 'T00:00:00').getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {daysToShow.map((day) => {
        const dayReceipts = groups.get(day) || [];
        const dayTotal = dayReceipts.reduce((s, r) => s + (r.total_sek ?? r.total ?? 0), 0);
        return (
          <View key={day}>
            <View style={styles.dayHeaderRow}>
              <Text style={[font.footnote, { color: c.textSecondary, letterSpacing: 0.5, flex: 1 }]}>
                {prettyDay(day).toUpperCase()}
              </Text>
              {dayTotal > 0 ? (
                <Text style={[font.footnote, { color: c.textSecondary, fontWeight: '600' }]}>
                  {formatSEK(dayTotal)}
                </Text>
              ) : null}
            </View>
            <View style={[styles.sectionCard, { backgroundColor: c.card, padding: 0 }]}>
              {dayReceipts.length === 0 ? (
                <Text style={{ ...font.callout, color: c.textTertiary, padding: spacing.lg }}>
                  Inga kvitton
                </Text>
              ) : (
                dayReceipts.map((r, i) => (
                  <ReceiptListItem
                    key={r.id}
                    receipt={r}
                    isLast={i === dayReceipts.length - 1}
                    c={c}
                    router={router}
                  />
                ))
              )}
            </View>
          </View>
        );
      })}

      {unassigned.length > 0 ? (
        <View>
          <Text style={[font.footnote, { color: c.textSecondary, letterSpacing: 0.5, marginLeft: spacing.sm, marginBottom: spacing.sm }]}>
            UTAN DATUM
          </Text>
          <View style={[styles.sectionCard, { backgroundColor: c.card, padding: 0 }]}>
            {unassigned.map((r, i) => (
              <ReceiptListItem
                key={r.id}
                receipt={r}
                isLast={i === unassigned.length - 1}
                c={c}
                router={router}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PeopleView({ tagTotals, total, tripId, c, router }) {
  const rows = [
    ...tagTotals.tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      total: t.total,
      shared: t.shared || 0,
      receiptCount: t.receipt_count || 0,
      navigable: true,
    })),
    ...(tagTotals.untagged > 0
      ? [{ id: null, name: 'Otaggat', color: c.textTertiary, total: tagTotals.untagged, shared: 0, receiptCount: 0, navigable: false }]
      : []),
  ];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="Inga taggar än"
        message="Lägg till taggar på dina kvitton för att se vem som köpt vad."
      >
        <Pressable
          onPress={() => router.push('/tags/manage')}
          accessibilityRole="button"
          accessibilityLabel="Hantera taggar"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ ...font.headline, color: '#fff' }}>Hantera taggar</Text>
        </Pressable>
      </EmptyState>
    );
  }

  const base = total || rows.reduce((s, r) => s + r.total, 0) || 1;

  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((r) => {
        const pct = Math.round((r.total / base) * 100);
        const content = (
          <View style={[styles.sectionCard, { backgroundColor: c.card, gap: spacing.sm }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.personAvatar, { backgroundColor: r.color }]}>
                <Text style={{ ...font.headline, color: '#fff' }}>
                  {r.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                  {pct}% av resan
                  {r.shared > 0 ? ` · varav ${formatSEK(r.shared)} delat` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={[font.title3, { color: c.text }]}
                  accessibilityLabel={`${r.name}: ${Math.round(r.total)} kronor`}
                >
                  {formatSEK(r.total)}
                </Text>
                {r.navigable ? (
                  <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                ) : null}
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: c.separator }]}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: r.color }} />
            </View>
          </View>
        );

        if (!r.navigable) return <View key={String(r.id)}>{content}</View>;

        return (
          <Pressable
            key={String(r.id)}
            onPress={() => router.push(`/trip/${tripId}/tag/${r.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}, se detaljer`}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

function StoresView({ storeStats, c }) {
  if (storeStats.length === 0) {
    return (
      <EmptyState
        icon="storefront-outline"
        title="Inga butiker"
        message="Butiksstatistik visas här när du lagt till kvitton."
      />
    );
  }

  return (
    <View style={[styles.sectionCard, { backgroundColor: c.card, padding: 0 }]}>
      {storeStats.map((s, i) => (
        <View key={s.store}>
          <View style={styles.storeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                {s.store}
              </Text>
              <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                {s.visit_count} {s.visit_count === 1 ? 'besök' : 'besök'} · snitt {formatSEK(s.avg)}
              </Text>
            </View>
            <Text
              style={[font.body, { color: c.text, fontWeight: '600' }]}
              accessibilityLabel={`${s.store}: ${Math.round(s.total)} kronor`}
            >
              {formatSEK(s.total)}
            </Text>
          </View>
          {i < storeStats.length - 1 ? (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ReceiptListItem({ receipt, isLast, c, router }) {
  const sekValue = receipt.total_sek ?? receipt.total;
  return (
    <>
      <Pressable
        onPress={() => router.push(`/receipt/${receipt.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${receipt.store || 'Okänd butik'}, ${Math.round(sekValue || 0)} kronor`}
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
  sectionCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  statCardLarge: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  stackBar: {
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  receiptRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, gap: spacing.sm,
  },
  personAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    gap: 4,
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
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
});
