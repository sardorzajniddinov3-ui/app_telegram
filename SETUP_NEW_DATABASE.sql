-- ============================================
-- ПОЛНАЯ НАСТРОЙКА НОВОЙ БАЗЫ ДАННЫХ SUPABASE
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard
-- Проект: psjtbcotmnfvgulziara
-- ============================================

-- ========== ШАГ 1: СОЗДАНИЕ ТАБЛИЦ ==========

-- ТАБЛИЦА PROFILES (Профили пользователей)
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

CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- ТАБЛИЦА QUIZZES (Квизы/Темы)
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quizzes_sort_order ON quizzes(sort_order);

-- ТАБЛИЦА QUESTIONS (Вопросы)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  image_url TEXT,
  explanation TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);
CREATE INDEX IF NOT EXISTS idx_questions_sort_order ON questions(sort_order);

-- ТАБЛИЦА OPTIONS (Варианты ответов)
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_options_is_correct ON options(is_correct);
CREATE INDEX IF NOT EXISTS idx_options_sort_order ON options(sort_order);

-- ТАБЛИЦА SUBSCRIPTIONS (Подписки)
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_telegram_id ON subscriptions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ТАБЛИЦА ADMINS (Администраторы)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_telegram_id ON admins(telegram_id);

-- ТАБЛИЦА AI_EXPLANATIONS (Кэш объяснений ИИ)
-- Примечание: Если нужно использовать векторный поиск, сначала включите расширение pgvector:
-- CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS ai_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  wrong_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  -- question_embedding vector(768), -- Раскомментируйте, если включили pgvector
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question, wrong_answer, correct_answer)
);

CREATE INDEX IF NOT EXISTS idx_ai_explanations_question ON ai_explanations(question);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_created_at ON ai_explanations(created_at);

-- ТАБЛИЦА TEST_RESULTS (Результаты тестов)
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

CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_quiz_id ON test_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_test_results_created_at ON test_results(created_at DESC);

-- ========== ШАГ 2: ВКЛЮЧЕНИЕ RLS ==========

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- ========== ШАГ 3: СОЗДАНИЕ RLS ПОЛИТИК ==========

-- PROFILES: Все могут читать, создавать, обновлять
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
CREATE POLICY "Anyone can read profiles" ON profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert/update profiles" ON profiles;
CREATE POLICY "Anyone can insert/update profiles" ON profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- QUIZZES: Все могут читать, создавать, обновлять, удалять
DROP POLICY IF EXISTS "Anyone can read quizzes" ON quizzes;
CREATE POLICY "Anyone can read quizzes" ON quizzes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage quizzes" ON quizzes;
CREATE POLICY "Anyone can manage quizzes" ON quizzes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- QUESTIONS: Все могут читать, создавать, обновлять, удалять
DROP POLICY IF EXISTS "Anyone can read questions" ON questions;
CREATE POLICY "Anyone can read questions" ON questions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage questions" ON questions;
CREATE POLICY "Anyone can manage questions" ON questions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- OPTIONS: Все могут читать, создавать, обновлять, удалять
DROP POLICY IF EXISTS "Anyone can read options" ON options;
CREATE POLICY "Anyone can read options" ON options
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage options" ON options;
CREATE POLICY "Anyone can manage options" ON options
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- SUBSCRIPTIONS: Все могут читать, создавать, обновлять, удалять
DROP POLICY IF EXISTS "Anyone can read subscriptions" ON subscriptions;
CREATE POLICY "Anyone can read subscriptions" ON subscriptions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage subscriptions" ON subscriptions;
CREATE POLICY "Anyone can manage subscriptions" ON subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ADMINS: Все могут читать, создавать, обновлять, удалять
DROP POLICY IF EXISTS "Anyone can read admins" ON admins;
CREATE POLICY "Anyone can read admins" ON admins
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage admins" ON admins;
CREATE POLICY "Anyone can manage admins" ON admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- AI_EXPLANATIONS: Все могут читать, создавать, обновлять
DROP POLICY IF EXISTS "Anyone can read ai_explanations" ON ai_explanations;
CREATE POLICY "Anyone can read ai_explanations" ON ai_explanations
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage ai_explanations" ON ai_explanations;
CREATE POLICY "Anyone can manage ai_explanations" ON ai_explanations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- TEST_RESULTS: Все могут читать, создавать, обновлять
DROP POLICY IF EXISTS "Anyone can read test_results" ON test_results;
CREATE POLICY "Anyone can read test_results" ON test_results
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can manage test_results" ON test_results;
CREATE POLICY "Anyone can manage test_results" ON test_results
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========== ШАГ 4: ДОБАВЛЕНИЕ ГЛАВНОГО АДМИНИСТРАТОРА ==========

INSERT INTO admins (telegram_id)
VALUES (473842863)
ON CONFLICT (telegram_id) DO NOTHING;

-- ========== ГОТОВО! ==========
-- Теперь база данных полностью настроена и готова к работе.
-- Проверьте работу приложения и убедитесь, что нет ошибок в консоли браузера.
