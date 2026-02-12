import { createClient } from '@supabase/supabase-js'

// Получаем переменные окружения для Supabase (обязательные)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Проверяем, что переменные окружения установлены
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL не установлен. Пожалуйста, создайте файл .env и добавьте VITE_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY не установлен. Пожалуйста, создайте файл .env и добавьте VITE_SUPABASE_ANON_KEY')
}

// Создаем клиент Supabase только с переменными окружения (без fallback значений)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
