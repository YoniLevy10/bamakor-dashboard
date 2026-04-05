import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  if (!supabaseUrl.startsWith('https://') && !supabaseUrl.startsWith('http://')) {
    throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`)
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey)
}
