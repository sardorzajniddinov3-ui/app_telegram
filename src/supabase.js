import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://psjtbcotmnfvgulziara.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzanRiY290bW5mdmd1bHppYXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODYzMzcsImV4cCI6MjA4NjQ2MjMzN30.AXmMzg9GasqUzIUBXdSPPvsZlsMIuMSRXvGTcqQNXKQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
