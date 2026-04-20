import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font } from '../../src/lib/theme';
import { listTags, createTag, deleteTag, getDB } from '../../src/lib/db';
import { EmptyState } from '../../src/components/EmptyState';
import { Button } from '../../src/components/Button';

async function tagReceiptCounts() {
  const db = await getDB();
  const rows = await db.getAllAsync(
    'SELECT tag_id, COUNT(*) AS count FROM receipt_tags GROUP BY tag_id'
  );
  const map = new Map();
  for (const r of rows) map.set(r.tag_id, r.count);
  return map;
}

export default function TagsScreen() {
  const { c } = useTheme();
  const nav = useNavigation();

  const [tags, setTags] = useState([]);
  const [counts, setCounts] = useState(new Map());

  const load = useCallback(async () => {
    const [ts, cs] = await Promise.all([listTags(), tagReceiptCounts()]);
    setTags(ts);
    setCounts(cs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addTag = useCallback(() => {
    Alert.prompt(
      'Ny tagg',
      'Namn på taggen (t.ex. Simon, Mette)',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Skapa',
          onPress: async (text) => {
            try {
              await createTag(text);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              await load();
            } catch (e) {
              Alert.alert('Kunde inte skapa tagg', String(e?.message || e));
            }
          },
        },
      ],
      'plain-text'
    );
  }, [load]);

  useEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable
          onPress={addTag}
          accessibilityLabel="Ny tagg"
          accessibilityRole="button"
          hitSlop={10}
          style={{ paddingHorizontal: spacing.md }}
        >
          <Ionicons name="add" size={28} color={c.accent} />
        </Pressable>
      ),
    });
  }, [nav, c.accent, addTag]);

  const confirmDelete = (tag) => {
    Alert.alert(
      `Ta bort ${tag.name}?`,
      'Taggen tas bort från alla kvitton.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            await deleteTag(tag.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await load();
          },
        },
      ]
    );
  };

  const renderRightActions = (tag) => {
    function RightActions() {
      return (
        <Pressable
          onPress={() => confirmDelete(tag)}
          accessibilityLabel={`Ta bort tagg ${tag.name}`}
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
    const count = counts.get(item.id) || 0;
    return (
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={renderRightActions(item)}
      >
        <Pressable
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            confirmDelete(item);
          }}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={`Tagg ${item.name}, ${count} ${count === 1 ? 'kvitto' : 'kvitton'}`}
          accessibilityHint="Dra åt vänster eller håll in för att ta bort"
          style={[styles.row, { backgroundColor: c.card }]}
        >
          <View style={[styles.dot, { backgroundColor: item.color }]}>
            <Text style={styles.dotInitial}>{item.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.meta, { color: c.textSecondary }]}>
              {count} {count === 1 ? 'kvitto' : 'kvitton'}
            </Text>
          </View>
        </Pressable>
      </ReanimatedSwipeable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={tags}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={tags.length === 0 ? styles.emptyWrap : styles.listContent}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 56 }} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="pricetag-outline"
            title="Inga taggar än"
            message="Skapa en tagg för personer, grupper eller kategorier. Varje tagg får en egen färg."
          >
            <Button title="Skapa tagg" onPress={addTag} />
          </EmptyState>
        }
      />
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
    minHeight: 60,
  },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  dotInitial: { ...font.caption, color: '#fff', fontWeight: '700' },
  name: { ...font.body, fontWeight: '600' },
  meta: { ...font.footnote, marginTop: 2 },
  swipeDelete: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
