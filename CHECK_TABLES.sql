-- Проверка существующих таблиц и их структуры

-- 1. Проверяем таблицу quizzes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'quizzes'
ORDER BY ordinal_position;

-- 2. Проверяем таблицу questions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'questions'
ORDER BY ordinal_position;

-- 3. Проверяем таблицу options
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'options'
ORDER BY ordinal_position;

-- 4. Проверяем все таблицы в схеме public
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
