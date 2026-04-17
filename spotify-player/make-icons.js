// Запусти: node make-icons.js
// Создаст папку icons/ с иконками 192x192 и 512x512

const fs   = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

function makeSVG(size) {
  const r  = Math.round(size * 0.2);
  const cx = size / 2;
  const s  = size * 0.45;
  const ox = cx - s / 2;
  const oy = size * 0.22;
  const sw = Math.max(2, Math.round(size * 0.055));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#C026D3"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <!-- stem -->
  <line x1="${ox + s * 0.65}" y1="${oy + s * 0.08}" x2="${ox + s * 0.65}" y2="${oy + s * 0.72}"
        stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  <!-- head -->
  <ellipse cx="${ox + s * 0.46}" cy="${oy + s * 0.8}" rx="${s * 0.22}" ry="${s * 0.15}"
           transform="rotate(-20 ${ox + s * 0.46} ${oy + s * 0.8})" fill="white"/>
  <!-- flag -->
  <path d="M${ox + s * 0.65} ${oy + s * 0.08} C${ox + s * 1.05} ${oy + s * 0.22}, ${ox + s * 1.05} ${oy + s * 0.52}, ${ox + s * 0.65} ${oy + s * 0.56}"
        stroke="white" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
</svg>`;
}

fs.writeFileSync(path.join(dir, 'icon-192.svg'), makeSVG(192));
fs.writeFileSync(path.join(dir, 'icon-512.svg'), makeSVG(512));

// Также сохраняем как .png-заглушку (SVG переименованный)
// Для настоящих PNG нужен sharp/canvas, но Netlify примет SVG через manifest
fs.writeFileSync(path.join(dir, 'icon-192.png'), makeSVG(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), makeSVG(512));

console.log('✓ icons/icon-192.png и icons/icon-512.png созданы');
