import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { scheduleExpiryReminders } from '../../src/services/notifications';
import { type FridgeItemInput } from '../../src/services/fridgeService';
import { useFridgeStore } from '../../src/store/fridgeStore';
import type { ComponentType } from 'react';

type BarcodeScannerModule = {
  BarCodeScanner: ComponentType<{
    onBarCodeScanned: ((params: { data: string }) => void) | undefined;
    style?: object;
  }>;
  requestPermissionsAsync?: () => Promise<{ status: string }>;
};

const createInitialForm = () => ({
  name: '',
  barcode: '',
  quantity: '',
  unit: '',
  expiryDate: '',
  location: '',
  notes: '',
});

export default function FridgeScanScreen() {
  const router = useRouter();
  const addItem = useFridgeStore((state) => state.add);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [barcodeScannerModule, setBarcodeScannerModule] = useState<BarcodeScannerModule | null>(null);
  const [scannerAvailable, setScannerAvailable] = useState(true);
  const [form, setForm] = useState(createInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    let isActive = true;
    const loadScanner = async () => {
      if (Constants.appOwnership === 'expo') {
        setScannerAvailable(false);
        setHasPermission(false);
        return;
      }

      try {
        const loadedModule = (await import('expo-barcode-scanner')) as BarcodeScannerModule;
        if (!isActive) return;
        setBarcodeScannerModule(loadedModule);
        if (typeof loadedModule.requestPermissionsAsync !== 'function') {
          throw new Error('requestPermissionsAsync is not available');
        }
        const { status } = await loadedModule.requestPermissionsAsync();
        if (!isActive) return;
        setHasPermission(status === 'granted');
      } catch (error) {
        console.warn('[FridgeScan] Barcode scanner module unavailable', error);
        if (!isActive) return;
        setScannerAvailable(false);
        setHasPermission(false);
      }
    };
    loadScanner();
    return () => {
      isActive = false;
    };
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      setHasScanned(true);
      setForm((prev) => ({
        ...prev,
        barcode: data,
      }));
    },
    [setForm]
  );

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const parseQuantity = (value: string): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const sanitizeString = (value: string) => (value.trim().length > 0 ? value.trim() : null);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Nom requis', 'Veuillez indiquer un nom pour cet aliment.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: FridgeItemInput = {
        name: form.name.trim(),
        barcode: sanitizeString(form.barcode),
        quantity: parseQuantity(form.quantity),
        unit: sanitizeString(form.unit),
        expiryDate: sanitizeString(form.expiryDate),
        location: sanitizeString(form.location),
        notes: sanitizeString(form.notes),
      };

      const created = await addItem(payload);
      await scheduleExpiryReminders({
        id: created.id,
        name: created.name,
        expiryDate: created.expiryDate,
      });

      router.back();
    } catch (error) {
      console.warn('[FridgeScan] Failed to create item', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : "Impossible d'enregistrer cet aliment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderScanner = () => {
    if (!scannerAvailable) {
      return (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Scanner indisponible</Text>
          <Text style={styles.permissionText}>
            Utilisez un build de developpement Expo pour activer la lecture de code-barres.
          </Text>
        </View>
      );
    }

    const ScannerComponent = barcodeScannerModule?.BarCodeScanner;

    if (!ScannerComponent) {
      return <Text style={styles.permissionText}>Initialisation du scanner...</Text>;
    }

    if (hasPermission === null) {
      return <Text style={styles.permissionText}>Demande d'acces a la camera...</Text>;
    }
    if (hasPermission === false) {
      return (
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Camera non autorisee</Text>
          <Text style={styles.permissionText}>
            Autorisez l'acces a la camera pour scanner les codes-barres.
          </Text>
        </View>
      );
    }

    return (
      <ScannerComponent
        onBarCodeScanned={hasScanned ? undefined : handleBarcodeScanned}
        style={styles.scanner}
      />
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Scanner un aliment</Text>

      <View style={styles.scannerContainer}>
        {renderScanner()}
        {hasScanned ? (
          <TouchableOpacity style={styles.scanAgainButton} onPress={() => setHasScanned(false)}>
            <Text style={styles.scanAgainText}>Scanner a nouveau</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Code-barres</Text>
        <TextInput
          value={form.barcode}
          onChangeText={(value) => handleChange('barcode', value)}
          placeholder="0000000000000"
          style={styles.input}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Nom</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) => handleChange('name', value)}
          placeholder="Yaourt nature"
          style={styles.input}
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Quantite</Text>
            <TextInput
              value={form.quantity}
              onChangeText={(value) => handleChange('quantity', value)}
              placeholder="1"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Unite</Text>
            <TextInput
              value={form.unit}
              onChangeText={(value) => handleChange('unit', value)}
              placeholder="piece(s)"
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Date d'expiration (YYYY-MM-DD)</Text>
        <TextInput
          value={form.expiryDate}
          onChangeText={(value) => handleChange('expiryDate', value)}
          placeholder="2024-12-31"
          style={styles.input}
        />

        <Text style={styles.label}>Emplacement</Text>
        <TextInput
          value={form.location}
          onChangeText={(value) => handleChange('location', value)}
          placeholder="Refrigerateur"
          style={styles.input}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={form.notes}
          onChangeText={(value) => handleChange('notes', value)}
          placeholder="Sans sucre ajoute"
          style={[styles.input, styles.multiline]}
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitText}>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  scannerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  scanner: {
    height: 220,
  },
  scanAgainButton: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  scanAgainText: {
    color: '#2f95dc',
    fontWeight: '600',
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    fontSize: 16,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#2f95dc',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#97c8e9',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  permissionBox: {
    padding: 24,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});
