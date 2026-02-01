import { createClient } from '@supabase/supabase-js'

// Используем переменные окружения с fallback на значения по умолчанию
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Проверка загрузки ключей (для отладки в браузере)
console.log('Supabase URL exists:', !!supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

// Проверка наличия переменных окружения
if (!supabaseUrl || !supabaseKey) {
  console.error("⛔ CRITICAL: Supabase keys are missing! Check .env variables.");
  console.error("VITE_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
  console.error("VITE_SUPABASE_ANON_KEY:", supabaseKey ? "✅ Set" : "❌ Missing");
}

// Используем fallback значения, если переменные не заданы
const SUPABASE_URL = supabaseUrl || 'https://rjfchznkmulatifulele.supabase.co';
const SUPABASE_ANON_KEY = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZmNoem5rbXVsYXRpZnVsZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjcxNjYsImV4cCI6MjA4NTI0MzE2Nn0.zKh_FO2M2htwW8-PrdC6wlsYiK-XB0irOAlAvqro5YE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
