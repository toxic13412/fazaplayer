# Настройка синхронизации (Firebase)

## 1. Создай Firebase проект
1. Зайди на https://console.firebase.google.com
2. "Add project" → дай имя (например `violettunes`) → Continue → Create

## 2. Добавь Web App
1. Project Settings (шестерёнка) → "Add app" → Web (`</>`)
2. Дай имя → Register app
3. Скопируй объект `firebaseConfig`

## 3. Вставь config в firebase.js
Открой `firebase.js` и замени блок:
```js
const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY",
  ...
};
```
на скопированный из Firebase Console.

## 4. Включи Firestore Database
1. В левом меню → Build → Firestore Database
2. "Create database" → Start in **test mode** → выбери регион → Done

## 5. Настрой Firestore Rules (важно!)
1. Firestore → Rules → вставь:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sync/{code} {
      allow read, write: if true;
    }
  }
}
```
2. Publish

## 6. Задеплой на Netlify
Перетащи папку `spotify-player` на netlify.com

## Использование
1. Открой плеер → нажми "Синхронизация" в сайдбаре
2. Нажми "Сгенерировать код" → получишь код вида `VT-ABC123`
3. Нажми "Подключить"
4. На другом устройстве введи тот же код → всё синхронизируется!
