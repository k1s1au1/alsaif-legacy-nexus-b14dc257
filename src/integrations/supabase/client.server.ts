import type { Database } from './types';

// Standard server-side client setup
export const getSupabaseAdmin = async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  // Use dynamic import to avoid serialization issues with Proxy objects
  const { createClient } = await import('@supabase/supabase-js');

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};
