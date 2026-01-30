-- SQL команды для настройки RLS в Supabase
-- Выполните эти команды в SQL Editor в Supabase Dashboard

-- 1. Разрешить всем пользователям (включая анонимных) создавать квизы
CREATE POLICY "Allow insert on quizzes for all users"
ON public.quizzes
FOR INSERT
TO public
WITH CHECK (true);

-- 2. Разрешить всем пользователям читать квизы
CREATE POLICY "Allow select on quizzes for all users"
ON public.quizzes
FOR SELECT
TO public
USING (true);

-- 3. Разрешить всем пользователям обновлять квизы
CREATE POLICY "Allow update on quizzes for all users"
ON public.quizzes
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 4. Разрешить всем пользователям удалять квизы
CREATE POLICY "Allow delete on quizzes for all users"
ON public.quizzes
FOR DELETE
TO public
USING (true);

-- Если политики уже существуют, сначала удалите их:
-- DROP POLICY IF EXISTS "Allow insert on quizzes for all users" ON public.quizzes;
-- DROP POLICY IF EXISTS "Allow select on quizzes for all users" ON public.quizzes;
-- DROP POLICY IF EXISTS "Allow update on quizzes for all users" ON public.quizzes;
-- DROP POLICY IF EXISTS "Allow delete on quizzes for all users" ON public.quizzes;
