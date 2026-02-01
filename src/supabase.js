import { createClient } from '@supabase/supabase-js'

// Используем переменные окружения с fallback на значения по умолчанию
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rjfchznkmulatifulele.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZmNoem5rbXVsYXRpZnVsZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjcxNjYsImV4cCI6MjA4NTI0MzE2Nn0.zKh_FO2M2htwW8-PrdC6wlsYiK-XB0irOAlAvqro5YE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
