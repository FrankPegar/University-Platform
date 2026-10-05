// Synthetic files for the browser suites; no accounts or remote data are changed.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const directory = process.env.COURSEPOINT_AVATAR_FIXTURES || '/private/tmp/coursepoint-v12-fixtures';
await mkdir(directory, { recursive: true });
for (const [format, color] of [['png', '#237ac8'], ['jpeg', '#b95c20'], ['webp', '#409348']]) {
  await sharp({ create: { width: 100, height: 100, channels: 3, background: color } }).toFormat(format).toFile(`${directory}/avatar.${format}`);
}
await writeFile(`${directory}/invalid.svg`, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
await writeFile(`${directory}/corrupt.png`, 'Not really a PNG');
await writeFile(`${directory}/oversized.png`, Buffer.alloc(2097153));
console.log('Avatar test fixtures created.');
