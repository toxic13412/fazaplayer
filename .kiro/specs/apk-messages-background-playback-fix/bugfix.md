# Bugfix Requirements Document

## Introduction

Два бага в Android APK приложении VioletTunes (Capacitor-based музыкальный плеер):

1. **Раздел сообщений/«Для тебя» не отображается** — страница `pageForyou` не рендерится корректно из-за ошибки в коде: в `renderForYouPage()` используется глобальная переменная `history` (объект браузера `window.history`) вместо `listenHistory`. Это приводит к тому, что раздел всегда показывает пустое состояние «Слушай музыку — я запомню», даже когда история прослушивания непустая. Также клики по «часто слушаемым» трекам не работают по той же причине.

2. **Фоновое воспроизведение музыки не работает** — воспроизведение YouTube через `ytPlayer` (IFrame API) останавливается при уходе приложения в фон, потому что `MediaPlayerService` запускается как foreground-сервис с уведомлением, но не управляет реальным аудиопотоком. Сам `ytPlayer` работает внутри WebView, который Android может приостановить или убить при сворачивании. Отсутствует `WAKE_LOCK` в WebView и нет явного запрета на паузу WebView при потере фокуса.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN пользователь прослушал несколько треков И открывает раздел «Для тебя» THEN система отображает пустой экран «Слушай музыку — я запомню» вместо персональных рекомендаций

1.2 WHEN пользователь нажимает на трек в блоке «Часто слушаешь» на странице «Для тебя» THEN система не воспроизводит трек, так как `history[id]` обращается к `window.history` браузера, а не к `listenHistory`

1.3 WHEN пользователь слушает музыку И сворачивает приложение (уходит в фон) THEN воспроизведение останавливается

1.4 WHEN приложение находится в фоне И пользователь нажимает кнопку «Play» в уведомлении THEN воспроизведение не возобновляется, так как WebView заморожен

### Expected Behavior (Correct)

2.1 WHEN пользователь прослушал несколько треков И открывает раздел «Для тебя» THEN система SHALL отображать персональные рекомендации на основе `listenHistory`

2.2 WHEN пользователь нажимает на трек в блоке «Часто слушаешь» THEN система SHALL воспроизводить выбранный трек, корректно обращаясь к `listenHistory[id]`

2.3 WHEN пользователь сворачивает приложение во время воспроизведения THEN система SHALL продолжать воспроизведение музыки в фоне

2.4 WHEN приложение находится в фоне И пользователь нажимает кнопку управления в уведомлении THEN система SHALL корректно обрабатывать команду (play/pause/next/prev) и изменять состояние воспроизведения

### Unchanged Behavior (Regression Prevention)

3.1 WHEN пользователь открывает раздел «Для тебя» при пустой истории прослушивания THEN система SHALL CONTINUE TO отображать экран-заглушку «Слушай музыку — я запомню»

3.2 WHEN пользователь воспроизводит трек при открытом приложении THEN система SHALL CONTINUE TO воспроизводить музыку через YouTube IFrame Player без изменений

3.3 WHEN пользователь нажимает кнопки управления (play/pause/next/prev) в интерфейсе приложения THEN система SHALL CONTINUE TO корректно управлять воспроизведением

3.4 WHEN пользователь добавляет треки в историю прослушивания THEN система SHALL CONTINUE TO сохранять историю в `localStorage` под ключом `vt_history`

3.5 WHEN приложение возвращается на передний план THEN система SHALL CONTINUE TO синхронизировать состояние UI с текущим состоянием воспроизведения

---

## Bug Condition Pseudocode

### Bug 1: Неверная переменная `history` вместо `listenHistory`

```pascal
FUNCTION isBugCondition_Messages(X)
  INPUT: X — вызов renderForYouPage() или клик по foryou-top-track
  OUTPUT: boolean

  RETURN uses_window_history_instead_of_listenHistory(X)
  // т.е. в коде написано history[id] или Object.keys(history).length
  // вместо listenHistory[id] или Object.keys(listenHistory).length
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_Messages(X) DO
  result ← renderForYouPage'(X)
  ASSERT result показывает рекомендации когда listenHistory непустой
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_Messages(X) DO
  ASSERT renderForYouPage(X) = renderForYouPage'(X)
END FOR
```

### Bug 2: WebView останавливается в фоне

```pascal
FUNCTION isBugCondition_Background(X)
  INPUT: X — событие ухода приложения в фон (onPause/onStop Activity)
  OUTPUT: boolean

  RETURN app_goes_to_background(X) AND music_is_playing(X)
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_Background(X) DO
  result ← onBackground'(X)
  ASSERT ytPlayer_still_playing(result) = true
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_Background(X) DO
  ASSERT onBackground(X) = onBackground'(X)
END FOR
```
