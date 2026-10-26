import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// No keys → the site runs in DEMO MODE with sample data saved in the browser.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const isDemo = !supabase;
