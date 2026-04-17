# Как собрать APK

## Шаг 1 — Установи Android Studio
https://developer.android.com/studio

## Шаг 2 — Установи зависимости
```bash
cd spotify-player
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
```

## Шаг 3 — Инициализируй Capacitor
```bash
npx cap init VioletTunes com.violettunes.app --web-dir .
```

## Шаг 4 — Добавь Android платформу
```bash
npx cap add android
npx cap copy
```

## Шаг 5 — Открой в Android Studio
```bash
npx cap open android
```

## Шаг 6 — Собери APK
В Android Studio:
- Build → Build Bundle(s) / APK(s) → Build APK(s)
- APK будет в: `android/app/build/outputs/apk/debug/app-debug.apk`

## Установка на телефон
Перекинь `app-debug.apk` на телефон → установи
(нужно разрешить установку из неизвестных источников)
