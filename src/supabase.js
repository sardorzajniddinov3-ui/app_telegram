import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rjfchznkmulatifulele.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZmNoem5rbXVsYXRpZnVsZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjcxNjYsImV4cCI6MjA4NTI0MzE2Nn0.zKh_FO2M2htwW8-PrdC6wlsYiK-XB0irOAlAvqro5YE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
