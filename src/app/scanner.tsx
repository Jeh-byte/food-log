import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Busy, Button, Field, Hint, Row, Screen } from '@/components/ui';
import { lookup } from '@/lib/barcode';
import { setDraft } from '@/lib/draft';
import { nowTime, today } from '@/lib/dates';
import { guessMeal, itemsFromEstimate } from '@/lib/nutrition';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  async function find(code: string) {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    try {
      const est = await lookup(code);
      if (!est) {
        Alert.alert('Not found', `Product ${code} isn’t in the database. Try a photo of the nutrition label instead.`, [
          { text: 'OK', onPress: () => (handled.current = false) },
        ]);
        return;
      }
      setDraft({
        id: null, date: today(), time: nowTime(), meal: guessMeal(), name: est.meal_name,
        items: itemsFromEstimate(est), source: 'barcode', notes: est.notes, confidence: est.confidence,
      });
      router.replace('/confirm');
    } catch (e) {
      Alert.alert('Lookup failed', (e as Error).message, [{ text: 'OK', onPress: () => (handled.current = false) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {permission?.granted ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={busy ? undefined : (r) => find(r.data)}
          />
        </View>
      ) : (
        <>
          <Hint>Food Log needs the camera to scan barcodes.</Hint>
          <Button title="Allow camera" kind="primary" onPress={requestPermission} />
        </>
      )}
      <Hint>Point the camera at the barcode. Product data comes from Open Food Facts.</Hint>
      <Row>
        <Field
          value={manual}
          onChangeText={(v) => setManual(v.replace(/\D/g, ''))}
          placeholder="Or type the number"
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
        <Button title="Look up" kind="primary" disabled={manual.length < 8} onPress={() => find(manual)} />
      </Row>
      <Busy visible={busy} text="Looking up product…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { height: 320, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
});
