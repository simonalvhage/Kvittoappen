import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius } from '../../src/lib/theme';
import { listTrips, assignReceipt, getReceipt } from '../../src/lib/db';

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
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function AssignScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { receiptId } = useLocalSearchParams();

  const [trips, setTrips] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const load = useCallback(async () => {
    const [ts, r] = await Promise.all([listTrips(), getReceipt(receiptId)]);
    setTrips(ts);
    setReceipt(r);
    if (r?.trip_day) setSelectedDay(r.trip_day);
  }, [receiptId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const days = selectedTrip ? enumerateDays(selectedTrip.start_date, selectedTrip.end_date) : [];

  const save = async (tripId, day) => {
    try {
      await assignReceipt(receiptId, { tripId, tripDay: day });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Kunde inte spara', String(e?.message || e));
    }
  };

  const removeFromTrip = () => {
    save(null, null);
  };

  const pickTrip = async (tripId) => {
    Haptics.selectionAsync().catch(() => {});
    const trip = trips.find((t) => t.id === tripId);
    const tripDays = trip ? enumerateDays(trip.start_date, trip.end_date) : [];
    if (tripDays.length <= 1) {
      // Direct assign
      await save(tripId, tripDays[0] || null);
      return;
    }
    setSelectedTripId(tripId);
    setSelectedDay(null);
  };

  const pickDay = async (day) => {
    await save(selectedTripId, day);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: selectedTrip ? 'Välj dag' : 'Lägg till i resa',
          headerLeft: () => (
            <Pressable onPress={() => (selectedTrip ? setSelectedTripId(null) : router.back())} hitSlop={10}>
              <Text style={{ ...font.body, color: c.accent }}>
                {selectedTrip ? 'Tillbaka' : 'Avbryt'}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        {!selectedTrip ? (
          <>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/trip/new', params: { assignReceiptId: String(receiptId) } })
              }
              style={({ pressed }) => [
                styles.createNew,
                { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="add-circle" size={24} color={c.accent} />
              <Text style={[font.body, { color: c.accent, fontWeight: '600' }]}>Skapa ny resa</Text>
            </Pressable>

            {trips.length > 0 ? (
              <View style={[styles.card, { backgroundColor: c.card }]}>
                {trips.map((t, i) => (
                  <View key={t.id}>
                    <Pressable
                      onPress={() => pickTrip(t.id)}
                      style={({ pressed }) => [styles.tripRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Text style={styles.tripEmoji}>{t.emoji || '✈️'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>{t.name}</Text>
                        {t.start_date ? (
                          <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                            {t.end_date && t.end_date !== t.start_date ? `${t.start_date} – ${t.end_date}` : t.start_date}
                          </Text>
                        ) : null}
                      </View>
                      {receipt?.trip_id === t.id ? (
                        <Ionicons name="checkmark-circle" size={22} color={c.accent} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                      )}
                    </Pressable>
                    {i < trips.length - 1 ? (
                      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 64 }} />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ ...font.callout, color: c.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
                Du har inga resor än. Skapa en för att lägga till kvittot.
              </Text>
            )}

            {receipt?.trip_id ? (
              <Pressable
                onPress={removeFromTrip}
                style={({ pressed }) => [
                  styles.removeRow,
                  { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[font.body, { color: c.danger, fontWeight: '600' }]}>Ta bort från resa</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: c.card }]}>
            {days.map((d, i) => (
              <View key={d}>
                <Pressable
                  onPress={() => pickDay(d)}
                  style={({ pressed }) => [styles.dayRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[font.body, { color: c.text }]}>{prettyDay(d)}</Text>
                  {selectedDay === d ? (
                    <Ionicons name="checkmark" size={22} color={c.accent} />
                  ) : null}
                </Pressable>
                {i < days.length - 1 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  createNew: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, borderRadius: radius.lg,
  },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  tripRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, gap: spacing.md,
  },
  tripEmoji: { fontSize: 28 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, minHeight: 52,
  },
  removeRow: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
