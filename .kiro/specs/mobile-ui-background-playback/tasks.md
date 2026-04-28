# Implementation Plan: Mobile UI & Background Playback

## Overview

Реализация ведётся в двух направлениях параллельно:
1. **Мобильный UI** — CSS/HTML изменения: скрытие sidebar, MiniPlayer, FullscreenPlayer, BottomNav, новые страницы.
2. **Фоновое воспроизведение** — WakeLock в `MediaPlayerService`, доработка JS-моста (`updateNativeNotification`, `setupNativeMediaButtons`).

Все изменения в JS/CSS/HTML вносятся в `spotify-player/android/app/src/main/assets/public/`.
Изменения Android — в `spotify-player/android/app/src/main/java/com/violettunes/app/`.

## Tasks

- [x] 1. Мобильный CSS layout — скрытие sidebar и базовая адаптация
  - В `style.css` добавить `@media (max-width: 767px)`: скрыть `.sidebar`, изменить `.app` на `grid-template-columns: 1fr`, убрать `grid-column: 1/3` у `.player-bar`
  - Добавить стили для `#bottomNav`: `position: fixed; bottom: 0; width: 100%; height: 56px; display: flex; background: var(--bg2); border-top: 1px solid var(--border); z-index: 200`
  - Кнопки `.bottom-nav-item` — минимум 48×48dp, flex-direction: column, gap, активный пункт подсвечивается `var(--accent)`
  - Добавить `padding-bottom: calc(64px + 56px)` для `.main` на мобайле (место под MiniPlayer + BottomNav)
  - _Requirements: 1.1, 1.2, 1.3, 1.7_

- [x] 2. MiniPlayer — переработка player-bar для мобайла
  - [x] 2.1 Добавить CSS для мобильного `.player-bar`: высота 64px, `position: fixed; bottom: 56px; left: 0; width: 100%; z-index: 150`, упрощённый layout (обложка + название + кнопка play)
    - Скрыть на мобайле: `.player-controls .progress-wrap`, `.player-right`, `.controls-row .ctrl-btn:not(.play-btn)` (оставить только play/pause)
    - _Requirements: 1.3, 1.2_
  - [x] 2.2 В `app.js` добавить обработчик тапа на MiniPlayer: клик на `.player-track` (не на кнопки) → вызов `openFullscreenPlayer()`
    - _Requirements: 1.4_

- [x] 3. FullscreenPlayer — HTML-структура и CSS
  - [x] 3.1 В `index.html` добавить элемент `#fullscreenPlayer` перед закрывающим `</body>`:
    - Структура: `.fsp-drag-handle`, `.fsp-header` (кнопка закрыть), `.fsp-cover` (img + анимация), `.fsp-meta` (название, исполнитель), `.fsp-progress` (прогресс-бар + время M:SS), `.fsp-controls` (prev, play/pause, next, like, repeat, shuffle)
    - _Requirements: 1.5, 2.1_
  - [x] 3.2 В `style.css` добавить стили `.fullscreen-player`:
    - `position: fixed; inset: 0; z-index: 500; background: var(--bg); transform: translateY(100%); transition: transform 300ms cubic-bezier(.4,0,.2,1)`
    - `.fullscreen-player.open { transform: translateY(0) }`
    - Обложка `.fsp-cover img` — минимум 240×240px, border-radius, анимация `spin 8s linear infinite` при `.fsp-cover.spinning`
    - Прогресс-бар `.fsp-progress-bar` — аналогичен существующему `.progress-bar`
    - Кнопки управления — минимум 48×48dp
    - _Requirements: 2.1, 1.5, 6.3_

- [x] 4. FullscreenPlayer — JS логика
  - [x] 4.1 В `app.js` реализовать функции `openFullscreenPlayer()` и `closeFullscreenPlayer()`:
    - `open`: убрать `hidden`, добавить класс `open` с requestAnimationFrame, обновить данные (обложка, название, исполнитель, прогресс)
    - `close`: убрать класс `open`, по окончании transition добавить `hidden`
    - _Requirements: 2.1, 1.4_
  - [x] 4.2 Синхронизация прогресса FullscreenPlayer: в существующем `progressTimer` (интервал 500мс) добавить обновление элементов `#fspProgressFill`, `#fspTimeCurrent`, `#fspTimeTotal`
    - Использовать существующую функцию `fmt(s)` для форматирования времени
    - _Requirements: 2.3, 2.5_
  - [ ]* 4.3 Написать property-тест для функции `fmt(s)` (Property 5)
    - **Property 5: Форматирование времени — для любого `s ≥ 0` результат `fmt(s)` соответствует формату `M:SS`**
    - **Validates: Requirements 2.5**
  - [x] 4.4 Реализовать seek через FullscreenPlayer: обработчик `input`/`change` на `#fspProgressBar` → `ytPlayer.seekTo(position, true)`
    - _Requirements: 2.4_
  - [ ]* 4.5 Написать property-тест для seek (Property 4)
    - **Property 4: Seek через FullscreenPlayer изменяет позицию YT_Player — для любой позиции в [0, duration] после seek `getCurrentTime()` возвращает значение ±1 сек**
    - **Validates: Requirements 2.4**
  - [x] 4.6 Анимация обложки: при `isPlaying === true` добавлять класс `spinning` на `.fsp-cover`, при паузе — убирать (в `onYTState`)
    - _Requirements: 2.6_
  - [x] 4.7 Обновление данных при смене трека: в `updatePlayerUI` добавить обновление `#fspCoverImg`, `#fspTitle`, `#fspArtist` если FullscreenPlayer открыт
    - _Requirements: 2.2_

- [x] 5. Свайп вниз для закрытия FullscreenPlayer
  - В `app.js` добавить touch-обработчики на `#fullscreenPlayer`: `touchstart` (запомнить `touchStartY`), `touchmove` (вычислить `deltaY`, визуальный сдвиг), `touchend` (если `deltaY > 80` → `closeFullscreenPlayer()`, иначе вернуть на место)
  - _Requirements: 1.6_

- [x] 6. Checkpoint — проверить мобильный UI
  - Убедиться что sidebar скрыт на мобайле, BottomNav виден, MiniPlayer открывает FullscreenPlayer, свайп вниз закрывает его. Все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 7. BottomNav — JS навигация
  - [x] 7.1 В `app.js` добавить обработчики кликов на `.bottom-nav-item[data-page]`: вызов `showPage(page)`, обновление активного класса на кнопках BottomNav синхронно с существующей логикой `showPage`
    - _Requirements: 1.7, 1.8_
  - [x] 7.2 В существующей функции `showPage` добавить синхронизацию активного состояния кнопок `#bottomNav .bottom-nav-item`
    - _Requirements: 1.8_

- [x] 8. MyMusicPage — новая страница
  - [x] 8.1 В `index.html` добавить страницу `#pageMyMusic` с секциями «Избранное» (счётчик лайков, кнопка перехода на LikedPage) и «Мои плейлисты» (список плейлистов с иконкой, названием, количеством треков, кнопка создания нового)
    - _Requirements: 8.1, 8.2, 8.4, 8.6_
  - [x] 8.2 В `style.css` добавить стили `.mymusic-content`, `.mymusic-section`, `.mymusic-section-header`, `.mymusic-pl-item`
    - _Requirements: 8.1_
  - [x] 8.3 В `app.js` реализовать `renderMyMusicPage()`: отображение счётчика лайков, списка плейлистов; обработчики тапов (переход на LikedPage, открытие плейлиста, создание нового плейлиста)
    - Кнопка «Плейлисты» в BottomNav (`#btnMobileLibrary`) переключает на `pageMyMusic` вместо модального окна
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 9. PlaylistsPage — отдельная страница плейлистов
  - [x] 9.1 В `index.html` добавить страницу `#pagePlaylistsMain` со списком всех плейлистов (иконка, название, количество треков)
    - _Requirements: 11.1_
  - [x] 9.2 В `app.js` реализовать `renderPlaylistsMainPage()`: список плейлистов, тап → `openPlaylistPage(id)`, кнопка создания нового плейлиста
    - _Requirements: 11.1, 11.2_

- [x] 10. LikedPage — доработка
  - [x] 10.1 В `app.js` в `renderLikedPage()` убедиться что: при тапе на трек устанавливается весь список лайкнутых треков как очередь (`tracks = Object.values(liked)`), снятие лайка немедленно убирает трек из списка без перезагрузки страницы
    - _Requirements: 10.4, 10.5, 10.6_
  - [ ]* 10.2 Написать property-тест для лайка (Property 6)
    - **Property 6: Лайк round-trip в localStorage — после `toggleLikeTrack(track)` трек есть в `vt_liked`; после повторного вызова — отсутствует**
    - **Validates: Requirements 8.9, 10.5**

- [x] 11. Плейлисты — доработка localStorage round-trip
  - [x] 11.1 Убедиться что `createPlaylist`, `deletePlaylist`, `removeTrackFromPlaylist` корректно сохраняют состояние в `localStorage` и обновляют UI без перезагрузки страницы
    - _Requirements: 8.7, 8.8, 8.9, 11.6, 11.7_
  - [ ]* 11.2 Написать property-тест для плейлистов (Property 7)
    - **Property 7: Плейлист round-trip в localStorage — после `createPlaylist(name)` плейлист есть в `vt_playlists`; после `deletePlaylist(id)` — отсутствует; после `removeTrackFromPlaylist` трек не присутствует**
    - **Validates: Requirements 8.7, 8.8, 8.9, 11.6, 11.7**

- [x] 12. Checkpoint — проверить страницы и навигацию
  - Убедиться что MyMusicPage, PlaylistsPage, LikedPage работают корректно, BottomNav переключает страницы, данные сохраняются в localStorage. Все тесты проходят, задать вопросы пользователю при необходимости.

- [x] 13. SearchPage — доработка
  - [x] 13.1 В `app.js` в функции `doSearch()` (или в обработчике `searchBtn`) добавить проверку: если длина запроса < 2 символов — не отправлять запрос, показать подсказку в `#searchHeading`
    - _Requirements: 7.8_
  - [ ]* 13.2 Написать property-тест для валидации поискового запроса (Property 8)
    - **Property 8: Запрос < 2 символов не отправляется — для любой строки длиной 0 или 1 символ `doSearch()` не выполняет fetch**
    - **Validates: Requirements 7.8**
  - [x] 13.3 Убедиться что при пустых результатах отображается «Ничего не найдено», при ошибке — сообщение об ошибке с кнопкой повтора, при запросе > 5 сек — `AbortController` с таймаутом и сообщение об ошибке
    - _Requirements: 7.4, 7.5, 6.5_

- [x] 14. ForYouPage — доработка
  - В `app.js` в `renderForYouPage()` исправить баг: `Object.keys(history).length` → `Object.keys(listenHistory).length` (переменная называется `listenHistory`, не `history`)
  - Убедиться что при < 2 уникальных треков отображается заглушка, при ≥ 2 — персональные подборки со статистикой, чипами артистов, топ-треками
  - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.7_

- [x] 15. WakeLock — добавить в MediaPlayerService
  - В `MediaPlayerService.java` добавить `PowerManager.WakeLock`:
    - `import android.os.PowerManager`
    - В `onCreate()`: инициализировать `wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VioletTunes::MediaWakeLock")`
    - В `showNotification()` (перед `startForeground`): `if (!wakeLock.isHeld()) wakeLock.acquire()`
    - В обработке `"STOP"` и `onDestroy()`: `if (wakeLock != null && wakeLock.isHeld()) wakeLock.release()`
  - _Requirements: 3.2, 3.6_

- [-] 16. JS-мост — доработка updateNativeNotification и setupNativeMediaButtons
  - [ ] 16.1 В `app.js` в `toggleLikeTrack` добавить вызов `updateNativeNotification` если лайкаемый трек является текущим:
    ```js
    if (tracks[currentIndex]?.id === track.id) {
      updateNativeNotification(tracks[currentIndex], isPlaying, !wasLiked);
    }
    ```
    - _Requirements: 5.1, 5.2_
  - [x] 16.2 В `setupNativeMediaButtons` добавить обработку `'stop'`: `stopNativeNotification()`
    - _Requirements: 5.3_
  - [x] 16.3 Убедиться что `setupNativeMediaButtons()` вызывается при инициализации приложения (в DOMContentLoaded или аналоге)
    - _Requirements: 5.3, 5.4_
  - [ ]* 16.4 Написать property-тест для синхронизации уведомления (Property 1)
    - **Property 1: updateNativeNotification вызывается с корректными данными — для любого трека и перехода play/pause переданные title/artist/cover/liked совпадают с данными текущего трека, флаг playing — с фактическим состоянием**
    - **Validates: Requirements 5.1, 5.2, 3.3, 3.4**
  - [ ]* 16.5 Написать property-тест для обработки событий кнопок уведомления (Property 2)
    - **Property 2: Событие кнопки уведомления вызывает правильное действие — для каждого action (play/pause/next/prev/like) соответствующий метод вызывается ровно один раз**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 17. Синхронизация MediaSession
  - Убедиться что `setMediaSessionState(playing)` вызывается синхронно в `onYTState` при каждом изменении состояния (уже есть), и что `updateMediaSession(track)` вызывается в `updatePlayerUI` (уже есть)
  - Проверить что `navigator.mediaSession.playbackState` обновляется при play/pause
  - _Requirements: 5.5, 4.9_

- [x] 18. Lazy loading изображений
  - Убедиться что все `<img>` обложек в `renderList`, `renderRecSection`, `renderLikedPage`, `openPlaylistPage` имеют атрибут `loading="lazy"` (в `renderList` уже есть, проверить остальные)
  - _Requirements: 6.4_

- [x] 19. Финальный checkpoint — все тесты и интеграция
  - Убедиться что все тесты проходят, WakeLock добавлен в AndroidManifest (`WAKE_LOCK` permission), JS-мост работает корректно, FullscreenPlayer открывается/закрывается с анимацией ≤ 350мс. Задать вопросы пользователю при необходимости.

## Notes

- Задачи с `*` — опциональные тесты, можно пропустить для быстрого MVP
- Property-тесты пишутся с использованием **fast-check** (JavaScript PBT library)
- Каждый property-тест запускается минимум 100 итераций
- Изменения CSS/HTML вносятся в `spotify-player/android/app/src/main/assets/public/`
- После изменений JS/HTML/CSS нужно пересобрать Android-проект: `npx cap sync android`
- `WAKE_LOCK` permission должен быть в `AndroidManifest.xml` (проверить перед финальным тестом)
