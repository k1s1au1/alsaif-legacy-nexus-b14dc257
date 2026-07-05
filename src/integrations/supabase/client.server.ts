import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _supabaseAdmin: any;

export const getSupabaseAdmin = () => {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  _supabaseAdmin = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  return _supabaseAdmin;
};

// DO NOT export as a constant, only as a getter for server functions
