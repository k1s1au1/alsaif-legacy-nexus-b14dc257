import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _supabaseAdmin: any;

export const getSupabaseAdmin = () => {
  if (_supabaseAdmin) return _supabaseAdmin;
  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) return null;
  _supabaseAdmin = createClient<Database>(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  return _supabaseAdmin;
};

export const supabaseAdmin = typeof process !== 'undefined' ? getSupabaseAdmin() : (null as any);
