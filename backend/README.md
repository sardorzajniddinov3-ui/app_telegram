## Telegram Mini App Backend (Node.js + Express + PostgreSQL)

### Требования

- Node.js 18+
- PostgreSQL
- Переменные окружения:
  - **DATABASE_URL**: строка подключения Postgres
  - **PORT**: порт сервера (по умолчанию 3000)
  - **RUN_MIGRATIONS**: если `true`, применяет миграции при старте

Пример окружения см. в `backend/env.example`.

### Установка

```bash
cd backend
npm install
```

### Миграции (создание таблиц)

```bash
cd backend
npm run migrate
```

### Запуск

```bash
cd backend
npm start
```

### API

- **POST** `/api/auth` — сохранить пользователя (из Telegram WebApp `initDataUnsafe.user`)
  - body:
    - `user`: объект пользователя Telegram (минимум `id`)
    - или `initDataUnsafe.user`

- **GET** `/api/tests` — список тестов

- **GET** `/api/tests/:id` — вопросы и ответы теста

- **POST** `/api/results` — сохранить результат (требует Telegram user)
  - body:
    - `user` (или `initDataUnsafe.user`)
    - `testId`, `correct`, `total` (+ optional: `answered`, `timeSeconds`)

### Быстрые примеры (curl)

```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d "{\"user\":{\"id\":123,\"username\":\"alice\",\"first_name\":\"Alice\"}}"
```

```bash
curl http://localhost:3000/api/tests
```

```bash
curl http://localhost:3000/api/tests/1
```

```bash
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -d "{\"user\":{\"id\":123},\"testId\":1,\"correct\":8,\"total\":10,\"timeSeconds\":45}"
```

### Тесты

Тесты используют **pg-mem** (in-memory Postgres), реальный Postgres не нужен:

```bash
cd backend
npm test
```

