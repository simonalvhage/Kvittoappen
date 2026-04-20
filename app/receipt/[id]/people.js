import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../src/hooks/useTheme';
import { spacing, font, radius } from '../../../src/lib/theme';
import {
  listPersons, createPerson, getReceiptPersons, setReceiptPersons,
} from '../../../src/lib/db';
import { Button } from '../../../src/components/Button';

export default function ReceiptPeopleScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { id, next } = useLocalSearchParams();

  const [persons, setPersons] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [all, current] = await Promise.all([listPersons(), getReceiptPersons(id)]);
    setPersons(all);
    const initial = new Set(current.map((p) => p.id));
    if (initial.size === 0) {
      const self = all.find((p) => p.is_self);
      if (self) initial.add(self.id);
    }
    setSelected(initial);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (personId) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(personId)) nextSet.delete(personId);
      else nextSet.add(personId);
      return nextSet;
    });
  };

  const addPerson = () => {
    Alert.prompt(
      'Ny person',
      'Namn',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Skapa',
          onPress: async (text) => {
            try {
              const p = await createPerson(text);
              await load();
              setSelected((prev) => new Set(prev).add(p.id));
            } catch (e) {
              Alert.alert('Kunde inte skapa person', String(e?.message || e));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const onDone = async () => {
    setSaving(true);
    try {
      await setReceiptPersons(id, [...selected]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (next) router.replace(String(next));
      else router.back();
    } catch (e) {
      Alert.alert('Kunde inte spara', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const goToSplit = async () => {
    if (selected.size < 2) {
      Alert.alert('Välj minst två personer', 'För att dela upp per vara behöver du välja minst två personer.');
      return;
    }
    try {
      await setReceiptPersons(id, [...selected]);
      router.replace({ pathname: `/receipt/${id}/split`, params: next ? { next: String(next) } : {} });
    } catch (e) {
      Alert.alert('Kunde inte spara', String(e?.message || e));
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: 'Vem handlade?' }} />
        <ActivityIndicator color={c.textSecondary} />
      </View>
    );
  }

  const count = selected.size;

  return (
    <>
      <Stack.Screen options={{ title: 'Vem handlade?' }} />
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: c.text }]}>Vem handlade?</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            Välj en eller flera. Kvittot delas lika mellan valda personer.
          </Text>

          <View style={styles.grid}>
            {persons.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => toggle(p.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${p.name}${isSelected ? ', vald' : ', ej vald'}`}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: isSelected ? p.color : c.card,
                      borderColor: isSelected ? p.color : c.separator,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : p.color }]}>
                    <Text style={styles.avatarInitial}>{p.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text
                    style={[
                      styles.name,
                      { color: isSelected ? '#fff' : c.text },
                    ]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {p.is_self ? (
                    <Text style={[styles.selfTag, { color: isSelected ? 'rgba(255,255,255,0.8)' : c.textSecondary }]}>
                      Du
                    </Text>
                  ) : null}
                  {isSelected ? (
                    <View style={styles.check}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}

            <Pressable
              onPress={addPerson}
              accessibilityRole="button"
              accessibilityLabel="Skapa ny person"
              style={({ pressed }) => [
                styles.card,
                styles.addCard,
                { borderColor: c.textTertiary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="add" size={28} color={c.textSecondary} />
              <Text style={[styles.name, { color: c.textSecondary, marginTop: 4 }]}>Ny person</Text>
            </Pressable>
          </View>

          {count >= 2 ? (
            <Text style={[styles.splitInfo, { color: c.textSecondary }]}>
              Kvittot delas lika mellan {count} personer.
            </Text>
          ) : null}

          <Pressable
            onPress={goToSplit}
            accessibilityRole="button"
            accessibilityLabel="Dela upp per vara istället"
            style={({ pressed }) => [styles.linkBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[font.callout, { color: c.accent }]}>Dela upp per vara istället</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.separator }]}>
          <Button
            title={count === 0 ? 'Välj minst en' : 'Klar'}
            onPress={onDone}
            disabled={count === 0}
            loading={saving}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { ...font.title1, fontWeight: '700', marginBottom: spacing.xs },
  sub: { ...font.callout, marginBottom: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '47%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 120,
    justifyContent: 'center',
  },
  addCard: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { ...font.title3, color: '#fff', fontWeight: '700' },
  name: { ...font.body, fontWeight: '600' },
  selfTag: { ...font.caption },
  check: {
    position: 'absolute',
    top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  splitInfo: { ...font.footnote, marginTop: spacing.lg, textAlign: 'center' },
  linkBtn: { alignItems: 'center', padding: spacing.md, marginTop: spacing.md },
  footer: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
