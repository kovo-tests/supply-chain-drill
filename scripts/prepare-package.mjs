import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const variants = new Map([
  ['0.1.0', 'vulnerable'],
  ['0.1.1', 'fixed'],
  ['0.1.2', 'malicious'],
  ['0.2.0', 'clean-fixed'],
  ['0.2.1', 'clean-fixed'],
]);

// This is the entire executable payload of the synthetic malicious variant.
// Exclusive creation refuses to follow or overwrite an existing marker symlink.
export const postinstall = `const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
try {
  writeFileSync(join(__dirname, 'drill-marker.txt'), 'Kovo security drill fixture\\n', { flag: 'wx' });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
`;

export function prepare(version, output) {
  const variant = variants.get(version);
  if (!variant) throw new Error('unsupported drill version');
  const source = join(dirname(fileURLToPath(import.meta.url)), '../packages/drill-canary');
  const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  // A fresh directory prevents stale malicious files from leaking into clean versions.
  mkdirSync(output, { recursive: false });
  manifest.version = version;
  delete manifest.scripts;
  manifest.files = ['README.md', 'variant.json'];
  if (variant === 'malicious') {
    manifest.scripts = { postinstall: 'node postinstall.cjs' };
    manifest.files.push('postinstall.cjs');
    writeFileSync(join(output, 'postinstall.cjs'), postinstall);
  }
  copyFileSync(join(source, 'README.md'), join(output, 'README.md'));
  writeFileSync(join(output, 'variant.json'), `${JSON.stringify({ variant }, null, 2)}\n`);
  writeFileSync(join(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('one explicit version is required');
  // Output path is fixed, never derived from unvalidated user input.
  prepare(process.argv[2], join(dirname(fileURLToPath(import.meta.url)), '../dist'));
}
