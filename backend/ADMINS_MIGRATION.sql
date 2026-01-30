-- Миграция для создания таблицы admins
-- Выполните этот SQL в вашей базе данных PostgreSQL

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT, -- Telegram ID того, кто выдал админку
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert main admin (473842863) if not exists
INSERT INTO admins (telegram_id, created_by)
SELECT 473842863, 473842863
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE telegram_id = 473842863);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_admins_telegram_id ON admins(telegram_id);

-- Проверка: выполните SELECT * FROM admins; чтобы убедиться, что главный админ добавлен
