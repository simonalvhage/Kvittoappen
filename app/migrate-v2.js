import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/hooks/useTheme';
import { spacing, font, radius } from '../src/lib/theme';
import { listTags, migrateTagsToPersons } from '../src/lib/db';
import { markMigrationV2Done } from '../src/lib/secureStore';
import { Button } from '../src/components/Button';

export default function MigrateV2Screen() {
  const { c } = useTheme();
  const router = useRouter();

  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const all = await listTags();
    setTags(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const skip = async () => {
    await markMigrationV2Done();
    router.replace('/feed');
  };

  const run = async () => {
    if (selected.size === 0) { skip(); return; }
    setRunning(true);
    try {
      await migrateTagsToPersons([...selected]);
      await markMigrationV2Done();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/feed');
    } catch (e) {
      setRunning(false);
      Alert.alert('Migrering misslyckades', String(e?.message || e));
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: 'Uppdatering' }} />
        <ActivityIndicator color={c.textSecondary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Uppdatering', headerBackVisible: false }} />
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: c.text }]}>Personer är nytt</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            Vi har separerat personer från kategorier. Välj vilka av dina befintliga taggar
            som är personer — de flyttas till Personer och kopplas till samma kvitton. Resten
            finns kvar som kategorier.
          </Text>

          {tags.length === 0 ? (
            <Text style={[font.callout, { color: c.textSecondary, marginTop: spacing.xl }]}>
              Du har inga taggar att migrera.
            </Text>
          ) : (
            <View style={[styles.list, { backgroundColor: c.card }]}>
              {tags.map((t, i) => {
                const on = selected.has(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggle(t.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${t.name}, ${on ? 'vald som person' : 'ej vald'}`}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        borderBottomColor: c.separator,
                        borderBottomWidth: i < tags.length - 1 ? StyleSheet.hairlineWidth : 0,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: t.color }]}>
                      <Text style={styles.dotInitial}>{t.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <Text style={[font.body, { color: c.text, fontWeight: '600', flex: 1 }]} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <View
                      style={[
                        styles.check,
                        {
                          backgroundColor: on ? c.accent : 'transparent',
                          borderColor: on ? c.accent : c.textTertiary,
                        },
                      ]}
                    >
                      {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.separator }]}>
          <Button
            title="Hoppa över"
            variant="secondary"
            onPress={skip}
            style={{ flex: 1 }}
          />
          <Button
            title={selected.size === 0 ? 'Fortsätt' : `Migrera (${selected.size})`}
            onPress={run}
            loading={running}
            style={{ flex: 1 }}
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
  list: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  dotInitial: { ...font.caption, color: '#fff', fontWeight: '700' },
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
