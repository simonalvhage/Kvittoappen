import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getDB, ensureSelfPerson, listTags } from '../src/lib/db';
import { isMigrationV2Done } from '../src/lib/secureStore';
import { useTheme } from '../src/hooks/useTheme';

export default function RootLayout() {
  const { c, scheme } = useTheme();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await getDB();
        await ensureSelfPerson();
        const migrationDone = await isMigrationV2Done();
        if (!migrationDone) {
          const tags = await listTags();
          if (tags.length > 0) {
            setReady(true);
            setTimeout(() => router.replace('/migrate-v2'), 0);
            return;
          }
        }
      } catch (e) {
        console.error('DB init failed', e);
      }
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: c.bg },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="scan"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="receipt/[id]"
            options={{ title: 'Kvitto', headerBackTitle: 'Tillbaka' }}
          />
          <Stack.Screen
            name="trip/new"
            options={{ title: 'Ny resa', presentation: 'modal' }}
          />
          <Stack.Screen
            name="trip/[id]"
            options={{ title: '', headerBackTitle: 'Resor' }}
          />
          <Stack.Screen
            name="trip/[id]/tag/[tagId]"
            options={{ title: '', headerBackTitle: 'Tillbaka' }}
          />
          <Stack.Screen
            name="trip/[id]/person/[personId]"
            options={{ title: '', headerBackTitle: 'Tillbaka' }}
          />
          <Stack.Screen
            name="assign/[receiptId]"
            options={{ title: 'Lägg till i resa', presentation: 'modal' }}
          />
          <Stack.Screen
            name="assign/bulk"
            options={{ title: 'Lägg till i resa', presentation: 'modal' }}
          />
          <Stack.Screen
            name="tags/pick"
            options={{ title: 'Kategorier' }}
          />
          <Stack.Screen
            name="receipt/[id]/people"
            options={{ title: 'Vem handlade?', presentation: 'modal' }}
          />
          <Stack.Screen
            name="receipt/[id]/split"
            options={{ title: 'Dela per vara' }}
          />
          <Stack.Screen
            name="tags/manage"
            options={{ title: 'Kategorier', headerBackTitle: 'Tillbaka' }}
          />
          <Stack.Screen
            name="persons/manage"
            options={{ title: 'Personer', headerBackTitle: 'Tillbaka' }}
          />
          <Stack.Screen
            name="inbox"
            options={{ title: 'Inbox', headerBackTitle: 'Resor' }}
          />
          <Stack.Screen
            name="trips/index"
            options={{ title: 'Resor', headerBackTitle: 'Flöde' }}
          />
          <Stack.Screen
            name="migrate-v2"
            options={{ title: 'Uppdatering', presentation: 'modal', gestureEnabled: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
