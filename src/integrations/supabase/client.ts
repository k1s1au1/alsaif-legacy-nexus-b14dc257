import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Standard client for browser use
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Getter for files that need a reliable instance
export const getSupabase = () => supabase;
