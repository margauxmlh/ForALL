import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { scheduleExpiryReminders } from '../../src/services/notifications';
import { type FridgeItemInput } from '../../src/services/fridgeService';
import { useFridgeStore } from '../../src/store/fridgeStore';

type FormState = {
  name: string;
  barcode: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  location: string;
  notes: string;
};

const createInitialForm = (): FormState => ({
  name: '',
  barcode: '',
  quantity: '',
  unit: '',
  expiryDate: '',
  location: '',
  notes: '',
});

const sanitizeString = (value: string) => (value.trim().length > 0 ? value.trim() : null);

const parseQuantity = (value: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function FridgeAddScreen() {
  const router = useRouter();
  const addItem = useFridgeStore((state) => state.add);
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((key: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
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

      setForm(createInitialForm());
      router.back();
    } catch (error) {
      console.warn('[FridgeAdd] Failed to create item', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : "Impossible d'enregistrer cet aliment.");
    } finally {
      setIsSubmitting(false);
    }
  }, [form, addItem, router]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Ajouter un aliment</Text>
      <Text style={styles.subtitle}>
        Renseignez la date de péremption pour être alerté avant la fin de validité.
      </Text>

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
            <Text style={styles.label}>Quantité</Text>
            <TextInput
              value={form.quantity}
              onChangeText={(value) => handleChange('quantity', value)}
              placeholder="1"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Unité</Text>
            <TextInput
              value={form.unit}
              onChangeText={(value) => handleChange('unit', value)}
              placeholder="pièce(s)"
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.label}>Date de péremption (YYYY-MM-DD)</Text>
        <TextInput
          value={form.expiryDate}
          onChangeText={(value) => handleChange('expiryDate', value)}
          placeholder="2025-04-12"
          style={styles.input}
        />

        <Text style={styles.label}>Emplacement</Text>
        <TextInput
          value={form.location}
          onChangeText={(value) => handleChange('location', value)}
          placeholder="Portes, bac à légumes…"
          style={styles.input}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={form.notes}
          onChangeText={(value) => handleChange('notes', value)}
          placeholder="Informations complémentaires"
          style={[styles.input, styles.multiline]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f5f5f5',
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111827',
  },
  multiline: {
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2f95dc',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    minWidth: 120,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#2f95dc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#2f95dc',
    fontSize: 15,
    fontWeight: '600',
  },
});
