# 🗄️ Настройка Supabase для хранения тестов и вопросов

## Структура таблиц

Приложение использует следующую структуру таблиц в Supabase:

- **`quizzes`** - Квизы (темы)
- **`questions`** - Вопросы
- **`options`** - Варианты ответов
- **`profiles`** - Профили пользователей
- **`user_progress`** - Прогресс пользователей

## Шаг 1: Проверка таблиц

Убедитесь, что в Supabase Dashboard созданы следующие таблицы:

### Таблица `quizzes`:
- `id` (uuid, PRIMARY KEY)
- `title` (text) - Название квиза
- `description` (text, nullable) - Описание
- `created_at` (timestamptz)

### Таблица `questions`:
- `id` (uuid, PRIMARY KEY)
- `quiz_id` (uuid, FK → quizzes.id) - ID квиза
- `question_text` (text) - Текст вопроса
- `image_url` (text, nullable) - URL изображения
- `explanation` (text, nullable) - Объяснение ответа
- `created_at` (timestamptz)

### Таблица `options`:
- `id` (uuid, PRIMARY KEY)
- `question_id` (uuid, FK → questions.id) - ID вопроса
- `option_text` (text) - Текст варианта ответа
- `is_correct` (bool) - Правильный ли ответ
- `created_at` (timestamptz)

Если таблицы не созданы, выполните следующий SQL в **SQL Editor**:

```sql
-- ========== ТАБЛИЦА QUIZZES (Квизы/Темы) ==========
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для quizzes
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);

-- ========== ТАБЛИЦА QUESTIONS (Вопросы) ==========
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  image_url TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для questions
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);

-- ========== ТАБЛИЦА OPTIONS (Варианты ответов) ==========
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для options
CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_options_is_correct ON options(is_correct);

-- ========== ROW LEVEL SECURITY (RLS) ==========
-- Включаем RLS для всех таблиц
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать квизы, вопросы и опции (публичный доступ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quizzes' 
    AND policyname = 'Anyone can read quizzes'
  ) THEN
    CREATE POLICY "Anyone can read quizzes" ON quizzes
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' 
    AND policyname = 'Anyone can read questions'
  ) THEN
    CREATE POLICY "Anyone can read questions" ON questions
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'options' 
    AND policyname = 'Anyone can read options'
  ) THEN
    CREATE POLICY "Anyone can read options" ON options
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- Политика: все могут вставлять/обновлять/удалять (для админа через фронтенд)
-- В реальном проекте можно ограничить только для админа, но для простоты оставляем открытым
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quizzes' 
    AND policyname = 'Anyone can manage quizzes'
  ) THEN
    CREATE POLICY "Anyone can manage quizzes" ON quizzes
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' 
    AND policyname = 'Anyone can manage questions'
  ) THEN
    CREATE POLICY "Anyone can manage questions" ON questions
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'options' 
    AND policyname = 'Anyone can manage options'
  ) THEN
    CREATE POLICY "Anyone can manage options" ON options
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ========== МИГРАЦИЯ ДАННЫХ ИЗ localStorage (ОПЦИОНАЛЬНО) ==========
-- Если у вас уже есть данные в localStorage, их можно импортировать вручную через админ-панель
-- Или выполните этот SQL для создания дефолтных квизов:

INSERT INTO quizzes (title, description) VALUES
  ('Термины', NULL),
  ('Обязанности участников дорожного движения', NULL),
  ('Сигналы светофора и регулировщика', NULL),
  ('Предупредительные и аварийные сигналы', NULL),
  ('Опознавательные знаки транспортных средств', NULL),
  ('Предупреждающие знаки', NULL),
  ('Знаки приоритета', NULL),
  ('Запрещающие знаки', NULL),
  ('Предписывающие знаки', NULL),
  ('Информационно указательные, сервисные и доп. знаки', NULL),
  ('Дорожные разметки', NULL)
ON CONFLICT DO NOTHING;
```

## Шаг 2: Проверка таблиц

После выполнения SQL проверьте:

1. **Table Editor** → должны появиться таблицы `quizzes`, `questions` и `options`
2. **Authentication → Policies** → должны быть активны политики для чтения и записи

## Структура данных

### Таблица `quizzes`:
- `id` (UUID) - Уникальный ID квиза
- `title` (TEXT) - Название квиза
- `description` (TEXT, nullable) - Описание квиза
- `created_at` (TIMESTAMPTZ) - Дата создания

### Таблица `questions`:
- `id` (UUID) - Уникальный ID вопроса
- `quiz_id` (UUID) - ID квиза (FK)
- `question_text` (TEXT) - Текст вопроса
- `image_url` (TEXT, nullable) - URL изображения (если есть)
- `explanation` (TEXT, nullable) - Объяснение ответа
- `created_at` (TIMESTAMPTZ) - Дата создания

### Таблица `options`:
- `id` (UUID) - Уникальный ID опции
- `question_id` (UUID) - ID вопроса (FK)
- `option_text` (TEXT) - Текст варианта ответа
- `is_correct` (BOOLEAN) - Правильный ли ответ
- `created_at` (TIMESTAMPTZ) - Дата создания

## Что изменилось в коде

✅ **Загрузка тем**: Теперь загружаются из Supabase при старте приложения
✅ **Сохранение тем**: Все изменения тем сохраняются в Supabase
✅ **Загрузка вопросов**: Вопросы загружаются из Supabase по topic_id
✅ **Сохранение вопросов**: Все новые/изменённые вопросы сохраняются в Supabase
✅ **Синхронизация**: Все пользователи видят одинаковые тесты и вопросы

## Миграция существующих данных

Если у вас уже есть данные в localStorage:

1. Откройте консоль браузера (F12)
2. Выполните:
   ```javascript
   // Получить темы из localStorage
   const topics = JSON.parse(localStorage.getItem('dev_topics') || '[]');
   console.log('Topics:', topics);
   
   // Получить вопросы из localStorage
   const questions = JSON.parse(localStorage.getItem('dev_questions') || '[]');
   console.log('Questions:', questions);
   ```
3. Скопируйте данные и импортируйте их через админ-панель или SQL

## Тестирование

1. Откройте приложение
2. Темы должны загрузиться из Supabase
3. В админке можно добавлять/редактировать темы и вопросы
4. Все изменения сохраняются в Supabase и видны всем пользователям
