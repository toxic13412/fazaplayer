# Implementation Plan: Self-Hosted Music Platform

## Overview

Расширяем `backend/server.js` собственным хранилищем треков на SQLite + файловой системе, системой рекомендаций, автоматическим импортом из внешних платформ и поддержкой в Android-приложении. Реализация ведётся на Node.js (Express) + JavaScript.

## Tasks

- [x] 1. Настроить SQLite схему и модуль db.js
  - Установить зависимости: `better-sqlite3`, `uuid`, `multer`, `fast-check` (devDependency)
  - Создать `backend/modules/db.js` — инициализация SQLite-соединения, выполнение миграций при старте
  - Реализовать все таблицы из схемы: `tracks`, `tracks_fts`, `listen_events`, `watched_artists`, `watched_artist_platforms`, `import_cycle_logs`, `oauth_sessions`, `import_jobs`
  - Создать директории `backend/storage/tracks/` и `backend/db/`
  - _Requirements: 1.1, 1.2, 4.2, 6.6, 8.1, 9.1, 10.7_

- [x] 2. Реализовать metadataSerializer.js
  - [x] 2.1 Создать `backend/modules/metadataSerializer.js`
    - Функция `serialize(track)` → JSON-объект по схеме `{ id, title, artist, album, genre, durationSeconds, coverUrl, uploadedAt }`
    - Функция `deserialize(row)` → объект Track с валидацией обязательных полей (`id`, `title`, `artist`, `durationSeconds`)
    - При отсутствии обязательного поля — логировать ошибку и возвращать `null`
    - Отклонять `durationSeconds` если не является положительным целым числом
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ]* 2.2 Написать property-тест P1: Metadata round-trip
    - **Property 1: For any valid Track metadata object, serialize → deserialize SHALL produce a deeply equal object**
    - **Validates: Requirements 7.4**
    - Генератор: `fc.record({ id: fc.uuid(), title: fc.string({minLength:1}), artist: fc.string({minLength:1}), durationSeconds: fc.integer({min:1}) })`

  - [ ]* 2.3 Написать property-тест P15: durationSeconds validation
    - **Property 15: For any durationSeconds that is not a positive integer, deserialize SHALL reject the metadata**
    - **Validates: Requirements 7.5**
    - Генератор: `fc.oneof(fc.float({max:0}), fc.integer({max:0}), fc.string(), fc.constant(null))`

- [x] 3. Реализовать trackStore.js
  - [x] 3.1 Создать `backend/modules/trackStore.js`
    - `insertTrack(track)` — INSERT в таблицу `tracks` + синхронизация `tracks_fts`
    - `getTrackById(id)` — SELECT по id, возвращает десериализованный Track или null
    - `listTracks({ page, limit })` — SELECT с LIMIT/OFFSET, возвращает `{ tracks, total, page, totalPages }`
    - `incrementPlayCount(id)` — UPDATE play_count
    - `trackExistsByArtistTitle(artist, title)` — проверка дубликата (case-insensitive) для дедупликации
    - _Requirements: 1.2, 1.3, 1.5, 6.6_

  - [ ]* 3.2 Написать property-тест P3: Pagination invariant
    - **Property 3: For any catalog of size N and valid page P, response contains exactly min(20, N-(P-1)*20) tracks; union of all pages equals full catalog without duplicates**
    - **Validates: Requirements 1.3**
    - Генератор: `fc.array(trackArb, {minLength:0, maxLength:60})`, `fc.integer({min:1})`

  - [ ]* 3.3 Написать property-тест P14: UUID uniqueness
    - **Property 14: For any number of track uploads, all generated track IDs SHALL be distinct UUIDs**
    - **Validates: Requirements 6.6**
    - Генератор: `fc.integer({min:1, max:100})` — количество вставок

- [x] 4. Реализовать маршруты tracks.js и download.js
  - [x] 4.1 Создать `backend/routes/tracks.js`
    - `GET /api/tracks?page&limit` — возвращает пагинированный список через `trackStore.listTracks`
    - `GET /api/tracks/:id` — возвращает метаданные трека; 404 если не найден
    - `GET /stream/:id` — стриминг аудиофайла с поддержкой HTTP Range requests (206 Partial Content, заголовки `Content-Range`, `Accept-Ranges`)
    - `GET /api/tracks/:id/lyrics` — возвращает `{ id, lyrics: string|null }`; 404 если трек не найден
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 9.3, 9.4, 9.5_

  - [x] 4.2 Создать `backend/routes/download.js`
    - `GET /download/:trackId` — отдаёт MP3 с заголовками `Content-Disposition: attachment; filename="{artist} - {title}.mp3"` и `Content-Type: audio/mpeg`
    - 404 если трек не найден
    - _Requirements: 5.7_

  - [ ]* 4.3 Написать property-тест P4: Non-existent track returns 404
    - **Property 4: For any UUID not in the catalog, GET /api/tracks/:id SHALL return HTTP 404 with JSON body containing a human-readable `message` field**
    - **Validates: Requirements 1.5**
    - Генератор: `fc.uuid()` (фильтровать чтобы не совпадал с существующими)

  - [ ]* 4.4 Написать property-тест P5: Range request correctness
    - **Property 5: For any stored track and valid byte range [start, end], GET with Range header SHALL return 206 with matching Content-Range and body of exactly end-start+1 bytes**
    - **Validates: Requirements 1.6**
    - Генератор: `fc.integer({min:0})` для start/end в пределах размера файла

- [x] 5. Реализовать search.js
  - [x] 5.1 Создать `backend/routes/search.js`
    - `GET /api/search?q=<query>&limit=20` — FTS5-поиск по `tracks_fts` (title, artist, album, lyrics)
    - Возвращает `{ tracks: Track[], total: number }`
    - HTTP 400 если `q.length < 2`; HTTP 200 с `{ tracks: [], total: 0 }` если нет результатов
    - Поиск case-insensitive, максимальная длина запроса 200 символов
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 Написать property-тест P6: Case-insensitive search matching
    - **Property 6: For any query Q and track T whose title/artist/album contains Q as substring (case-insensitive), T SHALL appear in search results**
    - **Validates: Requirements 2.2**
    - Генератор: `fc.string({minLength:2})` для запросов + генератор треков

  - [ ]* 5.3 Написать property-тест P7: Short query rejection
    - **Property 7: For any query of length 0 or 1, server SHALL return HTTP 400**
    - **Validates: Requirements 2.5**
    - Генератор: `fc.string({maxLength:1})`

  - [ ]* 5.4 Написать property-тест P18: FTS search by lyrics
    - **Property 18: For any track T whose lyrics field contains word W (case-insensitive), GET /api/search?q=W SHALL include T in results**
    - **Validates: Requirements 2.3, 9.1**
    - Генератор: трек с lyrics + извлечение слова из lyrics как запрос

- [ ] 6. Реализовать listenHistory.js и recommendationEngine.js
  - [x] 6.1 Создать `backend/modules/listenHistory.js`
    - `recordListenEvent({ trackId, sessionId, listenDurationSeconds })` — INSERT в `listen_events`
    - `getListenEventsBySession(sessionId)` — SELECT всех событий для сессии
    - _Requirements: 4.1, 4.2_

  - [ ]* 6.2 Написать property-тест P10: Listen event persistence round-trip
    - **Property 10: For any listen event { trackId, sessionId, listenDurationSeconds } sent to server, event SHALL be retrievable from Listen_History by sessionId and trackId**
    - **Validates: Requirements 4.2**
    - Генератор: `fc.record({ trackId: fc.uuid(), sessionId: fc.uuid(), listenDurationSeconds: fc.integer({min:1}) })`

  - [x] 6.3 Создать `backend/modules/recommendationEngine.js`
    - `computeScore(events)` — вычисляет Score по формуле: `playCount * 2.0 + totalListenMinutes * 1.0 * recencyDecay(lastPlayedAt)`, где `recencyDecay` = `2^(-(daysSince / 7))`
    - `getRecommendations(sessionId, currentSessionTrackIds)` — возвращает `{ sections: RecommendationSection[] }` с ≥ 2 секциями ("Похожие исполнители", "Твой микс")
    - Fallback: если < 3 событий — возвращает топ-20 треков по `play_count`
    - Исключает треки, сыгранные в текущей сессии
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 6.4 Написать property-тест P8: Recommendation scoring formula
    - **Property 8: For any set of listen history entries, Score SHALL equal playCount*2.0 + totalListenMinutes*1.0 * recencyDecay(lastPlayedAt) with half-life of 7 days**
    - **Validates: Requirements 4.3**
    - Генератор: `fc.array(listenEventArb, {minLength:1})`

  - [ ]* 6.5 Написать property-тест P9: Recommendation ordering and exclusion
    - **Property 9: For any sessionId with ≥ 3 listen events, recommendations SHALL be sorted by Score descending and SHALL NOT include tracks played in current session**
    - **Validates: Requirements 4.4**
    - Генератор: `fc.array(listenEventArb, {minLength:3})`

  - [x] 6.6 Создать `backend/routes/recommendations.js`
    - `POST /api/listen-events` — принимает `{ trackId, sessionId, listenDurationSeconds }`, вызывает `listenHistory.recordListenEvent`
    - `GET /api/recommendations?sessionId=<id>` — вызывает `recommendationEngine.getRecommendations`
    - _Requirements: 4.1, 4.7, 4.8_

- [x] 7. Checkpoint — убедиться что все тесты проходят
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Реализовать admin.js
  - [x] 8.1 Создать `backend/routes/admin.js` с middleware проверки `X-Admin-Key`
    - Middleware `requireAdminKey` — проверяет заголовок `X-Admin-Key` против `process.env.ADMIN_KEY`; возвращает 401 если отсутствует или неверный
    - _Requirements: 6.1, 6.2_

  - [ ]* 8.2 Написать property-тест P11: Admin auth — unauthorized requests rejected
    - **Property 11: For any request to POST /admin/tracks, POST /admin/watched-artists, DELETE /admin/watched-artists/:id with missing or invalid X-Admin-Key, server SHALL return HTTP 401**
    - **Validates: Requirements 6.1, 6.2, 8.4**
    - Генератор: `fc.option(fc.string())` для значения заголовка

  - [x] 8.3 Реализовать `POST /admin/tracks`
    - Multer для multipart/form-data: поля `file` (audio), `title`, `artist`, `album?`, `genre?`, `cover?`, `lyrics?`
    - Валидация: MIME-тип `audio/mpeg` или `audio/aac`, размер ≤ 50 MB, наличие `title` и `artist`
    - Генерация UUID v4 для нового трека
    - Сохранение файла в `storage/tracks/{uuid}.mp3`
    - INSERT в `tracks` + синхронизация `tracks_fts`
    - Возвращает 201 с метаданными; 400/413 при ошибках валидации
    - _Requirements: 1.7, 1.8, 6.3, 6.4, 6.5, 6.6, 9.2_

  - [ ]* 8.4 Написать property-тест P2: File format and size validation
    - **Property 2: Server SHALL accept file if and only if MIME type is audio/mpeg or audio/aac AND size ≤ 50 MB; all others SHALL be rejected with appropriate HTTP error**
    - **Validates: Requirements 1.1, 1.7, 1.8**
    - Генератор: `fc.record({ size: fc.integer({min:0}), mimeType: fc.string() })`

  - [ ]* 8.5 Написать property-тест P12: Upload round-trip
    - **Property 12: For any valid track upload, server SHALL return 201 with id and metadata, and subsequent GET /api/tracks/:id SHALL return the same metadata**
    - **Validates: Requirements 6.3**
    - Генератор: валидный генератор трека с корректными полями

  - [ ]* 8.6 Написать property-тест P13: Required field validation on upload
    - **Property 13: For any upload request missing title or artist, server SHALL return HTTP 400 with descriptive validation error**
    - **Validates: Requirements 6.4, 6.5**
    - Генератор: генератор трека с пропущенными обязательными полями

  - [x] 8.7 Реализовать `POST /admin/watched-artists` и `DELETE /admin/watched-artists/:artistId`
    - POST: принимает `{ name, platforms: [{ platform, identifier }] }`, INSERT в `watched_artists` + `watched_artist_platforms`, возвращает 201
    - DELETE: удаляет артиста и его платформы (CASCADE), возвращает 200
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ]* 8.8 Написать property-тест P17: Watched artist add/remove round-trip
    - **Property 17: For any artist added via POST /admin/watched-artists, artist SHALL appear in list; after DELETE /admin/watched-artists/:artistId, artist SHALL no longer appear**
    - **Validates: Requirements 8.2, 8.3**
    - Генератор: `fc.record({ name: fc.string({minLength:1}), platforms: fc.array(...) })`

- [x] 9. Реализовать importConverter.js и importScheduler.js
  - [x] 9.1 Создать `backend/modules/importConverter.js`
    - `convertToMp3(inputPath, outputPath)` — обёртка над `ffmpeg` для конвертации в MP3 192 kbps
    - `downloadWithYtDlp(url, outputDir)` — обёртка над `yt-dlp` для скачивания аудиопотока
    - _Requirements: 8.7_

  - [x] 9.2 Создать `backend/modules/importScheduler.js`
    - `start(intervalMs)` — запускает периодический опрос (≥ 15 минут)
    - `runCycle()` — для каждого watched_artist и каждой платформы: получить новые релизы, проверить дедупликацию, скачать + конвертировать, INSERT в tracks
    - Логировать ошибки недоступных платформ/треков без прерывания цикла
    - INSERT в `import_cycle_logs` по завершении цикла
    - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12_

  - [ ]* 9.3 Написать property-тест P16: Import deduplication (case-insensitive)
    - **Property 16: For any track already in catalog, import attempt for track with same artist+title (case-insensitive) SHALL be skipped and deduplication event logged**
    - **Validates: Requirements 8.9**
    - Генератор: трек + варианты с разным регистром artist/title

- [x] 10. Реализовать oauthManager.js и playlistImporter.js
  - [x] 10.1 Создать `backend/modules/oauthManager.js`
    - `getAuthorizationUrl(platform, sessionId)` — возвращает URL OAuth-страницы для VK/Spotify/Яндекс.Музыка
    - `handleCallback(platform, code, sessionId)` — обменивает code на токены, INSERT в `oauth_sessions`
    - `getSession(sessionId, platform)` — SELECT из `oauth_sessions`; возвращает null если не найдена
    - `refreshToken(sessionId, platform)` — обновляет access_token через refresh_token
    - `revokeSession(sessionId, platform)` — DELETE из `oauth_sessions`
    - _Requirements: 10.3, 10.4, 10.10, 10.11, 10.12_

  - [ ]* 10.2 Написать property-тест P20: OAuth session revocation
    - **Property 20: For any OAuth_Session revoked via DELETE /api/import/oauth/:platform/session, subsequent GET /api/import/oauth/:platform/playlists with same sessionId SHALL return HTTP 401**
    - **Validates: Requirements 10.11, 10.12**
    - Генератор: `fc.record({ sessionId: fc.uuid(), platform: fc.constantFrom('vk','spotify','yandex') })`

  - [x] 10.3 Создать `backend/modules/playlistImporter.js`
    - `importByUrl(url, sessionId)` — парсит URL (VK/Spotify/Яндекс.Музыка), создаёт import_job, запускает импорт асинхронно
    - `importByOAuth(platform, playlistId, sessionId)` — получает треки плейлиста через OAuth API, создаёт import_job
    - `runImportJob(jobId)` — для каждого трека: проверить дедупликацию, скачать, конвертировать, INSERT; обновлять `downloaded_tracks`/`skipped_tracks`/`failed_tracks`; при истечении токена — попытаться refresh, при неудаче — статус `auth_expired`
    - _Requirements: 10.1, 10.2, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

  - [ ]* 10.4 Написать property-тест P19: Playlist URL import completeness
    - **Property 19: For any valid playlist URL with N accessible tracks, after job completes, downloadedTracks + skippedTracks + failedTracks SHALL equal N**
    - **Validates: Requirements 10.1, 10.2, 10.8**
    - Генератор: генератор плейлиста с N треками, вариантами дедупликации

  - [x] 10.5 Создать `backend/routes/import.js`
    - `POST /api/import/playlist-url` — вызывает `playlistImporter.importByUrl`, возвращает 202 `{ jobId }`
    - `GET /api/import/oauth/:platform/authorize?sessionId` — редирект на OAuth URL
    - `GET /api/import/oauth/:platform/callback` — обрабатывает OAuth callback
    - `GET /api/import/oauth/:platform/playlists?sessionId` — возвращает плейлисты пользователя; 401 если нет сессии
    - `POST /api/import/oauth/:platform/import` — создаёт import_job через OAuth
    - `DELETE /api/import/oauth/:platform/session?sessionId` — отзывает OAuth сессию
    - `GET /api/import/jobs/:jobId` — возвращает статус задачи; 404 если не найдена
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6, 10.7, 10.11, 10.12, 10.16_

- [x] 11. Checkpoint — убедиться что все тесты проходят
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Подключить все маршруты в server.js
  - Импортировать и подключить `routes/tracks.js`, `routes/search.js`, `routes/recommendations.js`, `routes/download.js`, `routes/admin.js`, `routes/import.js` в `backend/server.js`
  - Запустить `importScheduler.start()` при инициализации сервера
  - Добавить `multer`, `better-sqlite3` в `backend/package.json`
  - _Requirements: 1.3, 1.4, 2.1, 4.1, 5.7, 6.1, 8.5, 10.1_

- [x] 13. Обновить Android-приложение (app.js)
  - [x] 13.1 Добавить загрузку self-hosted треков на главную страницу
    - Функция `loadSelfHostedTracks()` — `GET /api/tracks?page=1&limit=20`
    - Добавить треки в `tracks[]` рядом с YouTube-контентом
    - При недоступности Music_Server — показать toast и продолжить с YouTube-контентом
    - _Requirements: 3.1, 3.6_

  - [x] 13.2 Добавить бейдж "VT" для self-hosted треков
    - В `renderList()` — добавить `<span class="track-src-badge badge-vt">VT</span>` для треков с `src === 'self-hosted'`
    - Добавить CSS-стиль для `.badge-vt` (отличный от `.badge-yt`)
    - _Requirements: 3.3_

  - [x] 13.3 Реализовать воспроизведение self-hosted треков через `<audio>`
    - В `playTrack()` — если `track.src === 'self-hosted'`, использовать `<audio>` элемент вместо YouTube IFrame
    - URL стриминга: `${BACKEND_URL}/stream/${track.id}`
    - Обновлять `MediaNotificationPlugin` при смене self-hosted трека
    - _Requirements: 3.2, 3.4_

  - [x] 13.4 Реализовать кнопку "Текст" и блок lyrics в плеере
    - Добавить кнопку "Текст" в HTML плеера (disabled если `lyrics === null`)
    - При нажатии — `GET /api/tracks/:id/lyrics`, показать scrollable блок под элементами управления
    - Повторное нажатие — скрыть блок (toggle)
    - При смене трека — скрыть блок, сбросить кнопку
    - _Requirements: 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x] 13.5 Реализовать Download_Manager
    - Функция `downloadTrack(track)` — `GET /download/:trackId`, показывать прогресс 0–100%
    - Сохранять файл в публичную директорию Music с именем `{artist} - {title}.mp3`
    - Toast "Трек сохранён: {title}" при успехе; toast с ошибкой при неудаче
    - Диалог подтверждения если файл уже существует
    - Ограничение: не более 3 одновременных загрузок
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_

  - [x] 13.6 Реализовать экран "Импорт плейлиста"
    - Добавить страницу `pageImport` в HTML с: полем ввода URL, кнопками OAuth ("Войти через VK/Spotify/Яндекс.Музыку"), списком плейлистов после авторизации
    - Кнопка "Импортировать" по URL — `POST /api/import/playlist-url`
    - OAuth-кнопки — открывают WebView с `GET /api/import/oauth/:platform/authorize`
    - После авторизации — `GET /api/import/oauth/:platform/playlists`, отображать список
    - Polling `GET /api/import/jobs/:jobId` каждые 2 секунды во время импорта
    - Прогресс-бар "Скачано: {downloadedTracks} из {totalTracks}"
    - Toast по завершении: "Импортировано: {downloadedTracks} треков, пропущено: {skippedTracks}"
    - Кнопка "Выйти" — `DELETE /api/import/oauth/:platform/session`
    - _Requirements: 10.13, 10.14, 10.15_

- [x] 14. Финальный checkpoint — убедиться что все тесты проходят
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Создать документацию по развёртыванию
  - [x] 15.1 Создать `backend/render.yaml` для Render.com
  - [x] 15.2 Создать `backend/.env.example` с примерами переменных окружения
  - [x] 15.3 Создать `backend/DEPLOYMENT.md` с инструкциями для Render/Railway/VPS
  - [x] 15.4 Создать `backend/QUICKSTART.md` для быстрого старта на Render Free Plan
  - [x] 15.5 Создать `backend/README.md` с описанием проекта и API

## Notes

- Задачи с `*` — опциональные (property-тесты и unit-тесты), можно пропустить для быстрого MVP
- Каждая задача ссылается на конкретные требования для трассируемости
- Property-тесты используют библиотеку `fast-check`, минимум 100 итераций каждый
- Все property-тесты помечены тегом `// Feature: self-hosted-music-platform, Property N: <text>`
- Аудиофайлы хранятся на диске в `backend/storage/tracks/`, метаданные — в SQLite
- Импорт из внешних платформ требует установленных `yt-dlp` и `ffmpeg` на сервере
