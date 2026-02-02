-- ========== ОБНОВЛЕНИЕ ТАБЛИЦЫ AI_EXPLANATIONS ДЛЯ ЭМБЕДДИНГОВ ==========
-- Добавляем поддержку эмбеддингов для семантического поиска похожих вопросов

-- ВАЖНО: Сначала нужно установить расширение pgvector в Supabase
-- Выполните в SQL Editor:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Добавляем колонку для хранения эмбеддинга вопроса
ALTER TABLE ai_explanations 
ADD COLUMN IF NOT EXISTS question_embedding vector(768);

-- Создаем индекс для векторного поиска (HNSW для быстрого поиска)
CREATE INDEX IF NOT EXISTS idx_ai_explanations_embedding 
ON ai_explanations 
USING hnsw (question_embedding vector_cosine_ops);

-- Комментарий для документации
COMMENT ON COLUMN ai_explanations.question_embedding IS 'Эмбеддинг вопроса, созданный с помощью text-embedding-004 (Gemini Embedding v1). Размерность: 768.';
