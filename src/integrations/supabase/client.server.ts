import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

let _supabaseAdmin: any;

export function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  _supabaseAdmin = createClient<Database>(URL, KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  return _supabaseAdmin;
}
