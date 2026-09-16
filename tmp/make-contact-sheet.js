const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

(async () => {
  const dir = path.join(process.cwd(), 'tmp', 'patch-qa');
  const files = fs.readdirSync(dir).filter((name) => /^slide-\d+\.png$/.test(name)).sort();
  const tileWidth = 480;
  const tileHeight = 270;
  const columns = 3;
  const rows = Math.ceil(files.length / columns);
  const composites = [];
  for (let index = 0; index < files.length; index += 1) {
    const input = await sharp(path.join(dir, files[index])).resize(tileWidth, tileHeight, { fit: 'fill' }).png().toBuffer();
    composites.push({ input, left: (index % columns) * tileWidth, top: Math.floor(index / columns) * tileHeight });
  }
  await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 4, background: '#0b1f31' } })
    .composite(composites)
    .png()
    .toFile(path.join(dir, 'contact-sheet.png'));
})();
