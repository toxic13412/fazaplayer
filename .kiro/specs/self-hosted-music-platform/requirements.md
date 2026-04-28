# Requirements Document

## Introduction

Self-Hosted Music Platform — расширение VioletTunes, которое добавляет собственное хранилище музыки на бэкенде (независимо от YouTube/VK), систему рекомендаций на основе истории прослушивания и возможность скачивания треков в MP3. Фича решает проблему недоступности YouTube в РФ и зависимости от сторонних платформ.

## Glossary

- **Music_Server**: Node.js бэкенд VioletTunes (`backend/server.js`), расширенный для хранения и раздачи собственных треков
- **Track**: Аудиофайл с метаданными (название, исполнитель, обложка, длительность, жанр)
- **Track_Catalog**: Коллекция треков, хранящихся на Music_Server
- **Recommendation_Engine**: Серверный модуль, вычисляющий персональные рекомендации на основе истории прослушивания
- **Listen_History**: Серверная запись событий прослушивания пользователя (trackId, userId, timestamp, duration)
- **Download_Manager**: Клиентский модуль в Android-приложении, отвечающий за скачивание MP3
- **User**: Пользователь Android-приложения VioletTunes
- **Admin**: Владелец сервера, загружающий треки в Track_Catalog
- **Score**: Числовое значение релевантности трека для конкретного пользователя, вычисляемое Recommendation_Engine
- **Self-Hosted_Track**: Трек, хранящийся на Music_Server (в отличие от YouTube-трека)
- **Watched_Artists**: Персистентный список исполнителей, за новыми релизами которых следит Music_Server на внешних платформах
- **Import_Scheduler**: Серверный модуль, периодически опрашивающий внешние платформы на предмет новых треков от Watched_Artists
- **Import_Converter**: Серверный модуль, конвертирующий скачанные аудиопотоки в формат MP3
- **Lyrics**: Текст песни — текстовое содержимое трека (слова), хранящееся как поле метаданных Track на Music_Server
- **FTS**: Full-Text Search (полнотекстовый поиск) — механизм поиска по содержимому текстовых полей, реализованный через SQLite FTS5 виртуальную таблицу
- **Playlist**: Именованная коллекция треков, принадлежащая пользователю на внешней платформе (VK, Spotify, Яндекс.Музыка) или созданная внутри VioletTunes
- **Playlist_Import**: Процесс переноса треков из плейлиста внешней платформы в Track_Catalog Music_Server
- **OAuth_Session**: Серверная запись, хранящая OAuth-токен доступа пользователя к внешней платформе, привязанная к sessionId пользователя

---

## Requirements

### Requirement 1: Хранение треков на собственном сервере

**User Story:** As a User, I want to listen to music stored on VioletTunes servers, so that playback works regardless of YouTube availability in my region.

#### Acceptance Criteria

1. THE Music_Server SHALL store audio files in MP3 or AAC format with a maximum size of 50 MB per file.
2. THE Music_Server SHALL store metadata for each Track: title, artist, album, genre, duration in seconds, cover image URL, and upload timestamp.
3. WHEN a User requests the Track_Catalog, THE Music_Server SHALL return a paginated list of tracks with page size of 20 items per request.
4. WHEN a User requests a specific Track by its ID, THE Music_Server SHALL return the audio stream within 3 seconds under normal network conditions.
5. IF a requested Track ID does not exist in the Track_Catalog, THEN THE Music_Server SHALL return HTTP 404 with a JSON error body containing a human-readable message.
6. THE Music_Server SHALL serve audio files via HTTP range requests to support seeking within a track.
7. WHEN an Admin uploads a new Track, THE Music_Server SHALL validate that the file is a valid audio format (MP3 or AAC) before storing it.
8. IF an uploaded file exceeds 50 MB, THEN THE Music_Server SHALL reject the upload and return HTTP 413 with a descriptive error message.

---

### Requirement 2: Поиск по собственному каталогу

**User Story:** As a User, I want to search for tracks in the self-hosted catalog, so that I can find music without relying on external search engines.

#### Acceptance Criteria

1. WHEN a User submits a search query of at least 2 characters, THE Music_Server SHALL return matching tracks within 1 second.
2. THE Music_Server SHALL match search queries against track title, artist name, and album name fields (case-insensitive).
3. THE Music_Server SHALL match search queries against the Lyrics field of each Track using FTS (case-insensitive full-text search).
4. WHEN a search query returns no results, THE Music_Server SHALL return an empty tracks array with HTTP 200 and a `total: 0` field.
5. THE Music_Server SHALL support search queries of up to 200 characters in length.
6. IF a search query is shorter than 2 characters, THEN THE Music_Server SHALL return HTTP 400 with an error message indicating the minimum query length.

---

### Requirement 3: Интеграция в Android-приложение

**User Story:** As a User, I want self-hosted tracks to appear alongside other sources in the VioletTunes app, so that I have a unified listening experience.

#### Acceptance Criteria

1. THE VioletTunes_App SHALL display Self-Hosted_Tracks in the home feed alongside trending content.
2. WHEN a Self-Hosted_Track is selected for playback, THE VioletTunes_App SHALL stream it from Music_Server using the existing audio player without requiring a page reload.
3. THE VioletTunes_App SHALL display a visual badge (e.g. "VT") on Self-Hosted_Tracks to distinguish them from YouTube tracks.
4. WHEN a Self-Hosted_Track is playing, THE VioletTunes_App SHALL update the media notification (title, artist, cover) using the existing MediaNotificationPlugin.
5. THE VioletTunes_App SHALL support like, add-to-playlist, and download actions for Self-Hosted_Tracks using the same UI controls as YouTube tracks.
6. IF the Music_Server is unreachable, THEN THE VioletTunes_App SHALL display an error toast and fall back to showing only YouTube content.

---

### Requirement 4: Серверная система рекомендаций

**User Story:** As a User, I want the app to recommend tracks based on my listening history, so that I discover music that matches my taste.

#### Acceptance Criteria

1. WHEN a User plays a track for more than 30 seconds, THE VioletTunes_App SHALL send a listen event to THE Music_Server containing trackId, listenDurationSeconds, and a sessionId.
2. THE Music_Server SHALL persist listen events in a Listen_History store indexed by sessionId and trackId.
3. WHEN a User requests recommendations, THE Recommendation_Engine SHALL compute a Score for each Track based on: play count (weight 2.0), total listen time in minutes (weight 1.0), and recency decay (half-life of 7 days).
4. WHEN a User requests recommendations, THE Recommendation_Engine SHALL return up to 20 tracks sorted by Score in descending order, excluding tracks the User has already played in the current session.
5. THE Recommendation_Engine SHALL group recommendations into at least 2 named sections (e.g. "Похожие исполнители", "Твой микс") based on the dominant genre or artist in the User's Listen_History.
6. IF a User has fewer than 3 listen events, THEN THE Recommendation_Engine SHALL return the top 20 tracks from the Track_Catalog sorted by global play count as a fallback.
7. THE Music_Server SHALL recompute recommendations for a given sessionId within 500 ms of receiving a new listen event.
8. THE VioletTunes_App SHALL refresh the "For You" page recommendations after each completed track playback.

---

### Requirement 5: Скачивание треков в MP3

**User Story:** As a User, I want to download a track as an MP3 file to my device, so that I can listen offline without an internet connection.

#### Acceptance Criteria

1. WHEN a User taps the download button on a Self-Hosted_Track, THE Download_Manager SHALL initiate an HTTP download of the MP3 file from Music_Server.
2. THE Download_Manager SHALL display a progress indicator showing download percentage from 0% to 100% during the download.
3. WHEN a download completes successfully, THE Download_Manager SHALL save the file to the device's public Music directory with the filename format `{artist} - {title}.mp3`.
4. WHEN a download completes successfully, THE VioletTunes_App SHALL display a toast notification: "Трек сохранён: {title}".
5. IF a download fails due to a network error, THEN THE Download_Manager SHALL display an error toast and retain the partially downloaded file for retry.
6. IF a User attempts to download a track that is already saved on the device, THEN THE Download_Manager SHALL display a confirmation dialog before overwriting the existing file.
7. THE Music_Server SHALL expose a `/download/:trackId` endpoint that returns the MP3 file with `Content-Disposition: attachment` header and the correct `Content-Type: audio/mpeg` header.
8. THE Download_Manager SHALL support concurrent downloads of up to 3 tracks simultaneously.

---

### Requirement 6: Загрузка треков администратором

**User Story:** As an Admin, I want to upload audio files to the server catalog, so that users can access self-hosted music.

#### Acceptance Criteria

1. THE Music_Server SHALL expose a `POST /admin/tracks` endpoint protected by a static API key passed in the `X-Admin-Key` request header.
2. IF a request to `POST /admin/tracks` is made without a valid `X-Admin-Key` header, THEN THE Music_Server SHALL return HTTP 401.
3. WHEN an Admin uploads a Track with valid metadata and a valid audio file, THE Music_Server SHALL store the file and return HTTP 201 with the new Track's ID and metadata.
4. THE Music_Server SHALL accept multipart/form-data uploads containing: `file` (audio), `title` (string, max 200 chars), `artist` (string, max 100 chars), `album` (string, max 100 chars, optional), `genre` (string, max 50 chars, optional), `cover` (image file, max 2 MB, optional).
5. IF the `title` or `artist` field is missing from the upload, THEN THE Music_Server SHALL return HTTP 400 with a descriptive validation error.
6. THE Music_Server SHALL generate a unique UUID for each uploaded Track and use it as the Track's permanent ID.

---

### Requirement 7: Парсинг и сериализация метаданных треков

**User Story:** As a Developer, I want track metadata to be reliably serialized and deserialized, so that data integrity is maintained across API calls and storage.

#### Acceptance Criteria

1. THE Music_Server SHALL serialize Track metadata to JSON using a defined schema: `{ id, title, artist, album, genre, durationSeconds, coverUrl, uploadedAt }`.
2. WHEN Track metadata is deserialized from storage, THE Music_Server SHALL validate that all required fields (`id`, `title`, `artist`, `durationSeconds`) are present and of the correct type.
3. IF deserialized metadata is missing a required field, THEN THE Music_Server SHALL log an error and exclude that Track from API responses.
4. FOR ALL valid Track metadata objects, serializing then deserializing SHALL produce an object equal to the original (round-trip property).
5. THE Music_Server SHALL reject Track metadata where `durationSeconds` is not a positive integer.

---

### Requirement 9: Текст песни (Lyrics)

**User Story:** As a User, I want to see the lyrics of a playing track in the app, so that I can follow along with the song.

#### Acceptance Criteria

1. THE Music_Server SHALL store a Lyrics field (plain text, optional) as part of Track metadata.
2. WHEN an Admin uploads a Track, THE Music_Server SHALL accept an optional `lyrics` field (plain text, max 50 000 characters) in the multipart/form-data request body.
3. THE Music_Server SHALL expose a `GET /api/tracks/:id/lyrics` endpoint that returns the Lyrics for the specified Track as `{ id, lyrics: string | null }`.
4. IF the requested Track does not exist, THEN THE Music_Server SHALL return HTTP 404 for `GET /api/tracks/:id/lyrics`.
5. IF a Track has no Lyrics stored, THEN THE Music_Server SHALL return `{ id, lyrics: null }` with HTTP 200.
6. WHEN a User is playing a Self-Hosted_Track, THE VioletTunes_App SHALL display a "Текст" button in the player UI.
7. WHEN a User taps the "Текст" button, THE VioletTunes_App SHALL show a scrollable lyrics block below the player controls containing the Track's Lyrics text.
8. WHEN the "Текст" button is tapped again, THE VioletTunes_App SHALL hide the lyrics block.
9. IF a Track has no Lyrics (`lyrics: null`), THEN THE VioletTunes_App SHALL display the "Текст" button in a disabled state.
10. WHEN a User switches to a different track, THE VioletTunes_App SHALL hide the lyrics block and reset the "Текст" button to its default state.

**User Story:** As an Admin, I want the server to automatically download new tracks from external platforms when a tracked artist releases them, so that the Track_Catalog stays up to date without manual uploads.

#### Acceptance Criteria

1. THE Music_Server SHALL maintain a Watched_Artists list — a persistent collection of artist identifiers mapped to one or more external platforms (YouTube, VK, Spotify, SoundCloud, Яндекс.Музыка).
2. WHEN an Admin sends a `POST /admin/watched-artists` request with a valid `X-Admin-Key` header, artist name, and at least one platform identifier, THE Music_Server SHALL add the artist to the Watched_Artists list and return HTTP 201.
3. WHEN an Admin sends a `DELETE /admin/watched-artists/:artistId` request with a valid `X-Admin-Key` header, THE Music_Server SHALL remove the artist from the Watched_Artists list and return HTTP 200.
4. IF a request to `POST /admin/watched-artists` or `DELETE /admin/watched-artists/:artistId` is made without a valid `X-Admin-Key` header, THEN THE Music_Server SHALL return HTTP 401.
5. THE Import_Scheduler SHALL poll each external platform for new releases from Watched_Artists at a configurable interval of no less than 15 minutes.
6. WHEN the Import_Scheduler detects a new track from a Watched_Artist on an external platform, THE Import_Scheduler SHALL initiate a download of that track's audio stream.
7. WHEN a downloaded audio stream is not in MP3 format, THE Import_Converter SHALL convert it to MP3 at 192 kbps before storing it in the Track_Catalog.
8. WHEN a track is successfully downloaded and converted, THE Music_Server SHALL store it in the Track_Catalog with metadata fields: title, artist, source platform, source URL, and importedAt timestamp.
9. BEFORE downloading a track, THE Import_Scheduler SHALL check the Track_Catalog for an existing entry with the same artist name and title (case-insensitive). IF a matching entry exists, THEN THE Import_Scheduler SHALL skip the download and log a deduplication event.
10. IF a track download fails because the track is unavailable on the source platform, THEN THE Import_Scheduler SHALL log the failure with the track identifier and platform name, and continue processing remaining tracks without retrying that track in the same polling cycle.
11. IF a platform is unreachable during a polling cycle, THEN THE Import_Scheduler SHALL log the platform name and error, skip that platform for the current cycle, and retry in the next scheduled cycle.
12. WHEN an import cycle completes, THE Music_Server SHALL record a summary log entry containing: cycle start time, number of tracks checked, number of tracks downloaded, number of tracks skipped (deduplication), and number of errors per platform.

---

### Requirement 10: Импорт плейлистов пользователем

**User Story:** As a User, I want to import playlists from VK, Spotify, or Яндекс.Музыка into VioletTunes, so that I can access my existing music library on the self-hosted platform.

#### Acceptance Criteria

1. WHEN a User submits a valid public playlist URL from VK, Spotify, or Яндекс.Музыка, THE Music_Server SHALL initiate a Playlist_Import job and return a jobId with HTTP 202.
2. THE Music_Server SHALL extract all track metadata and audio streams from the submitted playlist URL and store each track in the Track_Catalog.
3. WHEN a User initiates OAuth authorization for a platform (VK, Spotify, or Яндекс.Музыка), THE Music_Server SHALL redirect the User to the platform's OAuth authorization page.
4. WHEN the OAuth authorization completes successfully, THE Music_Server SHALL store the OAuth_Session (access token, refresh token, expiry) associated with the User's sessionId and return HTTP 200.
5. WHEN a User with a valid OAuth_Session requests their playlists from a platform, THE Music_Server SHALL return a list of the User's saved playlists from that platform containing: playlist name, track count, and platform playlist ID.
6. WHEN a User selects a playlist and initiates import via OAuth, THE Music_Server SHALL create a Playlist_Import job for that playlist and return a jobId with HTTP 202.
7. WHEN a Playlist_Import job is running, THE Music_Server SHALL track progress as `{ jobId, status, totalTracks, downloadedTracks, failedTracks }` and make it available via `GET /api/import/jobs/:jobId`.
8. BEFORE adding a track from a Playlist_Import job to the Track_Catalog, THE Music_Server SHALL check for an existing entry with the same artist name and title (case-insensitive). IF a matching entry exists, THEN THE Music_Server SHALL skip that track and increment the job's skipped count.
9. IF a track within a Playlist_Import job is unavailable on the source platform, THEN THE Music_Server SHALL log the failure, increment the job's `failedTracks` count, and continue importing the remaining tracks.
10. IF the OAuth_Session token has expired during a Playlist_Import job, THEN THE Music_Server SHALL attempt to refresh the token using the stored refresh token. IF the refresh fails, THEN THE Music_Server SHALL pause the job and return an error status of `"auth_expired"` in the job status response.
11. WHEN a User sends a `DELETE /api/import/oauth/:platform/session` request, THE Music_Server SHALL revoke the stored OAuth_Session for that platform and sessionId, and return HTTP 200.
12. AFTER a User's OAuth_Session is revoked, THE Music_Server SHALL reject any subsequent requests to `GET /api/import/oauth/:platform/playlists` for that sessionId with HTTP 401.
13. THE VioletTunes_App SHALL display an "Импорт плейлиста" screen containing: a URL input field, and OAuth authorization buttons for VK, Spotify, and Яндекс.Музыка.
14. WHEN a Playlist_Import job is in progress, THE VioletTunes_App SHALL display a progress indicator showing `downloadedTracks` out of `totalTracks` tracks imported.
15. WHEN a Playlist_Import job completes, THE VioletTunes_App SHALL display a summary toast: "Импортировано: {downloadedTracks} треков, пропущено: {skippedTracks}".
16. THE Music_Server SHALL support playlist URL import for the following URL formats: VK (`vk.com/music/playlist/...`), Spotify (`open.spotify.com/playlist/...`), Яндекс.Музыка (`music.yandex.ru/users/.../playlists/...`).
