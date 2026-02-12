# Установка Supabase CLI на Windows

## ⚠️ Важно: npm install -g больше не поддерживается!

Supabase CLI больше не устанавливается через `npm install -g`. Используйте один из методов ниже.

---

## Метод 1: Через Scoop (рекомендуется для Windows)

### Шаг 1: Установите Scoop (если еще не установлен)

Откройте PowerShell от имени администратора и выполните:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

### Шаг 2: Установите Supabase CLI

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Шаг 3: Проверьте установку

```powershell
supabase --version
```

---

## Метод 2: Скачать бинарник напрямую

1. Перейдите на https://github.com/supabase/cli/releases
2. Скачайте последнюю версию для Windows: `supabase_windows_amd64.zip`
3. Распакуйте архив
4. Добавьте папку с `supabase.exe` в PATH:
   - Откройте "Переменные среды" (Environment Variables)
   - Добавьте путь к папке в переменную PATH

---

## Метод 3: Через Chocolatey (если установлен)

```powershell
choco install supabase
```

---

## Метод 4: Использовать веб-интерфейс (САМЫЙ ПРОСТОЙ)

Если установка CLI вызывает проблемы, используйте веб-интерфейс Supabase Dashboard:

1. Откройте https://supabase.com/dashboard
2. Перейдите в **Edge Functions**
3. Создайте функцию `explain-answer`
4. Скопируйте код из `index.ts`
5. Добавьте секрет `GEMINI_API_KEY`
6. Задеплойте

**Подробная инструкция:** см. файл `QUICK_DEPLOY.md`

---

## После установки CLI

### Логин:

```powershell
supabase login
```

### Связывание проекта:

```powershell
cd apptg111/apptg/telegram-mini-app
supabase link --project-ref psjtbcotmnfvgulziara
```

### Деплой функции:

```powershell
supabase functions deploy explain-answer
```
