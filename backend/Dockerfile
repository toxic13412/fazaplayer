FROM node:18-alpine

# Установка ffmpeg и yt-dlp
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip

# Установка yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем остальные файлы
COPY . .

# Создаём директории для данных
RUN mkdir -p /app/db /app/storage/tracks

EXPOSE 3001

CMD ["node", "server.js"]
