-- ====================================
-- SCHEMA ДЛЯ ПЕРСОНАЛЬНОГО ИИ-ТРЕНЕРА
-- ====================================

-- Таблица для сохранения результатов тестов
CREATE TABLE IF NOT EXISTS test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL, -- Telegram user ID
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  is_exam BOOLEAN DEFAULT FALSE, -- true если это экзамен
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  percentage DECIMAL(5,2),
  time_spent INTEGER, -- время в секундах
  completed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для сохранения ошибок пользователя
CREATE TABLE IF NOT EXISTS user_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  correct_option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  error_count INTEGER DEFAULT 1, -- сколько раз пользователь ошибался на этом вопросе
  last_error_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id) -- один вопрос - одна запись ошибки
);

-- Таблица для сохранения советов ИИ
CREATE TABLE IF NOT EXISTS ai_advice (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  advice_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_quiz_id ON test_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_user_errors_user_id ON user_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_errors_quiz_id ON user_errors(quiz_id);
CREATE INDEX IF NOT EXISTS idx_user_errors_question_id ON user_errors(question_id);
CREATE INDEX IF NOT EXISTS idx_ai_advice_user_id ON ai_advice(user_id);

-- RLS Policies (Row Level Security)
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_advice ENABLE ROW LEVEL SECURITY;

-- Политики для test_results
DROP POLICY IF EXISTS "Users can view own test results" ON test_results;
CREATE POLICY "Users can view own test results" ON test_results
  FOR SELECT USING (true); -- Пока разрешаем всем, можно ограничить по user_id

DROP POLICY IF EXISTS "Users can insert own test results" ON test_results;
CREATE POLICY "Users can insert own test results" ON test_results
  FOR INSERT WITH CHECK (true);

-- Политики для user_errors
DROP POLICY IF EXISTS "Users can view own errors" ON user_errors;
CREATE POLICY "Users can view own errors" ON user_errors
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own errors" ON user_errors;
CREATE POLICY "Users can insert own errors" ON user_errors
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own errors" ON user_errors;
CREATE POLICY "Users can update own errors" ON user_errors
  FOR UPDATE USING (true);

-- Политики для ai_advice
DROP POLICY IF EXISTS "Users can view own advice" ON ai_advice;
CREATE POLICY "Users can view own advice" ON ai_advice
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own advice" ON ai_advice;
CREATE POLICY "Users can insert own advice" ON ai_advice
  FOR INSERT WITH CHECK (true);

-- Функция для получения самых проблемных тем пользователя
CREATE OR REPLACE FUNCTION get_problematic_quizzes(p_user_id BIGINT, p_limit INTEGER DEFAULT 3)
RETURNS TABLE (
  quiz_id UUID,
  error_count BIGINT,
  unique_questions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.quiz_id,
    SUM(ue.error_count) as error_count,
    COUNT(DISTINCT ue.question_id) as unique_questions
  FROM user_errors ue
  WHERE ue.user_id = p_user_id
  GROUP BY ue.quiz_id
  ORDER BY error_count DESC, unique_questions DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения средней успеваемости пользователя по всем темам
CREATE OR REPLACE FUNCTION get_user_average_performance(p_user_id BIGINT)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  avg_percentage DECIMAL(5,2);
BEGIN
  SELECT AVG(percentage) INTO avg_percentage
  FROM test_results
  WHERE user_id = p_user_id AND is_exam = FALSE;
  
  RETURN COALESCE(avg_percentage, 0);
END;
$$ LANGUAGE plpgsql;

-- Функция для получения вопросов с ошибками пользователя по теме
CREATE OR REPLACE FUNCTION get_user_error_questions(p_user_id BIGINT, p_quiz_id UUID)
RETURNS TABLE (
  question_id UUID,
  error_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.question_id,
    ue.error_count
  FROM user_errors ue
  WHERE ue.user_id = p_user_id AND ue.quiz_id = p_quiz_id
  ORDER BY ue.error_count DESC, ue.last_error_at DESC;
END;
$$ LANGUAGE plpgsql;
