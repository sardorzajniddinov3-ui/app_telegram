# 🔧 Настройка новой базы данных Supabase

## Проблема
После переноса на новый проект Supabase база данных не работает, потому что:
1. Таблицы не созданы в новой базе
2. RLS политики не настроены
3. Структура данных может отличаться

## ✅ Решение: Пошаговая настройка

### Шаг 1: Проверка подключения

1. Откройте браузер с приложением
2. Нажмите F12 (открыть консоль разработчика)
3. Перейдите на вкладку **Console**
4. Проверьте наличие ошибок:
   - Если видите ошибки типа `relation "profiles" does not exist` - таблицы не созданы
   - Если видите ошибки типа `new row violates row-level security policy` - RLS не настроен
   - Если видите ошибки типа `Failed to fetch` - проблема с подключением

### Шаг 2: Создание всех необходимых таблиц

Откройте **Supabase Dashboard** → ваш проект `psjtbcotmnfvgulziara` → **SQL Editor** и выполните следующий SQL:

```sql
-- ========== ТАБЛИЦА PROFILES (Профили пользователей) ==========
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, -- Telegram ID пользователя
  first_name TEXT,
  phone TEXT,
  username TEXT,
  telegram_username TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  subscription_tier TEXT DEFAULT 'free',
  ai_queries_count INTEGER DEFAULT 0,
  ai_queries_used INTEGER DEFAULT 0,
  ai_limit_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- ========== ТАБЛИЦА QUIZZES (Квизы/Темы) ==========
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для quizzes
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_sort_order ON quizzes(sort_order);

-- ========== ТАБЛИЦА QUESTIONS (Вопросы) ==========
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  image_url TEXT,
  explanation TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для questions
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);
CREATE INDEX IF NOT EXISTS idx_questions_sort_order ON questions(sort_order);

-- ========== ТАБЛИЦА OPTIONS (Варианты ответов) ==========
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для options
CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_options_is_correct ON options(is_correct);
CREATE INDEX IF NOT EXISTS idx_options_sort_order ON options(sort_order);

-- ========== ТАБЛИЦА SUBSCRIPTIONS (Подписки) ==========
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT,
  subscription_tier TEXT DEFAULT 'free',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_telegram_id ON subscriptions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ========== ТАБЛИЦА ADMINS (Администраторы) ==========
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для admins
CREATE INDEX IF NOT EXISTS idx_admins_telegram_id ON admins(telegram_id);

-- ========== ТАБЛИЦА AI_EXPLANATIONS (Кэш объяснений ИИ) ==========
CREATE TABLE IF NOT EXISTS ai_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  wrong_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  question_embedding vector(768), -- Для векторного поиска (опционально)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question, wrong_answer, correct_answer)
);

-- Индексы для ai_explanations
CREATE INDEX IF NOT EXISTS idx_ai_explanations_question ON ai_explanations(question);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_created_at ON ai_explanations(created_at);

-- ========== ТАБЛИЦА TEST_RESULTS (Результаты тестов) ==========
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  quiz_id UUID REFERENCES quizzes(id),
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  percentage INTEGER DEFAULT 0,
  time_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для test_results
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_quiz_id ON test_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_test_results_created_at ON test_results(created_at DESC);
```

### Шаг 3: Настройка Row Level Security (RLS)

Выполните следующий SQL для настройки RLS политик:

```sql
-- ========== ВКЛЮЧЕНИЕ RLS ДЛЯ ВСЕХ ТАБЛИЦ ==========
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- ========== ПОЛИТИКИ ДЛЯ PROFILES ==========
-- Все могут читать профили (для админки)
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Anyone can read profiles" ON profiles
  FOR SELECT
  USING (true);

-- Все могут вставлять/обновлять профили
DROP POLICY IF EXISTS "Anyone can insert/update profiles" ON profiles;
CREATE POLICY "Anyone can insert/update profiles" ON profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ QUIZZES ==========
-- Все могут читать квизы
DROP POLICY IF EXISTS "Anyone can read quizzes" ON quizzes;
CREATE POLICY "Anyone can read quizzes" ON quizzes
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять/удалять квизы (для админки)
DROP POLICY IF EXISTS "Anyone can manage quizzes" ON quizzes;
CREATE POLICY "Anyone can manage quizzes" ON quizzes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ QUESTIONS ==========
-- Все могут читать вопросы
DROP POLICY IF EXISTS "Anyone can read questions" ON questions;
CREATE POLICY "Anyone can read questions" ON questions
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять/удалять вопросы (для админки)
DROP POLICY IF EXISTS "Anyone can manage questions" ON questions;
CREATE POLICY "Anyone can manage questions" ON questions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ OPTIONS ==========
-- Все могут читать опции
DROP POLICY IF EXISTS "Anyone can read options" ON options;
CREATE POLICY "Anyone can read options" ON options
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять/удалять опции (для админки)
DROP POLICY IF EXISTS "Anyone can manage options" ON options;
CREATE POLICY "Anyone can manage options" ON options
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ SUBSCRIPTIONS ==========
-- Все могут читать подписки
DROP POLICY IF EXISTS "Anyone can read subscriptions" ON subscriptions;
CREATE POLICY "Anyone can read subscriptions" ON subscriptions
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять/удалять подписки (для админки)
DROP POLICY IF EXISTS "Anyone can manage subscriptions" ON subscriptions;
CREATE POLICY "Anyone can manage subscriptions" ON subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ ADMINS ==========
-- Все могут читать админов
DROP POLICY IF EXISTS "Anyone can read admins" ON admins;
CREATE POLICY "Anyone can read admins" ON admins
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять/удалять админов (для админки)
DROP POLICY IF EXISTS "Anyone can manage admins" ON admins;
CREATE POLICY "Anyone can manage admins" ON admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ AI_EXPLANATIONS ==========
-- Все могут читать объяснения
DROP POLICY IF EXISTS "Anyone can read ai_explanations" ON ai_explanations;
CREATE POLICY "Anyone can read ai_explanations" ON ai_explanations
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять объяснения
DROP POLICY IF EXISTS "Anyone can manage ai_explanations" ON ai_explanations;
CREATE POLICY "Anyone can manage ai_explanations" ON ai_explanations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ПОЛИТИКИ ДЛЯ TEST_RESULTS ==========
-- Все могут читать результаты тестов
DROP POLICY IF EXISTS "Anyone can read test_results" ON test_results;
CREATE POLICY "Anyone can read test_results" ON test_results
  FOR SELECT
  USING (true);

-- Все могут создавать/обновлять результаты тестов
DROP POLICY IF EXISTS "Anyone can manage test_results" ON test_results;
CREATE POLICY "Anyone can manage test_results" ON test_results
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### Шаг 4: Добавление главного администратора

Выполните SQL для добавления главного админа (ID: 473842863):

```sql
-- Добавление главного администратора
INSERT INTO admins (telegram_id)
VALUES (473842863)
ON CONFLICT (telegram_id) DO NOTHING;
```

### Шаг 5: Проверка создания таблиц

Выполните SQL для проверки:

```sql
-- Проверка всех таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Должны быть таблицы:
-- admins
-- ai_explanations
-- options
-- profiles
-- questions
-- quizzes
-- subscriptions
-- test_results
```

### Шаг 6: Проверка работы приложения

1. Обновите страницу приложения (F5)
2. Откройте консоль браузера (F12)
3. Проверьте, что нет ошибок
4. Попробуйте зарегистрироваться как новый пользователь
5. Проверьте, что данные сохраняются в таблице `profiles`

## 🔍 Диагностика проблем

### Проблема: "relation does not exist"
**Решение:** Выполните SQL из Шага 2 для создания таблиц

### Проблема: "row-level security policy"
**Решение:** Выполните SQL из Шага 3 для настройки RLS

### Проблема: "Failed to fetch" или "Network error"
**Решение:** 
1. Проверьте, что URL в `.env` файле правильный: `VITE_SUPABASE_URL=https://psjtbcotmnfvgulziara.supabase.co`
2. Проверьте, что ANON_KEY правильный
3. Проверьте, что в Supabase Dashboard проект активен

### Проблема: Данные не сохраняются
**Решение:**
1. Проверьте RLS политики (Шаг 3)
2. Проверьте структуру таблиц (должны совпадать с Шагом 2)
3. Проверьте консоль браузера на наличие ошибок

## ✅ После настройки

После выполнения всех шагов:
1. Приложение должно работать с новой базой данных
2. Все данные будут сохраняться в новом проекте Supabase
3. Edge Functions нужно будет перезадеплоить (если они используются)

## 📝 Примечание

Если у вас уже были данные в старой базе, их нужно будет:
1. Экспортировать из старого проекта
2. Импортировать в новый проект
3. Или использовать Supabase Migration для переноса данных
