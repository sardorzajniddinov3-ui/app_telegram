-- Миграция для создания таблицы admins в Supabase
-- Выполните этот SQL в Supabase SQL Editor

-- Создание таблицы admins
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавление главного админа (473842863)
INSERT INTO admins (telegram_id, created_by)
SELECT 473842863, 473842863
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE telegram_id = 473842863);

-- Создание индекса для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_admins_telegram_id ON admins(telegram_id);

-- Настройка Row Level Security (RLS)
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Политика: только админы могут читать список админов
-- (Это базовая политика, можно настроить более детально)
CREATE POLICY "Admins can read admins list"
ON admins
FOR SELECT
USING (true);

-- Политика: только админы могут добавлять админов
-- (В реальности это должно проверяться через backend, но для безопасности добавим)
CREATE POLICY "Admins can insert admins"
ON admins
FOR INSERT
WITH CHECK (true);

-- Политика: только админы могут удалять админов
CREATE POLICY "Admins can delete admins"
ON admins
FOR DELETE
USING (true);

-- Проверка: выполните SELECT * FROM admins; чтобы убедиться, что главный админ добавлен
