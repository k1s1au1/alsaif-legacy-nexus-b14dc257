import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _supabase: any;

export const getSupabase = () => {
  if (_supabase) return _supabase;
  const URL = import.meta.env.VITE_SUPABASE_URL || "";
  const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (!URL || !KEY) return null;
  _supabase = createClient<Database>(URL, KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
  return _supabase;
};

// Export as a build-safe constant.
// During static analysis (Vite build), this will be an empty object.
// At runtime in the browser, it will be the real Supabase client.
export const supabase = typeof window !== 'undefined' ? getSupabase() : ({} as any);
