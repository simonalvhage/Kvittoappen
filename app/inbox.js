import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../src/hooks/useTheme';
import { spacing, font, shadow, radius } from '../src/lib/theme';
import { listAllReceipts, deleteReceipt } from '../src/lib/db';
import { formatSEK, formatMoney } from '../src/lib/fx';
import { EmptyState } from '../src/components/EmptyState';
import { Button } from '../src/components/Button';

export default function InboxScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const [receipts, setReceipts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const rows = await listAllReceipts();
      setReceipts(rows);
    } catch (e) {
      console.warn('load receipts', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const enterSelect = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectMode(true);
    setSelected(new Set([id]));
  }, []);

  const toggle = useCallback((id) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }, []);

  useEffect(() => {
    nav.setOptions({
      title: selectMode
        ? selected.size === 0
          ? 'Välj kvitton'
          : `${selected.size} ${selected.size === 1 ? 'valt' : 'valda'}`
        : 'Kvitton',
      headerRight: selectMode
        ? () => (
          <Pressable onPress={exitSelect} hitSlop={10} style={{ paddingHorizontal: spacing.md }}>
            <Text style={{ ...font.body, color: c.accent, fontWeight: '600' }}>Avbryt</Text>
          </Pressable>
        )
        : () => null,
    });
  }, [nav, selectMode, selected.size, c.accent, exitSelect]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/scan');
  };

  const deleteOne = (id) => {
    Alert.alert('Ta bort kvitto?', 'Detta går inte att ångra.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          await load();
        },
      },
    ]);
  };

  const bulkAssign = () => {
    if (selected.size === 0) return;
    const ids = [...selected].join(',');
    exitSelect();
    router.push({ pathname: '/assign/bulk', params: { ids } });
  };

  const bulkDelete = () => {
    const count = selected.size;
    if (count === 0) return;
    Alert.alert(
      `Ta bort ${count} ${count === 1 ? 'kvitto' : 'kvitton'}?`,
      'Detta går inte att ångra.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            for (const id of selected) {
              await deleteReceipt(id);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            exitSelect();
            await load();
          },
        },
      ]
    );
  };

  const renderRightActions = (id) => {
    function RightActions() {
      return (
        <Pressable
          onPress={() => deleteOne(id)}
          accessibilityLabel="Ta bort kvitto"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.swipeDelete,
            { backgroundColor: c.danger, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="trash" size={22} color="#fff" />
        </Pressable>
      );
    }
    return RightActions;
  };

  const renderItem = ({ item }) => {
    const sekValue = item.total_sek ?? item.total;
    const showOrig = item.currency && item.currency !== 'SEK' && item.total != null;
    const isSelected = selected.has(item.id);

    const onPress = () => {
      if (selectMode) toggle(item.id);
      else router.push(`/receipt/${item.id}`);
    };
    const onLongPress = () => {
      if (!selectMode) enterSelect(item.id);
    };

    return (
      <ReanimatedSwipeable
        enabled={!selectMode}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={renderRightActions(item.id)}
      >
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={280}
          accessibilityRole="button"
          accessibilityLabel={`${item.store || 'Okänd butik'}, ${Math.round(sekValue || 0)} kronor`}
          accessibilityHint="Dra åt vänster för att ta bort, eller håll in för att välja flera"
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {selectMode ? (
            <View
              style={[
                styles.check,
                {
                  backgroundColor: isSelected ? c.accent : 'transparent',
                  borderColor: isSelected ? c.accent : c.textTertiary,
                },
              ]}
            >
              {isSelected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
          ) : (
            <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
              <Ionicons name="receipt" size={20} color={c.accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.store, { color: c.text }]} numberOfLines={1}>
              {item.store || 'Okänd butik'}
            </Text>
            <Text style={[styles.meta, { color: c.textSecondary }]} numberOfLines={1}>
              {item.purchased_at || '–'}
              {item.trip_name ? `  ·  ${item.trip_emoji || ''} ${item.trip_name}` : '  ·  Inbox'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.amount, { color: c.text }]}>{formatSEK(sekValue)}</Text>
            {showOrig ? (
              <Text style={[styles.origAmount, { color: c.textSecondary }]}>
                {formatMoney(item.total, item.currency)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  const actionBarHeight = 72 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={receipts}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={[
          receipts.length === 0 ? styles.emptyWrap : styles.listContent,
          selectMode ? { paddingBottom: actionBarHeight + spacing.md } : null,
        ]}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 64 }} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="Inga kvitton än"
            message="Skanna ditt första kvitto för att komma igång."
          >
            <Button title="Skanna kvitto" onPress={openScan} />
          </EmptyState>
        }
      />

      {!selectMode && receipts.length > 0 ? (
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

      {selectMode ? (
        <View
          style={[
            styles.actionBar,
            shadow.floating,
            {
              backgroundColor: c.card,
              borderTopColor: c.separator,
              paddingBottom: insets.bottom || spacing.md,
            },
          ]}
        >
          <Pressable
            onPress={bulkDelete}
            disabled={selected.size === 0}
            accessibilityLabel={`Ta bort ${selected.size} valda kvitton`}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.dangerBtn,
              {
                backgroundColor: c.danger,
                opacity: selected.size === 0 ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button
              title={selected.size === 0 ? 'Välj minst ett kvitto' : `Lägg i resa (${selected.size})`}
              onPress={bulkAssign}
              disabled={selected.size === 0}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
  emptyWrap: { flexGrow: 1 },
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
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  store: { ...font.body, fontWeight: '600' },
  meta: { ...font.footnote, marginTop: 2 },
  amount: { ...font.body, fontWeight: '600' },
  origAmount: { ...font.caption, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  swipeDelete: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dangerBtn: {
    width: 52, height: 52, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
});
