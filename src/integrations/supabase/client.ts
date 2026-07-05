import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

// Simplest possible export to avoid [Getter/Setter] serialization errors during static analysis.
// The real client is only created in the browser.
export const supabase = (typeof window !== 'undefined')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {} as any;

export const getSupabase = () => supabase;
