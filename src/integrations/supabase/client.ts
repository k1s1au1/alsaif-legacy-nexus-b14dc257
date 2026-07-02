import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _supabase: any;

export function getSupabase() {
  if (_supabase) return _supabase;

  const URL = import.meta.env.VITE_SUPABASE_URL || (process as any).env?.SUPABASE_URL;
  const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (process as any).env?.SUPABASE_PUBLISHABLE_KEY;

  if (!URL || !KEY) return null;

  _supabase = createClient<Database>(URL, KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  return _supabase;
}

export const supabase = typeof window !== 'undefined' ? getSupabase() : (null as any);
