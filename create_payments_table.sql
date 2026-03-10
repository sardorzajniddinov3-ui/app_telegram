-- Run this script in the Supabase SQL Editor to create the payments table

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id BIGINT NOT NULL,
  screenshot_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  tariff_name TEXT,
  amount TEXT,
  sender_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Настройка Row Level Security (RLS) для таблицы payments (чтобы пользователи могли добавлять свои чеки)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Разрешаем чтение всем (или только админам, если требуется)
CREATE POLICY "Allow select on payments for all" 
ON payments FOR SELECT 
USING (true);

-- Разрешаем вставку записей (анонимно или авторизованным)
CREATE POLICY "Allow insert on payments for all" 
ON payments FOR INSERT 
WITH CHECK (true);

-- Делаем bucket 'payment-checks' публичным, если он еще не публичный
-- ВНИМАНИЕ: это отдельная операция в хранилище Supabase, её можно выполнить через UI
-- или SQL запрос, если установлен плагин storage.
