-- Добавление администратора с ID 1769624468253
-- Выполните этот SQL в вашей базе данных PostgreSQL (Supabase)

-- Проверяем, не существует ли уже этот админ
-- Если не существует, добавляем его
INSERT INTO admins (telegram_id, created_by)
SELECT 1769624468253, 473842863
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE telegram_id = 1769624468253);

-- Проверка: выполните SELECT * FROM admins WHERE telegram_id = 1769624468253;
-- чтобы убедиться, что админ добавлен
