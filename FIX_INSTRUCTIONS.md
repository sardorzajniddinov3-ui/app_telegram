# 🔧 Исправление ошибки "column quiz_id does not exist"

## ❌ Проблема
Оригинальный SQL скрипт пытался создать внешние ключи к таблицам, которые могут не существовать или иметь другую структуру.

## ✅ Решение

### 1️⃣ Используйте исправленный SQL скрипт

**Вместо файла `AI_TRAINER_SCHEMA.sql` используйте `AI_TRAINER_SCHEMA_FIXED.sql`**

#### Что изменилось:
- ✅ Убраны внешние ключи (`REFERENCES quizzes`, `REFERENCES questions`, `REFERENCES options`)
- ✅ Колонки `quiz_id`, `question_id`, `option_id` заменены на `topic_id`, `question_id` (тип TEXT)
- ✅ Используется универсальный тип TEXT для ID (поддерживает UUID, числа, строки)
- ✅ Функция переименована: `get_problematic_quizzes` → `get_problematic_topics`
- ✅ Параметр функции: `p_quiz_id` → `p_topic_id`

### 2️⃣ Применить исправленный скрипт

1. Откройте **Supabase Dashboard**
2. Перейдите в **SQL Editor**
3. Нажмите **New Query**
4. Скопируйте весь текст из файла **`AI_TRAINER_SCHEMA_FIXED.sql`**
5. Вставьте и нажмите **Run**

### 3️⃣ Проверьте, что таблицы создались

Выполните в SQL Editor:

```sql
-- Проверка созданных таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('test_results', 'user_errors', 'ai_advice')
ORDER BY table_name;

-- Проверка функций
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%problematic%' OR routine_name LIKE '%performance%' OR routine_name LIKE '%error_questions%';
```

**Должно вернуть:**
- Таблицы: `ai_advice`, `test_results`, `user_errors`
- Функции: `get_problematic_topics`, `get_user_average_performance`, `get_user_error_questions`

## 📝 Код уже обновлен

Я автоматически обновил код в `App.jsx`:
- ✅ `get_problematic_quizzes` → `get_problematic_topics`
- ✅ `p_quiz_id` → `p_topic_id`
- ✅ `quiz_id` → `topic_id`
- ✅ Все ID конвертируются в `String()` для совместимости

## 🚀 Что дальше

После успешного применения SQL скрипта продолжайте с **Шага 2** из `AI_TRAINER_IMPLEMENTATION_GUIDE.md`:

```bash
# Шаг 2: Задеплоить Edge Function
cd d:\apptg\apptg111\apptg111\apptg\telegram-mini-app
supabase functions deploy ai-trainer-advice
```

## ⚠️ Если снова ошибка

Если при выполнении скрипта возникнет другая ошибка, выполните:

```sql
-- Удалите старые объекты (если они были частично созданы)
DROP TABLE IF EXISTS ai_advice CASCADE;
DROP TABLE IF EXISTS user_errors CASCADE;
DROP TABLE IF EXISTS test_results CASCADE;
DROP FUNCTION IF EXISTS get_problematic_topics(BIGINT, INTEGER);
DROP FUNCTION IF EXISTS get_problematic_quizzes(BIGINT, INTEGER);
DROP FUNCTION IF EXISTS get_user_average_performance(BIGINT);
DROP FUNCTION IF EXISTS get_user_error_questions(BIGINT, TEXT);
```

После этого снова запустите `AI_TRAINER_SCHEMA_FIXED.sql`.

## 📊 Структура таблиц (для справки)

### test_results
- `id` (UUID) - PK
- `user_id` (BIGINT) - Telegram ID
- `topic_id` (TEXT) - ID темы
- `is_exam` (BOOLEAN)
- `total_questions` (INTEGER)
- `correct_answers` (INTEGER)
- `percentage` (DECIMAL)
- `time_spent` (INTEGER)

### user_errors
- `id` (UUID) - PK
- `user_id` (BIGINT)
- `topic_id` (TEXT)
- `question_id` (TEXT)
- `selected_option_id` (TEXT)
- `correct_option_id` (TEXT)
- `error_count` (INTEGER)
- UNIQUE(user_id, question_id)

### ai_advice
- `id` (UUID) - PK
- `user_id` (BIGINT)
- `test_result_id` (UUID) → FK к test_results
- `advice_text` (TEXT)
- `created_at` (TIMESTAMP)
