import { createClient } from '@supabase/supabase-js'

// Создаем клиент Supabase строго из переменных окружения (проект на Vite)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export { supabase }
