# 🚂 Railway.app - Визуальная инструкция

## 📸 Пошаговая настройка с картинками

### Шаг 1️⃣: Регистрация

```
┌─────────────────────────────────────┐
│   🚂 Railway.app                    │
│                                     │
│   [Login with GitHub] 👈 Нажми     │
│                                     │
└─────────────────────────────────────┘
```

**Что делать:**
1. Открой https://railway.app/
2. Нажми "Login"
3. Выбери "Login with GitHub"
4. Разреши доступ к репозиториям

---

### Шаг 2️⃣: Создание проекта

```
┌─────────────────────────────────────┐
│   Dashboard                         │
│                                     │
│   [+ New Project] 👈 Нажми         │
│                                     │
│   ┌─────────────────────────────┐  │
│   │ Deploy from GitHub repo     │  │
│   │ Deploy from template        │  │
│   │ Empty project               │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Что делать:**
1. Нажми "+ New Project"
2. Выбери "Deploy from GitHub repo"
3. Найди репозиторий "VioletTunes"
4. Нажми "Deploy Now"

---

### Шаг 3️⃣: Настройка Root Directory

```
┌─────────────────────────────────────┐
│   violettunes-backend               │
│                                     │
│   ⚙️ Settings                       │
│                                     │
│   Root Directory:                   │
│   [backend        ] 👈 Введи       │
│                                     │
│   [Save] 👈 Нажми                  │
└─────────────────────────────────────┘
```

**Что делать:**
1. Открой вкладку "Settings" (шестерёнка)
2. Найди "Root Directory"
3. Введи: `backend`
4. Нажми "Save"

---

### Шаг 4️⃣: Переменные окружения

```
┌─────────────────────────────────────┐
│   Variables                         │
│                                     │
│   [+ New Variable] 👈 Нажми        │
│                                     │
│   Variable Name:                    │
│   [ADMIN_KEY                    ]   │
│                                     │
│   Variable Value:                   │
│   [violettunes-secret-key-2024  ]   │
│                                     │
│   [Add] 👈 Нажми                   │
└─────────────────────────────────────┘
```

**Что делать:**
1. Открой вкладку "Variables"
2. Нажми "+ New Variable"
3. Добавь первую переменную:
   - Name: `ADMIN_KEY`
   - Value: `violettunes-secret-key-2024`
4. Нажми "Add"
5. Повтори для второй переменной:
   - Name: `NODE_ENV`
   - Value: `production`

---

### Шаг 5️⃣: Настройка команд

```
┌─────────────────────────────────────┐
│   Settings → Deploy                 │
│                                     │
│   Build Command:                    │
│   [npm install              ] ✅    │
│                                     │
│   Start Command:                    │
│   [node server.js           ] ✅    │
│                                     │
│   [Save]                            │
└─────────────────────────────────────┘
```

**Что делать:**
1. Settings → Deploy
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Нажми "Save"

---

### Шаг 6️⃣: Получение URL

```
┌─────────────────────────────────────┐
│   Settings → Networking             │
│                                     │
│   Public Networking:                │
│   [Generate Domain] 👈 Нажми       │
│                                     │
│   Your URL:                         │
│   https://violettunes-backend-      │
│   production.up.railway.app         │
│   [📋 Copy] 👈 Скопируй            │
└─────────────────────────────────────┘
```

**Что делать:**
1. Settings → Networking
2. Нажми "Generate Domain"
3. Скопируй URL

---

### Шаг 7️⃣: Проверка деплоя

```
┌─────────────────────────────────────┐
│   Deployments                       │
│                                     │
│   ✅ Active                         │
│   🟢 Building...                    │
│   🟢 Deploying...                   │
│   ✅ Success!                       │
│                                     │
│   Logs:                             │
│   ✓ Database initialized            │
│   ✓ Import scheduler started        │
│   VioletTunes backend running...    │
└─────────────────────────────────────┘
```

**Что проверить:**
1. Открой вкладку "Deployments"
2. Дождись статуса "Success"
3. Проверь логи - должно быть:
   - ✓ Database initialized
   - ✓ Import scheduler started
   - VioletTunes backend running...

---

### Шаг 8️⃣: Обновление фронтенда

Открой файл:
```
spotify-player/android/app/src/main/assets/public/app.js
```

Найди строку (примерно строка 10):
```javascript
const BACKEND_URL = localStorage.getItem('vt_backend_url') || 'https://violettunes-backend.onrender.com';
```

Замени на свой Railway URL:
```javascript
const BACKEND_URL = localStorage.getItem('vt_backend_url') || 'https://твой-railway-url.up.railway.app';
```

---

## ✅ Готово!

Теперь проверь, что всё работает:

### Тест 1: Ping
```bash
curl https://твой-railway-url.up.railway.app/ping
```

Должен вернуть:
```json
{"status":"ok","time":"2024-..."}
```

### Тест 2: Добавление артиста
```bash
curl -X POST https://твой-railway-url.up.railway.app/api/import/watch-artist \
  -H "Content-Type: application/json" \
  -H "x-admin-key: violettunes-secret-key-2024" \
  -d '{
    "artistName": "Imagine Dragons",
    "platforms": ["youtube"]
  }'
```

### Тест 3: Ручной импорт
```bash
curl -X POST https://твой-railway-url.up.railway.app/api/import/run-now \
  -H "x-admin-key: violettunes-secret-key-2024"
```

---

## 🎵 Автоматический импорт работает!

Каждые 15 минут сервер будет:
1. Проверять новые треки у отслеживаемых артистов
2. Скачивать их через yt-dlp
3. Конвертировать в MP3
4. Добавлять в базу данных

**Наслаждайся музыкой! 🎉**
