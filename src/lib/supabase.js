import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey)

function clearLegacyLocalStorageSession() {
  if (!hasSupabaseConfig) {
    return
  }

  const projectReference = new URL(supabaseUrl).hostname.split('.')[0]
  window.localStorage.removeItem(`sb-${projectReference}-auth-token`)
}

clearLegacyLocalStorageSession()

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        storage: window.sessionStorage,
      },
    })
  : null
