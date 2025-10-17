import { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { registerForPushLikePermissions } from '../../../src/services/notifications';
import { type FridgeItem } from '../../../src/services/fridgeService';
import { useFridgeStore } from '../../../src/store/fridgeStore';
import { sortItemsByExpiry } from '../../../src/utils/fridge';

type ExpiryStatus = 'unknown' | 'ok' | 'soon' | 'urgent' | 'expired';

type ExpiryInfo = {
  status: ExpiryStatus;
  badgeLabel: string;
  subtitle: string;
  alertMessage: string;
  warning?: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const STATUS_THEME: Record<ExpiryStatus, { badgeBg: string; badgeText: string; accent: string }> = {
  expired: { badgeBg: '#fee2e2', badgeText: '#b91c1c', accent: '#ef4444' },
  urgent: { badgeBg: '#fef3c7', badgeText: '#b45309', accent: '#f97316' },
  soon: { badgeBg: '#fef9c3', badgeText: '#92400e', accent: '#facc15' },
  ok: { badgeBg: '#dcfce7', badgeText: '#166534', accent: '#22c55e' },
  unknown: { badgeBg: '#e5e7eb', badgeText: '#374151', accent: '#9ca3af' },
};

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
});

const normalizeDate = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

const parseExpiry = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getExpiryInfo = (item: FridgeItem): ExpiryInfo => {
  const parsed = parseExpiry(item.expiryDate);
  if (!item.expiryDate) {
    return {
      status: 'unknown',
      badgeLabel: 'Sans date',
      subtitle: "Aucune date de péremption renseignée.",
      alertMessage: "Aucune date de péremption n'a été renseignée pour cet aliment.",
    };
  }
  if (!parsed) {
    return {
      status: 'unknown',
      badgeLabel: 'Inconnue',
      subtitle: 'Date de péremption invalide.',
      alertMessage:
        "La date indiquée est invalide. Modifiez la fiche de l'aliment pour corriger la date.",
      warning: 'Modifiez la fiche pour corriger la date.',
    };
  }

  const expiryDate = normalizeDate(parsed);
  const today = normalizeDate(new Date());
  const formattedLong = DATE_FORMATTER.format(expiryDate);
  const formattedShort = SHORT_DATE_FORMATTER.format(expiryDate);
  const diffInMs = expiryDate.getTime() - today.getTime();
  const diffInDays = diffInMs >= 0 ? Math.ceil(diffInMs / DAY_IN_MS) : Math.floor(diffInMs / DAY_IN_MS);

  if (diffInDays < 0) {
    const daysAgo = Math.abs(diffInDays);
    const baseSubtitle =
      daysAgo === 1
        ? `Périmé depuis 1 jour (${formattedShort})`
        : `Périmé depuis ${daysAgo} jours (${formattedShort})`;
    return {
      status: 'expired',
      badgeLabel: 'Périmé',
      subtitle: baseSubtitle,
      alertMessage:
        daysAgo === 1
          ? `Cet aliment est périmé depuis 1 jour (${formattedLong}).`
          : `Cet aliment est périmé depuis ${daysAgo} jours (${formattedLong}).`,
      warning: 'Ne consommez pas cet aliment sans vérifier son état.',
    };
  }

  if (diffInDays === 0) {
    return {
      status: 'urgent',
      badgeLabel: "Aujourd'hui",
      subtitle: `Expire aujourd'hui (${formattedShort})`,
      alertMessage: `Cet aliment expire aujourd'hui (${formattedLong}).`,
      warning: 'Consommez-le dès que possible.',
    };
  }

  if (diffInDays <= 3) {
    const baseSubtitle =
      diffInDays === 1
        ? `Expire dans 1 jour (${formattedShort})`
        : `Expire dans ${diffInDays} jours (${formattedShort})`;
    return {
      status: 'urgent',
      badgeLabel: `J-${diffInDays}`,
      subtitle: baseSubtitle,
      alertMessage:
        diffInDays === 1
          ? `Cet aliment expire dans 1 jour (${formattedLong}).`
          : `Cet aliment expire dans ${diffInDays} jours (${formattedLong}).`,
      warning: 'Consommez-le rapidement.',
    };
  }

  if (diffInDays <= 7) {
    return {
      status: 'soon',
      badgeLabel: formattedShort,
      subtitle: `Expire dans ${diffInDays} jours (${formattedShort})`,
      alertMessage: `Cet aliment expire dans ${diffInDays} jours (${formattedLong}).`,
      warning: 'Planifiez son utilisation cette semaine.',
    };
  }

  return {
    status: 'ok',
    badgeLabel: formattedShort,
    subtitle: `Expire le ${formattedLong}.`,
    alertMessage: `Cet aliment expire le ${formattedLong}.`,
  };
};

const formatQuantity = (item: FridgeItem) => {
  const { quantity, unit } = item;
  if ((quantity === null || quantity === undefined) && !unit) {
    return null;
  }
  if (quantity === null || quantity === undefined) {
    return unit;
  }
  if (!unit) {
    return `${quantity}`;
  }
  return `${quantity} ${unit}`;
};

export default function FridgeScreen() {
  const router = useRouter();
  const items = useFridgeStore((state) => state.items);
  const load = useFridgeStore((state) => state.load);
  const loading = useFridgeStore((state) => state.loading);
  const error = useFridgeStore((state) => state.error);
  const subscribeRealtime = useFridgeStore((state) => state.subscribeRealtime);

  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | null = null;
    load().catch((reason) => console.warn('[FridgeScreen] Failed to load', reason));
    registerForPushLikePermissions().catch((reason) =>
      console.warn('[FridgeScreen] Notification permission request failed', reason)
    );

    subscribeRealtime()
      .then((unsubscribe) => {
        cleanup = unsubscribe;
        if (!isMounted) {
          cleanup?.();
        }
      })
      .catch((reason) => console.warn('[FridgeScreen] Realtime subscription failed', reason));

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [load, subscribeRealtime]);

  const sortedItems = useMemo(() => sortItemsByExpiry(items), [items]);

  const handleRefresh = useCallback(() => {
    load().catch((reason) => console.warn('[FridgeScreen] Refresh failed', reason));
  }, [load]);

  const handleNavigateToAdd = useCallback(() => {
    router.push('/fridge/add');
  }, [router]);

  const handleNavigateToScan = useCallback(() => {
    router.push('/fridge/scan');
  }, [router]);

  const handleItemPress = useCallback(
    (item: FridgeItem) => {
      const info = getExpiryInfo(item);
      Alert.alert(item.name, info.alertMessage, [
        { text: 'Modifier', onPress: () => router.push(`/fridge/item/${item.id}`) },
        { text: 'Fermer', style: 'cancel' },
      ]);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      {loading && sortedItems.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Chargement des aliments…</Text>
        </View>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const info = getExpiryInfo(item);
            const theme = STATUS_THEME[info.status];
            const quantityLabel = formatQuantity(item);
            return (
              <TouchableOpacity
                style={[styles.item, { borderLeftColor: theme.accent }]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.85}
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: theme.badgeBg }]}>
                    <Text style={[styles.statusBadgeText, { color: theme.badgeText }]}>
                      {info.badgeLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemSubtitle}>{info.subtitle}</Text>
                {quantityLabel ? <Text style={styles.itemMeta}>Quantité : {quantityLabel}</Text> : null}
                {info.warning ? (
                  <Text
                    style={[
                      styles.warningText,
                      info.status === 'expired' ? styles.warningCritical : styles.warningSoft,
                    ]}
                  >
                    {info.warning}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={sortedItems.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Votre frigo est vide</Text>
              <Text style={styles.emptySubtitle}>
                Ajoutez un aliment pour renseigner sa date de péremption.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor="#999" />
          }
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={handleNavigateToAdd}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryActionText}>Ajouter un aliment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={handleNavigateToScan}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryActionText}>Scanner un produit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
  },
  list: {
    padding: 16,
    paddingBottom: 200,
  },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  itemMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
  },
  warningCritical: {
    color: '#b91c1c',
  },
  warningSoft: {
    color: '#b45309',
  },
  emptyList: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    position: 'absolute',
    bottom: 180,
    left: 24,
    right: 24,
    textAlign: 'center',
    color: '#b00020',
    backgroundColor: '#fff0f0',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  actions: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: '#2f95dc',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  secondaryAction: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2f95dc',
  },
  secondaryActionText: {
    color: '#2f95dc',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
