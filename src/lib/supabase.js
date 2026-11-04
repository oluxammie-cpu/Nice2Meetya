import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fallbacks keep the app loadable in preview mode (no backend configured).
export const supabase = createClient(url || 'http://localhost:54321', key || 'preview')
