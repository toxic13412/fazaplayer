# APK Messages Background Playback Fix — Bugfix Design

## Overview

Два бага в Android APK приложении VioletTunes (Capacitor WebView + YouTube IFrame API):

**Баг 1** — В `renderForYouPage()` в `app.js` используется глобальная переменная `history` (`window.history` браузера) вместо `listenHistory`. Это приводит к тому, что страница «Для тебя» всегда показывает пустое состояние, а клики по «часто слушаемым» трекам не работают.

**Баг 2** — WebView в `MainActivity.java` не управляется корректно при уходе приложения в фон: отсутствует явный вызов `webView.onResume()` / `webView.onPause()` через Capacitor Bridge, что приводит к заморозке WebView и остановке воспроизведения YouTube IFrame Player.

Стратегия исправления: минимальные точечные изменения — замена двух вхождений `history` на `listenHistory` в `app.js` и добавление переопределений `onResume`/`onPause` в `MainActivity.java`.

---

## Glossary

- **Bug_Condition (C)**: Условие, при котором проявляется баг
- **Property (P)**: Ожидаемое корректное поведение при выполнении условия бага
- **Preservation**: Существующее поведение, которое не должно измениться после исправления
- **listenHistory**: Объект `{ [trackId]: TrackEntry }` в `app.js`, хранящий историю прослушивания пользователя (сохраняется в `localStorage` под ключом `vt_history`)
- **window.history**: Встроенный браузерный объект History API — не имеет отношения к истории прослушивания
- **renderForYouPage()**: Функция в `app.js`, которая строит страницу «Для тебя» на основе `listenHistory`
- **BridgeActivity**: Базовый класс Capacitor для `MainActivity`, управляет жизненным циклом WebView
- **webView.onResume() / webView.onPause()**: Методы Android WebView для корректного управления состоянием при смене фокуса активности

---

## Bug Details

### Bug 1: Неверная переменная `history` вместо `listenHistory`

Баг проявляется в двух местах в `renderForYouPage()` в файле `spotify-player/android/app/src/main/assets/public/app.js`:

1. **Строка ~356**: `Object.keys(history).length` — обращается к `window.history` (объект History API), у которого нет числовых ключей, поэтому `histLen` всегда равен `0`. Условие `rec.totalTracks < 2` всегда истинно → страница всегда показывает заглушку.

2. **Строка ~462**: `const t = history[id]` — обращается к `window.history[id]`, которое всегда `undefined`. Клик по треку в «Часто слушаешь» не воспроизводит трек.

**Formal Specification:**
```
FUNCTION isBugCondition_Messages(X)
  INPUT: X — вызов renderForYouPage() или клик по .foryou-top-track
  OUTPUT: boolean

  RETURN (X.callSite === 'renderForYouPage' AND uses_window_history(X))
         OR (X.callSite === 'foryou-top-track.click' AND history[X.trackId] === undefined)
END FUNCTION
```

### Примеры проявления

- Пользователь прослушал 5 треков → `listenHistory` содержит 5 записей → открывает «Для тебя» → `Object.keys(history).length` возвращает `0` → показывается заглушка вместо рекомендаций
- Пользователь кликает на трек «Часто слушаешь» с id `"dQw4w9WgXcQ"` → `history["dQw4w9WgXcQ"]` = `undefined` → трек не воспроизводится
- Пользователь открывает «Для тебя» при пустой истории → `listenHistory` пуст → заглушка показывается корректно (это не баг, это ожидаемое поведение)

---

### Bug 2: WebView замораживается при уходе в фон

Баг проявляется в `MainActivity.java`. Текущая реализация наследует `BridgeActivity` и переопределяет только `onCreate`. При уходе в фон Android вызывает `onPause()` на Activity, что через `BridgeActivity` может приостановить WebView. Capacitor Bridge предоставляет `getBridge().getWebView()` для прямого управления WebView.

**Formal Specification:**
```
FUNCTION isBugCondition_Background(X)
  INPUT: X — событие жизненного цикла Activity
  OUTPUT: boolean

  RETURN X.event IN [onPause, onStop]
         AND ytPlayer_is_playing()
         AND webView.onResume_not_called_on_resume()
END FUNCTION
```

### Примеры проявления

- Пользователь слушает трек → сворачивает приложение → Android вызывает `onPause()` → WebView приостанавливается → YouTube IFrame Player останавливается
- Пользователь нажимает «Play» в уведомлении → `MediaButtonReceiver` отправляет событие в JS → WebView заморожен → событие не обрабатывается
- Пользователь возвращается в приложение → `onResume()` не вызывает `webView.onResume()` явно → WebView может не восстановиться корректно

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Воспроизведение треков при открытом приложении должно работать без изменений
- Страница «Для тебя» при пустой истории прослушивания должна продолжать показывать заглушку
- Кнопки управления (play/pause/next/prev) в интерфейсе приложения должны работать как прежде
- История прослушивания должна продолжать сохраняться в `localStorage` под ключом `vt_history`
- Синхронизация UI при возврате приложения на передний план должна работать как прежде

**Scope:**
Все вызовы, не связанные с `renderForYouPage()` и жизненным циклом Activity, должны быть полностью не затронуты исправлением. Это включает:
- Поиск треков и воспроизведение из поиска
- Работу с плейлистами и лайками
- Уведомления и MediaSession
- Все остальные страницы приложения (home, search, liked, playlists)

---

## Hypothesized Root Cause

### Баг 1

1. **Опечатка при рефакторинге**: Переменная `listenHistory` была переименована или добавлена позже, а в двух местах `renderForYouPage()` осталось старое имя `history`, которое случайно совпадает с глобальным `window.history`.

2. **Отсутствие линтинга**: JavaScript не выдаёт ошибку при обращении к `window.history` — это валидный объект, поэтому баг не проявляется как исключение, а только как некорректное поведение.

### Баг 2

1. **Неполная реализация жизненного цикла**: `MainActivity` переопределяет только `onCreate`, не переопределяя `onResume`/`onPause`. Базовый класс `BridgeActivity` вызывает `super.onPause()`, что может приостанавливать WebView.

2. **Отсутствие явного управления WebView**: Capacitor рекомендует явно вызывать `getBridge().getWebView().onResume()` и `getBridge().getWebView().onPause()` для корректной работы WebView в фоне при воспроизведении медиа.

3. **WAKE_LOCK не используется в WebView**: Хотя разрешение `WAKE_LOCK` объявлено в манифесте, оно не применяется к WebView через `webView.getSettings().setMediaPlaybackRequiresUserGesture(false)` или аналогичные настройки.

---

## Correctness Properties

Property 1: Bug Condition — Страница «Для тебя» отображает рекомендации

_For any_ вызова `renderForYouPage()` где `listenHistory` содержит 2 или более записей, исправленная функция SHALL отображать персональные рекомендации (блоки «Твои артисты», «Часто слушаешь», «Подборки для тебя»), а не заглушку «Слушай музыку — я запомню».

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Клик по треку в «Часто слушаешь» воспроизводит трек

_For any_ клика по `.foryou-top-track` с валидным `data-id`, исправленная функция SHALL корректно получить трек из `listenHistory[id]` и запустить воспроизведение через `playTrack(0)`.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Воспроизведение продолжается в фоне

_For any_ события ухода приложения в фон (`onPause`) при активном воспроизведении, исправленный `MainActivity` SHALL не приостанавливать WebView, позволяя YouTube IFrame Player продолжать воспроизведение.

**Validates: Requirements 2.3, 2.4**

Property 4: Preservation — Заглушка при пустой истории

_For any_ вызова `renderForYouPage()` где `listenHistory` пуст или содержит менее 2 записей, исправленная функция SHALL продолжать отображать заглушку «Слушай музыку — я запомню» — идентично оригинальному поведению.

**Validates: Requirements 3.1**

Property 5: Preservation — Воспроизведение при открытом приложении

_For any_ взаимодействия с плеером при открытом приложении (play/pause/next/prev/seek), исправленный код SHALL производить идентичный результат с оригинальным кодом.

**Validates: Requirements 3.2, 3.3**

---

## Fix Implementation

### Changes Required

#### Fix 1: `app.js` — замена `history` на `listenHistory`

**File**: `spotify-player/android/app/src/main/assets/public/app.js`  
(и зеркальный файл `spotify-player/www/app.js` если он используется как источник)

**Function**: `renderForYouPage()`

**Specific Changes**:

1. **Строка ~356** — исправить подсчёт длины истории:
   ```js
   // БЫЛО:
   const histLen = Object.keys(history).length;
   // СТАЛО:
   const histLen = Object.keys(listenHistory).length;
   ```

2. **Строка ~462** — исправить получение трека по id:
   ```js
   // БЫЛО:
   const t = history[id];
   // СТАЛО:
   const t = listenHistory[id];
   ```

---

#### Fix 2: `MainActivity.java` — управление жизненным циклом WebView

**File**: `spotify-player/android/app/src/main/java/com/violettunes/app/MainActivity.java`

**Specific Changes**:

1. **Добавить `onResume()`** — явно возобновлять WebView при возврате приложения:
   ```java
   @Override
   protected void onResume() {
       super.onResume();
       if (getBridge() != null && getBridge().getWebView() != null) {
           getBridge().getWebView().onResume();
           getBridge().getWebView().resumeTimers();
       }
   }
   ```

2. **Добавить `onPause()`** — НЕ приостанавливать WebView при уходе в фон (чтобы аудио продолжало играть):
   ```java
   @Override
   protected void onPause() {
       // Намеренно НЕ вызываем webView.onPause() — это остановит воспроизведение
       // WebView продолжает работать в фоне благодаря foreground service
       super.onPause();
   }
   ```

   > **Примечание**: Если полный пропуск `webView.onPause()` вызывает проблемы с другими функциями Capacitor, альтернатива — вызвать `getBridge().getWebView().onPause()` только если музыка не играет (проверить через JS bridge).

---

## Testing Strategy

### Validation Approach

Двухфазный подход: сначала воспроизвести баги на незафиксированном коде (exploratory), затем верифицировать исправление (fix checking) и убедиться в отсутствии регрессий (preservation checking).

---

### Exploratory Bug Condition Checking

**Goal**: Воспроизвести баги ДО исправления, подтвердить гипотезу о корневой причине.

**Test Plan**: Написать тесты, которые симулируют состояние `listenHistory` с несколькими треками и вызывают `renderForYouPage()`, проверяя результирующий DOM. Запустить на незафиксированном коде — тесты должны упасть.

**Test Cases**:
1. **ForYou с непустой историей**: Заполнить `listenHistory` 3 треками → вызвать `renderForYouPage()` → ожидать блок «Часто слушаешь» → на незафиксированном коде увидим заглушку (FAIL)
2. **Клик по треку в ForYou**: Заполнить `listenHistory` → отрендерить страницу → кликнуть `.foryou-top-track` → ожидать вызов `playTrack` → на незафиксированном коде `history[id]` = undefined (FAIL)
3. **Фоновое воспроизведение**: Запустить воспроизведение → вызвать `activity.onPause()` → проверить что `ytPlayer` не остановлен → на незафиксированном коде WebView заморожен (FAIL)

**Expected Counterexamples**:
- `renderForYouPage()` возвращает HTML с заглушкой вместо рекомендаций при непустом `listenHistory`
- `history[id]` === `undefined` при существующем треке в `listenHistory`
- Возможные причины: `window.history` не является словарём треков, `window.history.length` — это число шагов в стеке навигации

---

### Fix Checking

**Goal**: Верифицировать, что для всех входных данных, где выполняется условие бага, исправленный код производит ожидаемое поведение.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition_Messages(X) DO
  result := renderForYouPage_fixed(X)
  ASSERT result содержит блок рекомендаций (не заглушку)
  ASSERT listenHistory[id] возвращает корректный трек
END FOR

FOR ALL X WHERE isBugCondition_Background(X) DO
  result := onPause_fixed(X)
  ASSERT webView.isPlaying() = true после onPause
END FOR
```

---

### Preservation Checking

**Goal**: Верифицировать, что для всех входных данных, где условие бага НЕ выполняется, исправленный код производит идентичный результат с оригинальным.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition_Messages(X) DO
  ASSERT renderForYouPage_original(X) = renderForYouPage_fixed(X)
END FOR

FOR ALL X WHERE NOT isBugCondition_Background(X) DO
  ASSERT onPause_original(X) = onPause_fixed(X)
END FOR
```

**Testing Approach**: Property-based тестирование рекомендуется для preservation checking потому что:
- Автоматически генерирует множество состояний `listenHistory` (пустой, 1 трек, много треков)
- Покрывает граничные случаи (ровно 2 трека — граница условия `totalTracks < 2`)
- Даёт сильные гарантии неизменности поведения для всех не-багованных входных данных

**Test Cases**:
1. **Пустая история**: `listenHistory = {}` → `renderForYouPage()` → заглушка отображается (должно работать одинаково до и после фикса)
2. **1 трек в истории**: `listenHistory` с 1 записью → заглушка (граничный случай, `totalTracks < 2`)
2. **Воспроизведение при открытом приложении**: play/pause/next/prev при активном приложении → поведение идентично до и после фикса
3. **Возврат из фона**: `onResume()` → UI синхронизируется корректно

---

### Unit Tests

- Тест `renderForYouPage()` с `listenHistory` содержащим 3+ треков — ожидать рекомендации
- Тест `renderForYouPage()` с пустым `listenHistory` — ожидать заглушку
- Тест клика по `.foryou-top-track` — ожидать вызов `playTrack` с корректным треком
- Тест `MainActivity.onResume()` — ожидать вызов `webView.onResume()` и `resumeTimers()`
- Тест граничного случая: ровно 2 трека в `listenHistory` — ожидать рекомендации (не заглушку)

### Property-Based Tests

- Генерировать случайные объекты `listenHistory` с N ≥ 2 треками → `renderForYouPage()` всегда должна показывать рекомендации
- Генерировать случайные объекты `listenHistory` с N < 2 треками → всегда заглушка
- Генерировать случайные `trackId` из `listenHistory` → клик по треку всегда запускает воспроизведение

### Integration Tests

- Полный флоу: прослушать 3 трека → открыть «Для тебя» → убедиться в наличии рекомендаций
- Флоу фонового воспроизведения: запустить трек → свернуть приложение → убедиться что музыка играет → развернуть → убедиться в синхронизации UI
- Флоу управления из уведомления: свернуть приложение → нажать pause в уведомлении → убедиться что музыка остановилась
