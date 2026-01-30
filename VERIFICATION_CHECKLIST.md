# ✅ Чек-лист проверки SQL скрипта

## Проверка синтаксиса SQL

### ✅ Таблица `quizzes`
- [x] DROP POLICY для всех старых политик
- [x] CREATE POLICY для INSERT (WITH CHECK (true))
- [x] CREATE POLICY для SELECT (USING (true))
- [x] CREATE POLICY для UPDATE (USING + WITH CHECK)
- [x] CREATE POLICY для DELETE (USING (true))

### ✅ Таблица `questions`
- [x] DROP POLICY для всех старых политик
- [x] CREATE POLICY для INSERT (WITH CHECK (true))
- [x] CREATE POLICY для SELECT (USING (true))
- [x] CREATE POLICY для UPDATE (USING + WITH CHECK)
- [x] CREATE POLICY для DELETE (USING (true))

### ✅ Таблица `options`
- [x] DROP POLICY для всех старых политик
- [x] CREATE POLICY для INSERT (WITH CHECK (true))
- [x] CREATE POLICY для SELECT (USING (true))
- [x] CREATE POLICY для UPDATE (USING + WITH CHECK)
- [x] CREATE POLICY для DELETE (USING (true))

### ✅ Таблица `profiles`
- [x] DROP POLICY для всех старых политик
- [x] CREATE POLICY для INSERT (WITH CHECK (true))
- [x] CREATE POLICY для SELECT (USING (true))
- [x] CREATE POLICY для UPDATE (USING + WITH CHECK)
- [x] CREATE POLICY для DELETE (USING (true))

## Проверка синтаксиса PostgreSQL

### ✅ Правильное использование:
- [x] `DROP POLICY IF EXISTS` - безопасное удаление
- [x] `CREATE POLICY` с правильными параметрами
- [x] `FOR INSERT` с `WITH CHECK (true)`
- [x] `FOR SELECT` с `USING (true)`
- [x] `FOR UPDATE` с `USING (true)` и `WITH CHECK (true)`
- [x] `FOR DELETE` с `USING (true)`
- [x] `TO public` - для всех пользователей (включая anon)

## Итоговая проверка

✅ **Все политики настроены правильно!**

Скрипт готов к выполнению в Supabase SQL Editor.
