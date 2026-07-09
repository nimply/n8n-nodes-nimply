// Copies static assets (node icons) into dist after tsc.
// Kept as a plain Node script so the package does not need gulp.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const assets = ['nodes/Nimply/nimply.svg'];

for (const asset of assets) {
	const target = join(root, 'dist', asset);
	await mkdir(dirname(target), { recursive: true });
	await copyFile(join(root, asset), target);
}
