# 🔧 Проверка деплоя на Railway

## Твой URL: https://fazaplayer-copy-production.up.railway.app

## 📋 Чек-лист проверки:

### 1️⃣ Проверь статус деплоя
В Railway Dashboard:
- Открой свой проект
- Вкладка "Deployments"
- Должен быть статус: ✅ **Success** (зелёная галочка)

Если статус **Failed** (красный крестик):
- Открой логи деплоя
- Найди ошибку
- Скопируй и покажи мне

---

### 2️⃣ Проверь логи
В Railway Dashboard:
- Вкладка "Deployments"
- Нажми на последний деплой
- Открой "View Logs"

**Что должно быть в логах:**
```
✓ Database initialized
✓ Import scheduler started
VioletTunes backend running on port 3001
```

**Если видишь ошибки:**
- Скопируй их и покажи мне
- Я помогу исправить

---

### 3️⃣ Проверь настройки

#### Root Directory
Settings → Root Directory должно быть: `backend`

Если стоит `/` или пусто:
1. Измени на `backend`
2. Нажми "Save"
3. Railway автоматически передеплоит

#### Переменные окружения
Variables → должны быть:
- `ADMIN_KEY` = `violettunes-secret-key-2024`
- `NODE_ENV` = `production`

Если их нет:
1. Добавь через "+ New Variable"
2. Railway автоматически передеплоит

#### Команды
Settings → Deploy:
- Build Command: `npm install`
- Start Command: `node server.js`

---

### 4️⃣ Проверь Networking
Settings → Networking:
- Public Networking должно быть включено
- Domain должен быть: `fazaplayer-copy-production.up.railway.app`

Если домена нет:
1. Нажми "Generate Domain"
2. Скопируй новый URL

---

### 5️⃣ Тест подключения

После того как деплой успешен, проверь:

```bash
# Тест 1: Ping
curl https://fazaplayer-copy-production.up.railway.app/ping
```

Должен вернуть:
```json
{"status":"ok","time":"2026-04-28T..."}
```

Если возвращает 404 или ошибку:
- Проверь Root Directory (должно быть `backend`)
- Проверь логи на ошибки

```bash
# Тест 2: Список треков (пока пустой)
curl https://fazaplayer-copy-production.up.railway.app/api/tracks
```

Должен вернуть:
```json
{"tracks":[],"total":0,"page":1,"limit":20}
```

---

## 🐛 Частые проблемы:

### Проблема 1: 404 Not Found
**Причина:** Root Directory не настроен или неправильный

**Решение:**
1. Settings → Root Directory = `backend`
2. Save
3. Подожди 2-3 минуты пока передеплоится

---

### Проблема 2: Build Failed
**Причина:** Не установлены зависимости

**Решение:**
1. Проверь, что в `backend/` есть `package.json`
2. Settings → Deploy → Build Command = `npm install`
3. Redeploy

---

### Проблема 3: Application Error
**Причина:** Ошибка в коде или отсутствуют переменные

**Решение:**
1. Открой логи
2. Найди строку с ошибкой (обычно красным)
3. Скопируй и покажи мне

---

### Проблема 4: Port Already in Use
**Причина:** Railway автоматически устанавливает PORT

**Решение:**
Убедись, что в `server.js` используется:
```javascript
const PORT = process.env.PORT || 3001;
```

Это уже есть в коде, так что проблемы быть не должно.

---

## 📞 Что делать дальше?

1. **Проверь статус деплоя** в Railway Dashboard
2. **Посмотри логи** - там будет видно, что не так
3. **Скопируй ошибку** (если есть) и покажи мне
4. Я помогу исправить! 🚀

---

## ✅ Если всё работает:

Проверь автоматический импорт:

```bash
# Добавь артиста для отслеживания
curl -X POST https://fazaplayer-copy-production.up.railway.app/api/import/watch-artist \
  -H "Content-Type: application/json" \
  -H "x-admin-key: violettunes-secret-key-2024" \
  -d '{
    "artistName": "Imagine Dragons",
    "platforms": ["youtube"]
  }'
```

Должен вернуть:
```json
{"success":true,"artistId":1}
```

Затем запусти импорт вручную:
```bash
curl -X POST https://fazaplayer-copy-production.up.railway.app/api/import/run-now \
  -H "x-admin-key: violettunes-secret-key-2024"
```

Через 1-2 минуты проверь треки:
```bash
curl https://fazaplayer-copy-production.up.railway.app/api/tracks
```

Должны появиться треки! 🎵
