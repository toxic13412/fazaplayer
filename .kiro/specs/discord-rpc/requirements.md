# Requirements Document

## Introduction

Discord Rich Presence (RPC) для VioletTunes — функция, которая отображает в профиле Discord информацию о текущем треке: название, исполнитель, обложка альбома и время воспроизведения. Пользователь видит статус "Слушает VioletTunes" в Discord.

Поскольку Discord RPC работает только через десктопное приложение Discord (Windows/Mac/Linux), а VioletTunes работает как веб-приложение и Android APK (Capacitor), интеграция реализуется через бэкенд-мост: веб-клиент отправляет данные о треке на бэкенд, а бэкенд через WebSocket-соединение с локальным Discord-клиентом обновляет Rich Presence.

Для веб-пользователей на десктопе предоставляется отдельный лёгкий Node.js-агент (VioletTunes Discord Bridge), который запускается локально и подключается к бэкенду по WebSocket для получения событий воспроизведения.

---

## Glossary

- **VioletTunes**: веб/Android-приложение для прослушивания музыки с YouTube и SoundCloud
- **Discord_RPC**: протокол Discord Rich Presence, позволяющий приложениям отображать статус активности в профиле Discord
- **Backend**: Node.js/Express сервер VioletTunes, развёрнутый на Render
- **Bridge**: локальный Node.js-агент, запускаемый пользователем на десктопе, который соединяет Backend с Discord_RPC
- **Web_Client**: веб-приложение VioletTunes, работающее в браузере или Capacitor WebView
- **Track_Event**: JSON-объект с полями `trackId`, `name`, `artist`, `coverUrl`, `positionSec`, `durationSec`, `playing`
- **Session_Token**: уникальный идентификатор сессии пользователя, используемый для маршрутизации Track_Event между Web_Client и Bridge
- **Discord_App_ID**: идентификатор приложения в Discord Developer Portal, необходимый для Discord_RPC

---

## Requirements

### Requirement 1: Отправка событий воспроизведения с клиента

**User Story:** Как пользователь VioletTunes, я хочу, чтобы приложение автоматически отправляло информацию о текущем треке, чтобы Discord мог отображать актуальный статус.

#### Acceptance Criteria

1. WHEN трек начинает воспроизводиться, THE Web_Client SHALL отправить Track_Event на Backend в течение 2 секунд
2. WHEN воспроизведение ставится на паузу, THE Web_Client SHALL отправить Track_Event с полем `playing: false` на Backend в течение 2 секунд
3. WHEN трек меняется, THE Web_Client SHALL отправить новый Track_Event с данными нового трека на Backend в течение 2 секунд
4. WHEN воспроизведение останавливается и трек не выбран, THE Web_Client SHALL отправить событие очистки на Backend для сброса Rich Presence
5. THE Web_Client SHALL включать в Track_Event поля: `name`, `artist`, `coverUrl`, `positionSec`, `durationSec`, `playing`, `sessionToken`
6. IF Backend недоступен, THEN THE Web_Client SHALL повторить отправку Track_Event через 5 секунд не более 3 раз, после чего прекратить попытки до следующего события воспроизведения

---

### Requirement 2: Маршрутизация событий через Backend

**User Story:** Как разработчик, я хочу, чтобы Backend маршрутизировал события воспроизведения к нужному Bridge-агенту, чтобы каждый пользователь видел свой статус.

#### Acceptance Criteria

1. THE Backend SHALL предоставить WebSocket-эндпоинт `/discord-rpc/ws` для подключения Bridge-агентов
2. THE Backend SHALL предоставить HTTP POST-эндпоинт `/discord-rpc/event` для приёма Track_Event от Web_Client
3. WHEN Web_Client отправляет Track_Event, THE Backend SHALL направить его Bridge-агенту с совпадающим Session_Token в течение 500 миллисекунд
4. WHEN Bridge-агент подключается по WebSocket, THE Backend SHALL сохранить соответствие Session_Token и WebSocket-соединения
5. WHEN Bridge-агент отключается, THE Backend SHALL удалить соответствующую запись Session_Token из активных соединений
6. IF для Session_Token нет активного Bridge-соединения, THEN THE Backend SHALL вернуть HTTP 202 с телом `{"status": "no_bridge"}` без ошибки
7. THE Backend SHALL принимать Track_Event только с валидным Session_Token длиной от 8 до 64 символов, иначе вернуть HTTP 400

---

### Requirement 3: Локальный Bridge-агент

**User Story:** Как пользователь на десктопе, я хочу запустить лёгкий агент, который соединит VioletTunes с Discord, чтобы мой статус обновлялся автоматически.

#### Acceptance Criteria

1. THE Bridge SHALL подключиться к Backend по WebSocket с указанным Session_Token при запуске
2. WHEN Bridge получает Track_Event от Backend, THE Bridge SHALL обновить Discord_RPC активность в течение 1 секунды
3. THE Bridge SHALL отображать в Discord_RPC: название трека в поле `details`, исполнителя в поле `state`, обложку альбома как `large_image`, метку "VioletTunes" как `large_text`
4. WHEN `playing: true` в Track_Event, THE Bridge SHALL установить в Discord_RPC временную метку начала воспроизведения (`timestamps.start`) на основе `positionSec`
5. WHEN `playing: false` в Track_Event, THE Bridge SHALL убрать временную метку из Discord_RPC и установить статус паузы
6. WHEN Bridge получает событие очистки, THE Bridge SHALL сбросить Discord_RPC активность (clearActivity)
7. IF Discord десктопное приложение не запущено, THEN THE Bridge SHALL повторять попытку подключения к Discord_RPC каждые 15 секунд
8. IF WebSocket-соединение с Backend разрывается, THEN THE Bridge SHALL повторять попытку переподключения с экспоненциальной задержкой от 2 до 60 секунд
9. THE Bridge SHALL выводить в консоль текущий статус подключения к Discord и Backend при каждом изменении состояния

---

### Requirement 4: Управление Session Token в интерфейсе

**User Story:** Как пользователь, я хочу видеть и копировать свой Session Token в настройках VioletTunes, чтобы указать его в Bridge-агенте.

#### Acceptance Criteria

1. THE Web_Client SHALL отображать Session_Token в разделе настроек или в существующей панели синхронизации
2. THE Web_Client SHALL генерировать Session_Token при первом открытии и сохранять его в localStorage под ключом `vt_discord_token`
3. WHEN пользователь нажимает кнопку копирования Session_Token, THE Web_Client SHALL скопировать токен в буфер обмена и показать уведомление "Токен скопирован"
4. THE Web_Client SHALL отображать индикатор статуса Discord RPC: "Активен" (зелёный) если Bridge подключён, "Не подключён" (серый) если Bridge отсутствует
5. WHEN Backend возвращает `{"status": "no_bridge"}`, THE Web_Client SHALL обновить индикатор статуса на "Не подключён"
6. WHEN Backend подтверждает доставку Track_Event к Bridge, THE Web_Client SHALL обновить индикатор статуса на "Активен"

---

### Requirement 5: Отображение данных в Discord

**User Story:** Как пользователь, я хочу видеть в Discord красивый статус с обложкой и информацией о треке, чтобы друзья знали что я слушаю.

#### Acceptance Criteria

1. THE Bridge SHALL устанавливать в Discord_RPC поле `details` равным названию трека длиной не более 128 символов
2. THE Bridge SHALL устанавливать в Discord_RPC поле `state` равным имени исполнителя с префиксом "by " длиной не более 128 символов
3. WHERE coverUrl в Track_Event является валидным HTTPS URL, THE Bridge SHALL использовать его как `large_image` в Discord_RPC
4. WHERE coverUrl отсутствует или невалиден, THE Bridge SHALL использовать логотип VioletTunes как `large_image` в Discord_RPC
5. THE Bridge SHALL устанавливать `large_text` равным "VioletTunes"
6. THE Bridge SHALL устанавливать `small_image` равным иконке воспроизведения или паузы в зависимости от поля `playing`
7. THE Bridge SHALL устанавливать `small_text` равным "Играет" при `playing: true` и "Пауза" при `playing: false`

---

### Requirement 6: Совместимость платформ

**User Story:** Как пользователь Android, я хочу понимать, что Discord RPC недоступен на мобильных устройствах, чтобы не ожидать этой функции на телефоне.

#### Acceptance Criteria

1. WHILE приложение работает в Capacitor WebView (Android), THE Web_Client SHALL скрывать элементы управления Discord RPC из интерфейса
2. WHILE приложение работает в браузере на десктопе, THE Web_Client SHALL отображать элементы управления Discord RPC
3. THE Web_Client SHALL определять платформу через `window.Capacitor?.isNativePlatform()` для скрытия/отображения Discord RPC UI
4. IF пользователь открывает VioletTunes на мобильном устройстве, THEN THE Web_Client SHALL отображать информационное сообщение "Discord RPC доступен только на десктопе"
