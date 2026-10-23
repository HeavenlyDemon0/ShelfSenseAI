import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tokzyzqmvpnvqvrzwbzn.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRva3p5enFtdnBudnF2cnp3YnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODM1NzIsImV4cCI6MjEwODI1OTU3Mn0.XCFxOBmQFB35g9d9jpA7F7MwKD-6E_7sV60xGKEVH7c'

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ====================================================================
// 1. SUPABASE AUTH HELPERS
// ====================================================================

export async function supabaseSignUp(email, password, role = 'staff', name = 'Store Operator') {
  if (!isSupabaseConfigured) {
    return { data: { user: { email, user_metadata: { role, name } } }, error: null }
  }
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, name }
    }
  })
}

export async function supabaseSignIn(email, password) {
  if (!isSupabaseConfigured) {
    return { data: { user: { email } }, error: null }
  }
  return await supabase.auth.signInWithPassword({
    email,
    password
  })
}

export async function supabaseSignInWithGoogle() {
  if (!isSupabaseConfigured) return { data: null, error: null }
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
}

export async function supabaseSignOut() {
  if (!isSupabaseConfigured) return { error: null }
  return await supabase.auth.signOut()
}

// ====================================================================
// 2. SUPABASE DATABASE HELPERS
// ====================================================================

export async function logMisplacementIncident(incident) {
  if (!isSupabaseConfigured) {
    console.info('[Mock DB] Logged misplacement incident:', incident)
    return { data: incident, error: null }
  }

  try {
    const { data, error } = await supabase
      .from('misplacements')
      .insert([{
        product: incident.class_name || incident.product,
        current_zone: incident.actual_zone_name || incident.current_zone,
        expected_zone: incident.expected_zone_name || incident.expected_zone,
        neighbor_sku: incident.neighbor_sku || null,
        message: incident.message,
        severity: incident.severity || 'WARNING',
        resolved: false,
        created_at: new Date().toISOString()
      }])
    return { data, error }
  } catch (err) {
    console.warn('Supabase insert failed:', err)
    return { data: null, error: err }
  }
}

export async function resolveMisplacementIncident(id) {
  if (!isSupabaseConfigured) {
    return { data: null, error: null }
  }
  return await supabase
    .from('misplacements')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', id)
}

export async function syncInventoryCounts(counts) {
  if (!isSupabaseConfigured) {
    return { data: counts, error: null }
  }

  try {
    const records = Object.entries(counts).map(([sku, count]) => ({
      sku,
      unit_count: count,
      designated_zone: sku === 'Lays' ? 'Top-Left Deck' : (sku === 'CocaCola' ? 'Top-Right Deck' : (sku === 'KitKat' ? 'Bottom-Left Shelf' : 'Bottom-Right Shelf')),
      status: count > 0 ? 'OK' : 'OUT_OF_STOCK',
      updated_at: new Date().toISOString()
    }))
    const { data, error } = await supabase.from('inventory').upsert(records, { onConflict: 'sku' })
    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function fetchLiveInventory() {
  if (!isSupabaseConfigured) {
    return { data: [], error: null }
  }
  return await supabase.from('inventory').select('*')
}

export async function fetchActiveMisplacements() {
  if (!isSupabaseConfigured) {
    return { data: [], error: null }
  }
  return await supabase.from('misplacements').select('*').eq('resolved', false).order('created_at', { ascending: false })
}

// Real-time subscription helper
export function subscribeToDatabaseChanges(table, onUpdate) {
  if (!isSupabaseConfigured) return () => {}

  const channel = supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      onUpdate(payload)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
