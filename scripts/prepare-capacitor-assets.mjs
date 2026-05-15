import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
const iconSrc = join(root, 'public', 'icon-512.png');

mkdirSync(assetsDir, { recursive: true });

if (!existsSync(iconSrc)) {
  console.error('Missing public/icon-512.png — add app icon before running cap:assets');
  process.exit(1);
}

copyFileSync(iconSrc, join(assetsDir, 'icon.png'));
copyFileSync(iconSrc, join(assetsDir, 'splash.png'));
console.log('Prepared assets/icon.png and assets/splash.png from public/icon-512.png');
