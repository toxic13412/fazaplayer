# Развёртывание VioletTunes Backend

## Вариант 1: Render.com (Рекомендуется)

### Free Plan (Ограничения)
- ❌ Нет поддержки `yt-dlp` и `ffmpeg` (автоимпорт не работает)
- ✅ Основной функционал работает (загрузка через Admin API, стриминг, поиск, рекомендации)
- ✅ 1 GB постоянного хранилища для треков

**Шаги для Free Plan:**

1. Закомментируйте автоимпорт в `backend/server.js`:
```javascript
// importScheduler.start(15 * 60 * 1000); // Отключено на Free Plan
```

2. Создайте новый Web Service на [Render.com](https://render.com):
   - Repository: ваш GitHub репозиторий
   - Root Directory: `backend`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`

3. Добавьте Environment Variables:
   - `ADMIN_KEY` — сгенерируйте случайную строку (например, через `openssl rand -hex 32`)
   - `PORT` — 3000
   - `NODE_ENV` — production

4. Добавьте Persistent Disk:
   - Name: `violettunes-data`
   - Mount Path: `/opt/render/project/src/storage`
   - Size: 1 GB

5. Deploy!

### Paid Plan ($7/мес) — с автоимпортом

**Дополнительные шаги:**

1. В настройках Web Service добавьте Native Environment:
   - Shell Command: `apt-get update && apt-get install -y ffmpeg python3-pip && pip3 install yt-dlp`

2. Раскомментируйте `importScheduler.start()` в `server.js`

3. Добавьте OAuth credentials (если нужен импорт плейлистов):
   - `VK_CLIENT_ID`, `VK_CLIENT_SECRET`
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
   - `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`

4. Обновите Redirect URIs в OAuth приложениях:
   - VK: `https://your-app.onrender.com/api/import/oauth/vk/callback`
   - Spotify: `https://your-app.onrender.com/api/import/oauth/spotify/callback`
   - Yandex: `https://your-app.onrender.com/api/import/oauth/yandex/callback`

---

## Вариант 2: Railway.app

1. Установите Railway CLI: `npm i -g @railway/cli`
2. Войдите: `railway login`
3. Создайте проект: `railway init`
4. Добавьте переменные окружения: `railway variables set ADMIN_KEY=your-key`
5. Deploy: `railway up`

Railway автоматически устанавливает `ffmpeg` и поддерживает `yt-dlp`.

---

## Вариант 3: VPS (DigitalOcean, Hetzner, etc.)

```bash
# Установите зависимости
sudo apt update
sudo apt install -y nodejs npm ffmpeg python3-pip
pip3 install yt-dlp

# Клонируйте репозиторий
git clone <your-repo-url>
cd backend

# Установите npm пакеты
npm install

# Создайте .env файл
cp .env.example .env
nano .env  # Заполните переменные

# Запустите с PM2
npm install -g pm2
pm2 start server.js --name violettunes
pm2 save
pm2 startup
```

---

## После развёртывания

### 1. Обновите BACKEND_URL в Android приложении

Откройте `spotify-player/android/app/src/main/assets/public/app.js`:

```javascript
const BACKEND_URL = 'https://your-app.onrender.com'; // Замените на ваш URL
```

Пересоберите APK:
```bash
cd spotify-player
npx cap sync android
cd android
./gradlew assembleDebug
```

### 2. Загрузите первый трек через Admin API

```bash
curl -X POST https://your-app.onrender.com/admin/tracks \
  -H "X-Admin-Key: your-admin-key" \
  -F "file=@/path/to/song.mp3" \
  -F "title=Song Title" \
  -F "artist=Artist Name" \
  -F "album=Album Name" \
  -F "genre=Pop" \
  -F "lyrics=Song lyrics here..."
```

### 3. Проверьте работу API

```bash
# Получить список треков
curl https://your-app.onrender.com/api/tracks

# Поиск
curl "https://your-app.onrender.com/api/search?q=artist"

# Стриминг (откройте в браузере)
https://your-app.onrender.com/stream/<track-id>
```

---

## Troubleshooting

### Ошибка "ENOENT: no such file or directory, open 'db/music.db'"
- Убедитесь, что директории `db/` и `storage/tracks/` существуют
- На Render.com проверьте, что Persistent Disk подключён

### Ошибка "yt-dlp: command not found"
- Free Plan Render.com не поддерживает установку системных пакетов
- Используйте Paid Plan или другой хостинг

### Ошибка 401 при загрузке трека
- Проверьте, что заголовок `X-Admin-Key` совпадает с `ADMIN_KEY` в переменных окружения

### Треки не воспроизводятся в приложении
- Проверьте CORS настройки в `server.js` (должен быть `cors()` middleware)
- Убедитесь, что `BACKEND_URL` в `app.js` правильный (без trailing slash)
