# VioletTunes Backend

Бэкенд для музыкального плеера VioletTunes с поддержкой:
- 🎵 Self-hosted хранилище треков (MP3/AAC)
- 🔍 Full-text поиск по названию, исполнителю, альбому и тексту песни
- 🤖 AI-рекомендации на основе истории прослушиваний
- 📥 Автоматический импорт треков из YouTube, VK, Spotify, SoundCloud, Яндекс.Музыка
- 📋 Импорт плейлистов по URL и через OAuth
- 📝 Хранение и отображение текстов песен
- 🎧 Стриминг с поддержкой HTTP Range requests
- ⬇️ Скачивание треков в MP3

## 🚀 Быстрый деплой с автоматическим импортом

**Рекомендуем Railway.app** - бесплатно, ffmpeg работает из коробки:

👉 **[DEPLOY_QUICK_START.md](../DEPLOY_QUICK_START.md)** - деплой за 5 минут

Другие варианты:
- [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) - подробная инструкция Railway
- [DEPLOY_OPTIONS.md](./DEPLOY_OPTIONS.md) - сравнение всех вариантов
- [RENDER_DOCKER_DEPLOY.md](./RENDER_DOCKER_DEPLOY.md) - Render с Docker (платно)

## Локальная разработка

```bash
# Установка зависимостей
npm install

# Создание .env файла
cp .env.example .env
nano .env  # Заполните переменные

# Запуск сервера
npm run dev
```

Сервер будет доступен на `http://localhost:3000`

## Структура проекта

```
backend/
├── modules/           # Бизнес-логика
│   ├── db.js         # SQLite инициализация и миграции
│   ├── trackStore.js # CRUD операции с треками
│   ├── metadataSerializer.js # Сериализация метаданных
│   ├── listenHistory.js # История прослушиваний
│   ├── recommendationEngine.js # Алгоритм рекомендаций
│   ├── importConverter.js # yt-dlp + ffmpeg обёртки
│   ├── importScheduler.js # Автоматический импорт
│   ├── oauthManager.js # OAuth для VK/Spotify/Yandex
│   └── playlistImporter.js # Импорт плейлистов
├── routes/           # API маршруты
│   ├── tracks.js     # GET /api/tracks, /stream/:id
│   ├── search.js     # GET /api/search
│   ├── recommendations.js # GET /api/recommendations
│   ├── download.js   # GET /download/:id
│   ├── admin.js      # POST /admin/tracks (требует X-Admin-Key)
│   └── import.js     # POST /api/import/playlist-url
├── storage/          # Аудиофайлы
│   └── tracks/       # MP3/AAC файлы
├── db/               # SQLite база данных
│   └── music.db      # Метаданные треков
└── server.js         # Главный файл

```

## API Endpoints

### Public API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/tracks` | Список треков (пагинация) |
| GET | `/api/tracks/:id` | Метаданные трека |
| GET | `/stream/:id` | Стриминг аудио |
| GET | `/download/:id` | Скачать MP3 |
| GET | `/api/search?q=query` | Поиск треков |
| GET | `/api/recommendations?sessionId=xxx` | Рекомендации |
| POST | `/api/listen-events` | Записать событие прослушивания |
| POST | `/api/import/playlist-url` | Импорт плейлиста по URL |
| GET | `/api/import/jobs/:jobId` | Статус задачи импорта |

### Admin API (требует X-Admin-Key)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/admin/tracks` | Загрузить трек |
| POST | `/admin/watched-artists` | Добавить артиста для автоимпорта |
| DELETE | `/admin/watched-artists/:id` | Удалить артиста |

### OAuth API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/import/oauth/:platform/authorize` | Начать OAuth авторизацию |
| GET | `/api/import/oauth/:platform/callback` | OAuth callback |
| GET | `/api/import/oauth/:platform/playlists` | Список плейлистов пользователя |
| POST | `/api/import/oauth/:platform/import` | Импорт плейлиста через OAuth |
| DELETE | `/api/import/oauth/:platform/session` | Отозвать OAuth сессию |

## База данных

SQLite с 8 таблицами:

- `tracks` — метаданные треков
- `tracks_fts` — FTS5 индекс для поиска
- `listen_events` — история прослушиваний
- `watched_artists` — артисты для автоимпорта
- `watched_artist_platforms` — платформы артистов
- `import_cycle_logs` — логи циклов импорта
- `oauth_sessions` — OAuth токены
- `import_jobs` — задачи импорта плейлистов

## Алгоритм рекомендаций

```
Score = playCount * 2.0 + totalListenMinutes * 1.0 * recencyDecay(lastPlayedAt)

где recencyDecay = 2^(-(daysSince / 7))  // half-life 7 дней
```

Рекомендации группируются в секции:
- "Похожие исполнители" — треки от артистов из истории
- "Твой микс" — топ треки по Score

Fallback: если < 3 событий прослушивания → топ-20 по `play_count`

## Автоматический импорт

Scheduler опрашивает watched_artists каждые 15 минут:
1. Получает новые релизы с платформ (YouTube/VK/Spotify/SoundCloud/Yandex)
2. Проверяет дедупликацию (case-insensitive artist+title)
3. Скачивает через `yt-dlp`
4. Конвертирует в MP3 192kbps через `ffmpeg`
5. Сохраняет в `storage/tracks/`
6. Добавляет в базу данных

**Требования**: `yt-dlp` и `ffmpeg` должны быть установлены на сервере

## Переменные окружения

См. [.env.example](./.env.example)

Обязательные:
- `ADMIN_KEY` — ключ для Admin API
- `PORT` — порт сервера (по умолчанию 3000)

Опциональные (для OAuth импорта):
- `VK_CLIENT_ID`, `VK_CLIENT_SECRET`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`

## Тестирование

```bash
# Запуск всех тестов
npm test

# Property-based тесты (опционально)
# Требуют установленного fast-check
npm test -- --grep "Property"
```

## Лицензия

MIT

## Поддержка

Для вопросов и багов создавайте Issues в GitHub репозитории.
