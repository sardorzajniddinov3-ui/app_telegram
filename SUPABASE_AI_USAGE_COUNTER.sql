-- ====================================
-- ТАБЛИЦА ДЛЯ СЧЕТЧИКА ИСПОЛЬЗОВАНИЯ ИИ
-- ====================================

-- Создание таблицы для хранения счетчика использования ИИ
CREATE TABLE IF NOT EXISTS ai_usage_counter (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id BIGINT NOT NULL, -- Telegram user ID
  subscription_end_date TIMESTAMPTZ, -- Дата окончания подписки (для привязки счетчика к подписке)
  hints_count INTEGER NOT NULL DEFAULT 0, -- Количество использований ИИ для подсказок в тестах
  other_count INTEGER NOT NULL DEFAULT 0, -- Количество использований ИИ в других местах
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Уникальный индекс: один счетчик на пользователя и подписку
  UNIQUE(user_id, subscription_end_date)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_ai_usage_counter_user_id ON ai_usage_counter(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_counter_subscription_end_date ON ai_usage_counter(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_counter_user_subscription ON ai_usage_counter(user_id, subscription_end_date);

-- Включить RLS (Row Level Security)
ALTER TABLE ai_usage_counter ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут читать только свои данные
CREATE POLICY "Users can read their own AI usage counter" ON ai_usage_counter
  FOR SELECT
  USING (auth.uid()::text = user_id::text OR true); -- Разрешаем всем читать (можно изменить на строгую проверку)

-- Политика: пользователи могут вставлять свои данные
CREATE POLICY "Users can insert their own AI usage counter" ON ai_usage_counter
  FOR INSERT
  WITH CHECK (true); -- Разрешаем всем вставлять

-- Политика: пользователи могут обновлять свои данные
CREATE POLICY "Users can update their own AI usage counter" ON ai_usage_counter
  FOR UPDATE
  USING (true) -- Разрешаем всем обновлять
  WITH CHECK (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_ai_usage_counter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_update_ai_usage_counter_updated_at ON ai_usage_counter;
CREATE TRIGGER trigger_update_ai_usage_counter_updated_at
  BEFORE UPDATE ON ai_usage_counter
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_usage_counter_updated_at();

-- Комментарии к таблице и полям
COMMENT ON TABLE ai_usage_counter IS 'Таблица для хранения счетчика использования ИИ пользователями';
COMMENT ON COLUMN ai_usage_counter.user_id IS 'Telegram user ID пользователя';
COMMENT ON COLUMN ai_usage_counter.subscription_end_date IS 'Дата окончания подписки (для привязки счетчика к конкретной подписке)';
COMMENT ON COLUMN ai_usage_counter.hints_count IS 'Количество использований ИИ для подсказок в тестах';
COMMENT ON COLUMN ai_usage_counter.other_count IS 'Количество использований ИИ в других местах (советы, объяснения вне тестов)';
