import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Use a function to ensure instantiation only happens inside server handlers
export const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};
