# Requirements Document

## Introduction

Улучшение Android-приложения VioletTunes (Capacitor + нативный Android) по трём направлениям:

1. **Современный UI** — адаптация веб-интерфейса под мобильный Android: нижняя навигация, touch-friendly элементы управления, полноэкранный плеер, адаптивная вёрстка.
2. **Медиа-уведомление** — постоянное уведомление в шторке с обложкой трека, кнопками «Предыдущий / Пауза-Воспроизведение / Следующий / Лайк» и прогресс-баром, управляемое через нативный `MediaPlayerService`.
3. **Фоновое воспроизведение** — музыка продолжает играть при сворачивании приложения; `MediaPlayerService` работает как Foreground Service и синхронизирует состояние с JS-слоем через Capacitor-плагин `MediaNotification`.

Проект: `spotify-player/` — Capacitor-приложение, нативный Android-код в `spotify-player/android/`, пакет `com.violettunes.app`.

---

## Glossary

- **App** — Capacitor-приложение VioletTunes, работающее в WebView на Android.
- **Player_Bar** — нижняя панель плеера в веб-интерфейсе (footer.player-bar).
- **Player_Screen** — полноэкранный вид плеера, открывающийся по тапу на Player_Bar.
- **Bottom_Nav** — нижняя навигационная панель Android-приложения (замена боковой панели на мобильных).
- **MediaPlayerService** — нативный Android Foreground Service (`com.violettunes.app.MediaPlayerService`), управляющий уведомлением.
- **MediaNotificationPlugin** — Capacitor-плагин (`com.violettunes.app.MediaNotificationPlugin`), мост между JS и MediaPlayerService.
- **MediaButtonReceiver** — BroadcastReceiver, принимающий действия из уведомления и передающий их в JS через плагин.
- **Notification** — медиа-уведомление Android в шторке уведомлений.
- **MediaSession** — Android `MediaSessionCompat`, предоставляющий метаданные системе и Bluetooth-устройствам.
- **JS_Layer** — веб-часть приложения (app.js + index.html), работающая в Capacitor WebView.
- **Track** — объект с полями `id`, `name`, `artist`, `cover`, `src`.

---

## Requirements

### Requirement 1: Адаптивный мобильный UI — нижняя навигация

**User Story:** Как пользователь Android, я хочу видеть нижнюю навигационную панель вместо боковой, чтобы управлять приложением большим пальцем одной рукой.

#### Acceptance Criteria

1. WHEN экран устройства имеет ширину менее 768px, THE App SHALL скрывать боковую панель (`.sidebar`) и отображать Bottom_Nav в нижней части экрана над Player_Bar.
2. THE Bottom_Nav SHALL содержать четыре пункта: «Главная», «Поиск», «Для тебя», «Избранное» — с иконкой и подписью для каждого.
3. WHEN пользователь нажимает на пункт Bottom_Nav, THE App SHALL переключать активную страницу и визуально выделять выбранный пункт.
4. THE Bottom_Nav SHALL оставаться видимой поверх контента при прокрутке страницы (position: fixed).
5. WHERE устройство поддерживает safe area insets (Android gesture navigation), THE App SHALL добавлять отступ снизу Bottom_Nav равный `env(safe-area-inset-bottom)`.

---

### Requirement 2: Адаптивный мобильный UI — Player Bar и Player Screen

**User Story:** Как пользователь Android, я хочу удобно управлять воспроизведением с телефона, чтобы не промахиваться по маленьким кнопкам.

#### Acceptance Criteria

1. WHEN ширина экрана менее 768px, THE Player_Bar SHALL занимать всю ширину экрана и иметь высоту не менее 72px.
2. THE Player_Bar SHALL отображать обложку трека (48×48px), название, исполнителя, кнопку «Лайк» и кнопку «Воспроизведение/Пауза» в одну строку.
3. WHEN пользователь нажимает на область Player_Bar (кроме кнопок управления), THE App SHALL открывать Player_Screen.
4. THE Player_Screen SHALL отображать: обложку трека (минимум 240×240px), название, исполнителя, прогресс-бар с временными метками, кнопки «Предыдущий / Воспроизведение-Пауза / Следующий», кнопки «Перемешать» и «Повтор», кнопку «Лайк».
5. WHEN пользователь свайпает Player_Screen вниз (swipe down), THE App SHALL закрывать Player_Screen и возвращать Player_Bar.
6. THE Player_Screen SHALL использовать цвет фона, извлечённый из обложки трека (dominant color), или фиолетовый градиент по умолчанию.

---

### Requirement 3: Адаптивный мобильный UI — touch-friendly элементы

**User Story:** Как пользователь Android, я хочу, чтобы все интерактивные элементы были достаточно большими для нажатия пальцем.

#### Acceptance Criteria

1. THE App SHALL обеспечивать минимальный размер touch-target для всех кнопок управления плеером не менее 44×44px.
2. THE App SHALL обеспечивать минимальный размер touch-target для элементов списка треков не менее 56px по высоте.
3. WHEN пользователь нажимает на трек в списке, THE App SHALL воспроизводить трек без задержки более 100ms до начала загрузки.
4. THE App SHALL поддерживать горизонтальный свайп на элементе трека для добавления в «Избранное» (свайп вправо) или удаления из плейлиста (свайп влево, если трек в плейлисте).
5. IF пользователь выполняет свайп менее чем на 40px, THEN THE App SHALL отменять действие свайпа и возвращать элемент на место.

---

### Requirement 4: Медиа-уведомление — отображение

**User Story:** Как пользователь Android, я хочу видеть информацию о текущем треке в шторке уведомлений, чтобы знать, что играет, не открывая приложение.

#### Acceptance Criteria

1. WHEN JS_Layer вызывает `MediaNotificationPlugin.updateNotification({title, artist, cover, playing, liked})`, THE MediaPlayerService SHALL запустить Foreground Service и показать Notification в течение 500ms.
2. THE Notification SHALL отображать: обложку трека (LargeIcon), название трека (ContentTitle), имя исполнителя (ContentText).
3. WHEN `cover` содержит валидный URL изображения, THE MediaPlayerService SHALL загружать обложку асинхронно и обновлять Notification после загрузки.
4. IF загрузка обложки завершается ошибкой, THEN THE MediaPlayerService SHALL показывать Notification с иконкой приложения вместо обложки.
5. THE Notification SHALL иметь `VISIBILITY_PUBLIC`, чтобы отображаться на заблокированном экране.
6. WHEN пользователь нажимает на Notification (не на кнопки), THE MediaPlayerService SHALL открывать MainActivity приложения.

---

### Requirement 5: Медиа-уведомление — кнопки управления

**User Story:** Как пользователь Android, я хочу управлять воспроизведением прямо из шторки уведомлений, не открывая приложение.

#### Acceptance Criteria

1. THE Notification SHALL содержать четыре кнопки действий: «Предыдущий трек», «Воспроизведение/Пауза», «Следующий трек», «Лайк».
2. WHEN `playing` равно `true`, THE Notification SHALL отображать кнопку «Пауза»; WHEN `playing` равно `false`, THE Notification SHALL отображать кнопку «Воспроизведение».
3. WHEN `liked` равно `true`, THE Notification SHALL отображать кнопку «Лайк» с активной (закрашенной) иконкой; WHEN `liked` равно `false` — с неактивной.
4. WHEN пользователь нажимает кнопку в Notification, THE MediaButtonReceiver SHALL отправлять соответствующее действие в JS_Layer через `MediaNotificationPlugin.notifyListeners("mediaAction", {action})` в течение 200ms.
5. THE Notification SHALL использовать `MediaStyle` с `setShowActionsInCompactView(0, 1, 2)` для отображения «Предыдущий / Воспроизведение-Пауза / Следующий» в компактном виде.
6. WHEN JS_Layer получает событие `mediaAction` с `action: "play"` или `"pause"`, THE JS_Layer SHALL вызывать соответствующий метод YouTube IFrame Player API.
7. WHEN JS_Layer получает событие `mediaAction` с `action: "next"` или `"prev"`, THE JS_Layer SHALL переключать трек и вызывать `updateNotification` с новыми данными.
8. WHEN JS_Layer получает событие `mediaAction` с `action: "like"`, THE JS_Layer SHALL переключать состояние лайка текущего трека и вызывать `updateNotification` с обновлённым `liked`.

---

### Requirement 6: Медиа-уведомление — MediaSession

**User Story:** Как пользователь Android, я хочу управлять воспроизведением с Bluetooth-наушников и экрана блокировки, чтобы не доставать телефон.

#### Acceptance Criteria

1. THE MediaPlayerService SHALL создавать и поддерживать активный `MediaSessionCompat` на протяжении всего времени работы Foreground Service.
2. WHEN вызывается `updateNotification`, THE MediaPlayerService SHALL обновлять `MediaMetadataCompat` с полями `METADATA_KEY_TITLE`, `METADATA_KEY_ARTIST` и `METADATA_KEY_ART` (если обложка загружена).
3. WHEN `playing` равно `true`, THE MediaPlayerService SHALL устанавливать `PlaybackStateCompat.STATE_PLAYING`; WHEN `playing` равно `false` — `STATE_PAUSED`.
4. THE MediaSession SHALL поддерживать действия: `ACTION_PLAY`, `ACTION_PAUSE`, `ACTION_SKIP_TO_NEXT`, `ACTION_SKIP_TO_PREVIOUS`.
5. WHEN пользователь нажимает кнопку на Bluetooth-устройстве или гарнитуре, THE MediaSession SHALL передавать действие в MediaButtonReceiver, который уведомляет JS_Layer.

---

### Requirement 7: Фоновое воспроизведение

**User Story:** Как пользователь Android, я хочу, чтобы музыка продолжала играть, когда я сворачиваю приложение или блокирую экран.

#### Acceptance Criteria

1. WHILE MediaPlayerService запущен как Foreground Service, THE App SHALL продолжать воспроизведение YouTube IFrame Player в WebView при сворачивании приложения.
2. WHEN пользователь нажимает кнопку «Home» или «Recents» на Android, THE MediaPlayerService SHALL оставаться активным и Notification SHALL оставаться видимым в шторке.
3. WHEN пользователь блокирует экран устройства, THE App SHALL продолжать воспроизведение без прерывания.
4. WHEN пользователь возвращается в приложение из фона, THE JS_Layer SHALL синхронизировать состояние UI (кнопка play/pause, прогресс-бар) с текущим состоянием воспроизведения.
5. IF пользователь смахивает приложение из списка недавних (task killer), THEN THE MediaPlayerService SHALL останавливать воспроизведение, убирать Notification и вызывать `stopSelf()`.
6. THE MediaPlayerService SHALL запрашивать `WAKE_LOCK` для предотвращения засыпания процессора во время воспроизведения.
7. WHEN JS_Layer вызывает `MediaNotificationPlugin.stopNotification()`, THE MediaPlayerService SHALL вызывать `stopForeground(true)` и `stopSelf()`.

---

### Requirement 8: Синхронизация состояния JS ↔ Native

**User Story:** Как разработчик, я хочу, чтобы JS-слой и нативный Android-код всегда имели согласованное состояние плеера, чтобы кнопки в уведомлении и в приложении работали корректно.

#### Acceptance Criteria

1. WHEN состояние воспроизведения изменяется в JS_Layer (play/pause/next/prev/like), THE JS_Layer SHALL вызывать `MediaNotificationPlugin.updateNotification()` с актуальными данными в течение 300ms.
2. WHEN MediaButtonReceiver получает действие из Notification, THE MediaNotificationPlugin SHALL доставлять событие `mediaAction` в JS_Layer через Capacitor event listener.
3. THE JS_Layer SHALL регистрировать listener на событие `mediaAction` при инициализации приложения и обрабатывать все возможные значения `action`: `"play"`, `"pause"`, `"next"`, `"prev"`, `"like"`, `"stop"`.
4. IF Capacitor Bridge недоступен (веб-браузер, не Android), THEN THE JS_Layer SHALL использовать Web Media Session API (`navigator.mediaSession`) как fallback без ошибок.
5. THE JS_Layer SHALL вызывать `updateNotification` при каждом изменении трека, состояния воспроизведения или состояния лайка.

---

### Requirement 9: Производительность и надёжность

**User Story:** Как пользователь Android, я хочу, чтобы приложение работало плавно и не разряжало батарею быстрее обычного.

#### Acceptance Criteria

1. THE MediaPlayerService SHALL загружать обложку трека в фоновом потоке (не в Main Thread) с использованием `AsyncTask` или `ExecutorService`.
2. THE Notification SHALL обновляться не чаще одного раза в 500ms при изменении позиции воспроизведения, чтобы не перегружать систему.
3. WHEN MediaPlayerService получает повторный `UPDATE` intent с теми же данными трека, THE MediaPlayerService SHALL пропускать повторную загрузку обложки, если она уже загружена.
4. THE MediaPlayerService SHALL освобождать `MediaSessionCompat` в методе `onDestroy()` для предотвращения утечек памяти.
5. IF загрузка обложки занимает более 5 секунд, THEN THE MediaPlayerService SHALL отменять загрузку и показывать Notification без обложки.
