// Оптимизирует растровые ассеты лендинга для tilda-assets/ (уменьшает размеры до
// разумных для веба, пережимает в JPEG). Эти файлы хранятся в GitHub-репозитории
// и отдаются в блок Tilda через CDN jsDelivr. Запуск: node scripts/build-tilda-assets.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const OUT = 'tilda-assets';
await mkdir(OUT, { recursive: true });

const jobs = [
  { src: 'src/assets/hero-background.jpg', out: 'hero-background.jpg', width: 1600 },
  { src: 'src/assets/hero-wellness-illustration.jpg', out: 'hero-portrait.jpg', width: 760 },
  { src: 'src/assets/program-day-1.jpg', out: 'program-day-1.jpg', width: 240 },
  { src: 'src/assets/program-day-2.jpg', out: 'program-day-2.jpg', width: 240 },
  { src: 'src/assets/program-day-3.jpg', out: 'program-day-3.jpg', width: 240 },
  { src: 'src/assets/bonus-test.jpg', out: 'bonus-test.jpg', width: 120 },
  { src: 'src/assets/bonus-roadmap.jpg', out: 'bonus-roadmap.jpg', width: 120 },
  { src: 'src/assets/bonus-niches.jpg', out: 'bonus-niches.jpg', width: 120 },
  { src: 'src/assets/bonus-video.jpg', out: 'bonus-video.jpg', width: 120 },
  { src: 'src/assets/speaker-marina.jpg', out: 'speaker-marina.jpg', width: 440 },
];

for (const job of jobs) {
  const info = await sharp(job.src)
    .resize({ width: job.width, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(`${OUT}/${job.out}`);
  console.log(`${OUT}/${job.out}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
}
console.log('done');
