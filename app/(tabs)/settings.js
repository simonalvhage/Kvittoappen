import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, font, radius } from '../../src/lib/theme';
import { Button } from '../../src/components/Button';
import { ListRow, ListSection, Separator } from '../../src/components/ListRow';
import { getApiKey, setApiKey } from '../../src/lib/secureStore';

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return `${k.slice(0, 3)}•••${k.slice(-4)}`;
}

export default function SettingsScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const [savedKey, setSavedKey] = useState(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const k = await getApiKey();
    setSavedKey(k);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSave = async () => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('sk-')) {
      Alert.alert('Ogiltig nyckel', 'OpenAI-nycklar börjar med "sk-".');
      return;
    }
    setSaving(true);
    try {
      await setApiKey(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSavedKey(trimmed);
      setInput('');
      setEditing(false);
    } catch (e) {
      Alert.alert('Kunde inte spara', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = () => {
    Alert.alert('Ta bort API-nyckel?', 'Du kommer inte kunna skanna kvitton utan nyckel.', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Ta bort',
        style: 'destructive',
        onPress: async () => {
          await setApiKey(null);
          setSavedKey(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingVertical: spacing.lg }}>
      <ListSection
        title="OpenAI"
        footer="Din API-nyckel lagras krypterat i iOS Keychain och används endast för att tolka kvitton via gpt-4o."
      >
        {!editing ? (
          <>
            <ListRow
              title={savedKey ? 'API-nyckel sparad' : 'Lägg till API-nyckel'}
              subtitle={savedKey ? maskKey(savedKey) : 'Krävs för att skanna kvitton'}
              value=""
              onPress={() => setEditing(true)}
            />
            {savedKey ? (
              <>
                <Separator />
                <ListRow
                  title="Ta bort nyckel"
                  destructive
                  onPress={onRemove}
                  showChevron={false}
                />
              </>
            ) : null}
          </>
        ) : (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="sk-..."
              placeholderTextColor={c.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[styles.input, { color: c.text, backgroundColor: c.bg }]}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Avbryt"
                variant="secondary"
                onPress={() => { setEditing(false); setInput(''); }}
                style={{ flex: 1 }}
              />
              <Button
                title="Spara"
                onPress={onSave}
                loading={saving}
                disabled={!input.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </ListSection>

      <ListSection title="Taggar">
        <ListRow
          title="Hantera taggar"
          subtitle="Skapa och ta bort taggar för personer och kategorier"
          onPress={() => router.push('/tags/manage')}
        />
      </ListSection>

      <ListSection title="Om" footer={`Kvittoappen · version ${require('../../app.json').expo.version}`}>
        <ListRow
          title="Skapa API-nyckel hos OpenAI"
          onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}
        />
        <Separator />
        <ListRow
          title="OpenAI-prissättning"
          onPress={() => Linking.openURL('https://openai.com/api/pricing/')}
        />
      </ListSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    ...font.body,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
