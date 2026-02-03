-- ====================================
-- SCHEMA ДЛЯ ПЕРСОНАЛЬНОГО ИИ-ТРЕНЕРА (БЕЗОПАСНАЯ ВЕРСИЯ)
-- Сначала удаляет старые таблицы, затем создает новые
-- ====================================

-- Удаляем старые функции (если есть)
DROP FUNCTION IF EXISTS get_problematic_topics(BIGINT, INTEGER);
DROP FUNCTION IF EXISTS get_problematic_quizzes(BIGINT, INTEGER);
DROP FUNCTION IF EXISTS get_user_average_performance(BIGINT);
DROP FUNCTION IF EXISTS get_user_error_questions(BIGINT, TEXT);
DROP FUNCTION IF EXISTS get_user_error_questions(BIGINT, UUID);

-- Удаляем старые таблицы (если есть) - CASCADE удалит все зависимости
DROP TABLE IF EXISTS ai_advice CASCADE;
DROP TABLE IF EXISTS user_errors CASCADE;
DROP TABLE IF EXISTS test_results CASCADE;

-- ====================================
-- СОЗДАНИЕ ТАБЛИЦ
-- ====================================

-- Таблица для сохранения результатов тестов
CREATE TABLE test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL, -- Telegram user ID
  topic_id TEXT, -- ID темы (может быть UUID или число)
  is_exam BOOLEAN DEFAULT FALSE, -- true если это экзамен
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  percentage DECIMAL(5,2),
  time_spent INTEGER, -- время в секундах
  completed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для сохранения ошибок пользователя
CREATE TABLE user_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  topic_id TEXT, -- ID темы
  question_id TEXT, -- ID вопроса (может быть UUID или число)
  selected_option_id TEXT, -- ID выбранного ответа
  correct_option_id TEXT, -- ID правильного ответа
  error_count INTEGER DEFAULT 1, -- сколько раз пользователь ошибался на этом вопросе
  last_error_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id) -- один вопрос - одна запись ошибки
);

-- Таблица для сохранения советов ИИ
CREATE TABLE ai_advice (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  advice_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ====================================
-- СОЗДАНИЕ ИНДЕКСОВ
-- ====================================

CREATE INDEX idx_test_results_user_id ON test_results(user_id);
CREATE INDEX idx_test_results_topic_id ON test_results(topic_id);
CREATE INDEX idx_user_errors_user_id ON user_errors(user_id);
CREATE INDEX idx_user_errors_topic_id ON user_errors(topic_id);
CREATE INDEX idx_user_errors_question_id ON user_errors(question_id);
CREATE INDEX idx_ai_advice_user_id ON ai_advice(user_id);

-- ====================================
-- RLS POLICIES (Row Level Security)
-- ====================================

ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_advice ENABLE ROW LEVEL SECURITY;

-- Политики для test_results
CREATE POLICY "Users can view own test results" ON test_results
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own test results" ON test_results
  FOR INSERT WITH CHECK (true);

-- Политики для user_errors
CREATE POLICY "Users can view own errors" ON user_errors
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own errors" ON user_errors
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own errors" ON user_errors
  FOR UPDATE USING (true);

-- Политики для ai_advice
CREATE POLICY "Users can view own advice" ON ai_advice
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own advice" ON ai_advice
  FOR INSERT WITH CHECK (true);

-- ====================================
-- СОЗДАНИЕ ФУНКЦИЙ
-- ====================================

-- Функция для получения самых проблемных тем пользователя
CREATE FUNCTION get_problematic_topics(p_user_id BIGINT, p_limit INTEGER DEFAULT 3)
RETURNS TABLE (
  topic_id TEXT,
  error_count BIGINT,
  unique_questions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.topic_id,
    SUM(ue.error_count)::BIGINT as error_count,
    COUNT(DISTINCT ue.question_id)::BIGINT as unique_questions
  FROM user_errors ue
  WHERE ue.user_id = p_user_id
  GROUP BY ue.topic_id
  ORDER BY error_count DESC, unique_questions DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения средней успеваемости пользователя по всем темам
CREATE FUNCTION get_user_average_performance(p_user_id BIGINT)
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
CREATE FUNCTION get_user_error_questions(p_user_id BIGINT, p_topic_id TEXT)
RETURNS TABLE (
  question_id TEXT,
  error_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.question_id,
    ue.error_count
  FROM user_errors ue
  WHERE ue.user_id = p_user_id AND ue.topic_id = p_topic_id
  ORDER BY ue.error_count DESC, ue.last_error_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- КОММЕНТАРИИ
-- ====================================

COMMENT ON TABLE test_results IS 'Сохранение результатов тестов пользователей для персонального ИИ-тренера';
COMMENT ON TABLE user_errors IS 'Отслеживание ошибок пользователей для адаптивного подбора вопросов';
COMMENT ON TABLE ai_advice IS 'Сохранение советов ИИ-тренера после завершения тестов';
COMMENT ON FUNCTION get_problematic_topics IS 'Возвращает топ-3 самых проблемных тем для пользователя';
COMMENT ON FUNCTION get_user_average_performance IS 'Вычисляет средний процент успеваемости пользователя';
COMMENT ON FUNCTION get_user_error_questions IS 'Возвращает список вопросов с ошибками для адаптивного подбора';
