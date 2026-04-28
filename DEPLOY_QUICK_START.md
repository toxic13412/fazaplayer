# 🚀 Быстрый деплой VioletTunes с автоматическим импортом

## ⚡ Самый простой способ: Railway.app (5 минут)

### Почему Railway?
- ✅ **Бесплатно** ($5 кредитов/месяц)
- ✅ **ffmpeg работает** из коробки
- ✅ **Автоматический импорт** треков из YouTube/VK/Spotify
- ✅ **Простая настройка** - всего 5 шагов

---

## 📋 Пошаговая инструкция:

### Шаг 1: Регистрация (1 минута)
1. Иди на https://railway.app/
2. Нажми "Login" → "Login with GitHub"
3. Разреши доступ

### Шаг 2: Создание проекта (1 минута)
1. Нажми "New Project"
2. Выбери "Deploy from GitHub repo"
3. Найди репозиторий VioletTunes
4. Railway автоматически начнёт деплой

### Шаг 3: Настройка (2 минуты)
1. **Root Directory:**
   - Settings → Root Directory: `backend`
   - Save

2. **Переменные окружения:**
   - Variables → Add Variable:
     ```
     ADMIN_KEY=violettunes-secret-key-2024
     NODE_ENV=production
     ```

3. **Команды:**
   - Settings → Deploy:
     - Build Command: `npm install`
     - Start Command: `node server.js`

### Шаг 4: Получи URL (1 минута)
1. Settings → Networking → Generate Domain
2. Скопируй URL (например: `https://violettunes-backend-production.up.railway.app`)

### Шаг 5: Обнови фронтенд
Открой `spotify-player/android/app/src/main/assets/public/app.js`:
```javascript
const BACKEND_URL = localStorage.getItem('vt_backend_url') || 'https://твой-railway-url.up.railway.app';
```

---

## 🎵 Как использовать автоматический импорт:

### Добавь артиста для отслеживания:
```bash
curl -X POST https://твой-railway-url.up.railway.app/api/import/watch-artist \
  -H "Content-Type: application/json" \
  -H "x-admin-key: violettunes-secret-key-2024" \
  -d '{
    "artistName": "Imagine Dragons",
    "platforms": ["youtube", "spotify"]
  }'
```

### Импорт запустится автоматически каждые 15 минут!

Или запусти вручную:
```bash
curl -X POST https://твой-railway-url.up.railway.app/api/import/run-now \
  -H "x-admin-key: violettunes-secret-key-2024"
```

---

## 📚 Подробные инструкции:

- **Railway деплой:** `backend/RAILWAY_DEPLOY.md`
- **Все варианты деплоя:** `backend/DEPLOY_OPTIONS.md`
- **Render с Docker:** `backend/RENDER_DOCKER_DEPLOY.md`

---

## ✅ Готово!

Теперь у тебя:
- ✅ Работающий бэкенд с ffmpeg
- ✅ Автоматический импорт треков
- ✅ Бесплатный хостинг
- ✅ Музыка работает даже в РФ (свои серверы)

**Наслаждайся музыкой! 🎵**
