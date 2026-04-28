# Деплой на Render с Docker (с поддержкой ffmpeg)

Этот способ позволяет использовать ffmpeg на Render через Docker.

## Шаги деплоя:

1. **Зайди в настройки сервиса на Render**

2. **Измени тип деплоя на Docker**:
   - Settings → Build & Deploy
   - Build Command: оставь пустым
   - Start Command: оставь пустым
   - Docker Command: оставь пустым (будет использован CMD из Dockerfile)
   - Dockerfile Path: `backend/Dockerfile`

3. **Настрой переменные окружения**:
   ```
   ADMIN_KEY=violettunes-secret-key-2024
   NODE_ENV=production
   PORT=3001
   ```

4. **Включи автоматический импорт**:
   В `backend/server.js` раскомментируй строки 32-33:
   ```javascript
   importScheduler.start(15 * 60 * 1000);
   console.log('✓ Import scheduler started');
   ```

5. **Сохрани и передеплой**:
   - Нажми "Manual Deploy" → "Deploy latest commit"
   - Деплой займёт 5-10 минут (Docker образ собирается дольше)

## ⚠️ Важно:
- Docker деплой на Render работает только на **платном плане** ($7/месяц)
- Бесплатный план не поддерживает Docker

## Альтернатива:
Если не хочешь платить за Render, используй **Railway.app** (см. RAILWAY_DEPLOY.md) - там есть бесплатный план с поддержкой ffmpeg.
