import { createClient } from '@supabase/supabase-js'

// Получаем переменные окружения для Supabase (проект на Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Проверяем наличие переменных окружения
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = []
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY')
  
  console.error('❌ [SUPABASE] Отсутствуют переменные окружения:', missingVars.join(', '))
  console.error('❌ [SUPABASE] Создайте файл .env в корне проекта telegram-mini-app со следующими переменными:')
  console.error('   VITE_SUPABASE_URL=https://psjtbcotmnfvgulziara.supabase.co')
  console.error('   VITE_SUPABASE_ANON_KEY=<ваш_anon_key_из_Supabase_Dashboard>')
  console.error('')
  console.error('⚠️ [SUPABASE] Получите правильный ключ из Supabase Dashboard:')
  console.error('   1. Откройте https://supabase.com/dashboard')
  console.error('   2. Выберите проект psjtbcotmnfvgulziara')
  console.error('   3. Перейдите: Settings → API')
  console.error('   4. Скопируйте anon/public key')
  console.error('')
  console.error('⚠️ [SUPABASE] Приложение не будет работать без правильного API ключа!')
  
  // НЕ используем временные значения - это вызовет ошибку "Invalid API key"
  // Вместо этого выбрасываем ошибку, чтобы пользователь понял проблему
  throw new Error('VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY должны быть установлены в файле .env')
}

// Проверяем, что URL соответствует проекту psjtbcotmnfvgulziara
if (supabaseUrl && !supabaseUrl.includes('psjtbcotmnfvgulziara')) {
  console.warn('⚠️ [SUPABASE] URL не соответствует проекту psjtbcotmnfvgulziara:', supabaseUrl)
  console.warn('⚠️ [SUPABASE] Убедитесь, что используете правильный URL для проекта psjtbcotmnfvgulziara')
}

// Проверяем JWT токен на соответствие проекту
if (supabaseAnonKey) {
  try {
    // Декодируем JWT токен (без проверки подписи)
    const parts = supabaseAnonKey.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]))
      const tokenRef = payload.ref
      
      if (tokenRef && tokenRef !== 'psjtbcotmnfvgulziara') {
        console.error('❌ [SUPABASE] КРИТИЧЕСКАЯ ОШИБКА: API ключ от другого проекта!')
        console.error(`❌ [SUPABASE] Ключ от проекта: ${tokenRef}`)
        console.error('❌ [SUPABASE] Нужен ключ от проекта: psjtbcotmnfvgulziara')
        console.error('')
        console.error('🔧 [SUPABASE] Как исправить:')
        console.error('   1. Откройте https://supabase.com/dashboard')
        console.error('   2. Выберите проект psjtbcotmnfvgulziara (НЕ memoqljluizvccomaind!)')
        console.error('   3. Перейдите: Settings → API')
        console.error('   4. Скопируйте anon/public key')
        console.error('   5. Обновите VITE_SUPABASE_ANON_KEY в файле .env')
        console.error('   6. Перезапустите dev-сервер (npm run dev)')
        console.error('')
        console.error('⚠️ [SUPABASE] Приложение будет работать с ошибками до исправления ключа!')
      } else if (tokenRef === 'psjtbcotmnfvgulziara') {
        console.log('✅ [SUPABASE] API ключ соответствует проекту psjtbcotmnfvgulziara')
      }
    }
  } catch (e) {
    console.warn('⚠️ [SUPABASE] Не удалось проверить JWT токен:', e)
  }
}

// Создаем клиент Supabase строго из переменных окружения (проект на Vite)
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Логируем информацию о подключении
console.log('🔧 [SUPABASE] Клиент инициализирован:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 40)}...` : 'не установлен',
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0
})

// Проверяем подключение асинхронно (не блокируем запуск)
setTimeout(async () => {
  try {
    const { error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
      if (error.message && error.message.includes('Invalid API key')) {
        console.error('❌ [SUPABASE] ОШИБКА: Неверный API ключ!')
        console.error('❌ [SUPABASE] Получите правильный ключ из Supabase Dashboard для проекта psjtbcotmnfvgulziara')
        console.error('❌ [SUPABASE] Обновите VITE_SUPABASE_ANON_KEY в файле .env и перезапустите сервер')
      } else {
        console.error('❌ [SUPABASE] Ошибка подключения:', error.message)
      }
    } else {
      console.log('✅ [SUPABASE] Подключение к базе данных успешно')
    }
  } catch (e) {
    console.error('❌ [SUPABASE] Ошибка проверки подключения:', e)
  }
}, 1000)

export { supabase }
