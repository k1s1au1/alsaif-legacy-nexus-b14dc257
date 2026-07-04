import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Server-side initialization
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const getSupabaseAdmin = () => supabaseAdmin;
