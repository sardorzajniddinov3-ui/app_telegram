-- ========== RPC ФУНКЦИЯ ДЛЯ ВЕКТОРНОГО ПОИСКА ==========
-- Эта функция используется для семантического поиска похожих вопросов через эмбеддинги

-- ВАЖНО: Сначала нужно установить расширение pgvector в Supabase
-- Выполните в SQL Editor:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Создаем функцию для векторного поиска
CREATE OR REPLACE FUNCTION match_ai_explanations(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5,
  wrong_answer_filter text DEFAULT NULL,
  correct_answer_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question text,
  wrong_answer text,
  correct_answer text,
  explanation text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_explanations.id,
    ai_explanations.question,
    ai_explanations.wrong_answer,
    ai_explanations.correct_answer,
    ai_explanations.explanation,
    1 - (ai_explanations.question_embedding <=> query_embedding) AS similarity
  FROM ai_explanations
  WHERE 
    ai_explanations.question_embedding IS NOT NULL
    AND (1 - (ai_explanations.question_embedding <=> query_embedding)) >= match_threshold
    AND (wrong_answer_filter IS NULL OR ai_explanations.wrong_answer = wrong_answer_filter)
    AND (correct_answer_filter IS NULL OR ai_explanations.correct_answer = correct_answer_filter)
  ORDER BY ai_explanations.question_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Комментарий для документации
COMMENT ON FUNCTION match_ai_explanations IS 'Функция для семантического поиска похожих вопросов через векторные эмбеддинги. Использует cosine similarity для поиска.';
