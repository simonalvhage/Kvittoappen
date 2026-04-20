import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/hooks/useTheme';
import { spacing, font } from '../src/lib/theme';
import { Button } from '../src/components/Button';
import { getApiKey } from '../src/lib/secureStore';
import { parseReceiptImage } from '../src/lib/openai';
import { getRateToSEK } from '../src/lib/fx';
import { createReceiptFromParsed } from '../src/lib/db';

const STAGES = {
  CAMERA: 'camera',
  PREVIEW: 'preview',
  PROCESSING: 'processing',
};

export default function ScanScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState(STAGES.CAMERA);
  const [photo, setPhoto] = useState(null);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: '#000' }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: c.bg, padding: spacing.xl, justifyContent: 'center' }]}>
        <Ionicons name="camera-outline" size={64} color={c.textSecondary} style={{ alignSelf: 'center' }} />
        <Text style={[font.title2, { color: c.text, textAlign: 'center', marginTop: spacing.lg }]}>
          Kameraåtkomst krävs
        </Text>
        <Text style={[font.callout, { color: c.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          Kvittoappen behöver tillgång till kameran för att skanna kvitton.
        </Text>
        <View style={{ height: spacing.xl }} />
        <Button title="Tillåt kamera" onPress={requestPermission} />
        <View style={{ height: spacing.sm }} />
        <Button title="Avbryt" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      const manipulated = await ImageManipulator.manipulateAsync(
        shot.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhoto(manipulated);
      setStage(STAGES.PREVIEW);
    } catch (e) {
      Alert.alert('Kunde inte ta foto', String(e?.message || e));
    }
  };

  const retake = () => {
    setPhoto(null);
    setStage(STAGES.CAMERA);
  };

  const processReceipt = async () => {
    if (!photo) return;
    setStage(STAGES.PROCESSING);
    setProgress('Kontrollerar API-nyckel…');

    try {
      const apiKey = await getApiKey();
      if (!apiKey) {
        Alert.alert(
          'API-nyckel saknas',
          'Lägg till din OpenAI API-nyckel under Inställningar.',
          [{ text: 'OK', onPress: () => { setStage(STAGES.PREVIEW); router.replace('/settings'); } }]
        );
        return;
      }

      setProgress('Sparar bild lokalt…');
      const permanentUri = await persistImage(photo.uri);

      setProgress('Tolkar kvitto med gpt-4o…');
      const parsed = await parseReceiptImage({ apiKey, imageUri: permanentUri });

      setProgress('Hämtar växelkurs…');
      let fxRate = null;
      let totalSek = null;
      if (parsed?.currency && parsed?.total != null) {
        if (parsed.currency.toUpperCase() === 'SEK') {
          fxRate = 1;
          totalSek = parsed.total;
        } else {
          const rate = await getRateToSEK(parsed.currency);
          if (rate) {
            fxRate = rate;
            totalSek = parsed.total * rate;
          }
        }
      }

      setProgress('Sparar kvitto…');
      const receiptId = await createReceiptFromParsed({
        parsed,
        imagePath: permanentUri,
        fxRate,
        totalSek,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/receipt/${receiptId}`);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Kunde inte tolka kvittot', String(e?.message || e), [
        { text: 'Försök igen', onPress: () => setStage(STAGES.PREVIEW) },
        { text: 'Avbryt', style: 'cancel', onPress: () => router.back() },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {stage === STAGES.CAMERA ? (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
          />
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.frameOverlay} pointerEvents="none">
            <View style={[styles.frameCorner, styles.frameTL]} />
            <View style={[styles.frameCorner, styles.frameTR]} />
            <View style={[styles.frameCorner, styles.frameBL]} />
            <View style={[styles.frameCorner, styles.frameBR]} />
          </View>
          <View style={styles.bottomBar}>
            <Text style={styles.hint}>Rikta kameran mot kvittot</Text>
            <Pressable
              onPress={takePhoto}
              style={({ pressed }) => [styles.shutterOuter, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={{ height: 40 }} />
          </View>
        </>
      ) : null}

      {stage === STAGES.PREVIEW && photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          <View style={styles.topBar}>
            <Pressable
              onPress={retake}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.previewActions}>
            <View style={{ flex: 1 }}>
              <Button title="Ta om" variant="secondary" onPress={retake} />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Button title="Använd foto" onPress={processReceipt} />
            </View>
          </View>
        </>
      ) : null}

      {stage === STAGES.PROCESSING ? (
        <View style={styles.processing}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingTitle}>Analyserar kvitto…</Text>
          <Text style={styles.processingSubtitle}>{progress}</Text>
        </View>
      ) : null}
    </View>
  );
}

async function persistImage(uri) {
  try {
    const dir = `${FileSystem.documentDirectory}receipts`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const dest = `${dir}/${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (e) {
    console.warn('persistImage failed, using temp uri', e);
    return uri;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 0, right: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    margin: 40,
  },
  frameCorner: {
    position: 'absolute',
    width: 28, height: 28,
    borderColor: '#fff',
  },
  frameTL: { top: 80, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  frameTR: { top: 80, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  frameBL: { bottom: 160, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  frameBR: { bottom: 160, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  hint: { color: 'rgba(255,255,255,0.8)', ...font.callout, marginBottom: spacing.lg },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: spacing.lg, right: spacing.lg,
    flexDirection: 'row',
  },
  processing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  processingTitle: {
    ...font.title2,
    color: '#fff',
    marginTop: spacing.lg,
  },
  processingSubtitle: {
    ...font.callout,
    color: 'rgba(255,255,255,0.7)',
  },
});
