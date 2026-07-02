import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _supabase: any;

export function getSupabase() {
  if (_supabase) return _supabase;

  const URL = import.meta.env.VITE_SUPABASE_URL || (globalThis as any).process?.env?.SUPABASE_URL;
  const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (globalThis as any).process?.env?.SUPABASE_PUBLISHABLE_KEY;

  if (!URL || !KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  _supabase = createClient<Database>(URL, KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  return _supabase;
}
