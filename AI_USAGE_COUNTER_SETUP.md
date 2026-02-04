# 📊 Настройка счетчика использования ИИ в базе данных

## Шаг 1: Создание таблицы в Supabase

1. Откройте **Supabase Dashboard** → ваш проект
2. Перейдите в **SQL Editor**
3. Выполните SQL из файла `SUPABASE_AI_USAGE_COUNTER.sql`:

```sql
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
  USING (true); -- Разрешаем всем читать

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
```

## Шаг 2: Проверка таблицы

После создания таблицы выполните запрос для проверки:

```sql
SELECT * FROM ai_usage_counter LIMIT 10;
```

## Как это работает

1. **Автоматическое сохранение**: При каждом использовании ИИ счетчик автоматически сохраняется в базу данных
2. **Fallback на localStorage**: Если нет подключения к базе или нет userId, данные сохраняются в localStorage
3. **Миграция данных**: При первом использовании данные из localStorage автоматически мигрируют в базу данных
4. **Привязка к подписке**: Счетчик привязан к конкретной подписке через `subscription_end_date`
5. **Автоматический сброс**: При смене подписки счетчик автоматически сбрасывается

## Преимущества

- ✅ Данные синхронизируются между устройствами
- ✅ Данные не теряются при очистке localStorage
- ✅ Можно отслеживать использование ИИ на сервере
- ✅ Более надежное хранение данных
- ✅ Автоматическая миграция из localStorage

## Отладка

Если счетчик не работает, проверьте консоль браузера на наличие логов:
- `[AI_COUNTER] Загружено из БД:` - данные загружены из базы
- `[AI_COUNTER] Сохранено в БД:` - данные сохранены в базу
- `[AI_COUNTER] Нет userId, используем localStorage` - используется fallback
