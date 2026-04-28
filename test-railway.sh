#!/bin/bash

# Тест Railway деплоя
URL="https://fazaplayer-copy-production.up.railway.app"

echo "🧪 Тестирование Railway деплоя..."
echo "URL: $URL"
echo ""

echo "1️⃣ Тест /ping..."
curl -s "$URL/ping" | jq . || echo "❌ Ошибка"
echo ""

echo "2️⃣ Тест /api/tracks..."
curl -s "$URL/api/tracks" | jq . || echo "❌ Ошибка"
echo ""

echo "3️⃣ Тест /search..."
curl -s "$URL/search?q=test&limit=5" | jq . || echo "❌ Ошибка"
echo ""

echo "✅ Тесты завершены!"
