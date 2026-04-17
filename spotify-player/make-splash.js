// node make-splash.js
// Создаёт splash.xml для Android в нужных папках

const fs   = require('fs');
const path = require('path');

const androidRes = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(androidRes)) {
  console.log('❌ Папка android/ не найдена. Сначала запусти: npx cap add android');
  process.exit(1);
}

// SVG сплэш для разных размеров
function makeSplashSVG(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.18;
  const sw = size * 0.04;
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${size}dp"
    android:height="${size}dp"
    android:viewportWidth="${size}"
    android:viewportHeight="${size}">
  <path android:fillColor="#08080f"
        android:pathData="M0,0 L${size},0 L${size},${size} L0,${size} Z"/>
  <path android:fillColor="#7C3AED"
        android:pathData="M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.001},${cy - r} Z"/>
</vector>`;
}

// Создаём drawable папки
const drawableDirs = [
  'drawable',
  'drawable-land-hdpi',
  'drawable-land-mdpi',
  'drawable-land-xhdpi',
  'drawable-land-xxhdpi',
  'drawable-land-xxxhdpi',
  'drawable-port-hdpi',
  'drawable-port-mdpi',
  'drawable-port-xhdpi',
  'drawable-port-xxhdpi',
  'drawable-port-xxxhdpi',
];

drawableDirs.forEach(dir => {
  const full = path.join(androidRes, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  fs.writeFileSync(path.join(full, 'splash.xml'), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashBg"/>
    <item android:gravity="center">
        <bitmap android:src="@drawable/ic_splash_logo" android:gravity="center"/>
    </item>
</layer-list>`);
});

// Цвет фона
const valuesDir = path.join(androidRes, 'values');
if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });

const colorsFile = path.join(valuesDir, 'colors.xml');
const colorsContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splashBg">#08080f</color>
    <color name="colorPrimary">#7C3AED</color>
    <color name="colorPrimaryDark">#08080f</color>
    <color name="colorAccent">#A855F7</color>
</resources>`;
fs.writeFileSync(colorsFile, colorsContent);

// Логотип для сплэша (SVG → vector drawable)
const logoXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="200dp"
    android:height="200dp"
    android:viewportWidth="200"
    android:viewportHeight="200">
  <!-- Круг фон -->
  <path
      android:fillColor="#7C3AED"
      android:pathData="M100,10 A90,90 0 1,1 99.999,10 Z"/>
  <!-- Волны как у Spotify -->
  <path
      android:strokeColor="#FFFFFF"
      android:strokeWidth="8"
      android:strokeLineCap="round"
      android:fillColor="#00000000"
      android:pathData="M55,80 Q100,60 145,80"/>
  <path
      android:strokeColor="#FFFFFF"
      android:strokeWidth="8"
      android:strokeLineCap="round"
      android:fillColor="#00000000"
      android:pathData="M60,100 Q100,82 140,100"/>
  <path
      android:strokeColor="#FFFFFF"
      android:strokeWidth="8"
      android:strokeLineCap="round"
      android:fillColor="#00000000"
      android:pathData="M65,120 Q100,104 135,120"/>
</vector>`;

fs.writeFileSync(path.join(androidRes, 'drawable', 'ic_splash_logo.xml'), logoXml);

console.log('✓ Сплэш-экран создан!');
console.log('Теперь запусти: npx cap sync && npx cap open android');
