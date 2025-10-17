import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initDb } from '../src/db/sqlite';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'fridge/index',
};

export default function RootLayout() {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    FontAwesome.loadFont().catch((error) => console.warn('[Fonts]', error));
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await initDb();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Bootstrap]', error);
        if (active) {
          setBootstrapError(message);
        }
        return;
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  if (bootstrapError) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Une erreur est survenue.</Text>
        <Text style={styles.errorMessage}>{bootstrapError}</Text>
      </SafeAreaView>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Initialisation…</Text>
      </SafeAreaView>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#555',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#d00',
    textAlign: 'center',
  },
});
