# Быстрый старт VioletTunes Backend

## 🚀 Развёртывание на Render.com (Free Plan)

### 1. Подготовка кода

Закомментируйте автоимпорт в `backend/server.js` (строка ~23):

```javascript
// importScheduler.start(15 * 60 * 1000); // Отключено на Free Plan
```

### 2. Создание сервиса на Render

1. Зайдите на [render.com](https://render.com) и войдите через GitHub
2. Нажмите **New** → **Web Service**
3. Подключите ваш репозиторий
4. Настройки:
   - **Name**: `violettunes-backend`
   - **Region**: Frankfurt (или ближайший к РФ)
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free

### 3. Добавление переменных окружения

В разделе **Environment** добавьте:

```
ADMIN_KEY=<сгенерируйте случайную строку>
PORT=3000
NODE_ENV=production
```

Для генерации `ADMIN_KEY` используйте:
```bash
openssl rand -hex 32
```

### 4. Добавление постоянного хранилища

1. Перейдите в **Disks** → **Add Disk**
2. Настройки:
   - **Name**: `violettunes-data`
   - **Mount Path**: `/opt/render/project/src/storage`
   - **Size**: 1 GB

### 5. Deploy!

Нажмите **Create Web Service**. Через 2-3 минуты ваш бэкенд будет доступен по адресу:
```
https://violettunes-backend.onrender.com
```

---

## 📱 Обновление Android приложения

Откройте `spotify-player/android/app/src/main/assets/public/app.js` и замените:

```javascript
const BACKEND_URL = 'https://violettunes-backend.onrender.com'; // Ваш URL
```

Пересоберите APK:
```bash
cd spotify-player
npx cap sync android
cd android
./gradlew assembleDebug
```

APK будет в `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🎵 Загрузка первого трека

```bash
curl -X POST https://violettunes-backend.onrender.com/admin/tracks \
  -H "X-Admin-Key: ваш-admin-key" \
  -F "file=@song.mp3" \
  -F "title=Название песни" \
  -F "artist=Исполнитель" \
  -F "album=Альбом" \
  -F "genre=Жанр" \
  -F "lyrics=Текст песни (опционально)"
```

Или используйте Postman/Insomnia для удобства.

---

## ✅ Проверка работы

### Список треков
```bash
curl https://violettunes-backend.onrender.com/api/tracks
```

### Поиск
```bash
curl "https://violettunes-backend.onrender.com/api/search?q=исполнитель"
```

### Стриминг (откройте в браузере)
```
https://violettunes-backend.onrender.com/stream/<track-id>
```

---

## 🔧 Если нужен автоимпорт

Для автоматического импорта треков из YouTube/VK/Spotify нужен **Paid Plan** ($7/мес):

1. Upgrade до Starter Plan
2. Добавьте Native Environment в настройках сервиса:
   ```bash
   apt-get update && apt-get install -y ffmpeg python3-pip && pip3 install yt-dlp
   ```
3. Раскомментируйте `importScheduler.start()` в `server.js`
4. Redeploy

Подробнее в [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📚 Документация API

### Admin API (требует X-Admin-Key)

- `POST /admin/tracks` — загрузить трек
- `POST /admin/watched-artists` — добавить артиста для автоимпорта
- `DELETE /admin/watched-artists/:id` — удалить артиста

### Public API

- `GET /api/tracks?page=1&limit=20` — список треков
- `GET /api/tracks/:id` — метаданные трека
- `GET /stream/:id` — стриминг аудио
- `GET /download/:id` — скачать MP3
- `GET /api/search?q=query` — поиск
- `GET /api/recommendations?sessionId=xxx` — рекомендации
- `POST /api/listen-events` — записать событие прослушивания

### Import API

- `POST /api/import/playlist-url` — импорт плейлиста по URL
- `GET /api/import/oauth/:platform/authorize` — OAuth авторизация
- `GET /api/import/oauth/:platform/playlists` — список плейлистов
- `POST /api/import/oauth/:platform/import` — импорт плейлиста через OAuth
- `GET /api/import/jobs/:jobId` — статус задачи импорта

---

## 🐛 Troubleshooting

### "Cannot find module 'better-sqlite3'"
```bash
cd backend
npm install
```

### "ENOENT: no such file or directory, open 'db/music.db'"
Убедитесь, что Persistent Disk подключён в настройках Render.

### Треки не воспроизводятся в приложении
- Проверьте, что `BACKEND_URL` в `app.js` правильный (без `/` в конце)
- Проверьте CORS в логах Render

### Free Plan засыпает через 15 минут
Это нормально для Free Plan. Первый запрос после сна займёт ~30 секунд.
