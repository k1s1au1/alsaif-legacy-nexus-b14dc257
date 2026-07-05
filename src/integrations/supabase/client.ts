import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Standard client setup with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

// We export a variable that is NOT a Proxy during build/server-side analysis.
// This prevents [Getter/Setter] serialization errors.
export const supabase = (typeof window !== 'undefined')
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : {
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
            single: () => Promise.resolve({ data: null })
          })
        })
      })
    } as any;

export const getSupabase = () => supabase;
