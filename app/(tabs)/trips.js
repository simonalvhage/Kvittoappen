import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, shadow } from '../../src/lib/theme';
import { listTrips } from '../../src/lib/db';
import { formatSEK } from '../../src/lib/fx';
import { EmptyState } from '../../src/components/EmptyState';
import { Button } from '../../src/components/Button';

export default function TripsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [trips, setTrips] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listTrips();
      setTrips(rows);
    } catch (e) {
      console.warn('load trips', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    const dateRange = item.start_date
      ? item.end_date && item.end_date !== item.start_date
        ? `${item.start_date} – ${item.end_date}`
        : item.start_date
      : 'Inget datum';

    return (
      <Pressable
        onPress={() => router.push(`/trip/${item.id}`)}
        style={({ pressed }) => [
          styles.card,
          shadow.card,
          { backgroundColor: c.card, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.emoji]}>{item.emoji || (item.kind === 'kvall' ? '🍻' : '✈️')}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tripName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.tripMeta, { color: c.textSecondary }]}>{dateRange}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </View>
        <View style={[styles.cardBottom, { borderTopColor: c.separator }]}>
          <View>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Kvitton</Text>
            <Text style={[styles.statValue, { color: c.text }]}>{item.receipt_count || 0}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>Totalt</Text>
            <Text style={[styles.statValue, { color: c.text }]}>{formatSEK(item.total_sek)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={trips}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={trips.length === 0 ? styles.emptyWrap : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        ListEmptyComponent={
          <EmptyState
            icon="airplane-outline"
            title="Inga resor än"
            message="Skapa din första resa eller utekväll."
          >
            <Button title="Skapa resa" onPress={() => router.push('/trip/new')} />
          </EmptyState>
        }
      />

      {trips.length > 0 ? (
        <Pressable
          onPress={() => router.push('/trip/new')}
          accessibilityLabel="Skapa ny resa"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.fab,
            shadow.floating,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.md },
  emptyWrap: { flexGrow: 1 },
  card: { borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 28 },
  tripName: { ...font.title3 },
  tripMeta: { ...font.footnote, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { ...font.caption },
  statValue: { ...font.headline, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
});
