import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../src/hooks/useTheme';
import { spacing, font, radius, shadow } from '../../../../src/lib/theme';
import {
  getTrip, getReceiptsByTripAndTag, listTags,
} from '../../../../src/lib/db';
import { formatSEK } from '../../../../src/lib/fx';
import { EmptyState } from '../../../../src/components/EmptyState';

export default function TripTagDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const { id, tagId } = useLocalSearchParams();

  const [trip, setTrip] = useState(null);
  const [tag, setTag] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, rs, tags] = await Promise.all([
      getTrip(id),
      getReceiptsByTripAndTag(id, tagId),
      listTags(),
    ]);
    setTrip(t);
    setReceipts(rs);
    setTag(tags.find((x) => String(x.id) === String(tagId)) || null);
    setLoading(false);
  }, [id, tagId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.textSecondary} />
      </View>
    );
  }

  if (!tag || !trip) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textSecondary }}>Kunde inte hitta taggen.</Text>
      </View>
    );
  }

  const total = receipts.reduce((s, r) => s + (r.total_sek ?? r.total ?? 0), 0);
  const storeMap = new Map();
  for (const r of receipts) {
    const name = r.store || 'Okänd butik';
    if (!storeMap.has(name)) storeMap.set(name, { store: name, count: 0, total: 0 });
    const entry = storeMap.get(name);
    entry.count += 1;
    entry.total += r.total_sek ?? r.total ?? 0;
  }
  const stores = [...storeMap.values()].sort((a, b) => b.total - a.total);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: tag.name, headerBackTitle: 'Tillbaka' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: c.card }, shadow.card]}>
          <View style={[styles.avatar, { backgroundColor: tag.color }]}>
            <Text style={{ ...font.title1, color: '#fff' }}>
              {tag.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={[font.title2, { color: c.text, marginTop: spacing.sm }]}>{tag.name}</Text>
          <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
            {trip.emoji || '✈️'} {trip.name}
          </Text>
          <View style={[styles.heroStats, { borderTopColor: c.separator }]}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[font.caption, { color: c.textSecondary }]}>KVITTON</Text>
              <Text style={[font.title2, { color: c.text, marginTop: 4 }]}>{receipts.length}</Text>
            </View>
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: c.separator }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[font.caption, { color: c.textSecondary }]}>SUMMA</Text>
              <Text
                style={[font.title2, { color: c.text, marginTop: 4 }]}
                accessibilityLabel={`Totalt ${Math.round(total)} kronor`}
              >
                {formatSEK(total)}
              </Text>
            </View>
          </View>
        </View>

        {receipts.length === 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              icon="pricetag-outline"
              title="Inga kvitton med denna tagg"
              message="Tagga kvitton i resan för att se dem här."
            />
          </View>
        ) : null}

        {stores.length > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>BUTIKER</Text>
            <View style={[styles.card, { backgroundColor: c.card }]}>
              {stores.map((s, i) => (
                <View key={s.store}>
                  <View style={styles.storeRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                        {s.store}
                      </Text>
                      <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                        {s.count} {s.count === 1 ? 'besök' : 'besök'}
                      </Text>
                    </View>
                    <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
                      {formatSEK(s.total)}
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

        {receipts.length > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>KVITTON</Text>
            <View style={[styles.card, { backgroundColor: c.card }]}>
              {receipts.map((r, i) => {
                const sekValue = r.total_sek ?? r.total;
                return (
                  <View key={r.id}>
                    <Pressable
                      onPress={() => router.push(`/receipt/${r.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.store || 'Okänd butik'}, ${Math.round(sekValue || 0)} kronor`}
                      style={({ pressed }) => [styles.receiptRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                          {r.store || 'Okänd butik'}
                        </Text>
                        {r.purchased_at ? (
                          <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                            {r.purchased_at}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
                        {formatSEK(sekValue)}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                    </Pressable>
                    {i < receipts.length - 1 ? (
                      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
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
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
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
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  receiptRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, gap: spacing.sm,
  },
});
