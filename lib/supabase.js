import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these two strings with your actual keys from your Supabase Dashboard:
// Settings (gear icon) -> API
const SUPABASE_URL = 'https://ihyafzoyyopbdiemohlh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lMmEk7iICOv1jR_XTO7Utw_ELIWb9Bk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});