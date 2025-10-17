import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFridgeStore } from '../../../src/store/fridgeStore';
import type { FridgeItem } from '../../../src/services/fridgeService';

type FormState = {
  name: string;
  barcode: string;
  quantity: string;
  unit: string;
  expiryDate: string;
  location: string;
  notes: string;
};

const toFormState = (item: FridgeItem): FormState => ({
  name: item.name ?? '',
  barcode: item.barcode ?? '',
  quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '',
  unit: item.unit ?? '',
  expiryDate: item.expiryDate ?? '',
  location: item.location ?? '',
  notes: item.notes ?? '',
});

const emptyForm: FormState = {
  name: '',
  barcode: '',
  quantity: '',
  unit: '',
  expiryDate: '',
  location: '',
  notes: '',
};

const sanitizeString = (value: string) => (value.trim().length > 0 ? value.trim() : null);
const parseQuantity = (value: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function FridgeItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { items, update, remove, load, loading } = useFridgeStore((state) => ({
    items: state.items,
    update: state.update,
    remove: state.remove,
    load: state.load,
    loading: state.loading,
  }));

  const item = useMemo(() => items.find((entry) => entry.id === id), [items, id]);

  const [form, setForm] = useState<FormState>(item ? toFormState(item) : emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!item && !loading) {
      load().catch((reason) => console.warn('[FridgeItemDetail] Reload failed', reason));
    }
  }, [item, loading, load]);

  useEffect(() => {
    if (item) {
      setForm(toFormState(item));
    }
  }, [item?.id]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = useCallback(async () => {
    if (!item) {
      return;
    }
    if (!form.name.trim()) {
      Alert.alert('Nom requis', 'Veuillez indiquer un nom pour cet aliment.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: FridgeItem = {
        ...item,
        name: form.name.trim(),
        barcode: sanitizeString(form.barcode),
        quantity: parseQuantity(form.quantity),
        unit: sanitizeString(form.unit),
        expiryDate: sanitizeString(form.expiryDate),
        location: sanitizeString(form.location),
        notes: sanitizeString(form.notes),
      };
      await update(payload);
      router.back();
    } catch (error) {
      console.warn('[FridgeItemDetail] Update failed', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Mise a jour impossible.');
    } finally {
      setIsSaving(false);
    }
  }, [item, form, update, router]);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    setIsDeleting(true);
    try {
      await remove(item.id);
      router.back();
    } catch (error) {
      console.warn('[FridgeItemDetail] Delete failed', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Suppression impossible.');
    } finally {
      setIsDeleting(false);
    }
  }, [item, remove, router]);

  const confirmDeletion = useCallback(() => {
    if (!item) {
      return;
    }
    Alert.alert(
      'Supprimer',
      'Voulez-vous vraiment retirer cet aliment ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => handleDelete(),
        },
      ],
      { cancelable: true }
    );
  }, [item, handleDelete]);

  if (!item) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Aliment introuvable</Text>
        <Text style={styles.fallbackSubtitle}>
          Rafraichissez la liste depuis l'onglet principal puis reessayez.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Modifier l'aliment</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Code-barres</Text>
        <TextInput
          value={form.barcode}
          onChangeText={(value) => handleChange('barcode', value)}
          placeholder="0000000000000"
          style={styles.input}
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
        style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.primaryButtonText}>{isSaving ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
        onPress={confirmDeletion}
        disabled={isDeleting}
      >
        <Text style={styles.deleteButtonText}>{isDeleting ? 'Suppression...' : 'Supprimer'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
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
  primaryButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#97c8e9',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  deleteButton: {
    marginTop: 8,
    backgroundColor: '#d9534f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#f3b2b0',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f5f5f5',
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  fallbackSubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
});
