import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius } from '../../src/lib/theme';
import {
  listTags, createTag, getReceiptTags, addTagToReceipt, removeTagFromReceipt, getReceipt,
} from '../../src/lib/db';

export default function TagPickScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { receiptId, next } = useLocalSearchParams();

  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(async () => {
    const [all, own, r] = await Promise.all([
      listTags(),
      getReceiptTags(receiptId),
      getReceipt(receiptId),
    ]);
    setTags(all);
    setSelected(new Set(own.map((t) => t.id)));
    setReceipt(r);
  }, [receiptId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const done = () => {
    if (next) router.replace(String(next));
    else router.back();
  };

  const toggle = async (tag) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(tag.id)) nextSet.delete(tag.id);
      else nextSet.add(tag.id);
      return nextSet;
    });
    if (selected.has(tag.id)) {
      await removeTagFromReceipt(Number(receiptId), tag.id);
    } else {
      await addTagToReceipt(Number(receiptId), tag.id);
    }
  };

  const create = () => {
    Alert.prompt(
      'Ny kategori',
      'Namn på kategorin',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Skapa',
          onPress: async (text) => {
            try {
              const tag = await createTag(text);
              await addTagToReceipt(Number(receiptId), tag.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              await load();
            } catch (e) {
              Alert.alert('Kunde inte skapa kategori', String(e?.message || e));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Kategorier',
          headerRight: () => (
            <Pressable onPress={done} hitSlop={10} style={{ paddingHorizontal: spacing.md }}>
              <Text style={{ ...font.body, color: c.accent, fontWeight: '600' }}>Klar</Text>
            </Pressable>
          ),
          headerLeft: next ? () => null : undefined,
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        {receipt ? (
          <Text style={[font.footnote, { color: c.textSecondary, marginBottom: spacing.md }]}>
            {receipt.store || 'Kvitto'}
          </Text>
        ) : null}

        <View style={styles.chipWrap}>
          {tags.map((t) => {
            const isOn = selected.has(t.id);
            return (
              <Pressable
                key={t.id}
                onPress={() => toggle(t)}
                accessibilityRole="button"
                accessibilityLabel={`Kategori ${t.name}`}
                accessibilityState={{ selected: isOn }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isOn ? t.color : c.card,
                    borderColor: isOn ? t.color : c.separator,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                {!isOn ? (
                  <View style={[styles.chipDot, { backgroundColor: t.color }]} />
                ) : null}
                <Text
                  style={[
                    font.callout,
                    {
                      color: isOn ? '#fff' : c.text,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {t.name}
                </Text>
                {isOn ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            onPress={create}
            style={({ pressed }) => [
              styles.chip,
              styles.createChip,
              { borderColor: c.accent, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="add" size={18} color={c.accent} />
            <Text style={[font.callout, { color: c.accent, fontWeight: '600' }]}>
              Skapa ny kategori
            </Text>
          </Pressable>
        </View>

        {tags.length === 0 ? (
          <Text style={[font.callout, { color: c.textSecondary, textAlign: 'center', marginTop: spacing.xl }]}>
            Du har inga kategorier än. Skapa en första här.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  createChip: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
});
