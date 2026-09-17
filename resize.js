const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const iconPath = path.join(__dirname, 'assets', 'images', 'icon.png');
  const publicDir = path.join(__dirname, 'public');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
  }

  await sharp(iconPath).resize(192, 192).toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(iconPath).resize(512, 512).toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(iconPath).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));

  console.log('Icons generated successfully.');
}

generateIcons().catch(console.error);
