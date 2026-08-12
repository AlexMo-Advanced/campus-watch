const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const srcArg = process.argv[2];
const src = srcArg || path.join(__dirname, '../assets/images/new-logo.png');
const outDir = path.join(__dirname, '../assets/images');

if (!fs.existsSync(src)) {
  console.error(`Source image not found: ${src}`);
  console.error('Save your uploaded image as assets/images/new-logo.png or pass a path: node generate-icons.js /path/to/image.png');
  process.exit(1);
}

const jobs = [
  { name: 'icon.png', size: 1024, opts: { fit: 'cover' } },
  { name: 'android-icon-foreground.png', size: 432, opts: { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } } },
  { name: 'android-icon-background.png', size: 1080, opts: { fit: 'cover' } },
  { name: 'android-icon-monochrome.png', size: 432, opts: { fit: 'contain', grayscale: true } },
  { name: 'favicon.png', size: 32, opts: { fit: 'contain' } },
  { name: 'splash-icon.png', size: 1024, opts: { fit: 'cover' } },
];

async function run() {
  for (const job of jobs) {
    const outPath = path.join(outDir, job.name);
    let pipeline = sharp(src).resize(job.size, job.size, { fit: job.opts.fit || 'cover' });

    if (job.opts.grayscale) pipeline = pipeline.grayscale();
    if (job.name === 'android-icon-foreground.png') {
      // try to preserve transparency by centering the logo on a transparent canvas
      pipeline = sharp(src)
        .resize(job.size, job.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png();
    }

    try {
      await pipeline.png().toFile(outPath);
      console.log(`Wrote ${outPath}`);
    } catch (err) {
      console.error(`Failed to write ${outPath}:`, err.message);
    }
  }
}

run();
