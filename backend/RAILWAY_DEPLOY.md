# 🚂 Деплой на Railway.app с автоматическим импортом

Railway поддерживает ffmpeg/yt-dlp из коробки, что позволяет использовать автоматический импорт треков из YouTube/VK/Spotify/SoundCloud/Яндекс.Музыка.

## 📋 Быстрый старт (5 минут):

### 1. Регистрация
- Иди на https://railway.app/
- Нажми "Login" → "Login with GitHub"
- Разреши доступ к репозиториям

### 2. Создание проекта
- Нажми "New Project"
- Выбери "Deploy from GitHub repo"
- Найди и выбери свой репозиторий VioletTunes
- Railway автоматически определит Node.js проект

### 3. Настройка сервиса
После создания проекта:

**3.1. Настрой Root Directory:**
- Открой Settings (шестерёнка)
- Root Directory: `backend`
- Нажми "Save"

**3.2. Добавь переменные окружения:**
- Открой вкладку "Variables"
- Добавь:
  ```
  ADMIN_KEY=violettunes-secret-key-2024
  NODE_ENV=production
  ```
- PORT добавлять не нужно (Railway сам установит)

**3.3. Настрой команды:**
- Settings → Deploy
- Build Command: `npm install`
- Start Command: `node server.js`

### 4. Получи публичный URL
- Открой вкладку "Settings"
- Найди "Networking" → "Public Networking"
- Нажми "Generate Domain"
- Скопируй URL (будет типа `https://violettunes-backend-production.up.railway.app`)

### 5. Обнови фронтенд
Открой `spotify-player/android/app/src/main/assets/public/app.js` и замени:
```javascript
const BACKEND_URL = localStorage.getItem('vt_backend_url') || 'https://твой-railway-url.up.railway.app';
```

### 6. Готово! 🎉
- Railway автоматически задеплоит проект
- Деплой займёт 2-3 минуты
- Автоматический импорт заработает сразу

---

## 🔧 Что уже настроено:

✅ **nixpacks.toml** - конфигурация с ffmpeg и python3  
✅ **server.js** - автоматический импорт включён  
✅ **importScheduler.js** - запускается каждые 15 минут  

---

## 📊 Как работает автоматический импорт:

1. **Добавь артистов для отслеживания:**
   ```bash
   curl -X POST https://твой-railway-url.up.railway.app/api/import/watch-artist \
     -H "Content-Type: application/json" \
     -H "x-admin-key: violettunes-secret-key-2024" \
     -d '{
       "artistName": "Imagine Dragons",
       "platforms": ["youtube", "spotify"]
     }'
   ```

2. **Импорт запустится автоматически каждые 15 минут**
   - Проверит новые треки у отслеживаемых артистов
   - Скачает MP3 через yt-dlp
   - Сохранит в базу данных
   - Треки появятся в приложении

3. **Ручной запуск импорта:**
   ```bash
   curl -X POST https://твой-railway-url.up.railway.app/api/import/run-now \
     -H "x-admin-key: violettunes-secret-key-2024"
   ```

---

## 💰 Стоимость:

- **Бесплатно:** $5 кредитов/месяц (~500 часов работы)
- **Платно:** $5/месяц за дополнительные ресурсы
- Для небольшого проекта бесплатного плана хватит

---

## 🐛 Проблемы?

**Деплой не запускается:**
- Проверь, что Root Directory = `backend`
- Проверь логи в разделе "Deployments"

**Импорт не работает:**
- Проверь логи: `railway logs`
- Убедись, что добавлены артисты для отслеживания
- Проверь, что ADMIN_KEY правильный

**Нужна помощь:**
- Railway Discord: https://discord.gg/railway
- Документация: https://docs.railway.app/

---

## 🚀 Следующие шаги:

1. Задеплой на Railway
2. Добавь несколько артистов для отслеживания
3. Подожди 15 минут (или запусти импорт вручную)
4. Открой приложение и наслаждайся музыкой! 🎵
