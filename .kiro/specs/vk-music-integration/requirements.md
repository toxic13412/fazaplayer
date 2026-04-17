# Requirements Document

## Introduction

Интеграция ВКонтакте (VK) как третьего источника музыки в приложение VioletTunes (Capacitor + Android).
Пользователь сможет авторизоваться через VK OAuth, искать треки через VK Audio API и воспроизводить их
через существующий плеер рядом с YouTube и SoundCloud. Источник VK отображается в боковой панели,
строке поиска и плеере наравне с уже существующими источниками.

---

## Glossary

- **VK_Auth_Module** — модуль, отвечающий за OAuth-авторизацию через ВКонтакте и хранение токена.
- **VK_API_Client** — модуль, выполняющий запросы к VK API (audio.search, audio.get и др.).
- **VK_Player_Adapter** — адаптер, интегрирующий VK-треки в существующий плеер VioletTunes.
- **VK_Token** — access_token, полученный после успешной OAuth-авторизации ВКонтакте.
- **VK_Track** — объект трека из VK Audio API: `{ id, owner_id, title, artist, url, duration, thumb }`.
- **Source_Selector** — UI-элемент в боковой панели и строке поиска для выбора источника музыки.
- **Player_Bar** — нижняя панель плеера VioletTunes с кнопками управления и прогресс-баром.
- **Audio_Element** — нативный HTML5 `<audio>` элемент, используемый для воспроизведения MP3.
- **VK_App_ID** — идентификатор приложения ВКонтакте, настраиваемый пользователем в настройках.

---

## Requirements

### Requirement 1: Авторизация через ВКонтакте

**User Story:** Как пользователь, я хочу войти в свой аккаунт ВКонтакте, чтобы получить доступ к музыке VK.

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку «Войти через VK», THE VK_Auth_Module SHALL открыть OAuth-страницу ВКонтакте в системном браузере или WebView с параметрами `scope=audio` и `response_type=token`.
2. WHEN OAuth-авторизация завершается успешно, THE VK_Auth_Module SHALL извлечь VK_Token из redirect URI и сохранить его в `localStorage` под ключом `vt_vk_token`.
3. WHEN VK_Token сохранён, THE VK_Auth_Module SHALL отобразить имя и аватар авторизованного пользователя в блоке настроек VK.
4. IF OAuth-авторизация завершается с ошибкой или пользователь отменяет её, THEN THE VK_Auth_Module SHALL отобразить сообщение об ошибке и оставить пользователя неавторизованным.
5. WHEN пользователь нажимает кнопку «Выйти из VK», THE VK_Auth_Module SHALL удалить VK_Token из `localStorage` и сбросить отображаемые данные пользователя.
6. WHILE VK_Token отсутствует или истёк, THE VK_Auth_Module SHALL отображать кнопку «Войти через VK» вместо элементов управления VK-источником.

---

### Requirement 2: Поиск музыки через VK Audio API

**User Story:** Как пользователь, я хочу искать треки ВКонтакте по названию или исполнителю, чтобы находить нужную музыку.

#### Acceptance Criteria

1. WHEN пользователь выбирает источник «VK» и вводит поисковый запрос, THE VK_API_Client SHALL выполнить запрос к методу `audio.search` с параметрами `q`, `count=50` и актуальным VK_Token.
2. WHEN запрос `audio.search` возвращает результаты, THE VK_API_Client SHALL преобразовать каждый элемент ответа в объект VK_Track и передать список в Source_Selector для отображения.
3. WHEN список VK_Track отображается, THE Source_Selector SHALL показать для каждого трека: обложку альбома (или заглушку), название, исполнителя и длительность в формате `M:SS`.
4. IF запрос `audio.search` возвращает ошибку с кодом `5` (невалидный токен), THEN THE VK_API_Client SHALL инициировать повторную авторизацию через VK_Auth_Module.
5. IF запрос `audio.search` возвращает сетевую ошибку, THEN THE VK_API_Client SHALL отобразить сообщение «Ошибка соединения с VK» и предложить повторить запрос.
6. WHEN пользователь прокручивает список результатов до конца, THE VK_API_Client SHALL выполнить следующий запрос `audio.search` со смещением `offset = текущее_количество_треков` и добавить результаты к существующему списку.
7. WHILE VK_Token отсутствует, THE Source_Selector SHALL отображать предложение авторизоваться вместо поля поиска VK.

---

### Requirement 3: Воспроизведение треков VK

**User Story:** Как пользователь, я хочу воспроизводить треки из ВКонтакте через встроенный плеер, чтобы слушать музыку без переключения приложений.

#### Acceptance Criteria

1. WHEN пользователь нажимает на VK_Track в списке, THE VK_Player_Adapter SHALL передать прямую MP3-ссылку (`url`) из объекта VK_Track в Audio_Element и вызвать `audio.play()`.
2. WHEN Audio_Element начинает воспроизведение, THE Player_Bar SHALL обновить обложку, название и исполнителя текущего трека, а также отобразить бейдж «VK» фирменного синего цвета (`#0077FF`).
3. WHILE трек VK воспроизводится, THE Player_Bar SHALL обновлять прогресс-бар и таймер каждые 500 мс на основе `audio.currentTime` и `audio.duration`.
4. WHEN воспроизведение трека VK завершается, THE VK_Player_Adapter SHALL вызвать функцию `playNext()` для перехода к следующему треку в текущем списке.
5. IF MP3-ссылка трека VK недоступна или возвращает HTTP-ошибку, THEN THE VK_Player_Adapter SHALL пропустить трек, отобразить тост «Трек недоступен» и вызвать `playNext()`.
6. WHEN пользователь нажимает «Пауза» или «Воспроизвести» в Player_Bar, THE VK_Player_Adapter SHALL вызвать соответственно `audio.pause()` или `audio.play()` на Audio_Element.
7. WHEN пользователь перетаскивает ползунок прогресс-бара, THE VK_Player_Adapter SHALL установить `audio.currentTime` в соответствующее значение.
8. WHEN пользователь изменяет громкость через слайдер, THE VK_Player_Adapter SHALL установить `audio.volume` в значение от `0.0` до `1.0`, соответствующее позиции слайдера.

---

### Requirement 4: Интеграция VK в Source_Selector и навигацию

**User Story:** Как пользователь, я хочу видеть VK как равноправный источник рядом с YouTube и SoundCloud, чтобы легко переключаться между ними.

#### Acceptance Criteria

1. THE Source_Selector SHALL отображать кнопку «VK» в боковой панели рядом с кнопками «YouTube» и «SoundCloud».
2. WHEN пользователь нажимает кнопку «VK» в Source_Selector, THE Source_Selector SHALL переключить активный источник на VK, выделить кнопку «VK» фирменным синим цветом и скрыть результаты других источников.
3. WHEN активный источник переключается с VK на другой, THE VK_Player_Adapter SHALL приостановить воспроизведение Audio_Element, если трек VK воспроизводится в данный момент.
4. THE Source_Selector SHALL отображать переключатель «VK» в строке поиска рядом с «YouTube» и «SoundCloud».
5. WHEN пользователь переключается на источник VK в строке поиска, THE Source_Selector SHALL показать поле поиска VK и скрыть результаты YouTube и SoundCloud.
6. WHERE пользователь авторизован в VK, THE Source_Selector SHALL отображать аватар пользователя VK рядом с кнопкой источника в боковой панели.

---

### Requirement 5: Сохранение треков VK в избранное и плейлисты

**User Story:** Как пользователь, я хочу добавлять треки VK в избранное и плейлисты, чтобы сохранять понравившуюся музыку.

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку «Лайк» на треке VK, THE Player_Bar SHALL сохранить объект VK_Track в `localStorage` под ключом `vt_liked` и выделить кнопку лайка.
2. WHEN пользователь открывает страницу «Избранное», THE Player_Bar SHALL отображать треки VK вместе с треками YouTube с бейджем «VK» для визуального различия.
3. WHEN пользователь добавляет трек VK в плейлист, THE VK_Player_Adapter SHALL сохранить объект VK_Track в массиве треков соответствующего плейлиста в `localStorage`.
4. WHEN пользователь воспроизводит трек VK из плейлиста или избранного, THE VK_Player_Adapter SHALL использовать сохранённую MP3-ссылку из объекта VK_Track.
5. IF сохранённая MP3-ссылка трека VK истекла (VK-ссылки имеют TTL), THEN THE VK_API_Client SHALL выполнить повторный запрос `audio.getById` для получения актуальной ссылки перед воспроизведением.

---

### Requirement 6: Настройка VK App ID

**User Story:** Как пользователь, я хочу указать свой VK App ID, чтобы использовать собственное приложение ВКонтакте для авторизации.

#### Acceptance Criteria

1. THE VK_Auth_Module SHALL отображать поле ввода VK App ID в блоке настроек рядом с полем YouTube API Key.
2. WHEN пользователь вводит VK App ID и нажимает «Сохранить», THE VK_Auth_Module SHALL сохранить значение в `localStorage` под ключом `vt_vk_app_id`.
3. WHEN VK_Auth_Module инициирует OAuth-авторизацию, THE VK_Auth_Module SHALL использовать сохранённый VK App ID в параметре `client_id` OAuth-запроса.
4. IF поле VK App ID пустое при попытке авторизации, THEN THE VK_Auth_Module SHALL отобразить подсказку «Введите VK App ID» и заблокировать открытие OAuth-страницы.

---

### Requirement 7: История прослушивания и рекомендации для VK-треков

**User Story:** Как пользователь, я хочу, чтобы треки VK учитывались в истории прослушивания и рекомендациях, чтобы страница «Для тебя» отражала все мои вкусы.

#### Acceptance Criteria

1. WHEN трек VK воспроизводится более 5 секунд, THE VK_Player_Adapter SHALL вызвать функцию `recordPlay(track)` с объектом VK_Track, приведённым к общему формату `{ id, name, artist, cover, src: 'vk' }`.
2. WHEN воспроизведение трека VK прерывается или завершается, THE VK_Player_Adapter SHALL вызвать функцию `recordListenTime(trackId, seconds)` с количеством прослушанных секунд.
3. WHEN страница «Для тебя» строит рекомендации, THE Player_Bar SHALL включать треки VK из истории прослушивания в расчёт топ-артистов и ключевых слов наравне с треками YouTube.
4. WHEN в истории прослушивания есть треки VK, THE Player_Bar SHALL отображать их в секции «Часто слушаешь» с бейджем «VK».
