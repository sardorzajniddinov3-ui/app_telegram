-- ========== ТАБЛИЦА AI_EXPLANATIONS (Кэш объяснений ИИ) ==========
-- Эта таблица хранит объяснения от ИИ для комбинаций вопрос + неправильный ответ + правильный ответ
-- Это позволяет не обращаться к API каждый раз, а использовать сохраненные ответы

CREATE TABLE IF NOT EXISTS ai_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  wrong_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Уникальный индекс для быстрого поиска по комбинации вопрос + неправильный ответ + правильный ответ
  UNIQUE(question, wrong_answer, correct_answer)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_ai_explanations_question ON ai_explanations(question);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_created_at ON ai_explanations(created_at DESC);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_ai_explanations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_ai_explanations_updated_at ON ai_explanations;
CREATE TRIGGER trigger_update_ai_explanations_updated_at
  BEFORE UPDATE ON ai_explanations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_explanations_updated_at();

-- ========== ROW LEVEL SECURITY (RLS) ==========
ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать объяснения (публичный доступ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_explanations' 
    AND policyname = 'Anyone can read AI explanations'
  ) THEN
    CREATE POLICY "Anyone can read AI explanations" ON ai_explanations
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Политика: все могут вставлять новые объяснения (для Edge Function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_explanations' 
    AND policyname = 'Anyone can insert AI explanations'
  ) THEN
    CREATE POLICY "Anyone can insert AI explanations" ON ai_explanations
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Политика: все могут обновлять объяснения (для Edge Function)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_explanations' 
    AND policyname = 'Anyone can update AI explanations'
  ) THEN
    CREATE POLICY "Anyone can update AI explanations" ON ai_explanations
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Комментарии для документации
COMMENT ON TABLE ai_explanations IS 'Кэш объяснений от ИИ для вопросов тестов. Позволяет не обращаться к API каждый раз.';
COMMENT ON COLUMN ai_explanations.question IS 'Текст вопроса';
COMMENT ON COLUMN ai_explanations.wrong_answer IS 'Неправильный ответ пользователя';
COMMENT ON COLUMN ai_explanations.correct_answer IS 'Правильный ответ';
COMMENT ON COLUMN ai_explanations.explanation IS 'Объяснение от ИИ, почему ответ неправильный';
