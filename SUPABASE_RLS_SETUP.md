# 🔐 Настройка Row-Level Security (RLS) в Supabase

## Проблема

Ошибка: `new row violates row-level security policy for table "quizzes"`

Это означает, что у пользователей нет прав на создание записей в таблице `quizzes` из-за настроек Row-Level Security (RLS).

## Решение

### Вариант 1: Отключить RLS для таблицы quizzes (для разработки)

1. Зайдите в Supabase Dashboard: https://supabase.com
2. Откройте ваш проект
3. Перейдите: **Table Editor** → **quizzes**
4. Нажмите на иконку замка рядом с названием таблицы
5. Отключите RLS (снимите галочку "Enable Row Level Security")

⚠️ **Внимание:** Это отключает безопасность для всех пользователей. Используйте только для разработки!

### Вариант 2: Настроить RLS политики (рекомендуется)

1. Зайдите в Supabase Dashboard
2. Перейдите: **Authentication** → **Policies**
3. Выберите таблицу `quizzes`
4. Создайте политику:

**Для INSERT (создание):**
```sql
CREATE POLICY "Allow authenticated users to insert quizzes"
ON quizzes
FOR INSERT
TO authenticated
WITH CHECK (true);
```

**Для SELECT (чтение):**
```sql
CREATE POLICY "Allow all users to read quizzes"
ON quizzes
FOR SELECT
TO public
USING (true);
```

**Для UPDATE (обновление):**
```sql
CREATE POLICY "Allow authenticated users to update quizzes"
ON quizzes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

**Для DELETE (удаление):**
```sql
CREATE POLICY "Allow authenticated users to delete quizzes"
ON quizzes
FOR DELETE
TO authenticated
USING (true);
```

### Вариант 3: Использовать SQL Editor

1. Зайдите в Supabase Dashboard
2. Перейдите: **SQL Editor**
3. Выполните следующие команды:

```sql
-- Отключить RLS для таблицы quizzes (временно)
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;

-- Или создать политики для всех операций
CREATE POLICY "Enable all operations for authenticated users" ON quizzes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
```

### Вариант 4: Настроить RLS для анонимных пользователей

Если вы используете anon key (как в коде), создайте политику для анонимных пользователей:

```sql
-- Разрешить анонимным пользователям создавать квизы
CREATE POLICY "Allow anonymous insert on quizzes" ON quizzes
FOR INSERT
TO anon
WITH CHECK (true);

-- Разрешить анонимным пользователям читать квизы
CREATE POLICY "Allow anonymous select on quizzes" ON quizzes
FOR SELECT
TO anon
USING (true);
```

## Проверка

После настройки RLS попробуйте создать вопрос снова. Ошибка должна исчезнуть.

## Важно

- Для продакшена используйте более строгие политики
- Ограничьте доступ только для авторизованных пользователей
- Добавьте проверки прав доступа в политиках
