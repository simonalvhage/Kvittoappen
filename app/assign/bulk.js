import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius } from '../../src/lib/theme';
import { listTrips, assignReceipt } from '../../src/lib/db';

export default function AssignBulkScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { ids } = useLocalSearchParams();

  const [trips, setTrips] = useState([]);
  const idList = String(ids || '').split(',').map((x) => Number(x)).filter(Boolean);

  const load = useCallback(async () => {
    const ts = await listTrips();
    setTrips(ts);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickTrip = async (tripId) => {
    try {
      Haptics.selectionAsync().catch(() => {});
      for (const rid of idList) {
        await assignReceipt(rid, { tripId, tripDay: null });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Kunde inte spara', String(e?.message || e));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `Lägg ${idList.length} kvitton i resa`,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={{ ...font.body, color: c.accent }}>Avbryt</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/trip/new', params: { assignIds: idList.join(',') } })
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
                    <Text style={[font.body, { color: c.text, fontWeight: '600' }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    {t.start_date ? (
                      <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                        {t.end_date && t.end_date !== t.start_date
                          ? `${t.start_date} – ${t.end_date}`
                          : t.start_date}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                </Pressable>
                {i < trips.length - 1 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 64 }} />
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ ...font.callout, color: c.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
            Inga resor än. Skapa en för att lägga till kvittona.
          </Text>
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
});
