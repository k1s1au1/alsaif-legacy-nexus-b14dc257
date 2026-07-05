import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Standard client setup with environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// We only initialize if keys are present to avoid build-time Proxy errors
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : ({} as any);

export const getSupabase = () => supabase;
