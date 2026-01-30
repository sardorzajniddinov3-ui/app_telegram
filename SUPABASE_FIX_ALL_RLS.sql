-- ============================================
-- ПОЛНАЯ НАСТРОЙКА RLS ДЛЯ ВСЕХ ТАБЛИЦ
-- Выполните этот скрипт в SQL Editor в Supabase
-- ============================================

-- 1. ТАБЛИЦА quizzes - разрешить все операции
-- ============================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Allow public insert on quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Allow public read on quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Allow public update on quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Allow public delete on quizzes" ON public.quizzes;

-- INSERT - создание квизов
CREATE POLICY "Allow public insert on quizzes"
ON public.quizzes
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT - чтение квизов
CREATE POLICY "Allow public read on quizzes"
ON public.quizzes
FOR SELECT
TO public
USING (true);

-- UPDATE - обновление квизов
CREATE POLICY "Allow public update on quizzes"
ON public.quizzes
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE - удаление квизов
CREATE POLICY "Allow public delete on quizzes"
ON public.quizzes
FOR DELETE
TO public
USING (true);

-- 2. ТАБЛИЦА questions - разрешить все операции
-- ============================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Allow public insert on questions" ON public.questions;
DROP POLICY IF EXISTS "Allow public read on questions" ON public.questions;
DROP POLICY IF EXISTS "Allow public update on questions" ON public.questions;
DROP POLICY IF EXISTS "Allow public delete on questions" ON public.questions;

-- INSERT - создание вопросов
CREATE POLICY "Allow public insert on questions"
ON public.questions
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT - чтение вопросов
CREATE POLICY "Allow public read on questions"
ON public.questions
FOR SELECT
TO public
USING (true);

-- UPDATE - обновление вопросов
CREATE POLICY "Allow public update on questions"
ON public.questions
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE - удаление вопросов
CREATE POLICY "Allow public delete on questions"
ON public.questions
FOR DELETE
TO public
USING (true);

-- 3. ТАБЛИЦА options - разрешить все операции
-- ============================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Allow public insert on options" ON public.options;
DROP POLICY IF EXISTS "Allow public read on options" ON public.options;
DROP POLICY IF EXISTS "Allow public update on options" ON public.options;
DROP POLICY IF EXISTS "Allow public delete on options" ON public.options;

-- INSERT - создание опций
CREATE POLICY "Allow public insert on options"
ON public.options
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT - чтение опций
CREATE POLICY "Allow public read on options"
ON public.options
FOR SELECT
TO public
USING (true);

-- UPDATE - обновление опций
CREATE POLICY "Allow public update on options"
ON public.options
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE - удаление опций
CREATE POLICY "Allow public delete on options"
ON public.options
FOR DELETE
TO public
USING (true);

-- 4. ТАБЛИЦА profiles - разрешить все операции (если нужно)
-- ============================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Allow public insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete on profiles" ON public.profiles;

-- INSERT - создание профилей
CREATE POLICY "Allow public insert on profiles"
ON public.profiles
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT - чтение профилей
CREATE POLICY "Allow public read on profiles"
ON public.profiles
FOR SELECT
TO public
USING (true);

-- UPDATE - обновление профилей
CREATE POLICY "Allow public update on profiles"
ON public.profiles
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- DELETE - удаление профилей
CREATE POLICY "Allow public delete on profiles"
ON public.profiles
FOR DELETE
TO public
USING (true);

-- ============================================
-- ГОТОВО! Все политики созданы
-- ============================================
