import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Pressable, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius } from '../../src/lib/theme';
import { Button } from '../../src/components/Button';
import { createTrip, assignReceipt } from '../../src/lib/db';

const EMOJIS = ['✈️', '🏝️', '🗼', '🗽', '🏙️', '🍻', '🍷', '🎉', '🍽️', '🎵', '⛷️', '🏔️', '🚗', '🚂'];

function fmt(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewTripScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { assignReceiptId, assignIds } = useLocalSearchParams();

  const [name, setName] = useState('');
  const [kind, setKind] = useState('resa');
  const [emoji, setEmoji] = useState('✈️');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);
  const [saving, setSaving] = useState(false);

  const isAssignFlow = !!(assignReceiptId || assignIds);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Namn saknas', 'Ge resan ett namn.');
      return;
    }
    setSaving(true);
    try {
      const startIso = fmt(startDate);
      const endIso = endDate ? fmt(endDate) : null;
      const tripId = await createTrip({
        name: name.trim(),
        kind,
        emoji,
        start_date: startIso,
        end_date: endIso,
      });

      if (assignReceiptId) {
        await assignReceipt(Number(assignReceiptId), { tripId, tripDay: startIso });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.dismiss(2);
        return;
      }

      if (assignIds) {
        const ids = String(assignIds).split(',').map((x) => Number(x)).filter(Boolean);
        for (const rid of ids) {
          await assignReceipt(rid, { tripId, tripDay: null });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.dismiss(2);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      Alert.alert('Kunde inte skapa', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      {isAssignFlow ? (
        <Text style={[font.footnote, { color: c.textSecondary, paddingHorizontal: spacing.sm, marginBottom: -spacing.sm }]}>
          Kvittot läggs automatiskt till i den nya resan.
        </Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <View style={styles.emojiHeader}>
          <Text style={{ fontSize: 48 }}>{emoji}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
          style={{ marginTop: spacing.md }}
        >
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => { setEmoji(e); Haptics.selectionAsync().catch(() => {}); }}
              accessibilityLabel={`Välj emoji ${e}`}
              accessibilityRole="button"
              accessibilityState={{ selected: emoji === e }}
              style={[
                styles.emojiChoice,
                { backgroundColor: emoji === e ? c.accent + '22' : c.bg, borderColor: emoji === e ? c.accent : 'transparent' },
              ]}
            >
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <Text style={[styles.label, { color: c.textSecondary }]}>NAMN</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="t.ex. Tokyo 2026"
          placeholderTextColor={c.textTertiary}
          style={[styles.input, { color: c.text }]}
          autoFocus
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <Text style={[styles.label, { color: c.textSecondary }]}>TYP</Text>
        <View style={styles.kindRow}>
          <KindChip label="Resa" emoji="✈️" active={kind === 'resa'} onPress={() => setKind('resa')} c={c} />
          <KindChip label="Utekväll" emoji="🍻" active={kind === 'kvall'} onPress={() => setKind('kvall')} c={c} />
          <KindChip label="Annat" emoji="📌" active={kind === 'annat'} onPress={() => setKind('annat')} c={c} />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.card }]}>
        <Text style={[styles.label, { color: c.textSecondary }]}>DATUM</Text>
        <View style={styles.dateRow}>
          <Text style={[font.body, { color: c.text }]}>Start</Text>
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onChange={(_, d) => { if (d) setStartDate(d); }}
          />
        </View>
        <View style={[styles.dateRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}>
          <Text style={[font.body, { color: c.text }]}>Slut (valfritt)</Text>
          {endDate ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={(_, d) => { if (d) setEndDate(d); }}
              />
              <Pressable onPress={() => setEndDate(null)} hitSlop={10}>
                <Text style={{ ...font.callout, color: c.danger }}>Ta bort</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEndDate(new Date(startDate.getTime() + 86400000))}>
              <Text style={{ ...font.callout, color: c.accent }}>Lägg till</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ padding: spacing.lg }}>
        <Button
          title={isAssignFlow ? 'Skapa och lägg till kvitto' : 'Skapa'}
          onPress={onSave}
          loading={saving}
          disabled={!name.trim()}
        />
      </View>
    </ScrollView>
  );
}

function KindChip({ label, emoji, active, onPress, c }) {
  return (
    <Pressable
      onPress={() => { onPress(); Haptics.selectionAsync().catch(() => {}); }}
      style={[
        styles.chip,
        { backgroundColor: active ? c.accent : c.bg, borderColor: active ? c.accent : 'transparent' },
      ]}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={{ ...font.callout, color: active ? '#fff' : c.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  label: { ...font.footnote, letterSpacing: 0.5, marginBottom: spacing.sm },
  input: { ...font.title3, paddingVertical: spacing.xs, minHeight: 36 },
  emojiHeader: { alignItems: 'center', paddingVertical: spacing.md },
  emojiChoice: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 2,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
});
