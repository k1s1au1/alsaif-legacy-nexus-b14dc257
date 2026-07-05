import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Simple initialization. No Proxies. No getters.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const getSupabase = () => supabase;
