# Implementation Plan: Discord RPC

## Overview

Реализация Discord Rich Presence для VioletTunes через трёхзвенную архитектуру: Web_Client (app.js) → Backend (server.js) → Bridge (discord-bridge/index.js) → Discord Desktop App. Bridge собирается в `.exe` через `pkg` для Windows.

## Tasks

- [x] 1. Создать discord-bridge — структуру проекта и зависимости
  - Создать папку `discord-bridge/` с `package.json` (зависимости: `discord-rpc`, `ws`; devDependencies: `pkg`)
  - Добавить скрипт `"build": "pkg index.js --target node18-win-x64 --output dist/VioletTunesDiscord.exe"` в `package.json`
  - Создать `discord-bridge/index.js` с точкой входа: парсинг аргументов `--token` и `--backend`, вызов `connectToBackend` и `connectToDiscord`
  - _Requirements: 3.1, 3.9_

- [x] 2. Реализовать логику Bridge
  - [x] 2.1 Реализовать `connectToBackend(token, backendUrl)` — WebSocket-подключение к Backend, отправка `{type:"register", token}` при открытии, обработка входящих сообщений `track`, `clear`, `ping`
    - _Requirements: 3.1, 3.2, 3.6_
  - [x] 2.2 Реализовать `getReconnectDelay(attempt)` — экспоненциальная задержка: `Math.min(2000 * 2 ** (attempt - 1), 60000)`
    - _Requirements: 3.8_
  - [ ]* 2.3 Написать property-тест для `getReconnectDelay`
    - **Property 8: Экспоненциальная задержка переподключения**
    - **Validates: Requirements 3.8**
    - Файл: `discord-bridge/test/activity.test.js`, библиотека `fast-check`
  - [x] 2.4 Реализовать `connectToDiscord(clientId)` — подключение к Discord IPC через `discord-rpc`, retry каждые 15 сек если Discord не запущен
    - _Requirements: 3.7_
  - [x] 2.5 Реализовать `setActivity(trackEvent)` — формирование Discord Activity из Track_Event
    - `details` = `name.slice(0, 128)`
    - `state` = `("by " + artist).slice(0, 128)`
    - `largeImageKey` = валидный HTTPS URL из `coverUrl` или `"violettunes_logo"`
    - `largeImageText` = `"VioletTunes"`
    - `smallImageKey` = `"play"` / `"pause"` по `playing`
    - `smallImageText` = `"Играет"` / `"Пауза"` по `playing`
    - `timestamps.start` = `Date.now() - positionSec * 1000` только при `playing: true`
    - _Requirements: 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [ ]* 2.6 Написать property-тесты для `setActivity`
    - **Property 4: Discord Activity fields completeness** — Validates: Requirements 3.3, 5.1, 5.2, 5.5
    - **Property 5: Timestamps соответствуют состоянию playing** — Validates: Requirements 3.4, 3.5
    - **Property 6: coverUrl fallback** — Validates: Requirements 5.3, 5.4
    - **Property 7: small_image соответствует playing** — Validates: Requirements 5.6, 5.7
    - Файл: `discord-bridge/test/activity.test.js`
  - [x] 2.7 Реализовать `clearActivity()` — сброс Discord RPC активности
    - _Requirements: 3.6_

- [x] 3. Checkpoint — убедиться что Bridge запускается
  - Убедиться что `node discord-bridge/index.js --token=testtoken123 --backend=ws://localhost:3001` не падает и выводит статус в консоль. Спросить пользователя если возникнут вопросы.

- [x] 4. Добавить Discord RPC эндпоинты в backend/server.js
  - [x] 4.1 Установить пакет `ws` в `backend/` (добавить в `package.json` dependencies)
    - _Requirements: 2.1_
  - [x] 4.2 Создать WebSocket-сервер поверх существующего Express HTTP-сервера
    - `const { WebSocketServer } = require('ws')`
    - Изменить `app.listen(...)` на `const server = app.listen(...)`, создать `new WebSocketServer({ server })`
    - Обработать upgrade-запросы на путь `/discord-rpc/ws`
    - _Requirements: 2.1_
  - [x] 4.3 Реализовать хранилище соединений и регистрацию Bridge
    - `const bridgeConnections = new Map()` — sessionToken → WebSocket
    - При получении `{type:"register", token}` — сохранить соединение в Map
    - При закрытии WebSocket — удалить запись из Map
    - _Requirements: 2.4, 2.5_
  - [x] 4.4 Реализовать `POST /discord-rpc/event`
    - Валидация `sessionToken`: длина 8–64 символа, иначе HTTP 400 `{"error":"invalid_token"}`
    - Поиск Bridge в `bridgeConnections` по токену
    - Если найден — отправить Track_Event через WebSocket, вернуть HTTP 200 `{"status":"delivered"}`
    - Если не найден — вернуть HTTP 202 `{"status":"no_bridge"}`
    - _Requirements: 2.2, 2.3, 2.6, 2.7_
  - [x] 4.5 Реализовать `GET /discord-rpc/status/:token`
    - Вернуть `{"connected": true/false}` в зависимости от наличия токена в `bridgeConnections`
    - _Requirements: 2.1_
  - [ ]* 4.6 Написать property-тесты для Backend эндпоинтов
    - **Property 1: Session Token валидация** — Validates: Requirements 2.7
    - **Property 2: Маршрутизация Track_Event к Bridge** — Validates: Requirements 2.3, 2.4, 2.5
    - **Property 3: Отсутствие Bridge — корректный ответ** — Validates: Requirements 2.6
    - Файл: `backend/test/discord-rpc.test.js`, библиотека `fast-check`

- [x] 5. Checkpoint — убедиться что Backend работает
  - Убедиться что все тесты проходят, эндпоинты `/discord-rpc/event` и `/discord-rpc/ws` доступны. Спросить пользователя если возникнут вопросы.

- [x] 6. Добавить модуль discordRpc в app.js
  - [x] 6.1 Реализовать `initDiscordRpc()` — генерация/загрузка токена из localStorage (`vt_discord_token`), проверка платформы через `window.Capacitor?.isNativePlatform()`, добавление UI-блока Discord RPC в sidebar только на десктопе
    - _Requirements: 4.1, 4.2, 6.1, 6.2, 6.3_
  - [ ]* 6.2 Написать property-тест для генерации токена
    - **Property 9: Генерация и сохранение Session Token** — Validates: Requirements 4.2
  - [x] 6.3 Реализовать `sendTrackEvent(track, playing)` — формирование и отправка Track_Event на `POST /discord-rpc/event` с retry-логикой (3 попытки, задержка 5 сек)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_
  - [x] 6.4 Реализовать `sendClearEvent()` — отправка `{sessionToken, clear: true}` на Backend
    - _Requirements: 1.4_
  - [x] 6.5 Реализовать `updateDiscordStatus(status)` — обновление UI-индикатора: `'active'` → "Активен" (зелёный), `'no_bridge'` → "Не подключён" (серый), `'error'` → "Ошибка"
    - _Requirements: 4.4, 4.5, 4.6_
  - [ ]* 6.6 Написать тест для `updateDiscordStatus`
    - **Property 10: Индикатор статуса соответствует ответу Backend** — Validates: Requirements 4.5, 4.6
  - [x] 6.7 Реализовать `copyDiscordToken()` — копирование токена в буфер обмена, показ toast "Токен скопирован"
    - _Requirements: 4.3_
  - [x] 6.8 Интегрировать `sendTrackEvent` и `sendClearEvent` в `onYTState`
    - При `S.PLAYING` — вызвать `sendTrackEvent(tracks[currentIndex], true)`
    - При `S.PAUSED` — вызвать `sendTrackEvent(tracks[currentIndex], false)`
    - При `S.ENDED` без следующего трека — вызвать `sendClearEvent()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 6.9 Вызвать `initDiscordRpc()` при инициализации приложения (рядом с `setupMediaSession()`)
    - _Requirements: 4.1, 6.1, 6.2_

- [x] 7. Final checkpoint — полная интеграция
  - Убедиться что все тесты проходят, UI-индикатор отображается на десктопе и скрыт на Android, Bridge корректно получает события. Спросить пользователя если возникнут вопросы.

## Notes

- Задачи с `*` опциональны и могут быть пропущены для быстрого MVP
- Bridge собирается командой `npm run build` в папке `discord-bridge/` → `dist/VioletTunesDiscord.exe`
- Backend URL по умолчанию в Bridge: `wss://violettunes-backend.onrender.com`
- Discord App ID для `connectToDiscord` нужно создать в Discord Developer Portal и захардкодить в Bridge
- Property-тесты используют `fast-check`, минимум 100 итераций
