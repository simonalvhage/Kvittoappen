import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/hooks/useTheme';
import { spacing, font, radius } from '../../../src/lib/theme';
import {
  getReceipt, getReceiptItems, getReceiptPersons,
  getItemPersons, setItemPersons,
} from '../../../src/lib/db';
import { formatMoney } from '../../../src/lib/fx';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';

function buildCycleStates(receiptPersonIds) {
  const states = [new Set()];
  for (const pid of receiptPersonIds) states.push(new Set([pid]));
  if (receiptPersonIds.length >= 2) states.push(new Set(receiptPersonIds));
  return states;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export default function ReceiptSplitScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { id, next } = useLocalSearchParams();

  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [receiptPersons, setReceiptPersons] = useState([]);
  const [assignments, setAssignments] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [r, its, ps] = await Promise.all([
      getReceipt(id), getReceiptItems(id), getReceiptPersons(id),
    ]);
    setReceipt(r);
    setItems(its);
    setReceiptPersons(ps);
    const map = new Map();
    for (const it of its) {
      const current = await getItemPersons(it.id);
      map.set(it.id, new Set(current.map((p) => p.id)));
    }
    setAssignments(map);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cycleItem = (itemId) => {
    Haptics.selectionAsync().catch(() => {});
    const states = buildCycleStates(receiptPersons.map((p) => p.id));
    setAssignments((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) || new Set();
      const idx = states.findIndex((s) => setsEqual(s, current));
      const nextIdx = (idx + 1) % states.length;
      next.set(itemId, states[nextIdx]);
      return next;
    });
  };

  const onDone = async () => {
    setSaving(true);
    try {
      for (const [itemId, set] of assignments.entries()) {
        await setItemPersons(itemId, [...set]);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (next) router.replace(String(next));
      else router.back();
    } catch (e) {
      Alert.alert('Kunde inte spara', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: 'Dela per vara' }} />
        <ActivityIndicator color={c.textSecondary} />
      </View>
    );
  }

  if (receiptPersons.length < 2) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: 'Dela per vara' }} />
        <EmptyState
          icon="people-outline"
          title="Välj minst två personer först"
          message="Gå tillbaka och välj minst två personer på kvittot för att kunna dela upp per vara."
        >
          <Button title="Tillbaka" onPress={() => router.back()} />
        </EmptyState>
      </View>
    );
  }

  const getItemPersonsSet = (itemId) => assignments.get(itemId) || new Set();

  return (
    <>
      <Stack.Screen options={{ title: 'Dela per vara' }} />
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[font.callout, { color: c.textSecondary, marginBottom: spacing.md }]}>
            Tryck på en rad för att byta mellan personer.
            Rader utan egen tilldelning delas enligt kvittot
            ({receiptPersons.map((p) => p.name).join(' · ')}).
          </Text>

          <View style={styles.legend}>
            {receiptPersons.map((p) => (
              <View key={p.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                <Text style={[font.footnote, { color: c.textSecondary }]}>{p.name}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: c.card }]}>
            {items.map((it, i) => {
              const assigned = getItemPersonsSet(it.id);
              const active = assigned.size > 0;
              const dots = active
                ? receiptPersons.filter((p) => assigned.has(p.id))
                : receiptPersons;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => cycleItem(it.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.name_sv || it.name_original || 'Vara'}, ${active ? dots.map((d) => d.name).join(', ') : 'delat enligt kvitto'}`}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: c.separator,
                      borderBottomWidth: i < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: c.text }]} numberOfLines={2}>
                      {it.name_sv || it.name_original || 'Okänd vara'}
                    </Text>
                    {!active ? (
                      <Text style={[font.caption, { color: c.textTertiary, marginTop: 2 }]}>
                        Delas enligt kvitto
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.dots}>
                    {dots.map((p) => (
                      <View
                        key={p.id}
                        style={[
                          styles.dot,
                          { backgroundColor: p.color, opacity: active ? 1 : 0.35 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[font.body, { color: c.text, fontWeight: '600', minWidth: 80, textAlign: 'right' }]}>
                    {formatMoney(it.price, receipt?.currency)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.separator }]}>
          <Button title="Klar" onPress={onDone} loading={saving} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 56,
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
