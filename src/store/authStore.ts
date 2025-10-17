import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../services/supabase';

const SESSION_KEY = 'supabase.session';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  listenAuthState: () => Promise<() => void>;
};

const serializeSession = (session: Session) => JSON.stringify(session);

const deserializeSession = (value: string | null): Session | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch (error) {
    console.warn('[AuthStore] Failed to parse stored session', error);
    return null;
  }
};

let unsubscribeAuth: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  async signInWithEmail(email: string) {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    set({ loading: false });
  },

  async signInAnonymously() {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    set({ user: data.user ?? null, loading: false, error: null });
  },

  async signOut() {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_KEY).catch((reason) =>
      console.warn('[AuthStore] Failed to clear session', reason)
    );
    set({ user: null, loading: false, error: null });
  },

  async listenAuthState() {
    if (unsubscribeAuth) {
      return unsubscribeAuth;
    }

    set({ loading: true, error: null });

    try {
      const storedSession = deserializeSession(await SecureStore.getItemAsync(SESSION_KEY));
      if (storedSession?.access_token && storedSession?.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });
        if (error) {
          console.warn('[AuthStore] Failed to restore session', error);
          await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
        } else {
          set({ user: data.user ?? storedSession.user ?? null });
        }
      } else {
        const { data } = await supabase.auth.getSession();
        set({ user: data.session?.user ?? null });
      }

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          SecureStore.setItemAsync(SESSION_KEY, serializeSession(session)).catch((reason) =>
            console.warn('[AuthStore] Failed to persist session', reason)
          );
        } else {
          SecureStore.deleteItemAsync(SESSION_KEY).catch((reason) =>
            console.warn('[AuthStore] Failed to remove session', reason)
          );
        }

        set({ user: session?.user ?? null, loading: false, error: null });
      });

      unsubscribeAuth = () => {
        data.subscription.unsubscribe();
        unsubscribeAuth = null;
      };
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        loading: false,
      });
    } finally {
      set({ initialized: true, loading: false });
    }

    return unsubscribeAuth ?? (() => undefined);
  },
}));
