import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const getSupabase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  return createClient<Database>(url, key, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
};

export const supabase = typeof window !== 'undefined' ? getSupabase() : (null as any);
