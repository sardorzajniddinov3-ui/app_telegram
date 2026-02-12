-- ============================================
-- ОБНОВЛЕНИЕ ВСЕХ URL С СТАРОГО ПРОЕКТА НА НОВЫЙ
-- Старый проект: rjfchznkmulatifulele (или memoqljluizvccomaind)
-- Новый проект: psjtbcotmnfvgulziara
-- ============================================

-- ========== ОБНОВЛЕНИЕ URL В ТАБЛИЦЕ QUESTIONS ==========
-- Обновляем image_url с старого проекта на новый (обновляем оба старых проекта)
UPDATE questions
SET image_url = REPLACE(
  REPLACE(
    image_url,
    'https://rjfchznkmulatifulele.supabase.co',
    'https://psjtbcotmnfvgulziara.supabase.co'
  ),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE image_url LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR image_url LIKE '%memoqljluizvccomaind.supabase.co%';

-- Также обновляем explanation, если там есть URL
UPDATE questions
SET explanation = REPLACE(
  REPLACE(
    explanation,
    'https://rjfchznkmulatifulele.supabase.co',
    'https://psjtbcotmnfvgulziara.supabase.co'
  ),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE explanation LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR explanation LIKE '%memoqljluizvccomaind.supabase.co%';

-- Обновляем question_text, если там есть URL
UPDATE questions
SET question_text = REPLACE(
  REPLACE(
    question_text,
    'https://rjfchznkmulatifulele.supabase.co',
    'https://psjtbcotmnfvgulziara.supabase.co'
  ),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE question_text LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR question_text LIKE '%memoqljluizvccomaind.supabase.co%';

-- ========== ОБНОВЛЕНИЕ URL В ТАБЛИЦЕ PROFILES ==========
-- Обновляем все текстовые поля в profiles, если там есть URL
-- Примечание: photo_url может не существовать в вашей таблице, поэтому обновляем только существующие поля
UPDATE profiles
SET first_name = REPLACE(
  REPLACE(
    first_name,
    'https://rjfchznkmulatifulele.supabase.co',
    'https://psjtbcotmnfvgulziara.supabase.co'
  ),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE first_name LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR first_name LIKE '%memoqljluizvccomaind.supabase.co%';

UPDATE profiles
SET username = REPLACE(
  REPLACE(
    username,
    'https://rjfchznkmulatifulele.supabase.co',
    'https://psjtbcotmnfvgulziara.supabase.co'
  ),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE username LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR username LIKE '%memoqljluizvccomaind.supabase.co%';

-- ========== ОБНОВЛЕНИЕ URL В ТАБЛИЦЕ OPTIONS ==========
-- Если в options есть поля с URL
UPDATE options
SET option_text = REPLACE(
  REPLACE(
    option_text,
    'https://rjfchznkmulatifulele.supabase.co',
    'https://psjtbcotmnfvgulziara.supabase.co'
  ),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE option_text LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR option_text LIKE '%memoqljluizvccomaind.supabase.co%';

-- ========== ОБНОВЛЕНИЕ URL В ДРУГИХ ТАБЛИЦАХ ==========
-- Обновляем все текстовые поля во всех таблицах (универсальный подход)
-- Это обновит любые URL, которые могут быть в любых текстовых полях

-- AI_EXPLANATIONS
UPDATE ai_explanations
SET question = REPLACE(
  REPLACE(question, 'https://rjfchznkmulatifulele.supabase.co', 'https://psjtbcotmnfvgulziara.supabase.co'),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE question LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR question LIKE '%memoqljluizvccomaind.supabase.co%';

UPDATE ai_explanations
SET explanation = REPLACE(
  REPLACE(explanation, 'https://rjfchznkmulatifulele.supabase.co', 'https://psjtbcotmnfvgulziara.supabase.co'),
  'https://memoqljluizvccomaind.supabase.co',
  'https://psjtbcotmnfvgulziara.supabase.co'
)
WHERE explanation LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR explanation LIKE '%memoqljluizvccomaind.supabase.co%';

-- ========== ОБНОВЛЕНИЕ URL В ДРУГИХ ТАБЛИЦАХ ==========
-- Если есть другие таблицы с URL полями, добавьте их здесь

-- ========== ПРОВЕРКА РЕЗУЛЬТАТОВ ==========
-- Проверяем, сколько записей было обновлено
SELECT 
  'questions (image_url)' as table_column,
  COUNT(*) as updated_count
FROM questions
WHERE image_url LIKE '%psjtbcotmnfvgulziara.supabase.co%'
UNION ALL
SELECT 
  'questions (explanation)' as table_column,
  COUNT(*) as updated_count
FROM questions
WHERE explanation LIKE '%psjtbcotmnfvgulziara.supabase.co%'
UNION ALL
SELECT 
  'profiles (text fields)' as table_column,
  COUNT(*) as updated_count
FROM profiles
WHERE first_name LIKE '%psjtbcotmnfvgulziara.supabase.co%'
   OR username LIKE '%psjtbcotmnfvgulziara.supabase.co%';

-- Проверяем, остались ли старые URL
SELECT 
  'questions (image_url) - старые URL' as table_column,
  COUNT(*) as old_urls_count
FROM questions
WHERE image_url LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR image_url LIKE '%memoqljluizvccomaind.supabase.co%'
UNION ALL
SELECT 
  'questions (explanation) - старые URL' as table_column,
  COUNT(*) as old_urls_count
FROM questions
WHERE explanation LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR explanation LIKE '%memoqljluizvccomaind.supabase.co%'
UNION ALL
SELECT 
  'profiles (text fields) - старые URL' as table_column,
  COUNT(*) as old_urls_count
FROM profiles
WHERE first_name LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR first_name LIKE '%memoqljluizvccomaind.supabase.co%'
   OR username LIKE '%rjfchznkmulatifulele.supabase.co%'
   OR username LIKE '%memoqljluizvccomaind.supabase.co%';

-- ========== ГОТОВО! ==========
-- Все URL обновлены с старого проекта на новый.
-- Теперь все ссылки указывают на psjtbcotmnfvgulziara.supabase.co
