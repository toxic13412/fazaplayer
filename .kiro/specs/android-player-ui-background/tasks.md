# Implementation Plan: android-player-ui-background

## Overview

Реализация трёх взаимосвязанных улучшений Android-приложения VioletTunes: адаптивный мобильный UI (Bottom Nav, Player Bar, Player Screen, свайп-жесты), медиа-уведомление с кнопками управления и MediaSession, фоновое воспроизведение через Foreground Service. Реализация ведётся параллельно в двух слоях: JS/CSS (веб-часть) и нативный Android (Java).

## Tasks

- [x] 1. Адаптивный CSS и Bottom Navigation
  - [x] 1.1 Добавить Bottom Nav в `index.html` и стили в `style.css`
    - Добавить `<nav id="bottomNav">` с четырьмя пунктами (Главная, Поиск, Для тебя, Избранное), каждый с SVG-иконкой и подписью
    - Добавить CSS: `position: fixed; bottom: calc(var(--player-h) + env(safe-area-inset-bottom)); left: 0; right: 0; z-index: 50`
    - Скрывать `.sidebar` и показывать `#bottomNav` только при `@media (max-width: 767px)`
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.2 Реализовать `initBottomNav()` и `updateBottomNavActive()` в `app.js`
    - Навесить обработчики кликов на пункты Bottom Nav, вызывать `showPage(pageId)`
    - Обновлять активный класс: снимать со всех, ставить на выбранный
    - _Requirements: 1.3_

  - [ ]* 1.3 Написать property-тест для Bottom Nav (P1)
    - **Property 1: Bottom Nav navigation consistency**
    - **Validates: Requirements 1.3**
    - Использовать fast-check: `fc.constantFrom('home','search','foryou','liked')`, проверять что после `showPage(id)` активен именно этот пункт и только он

  - [x] 1.4 Адаптировать Player Bar под мобильный экран в `style.css`
    - При `max-width: 767px`: `width: 100%; height: 72px; padding-bottom: env(safe-area-inset-bottom)`
    - Layout: обложка 48×48px, название+исполнитель, кнопка лайк, кнопка play/pause в одну строку
    - _Requirements: 2.1, 2.2_

  - [x] 1.5 Обеспечить touch-friendly размеры кнопок и элементов списка в `style.css`
    - Все кнопки управления плеером: `min-width: 44px; min-height: 44px`
    - Элементы списка треков: `min-height: 56px`
    - _Requirements: 3.1, 3.2_

  - [ ]* 1.6 Написать property-тесты для touch targets (P2, P3)
    - **Property 2: Player controls touch target size**
    - **Validates: Requirements 3.1**
    - **Property 3: Track list item touch target size**
    - **Validates: Requirements 3.2**
    - Использовать fast-check + jsdom: проверять computed style кнопок и высоту track-item

- [ ] 2. Player Screen и свайп-жесты
  - [ ] 2.1 Добавить `#playerScreen` в `index.html` и стили в `style.css`
    - Добавить `<div id="playerScreen" class="player-screen hidden">` с элементами: обложка (min 240×240px), название, исполнитель, прогресс-бар с временными метками, кнопки Prev/Play/Next, Shuffle/Repeat, Like
    - CSS: `position: fixed; inset: 0; z-index: 200`
    - _Requirements: 2.4_

  - [ ] 2.2 Реализовать `openPlayerScreen()`, `closePlayerScreen()`, `extractDominantColor()` в `app.js`
    - `openPlayerScreen()`: убирать класс `hidden`, вызывать `extractDominantColor()` для установки фона
    - `extractDominantColor(img)`: Canvas API → dominant color; при ошибке или null cover — фиолетовый градиент по умолчанию
    - `closePlayerScreen()`: добавлять класс `hidden`
    - Навесить обработчик клика на Player Bar (кроме кнопок) для открытия Player Screen
    - _Requirements: 2.3, 2.6_

  - [ ] 2.3 Реализовать `setupSwipeToClose()` в `app.js`
    - Обработчики `touchstart`, `touchmove`, `touchend` на `#playerScreen`
    - При свайпе вниз — вызывать `closePlayerScreen()`
    - Кнопка «↓» также закрывает Player Screen
    - _Requirements: 2.5_

  - [ ] 2.4 Реализовать `setupTrackSwipe()` в `app.js`
    - Горизонтальный свайп на элементе трека: вправо — лайк, влево — удаление из плейлиста
    - Если `deltaX < 40px` при `touchend` — возвращать элемент через `transition: transform 0.2s`
    - Если `deltaX >= 40px` — выполнять действие
    - _Requirements: 3.4, 3.5_

  - [ ]* 2.5 Написать property-тест для отмены свайпа (P4)
    - **Property 4: Swipe cancellation below threshold**
    - **Validates: Requirements 3.5**
    - Использовать fast-check: `fc.integer({min:0, max:39})`, проверять что действие не выполнено и элемент вернулся на место

- [ ] 3. Checkpoint — проверка UI-слоя
  - Убедиться что все тесты UI-слоя проходят, спросить пользователя если есть вопросы.

- [ ] 4. Доработка `MediaPlayerService` (Java)
  - [ ] 4.1 Заменить `AsyncTask` на `ExecutorService` в `MediaPlayerService.java`
    - Создать `ExecutorService` (single thread) для загрузки обложки
    - Использовать `Future.get(5, TimeUnit.SECONDS)` с обработкой `TimeoutException`
    - По завершении вызывать `showNotification()` через `Handler(Looper.getMainLooper())`
    - _Requirements: 9.1, 9.5_

  - [ ] 4.2 Добавить дедупликацию обложки в `MediaPlayerService.java`
    - Добавить поле `private String lastLoadedCover`
    - Перед загрузкой проверять `currentCover.equals(lastLoadedCover)` — если совпадает, пропускать загрузку
    - После успешной загрузки обновлять `lastLoadedCover`
    - _Requirements: 9.3_

  - [ ]* 4.3 Написать property-тест для дедупликации обложки (P11)
    - **Property 11: Cover deduplication prevents redundant loads**
    - **Validates: Requirements 9.3**
    - Использовать jqwik: `@ForAll String coverUrl, @ForAll @IntRange(min=2, max=10) int repeatCount`, проверять что загрузка вызвана ровно 1 раз

  - [ ] 4.4 Добавить `PowerManager.WakeLock` в `MediaPlayerService.java`
    - В `onCreate()`: запрашивать `WAKE_LOCK` с тегом `"VioletTunes:playback"`, флаг `PARTIAL_WAKE_LOCK`
    - В `onDestroy()`: освобождать `wakeLock` если удерживается (`wakeLock.isHeld()`)
    - _Requirements: 7.6_

  - [ ] 4.5 Добавить `onTaskRemoved()` в `MediaPlayerService.java`
    - Вызывать `stopForeground(true)` и `stopSelf()`
    - _Requirements: 7.5_

  - [ ]* 4.6 Написать unit-тесты для `MediaPlayerService` (JUnit + Robolectric)
    - `onCreate()`: канал создан, MediaSession активен, WAKE_LOCK запрошен
    - `onStartCommand(STOP)`: `stopForeground` + `stopSelf` вызваны
    - `onTaskRemoved()`: сервис останавливается
    - `onDestroy()`: `mediaSession.release()` вызван
    - Timeout обложки > 5s: уведомление без обложки
    - _Requirements: 7.5, 7.6, 9.1, 9.4, 9.5_

- [ ] 5. Доработка `MediaNotificationPlugin` и уведомления (Java)
  - [ ] 5.1 Добавить дедупликацию и rate-limiting в `MediaNotificationPlugin.java`
    - Хранить последние переданные данные (`lastTitle`, `lastArtist`, `lastCover`, `lastPlaying`, `lastLiked`)
    - Пропускать `updateNotification` если данные не изменились
    - Rate-limiting: не отправлять UPDATE чаще раза в 500ms (использовать `Handler.postDelayed` или timestamp)
    - _Requirements: 9.2_

  - [ ]* 5.2 Написать property-тест для rate-limiting (P12)
    - **Property 12: Notification update rate limiting**
    - **Validates: Requirements 9.2**
    - Использовать jqwik: `@ForAll List<Long> updateTimestamps`, проверять что количество фактических обновлений ≤ 1 на каждые 500ms

  - [ ] 5.3 Реализовать отображение уведомления с кнопками в `MediaPlayerService.java`
    - `showNotification()`: строить `NotificationCompat.Builder` с `MediaStyle`, `setShowActionsInCompactView(0, 1, 2)`
    - Четыре кнопки: Prev, Play/Pause (зависит от `isPlaying`), Next, Like (иконка зависит от `isLiked`)
    - `VISIBILITY_PUBLIC`, `LargeIcon` из загруженной обложки или иконки приложения
    - `ContentIntent` для открытия `MainActivity`
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.2, 5.3, 5.5_

  - [ ]* 5.4 Написать property-тесты для уведомления (P5, P6, P7)
    - **Property 5: Notification reflects track data**
    - **Validates: Requirements 4.2**
    - **Property 6: Play/Pause button reflects playing state**
    - **Validates: Requirements 5.2**
    - **Property 7: Like button reflects liked state**
    - **Validates: Requirements 5.3**
    - Использовать jqwik: `@ForAll String title, artist`, `@ForAll boolean playing`, `@ForAll boolean liked`

- [ ] 6. MediaSession интеграция (Java)
  - [ ] 6.1 Создать и настроить `MediaSessionCompat` в `MediaPlayerService.java`
    - В `onCreate()`: создавать `MediaSessionCompat`, устанавливать `setActive(true)`
    - Поддерживать действия: `ACTION_PLAY`, `ACTION_PAUSE`, `ACTION_SKIP_TO_NEXT`, `ACTION_SKIP_TO_PREVIOUS`
    - Callback передаёт действия в `MediaButtonReceiver`
    - _Requirements: 6.1, 6.4_

  - [ ] 6.2 Обновлять `MediaMetadataCompat` и `PlaybackStateCompat` в `showNotification()` / `MediaPlayerService.java`
    - `MediaMetadataCompat`: `METADATA_KEY_TITLE`, `METADATA_KEY_ARTIST`, `METADATA_KEY_ART` (если обложка загружена)
    - `PlaybackStateCompat`: `STATE_PLAYING` если `isPlaying=true`, `STATE_PAUSED` если `false`
    - _Requirements: 6.2, 6.3_

  - [ ]* 6.3 Написать property-тесты для MediaSession (P8, P9)
    - **Property 8: MediaSession metadata reflects track data**
    - **Validates: Requirements 6.2**
    - **Property 9: PlaybackState reflects playing flag**
    - **Validates: Requirements 6.3**
    - Использовать jqwik: `@ForAll String title, artist`, `@ForAll boolean playing`

- [ ] 7. Checkpoint — проверка нативного Android-слоя
  - Убедиться что все тесты Android-слоя проходят, спросить пользователя если есть вопросы.

- [ ] 8. Синхронизация JS ↔ Native и обработка событий
  - [ ] 8.1 Реализовать обработку `mediaAction` событий в `app.js`
    - Зарегистрировать listener на `mediaAction` при инициализации приложения
    - Обрабатывать все значения `action`: `"play"`, `"pause"`, `"next"`, `"prev"`, `"like"`, `"stop"`
    - `"play"` / `"pause"` → вызывать YouTube IFrame Player API
    - `"next"` / `"prev"` → переключать трек, вызывать `updateNotification` с новыми данными
    - `"like"` → переключать состояние лайка, вызывать `updateNotification` с обновлённым `liked`
    - _Requirements: 5.6, 5.7, 5.8, 8.2, 8.3_

  - [ ] 8.2 Обновить `updatePlayerUI()` и `onYTState()` в `app.js`
    - `updatePlayerUI(track)`: дополнительно обновлять Player Screen если он открыт
    - `onYTState(e)`: при resume из фона синхронизировать UI (кнопка play/pause, прогресс-бар)
    - _Requirements: 7.4_

  - [ ] 8.3 Вызывать `updateNotification` при каждом изменении состояния в `app.js`
    - При смене трека, play/pause, toggle лайка — вызывать `updateNotification` в течение 300ms
    - Обернуть все вызовы плагина в `try/catch` с `console.warn`
    - Проверять `window.Capacitor?.isNativePlatform?.()` перед вызовом; при `false` — использовать `navigator.mediaSession` как fallback
    - _Requirements: 8.1, 8.4, 8.5_

  - [ ]* 8.4 Написать property-тест для синхронизации состояния (P10)
    - **Property 10: JS state changes trigger updateNotification**
    - **Validates: Requirements 8.1, 8.5**
    - Использовать fast-check: `fc.oneof(...)` для событий play/pause/next/prev/like, проверять что `updateNotification` вызван ≤ 300ms

  - [ ] 8.5 Обработать ошибки YouTube IFrame Player в `app.js`
    - `onError` callback: показывать toast «Ошибка воспроизведения», вызывать `playNext()`
    - Вызывать `updateNotification` с `playing: false` при ошибке
    - _Requirements: 4.4_

- [ ] 9. Финальный checkpoint — все тесты и интеграция
  - Убедиться что все тесты (unit, property, integration) проходят, спросить пользователя если есть вопросы.

## Notes

- Задачи с `*` — опциональные, можно пропустить для быстрого MVP
- Каждая задача ссылается на конкретные требования для трассируемости
- Реализация ведётся в двух слоях: JS/CSS (`app.js`, `style.css`, `index.html`) и нативный Android (`MediaPlayerService.java`, `MediaNotificationPlugin.java`)
- Property-тесты: JS — fast-check, Android — jqwik (минимум 100 итераций каждый)
- Unit-тесты: JS — Jest + jsdom, Android — JUnit + Robolectric
