import { createClient, Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
export const SUPABASE_URL = (extra.supabaseUrl as string | undefined) ?? '';
export const SUPABASE_ANON_KEY = (extra.supabaseAnonKey as string | undefined) ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY. Please check your environment configuration.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const getSession = () => supabase.auth.getSession();

export type SupabaseSession = Session | null;
