import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { getDB } from '../src/lib/db';
import { useTheme } from '../src/hooks/useTheme';

export default function RootLayout() {
  const { c, scheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getDB()
      .then(() => setReady(true))
      .catch((e) => {
        console.error('DB init failed', e);
        setReady(true);
      });
  }, []);

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
            name="assign/[receiptId]"
            options={{ title: 'Lägg till i resa', presentation: 'modal' }}
          />
          <Stack.Screen
            name="assign/bulk"
            options={{ title: 'Lägg till i resa', presentation: 'modal' }}
          />
          <Stack.Screen
            name="tags/pick"
            options={{ title: 'Taggar' }}
          />
          <Stack.Screen
            name="tags/manage"
            options={{ title: 'Taggar', headerBackTitle: 'Tillbaka' }}
          />
          <Stack.Screen
            name="inbox"
            options={{ title: 'Inbox', headerBackTitle: 'Resor' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
