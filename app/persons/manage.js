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
import { listPersons, createPerson, deletePerson, updatePerson } from '../../src/lib/db';
import { EmptyState } from '../../src/components/EmptyState';
import { Button } from '../../src/components/Button';

export default function PersonsScreen() {
  const { c } = useTheme();
  const nav = useNavigation();

  const [persons, setPersons] = useState([]);

  const load = useCallback(async () => {
    const ps = await listPersons();
    setPersons(ps);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPerson = useCallback(() => {
    Alert.prompt(
      'Ny person',
      'Namn (t.ex. Mette, Erik)',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Skapa',
          onPress: async (text) => {
            try {
              await createPerson(text);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              await load();
            } catch (e) {
              Alert.alert('Kunde inte skapa person', String(e?.message || e));
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
          onPress={addPerson}
          accessibilityLabel="Ny person"
          accessibilityRole="button"
          hitSlop={10}
          style={{ paddingHorizontal: spacing.md }}
        >
          <Ionicons name="add" size={28} color={c.accent} />
        </Pressable>
      ),
    });
  }, [nav, c.accent, addPerson]);

  const confirmDelete = (person) => {
    if (person.is_self) {
      Alert.alert('Kan inte tas bort', 'Detta är dig själv.');
      return;
    }
    Alert.alert(
      `Ta bort ${person.name}?`,
      'Personen tas bort från alla kvitton.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: async () => {
            await deletePerson(person.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await load();
          },
        },
      ]
    );
  };

  const rename = (person) => {
    Alert.prompt(
      'Byt namn',
      null,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Spara',
          onPress: async (text) => {
            try {
              await updatePerson(person.id, { name: text });
              await load();
            } catch (e) {
              Alert.alert('Kunde inte spara', String(e?.message || e));
            }
          },
        },
      ],
      'plain-text',
      person.name
    );
  };

  const renderRightActions = (person) => {
    function RightActions() {
      return (
        <Pressable
          onPress={() => confirmDelete(person)}
          accessibilityLabel={`Ta bort person ${person.name}`}
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

  const renderItem = ({ item }) => (
    <ReanimatedSwipeable
      enabled={!item.is_self}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions(item)}
    >
      <Pressable
        onPress={() => rename(item)}
        onLongPress={() => {
          if (item.is_self) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          confirmDelete(item);
        }}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}${item.is_self ? ', du själv' : ''}`}
        accessibilityHint={item.is_self ? 'Tryck för att byta namn' : 'Tryck för att byta namn, håll in för att ta bort'}
        style={[styles.row, { backgroundColor: c.card }]}
      >
        <View style={[styles.dot, { backgroundColor: item.color }]}>
          <Text style={styles.dotInitial}>{item.name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
          {item.is_self ? (
            <Text style={[styles.meta, { color: c.textSecondary }]}>Du själv</Text>
          ) : null}
        </View>
        {item.is_self ? (
          <Ionicons name="person-circle-outline" size={22} color={c.textSecondary} />
        ) : null}
      </Pressable>
    </ReanimatedSwipeable>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={persons}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={persons.length === 0 ? styles.emptyWrap : styles.listContent}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: 56 }} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Inga personer än"
            message="Lägg till personer du delar kvitton med. Varje person får en egen färg."
          >
            <Button title="Skapa person" onPress={addPerson} />
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
