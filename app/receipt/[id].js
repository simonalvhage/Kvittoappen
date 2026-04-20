import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, Pressable, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius } from '../../src/lib/theme';
import {
  getReceipt, getReceiptItems, setReceiptSplit, deleteReceipt, getTrip, getReceiptTags,
  getReceiptPersons, hasItemLevelSplit,
} from '../../src/lib/db';
import { formatSEK, formatMoney } from '../../src/lib/fx';

export default function ReceiptDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [trip, setTrip] = useState(null);
  const [tags, setTags] = useState([]);
  const [people, setPeople] = useState([]);
  const [itemSplit, setItemSplit] = useState(false);
  const [splitCount, setSplitCount] = useState(1);

  const load = useCallback(async () => {
    const r = await getReceipt(id);
    if (!r) return;
    setReceipt(r);
    setSplitCount(r.split_count || 1);
    const [its, ts, ps, itemFlag] = await Promise.all([
      getReceiptItems(id),
      getReceiptTags(id),
      getReceiptPersons(id),
      hasItemLevelSplit(id),
    ]);
    setItems(its);
    setTags(ts);
    setPeople(ps);
    setItemSplit(itemFlag);
    if (r.trip_id) {
      const t = await getTrip(r.trip_id);
      setTrip(t);
    } else {
      setTrip(null);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!receipt) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textSecondary }}>Laddar…</Text>
      </View>
    );
  }

  const sekValue = receipt.total_sek ?? receipt.total;
  const perPerson = sekValue != null ? sekValue / Math.max(1, splitCount) : null;
  const showOriginal = receipt.currency && receipt.currency !== 'SEK' && receipt.total != null;

  const changeSplit = async (n) => {
    const next = Math.max(1, Math.min(20, n));
    setSplitCount(next);
    Haptics.selectionAsync().catch(() => {});
    await setReceiptSplit(id, next);
  };

  const onDelete = () => {
    Alert.alert('Ta bort kvitto?', 'Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: receipt.store || 'Kvitto',
          headerRight: () => (
            <Pressable
              onPress={onDelete}
              accessibilityLabel="Ta bort kvitto"
              accessibilityRole="button"
              hitSlop={8}
              style={styles.headerBtn}
            >
              <Ionicons name="trash-outline" size={22} color={c.danger} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        {receipt.image_path ? (
          <Image source={{ uri: receipt.image_path }} style={styles.thumb} resizeMode="cover" />
        ) : null}

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Row label="Butik" value={receipt.store || '–'} c={c} />
          <Row label="Datum" value={receipt.purchased_at || '–'} c={c} />
          {receipt.card ? <Row label="Kort" value={receipt.card} c={c} /> : null}
          <Row
            label="Total"
            value={formatSEK(sekValue)}
            sub={showOriginal ? formatMoney(receipt.total, receipt.currency) : null}
            c={c}
          />
          {receipt.fx_rate && receipt.currency && receipt.currency !== 'SEK' ? (
            <Row
              label="Växelkurs"
              value={`1 ${receipt.currency} = ${receipt.fx_rate.toFixed(4)} SEK`}
              c={c}
            />
          ) : null}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: `/receipt/${id}/people` })}
          accessibilityRole="button"
          accessibilityLabel={people.length === 0 ? 'Lägg till personer' : `Personer: ${people.map((p) => p.name).join(', ')}`}
          style={({ pressed }) => [
            styles.card, styles.tripRow,
            { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="people-outline" size={20} color={c.accent} />
          <View style={{ flex: 1 }}>
            {people.length === 0 ? (
              <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>Lägg till personer</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {people.map((p) => (
                    <View key={p.id} style={[styles.personChip, { backgroundColor: p.color }]}>
                      <Text style={[font.caption, { color: '#fff', fontWeight: '700' }]}>
                        {p.name.slice(0, 1).toUpperCase()}
                      </Text>
                      <Text style={[font.footnote, { color: '#fff', fontWeight: '600' }]}>
                        {p.name}
                      </Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({ pathname: `/receipt/${id}/people` });
                  }}
                >
                  <Text style={[font.footnote, { color: c.textSecondary, marginTop: 6 }]}>
                    {itemSplit
                      ? 'Uppdelad per vara · tryck för att ändra'
                      : people.length === 1
                        ? 'Hela kvittot'
                        : `Delat lika på ${people.length} personer`}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </Pressable>

        <Pressable
          onPress={() => router.push(`/assign/${receipt.id}`)}
          style={({ pressed }) => [
            styles.card, styles.tripRow,
            { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="airplane-outline" size={20} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
              {trip ? `${trip.emoji || ''} ${trip.name}`.trim() : 'Lägg till i resa'}
            </Text>
            {receipt.trip_day ? (
              <Text style={[font.footnote, { color: c.textSecondary, marginTop: 2 }]}>
                {receipt.trip_day}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: '/tags/pick', params: { receiptId: String(id) } })}
          style={({ pressed }) => [
            styles.card, styles.tripRow,
            { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="pricetag-outline" size={20} color={c.accent} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tags.length === 0 ? (
              <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
                Lägg till kategorier
              </Text>
            ) : (
              tags.map((t) => (
                <View
                  key={t.id}
                  style={[styles.tagChip, { backgroundColor: t.color }]}
                >
                  <Text style={[font.footnote, { color: '#fff', fontWeight: '600' }]}>
                    {t.name}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </Pressable>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>DELA NOTAN</Text>
          <View style={styles.splitRow}>
            <Pressable
              onPress={() => changeSplit(splitCount - 1)}
              disabled={splitCount <= 1}
              accessibilityLabel="Minska antal personer"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.splitBtn,
                { backgroundColor: c.bg, opacity: splitCount <= 1 ? 0.3 : pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="remove" size={24} color={c.text} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[font.largeTitle, { color: c.text }]}>{splitCount}</Text>
              <Text style={[font.footnote, { color: c.textSecondary }]}>
                {splitCount === 1 ? 'person' : 'personer'}
              </Text>
            </View>
            <Pressable
              onPress={() => changeSplit(splitCount + 1)}
              accessibilityLabel="Öka antal personer"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.splitBtn,
                { backgroundColor: c.bg, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="add" size={24} color={c.text} />
            </Pressable>
          </View>
          {perPerson != null ? (
            <View style={[styles.perPersonBox, { backgroundColor: c.bg }]}>
              <Text style={[font.footnote, { color: c.textSecondary }]}>PER PERSON</Text>
              <Text style={[font.title1, { color: c.accent, marginTop: 4 }]}>
                {formatSEK(perPerson)}
              </Text>
              {splitCount > 1 ? (
                <Text style={[font.caption, { color: c.textSecondary, marginTop: 4 }]}>
                  Dina vänner Swishar {formatSEK(perPerson)} var
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: c.card, padding: 0 }]}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }]}>
            VAROR ({items.length})
          </Text>
          {items.length === 0 ? (
            <Text style={{ ...font.callout, color: c.textSecondary, padding: spacing.lg }}>
              Inga varor hittades.
            </Text>
          ) : (
            items.map((it, i) => (
              <View key={it.id}>
                <View style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.body, { color: c.text }]} numberOfLines={2}>
                      {it.name_sv || it.name_original || 'Okänd vara'}
                    </Text>
                    {it.name_sv && it.name_original && it.name_sv !== it.name_original ? (
                      <Text style={[font.caption, { color: c.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                        {it.name_original}
                      </Text>
                    ) : null}
                    {it.quantity && it.quantity !== 1 ? (
                      <Text style={[font.caption, { color: c.textSecondary, marginTop: 2 }]}>
                        {it.quantity} st
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>
                    {formatMoney(it.price, receipt.currency)}
                  </Text>
                </View>
                {i < items.length - 1 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: spacing.lg }} />
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

function Row({ label, value, sub, c }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[font.callout, { color: c.textSecondary }]}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[font.body, { color: c.text, fontWeight: '600' }]}>{value}</Text>
        {sub ? <Text style={[font.caption, { color: c.textSecondary, marginTop: 2 }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  thumb: { width: '100%', height: 200, borderRadius: radius.lg },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sectionTitle: { ...font.footnote, letterSpacing: 0.5, marginBottom: spacing.md },
  splitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  splitBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  perPersonBox: {
    borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.md, alignItems: 'flex-start',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
