import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepare, postinstall, variants } from './prepare-package.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const name = '@kovo-internal-testing/drill-canary';
const base = json('packages/drill-canary/package.json');
assert.equal(base.name, name);
assert.equal(base.version, '0.1.0');
assert.equal(base.scripts, undefined);
assert.deepEqual(base.files, ['README.md', 'variant.json']);
assert.deepEqual(base.publishConfig, { access: 'public', registry: 'https://registry.npmjs.org/' });
assert.deepEqual(json('packages/drill-canary/variant.json'), { variant: 'vulnerable' });

const app = json('app/package.json');
const lock = json('app/package-lock.json');
// Future drill fix/recovery PRs must be able to advance this synthetic consumer.
assert.deepEqual(Object.keys(app.dependencies), [name]);
const consumerVersion = app.dependencies[name];
assert.equal(variants.has(consumerVersion), true, 'consumer version must be an exact drill version');
const dependency = { [name]: consumerVersion };
assert.equal(app.private, true);
assert.equal(app.scripts, undefined);
assert.deepEqual(app.dependencies, dependency);
assert.equal(lock.name, app.name);
assert.equal(lock.version, app.version);
assert.equal(lock.lockfileVersion, 3);
assert.equal(lock.requires, true);
assert.deepEqual(lock.packages[''], {
  name: app.name, version: app.version, dependencies: dependency,
});
assert.deepEqual(Object.keys(lock.packages).sort(), ['', `node_modules/${name}`]);
const locked = lock.packages[`node_modules/${name}`];
assert.equal(locked.version, consumerVersion);
assert.equal(locked.resolved,
  `https://registry.npmjs.org/@kovo-internal-testing/drill-canary/-/drill-canary-${consumerVersion}.tgz`);
if (locked.integrity !== undefined) {
  assert.match(locked.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
}
assert.equal(locked.link, undefined);

const expected = [
  ['0.1.0', 'vulnerable'], ['0.1.1', 'fixed'], ['0.1.2', 'malicious'],
  ['0.2.0', 'clean-fixed'], ['0.2.1', 'clean-fixed'],
];
assert.deepEqual([...variants], expected);
const temporary = mkdtempSync(join(tmpdir(), 'drill-static-'));
try {
  for (const input of [undefined, '', '0.1.3', '0.1.0\n', 'latest', '__proto__', 'constructor', '../../escape', '$(false)']) {
    const output = join(temporary, 'refused');
    assert.throws(() => prepare(input, output), /unsupported drill version/);
    assert.equal(existsSync(output), false);
  }
  for (const [version, variant] of expected) {
    const output = join(temporary, version);
    prepare(version, output);
    const manifest = JSON.parse(readFileSync(join(output, 'package.json'), 'utf8'));
    const malicious = variant === 'malicious';
    assert.deepEqual(manifest, {
      ...base, version,
      files: malicious ? [...base.files, 'postinstall.cjs'] : base.files,
      ...(malicious ? { scripts: { postinstall: 'node postinstall.cjs' } } : {}),
    });
    assert.deepEqual(JSON.parse(readFileSync(join(output, 'variant.json'), 'utf8')), { variant });
    assert.equal(existsSync(join(output, 'postinstall.cjs')), malicious);
    if (malicious) {
      assert.equal(readFileSync(join(output, 'postinstall.cjs'), 'utf8'), postinstall);
      // Parse only: never execute the synthetic malicious lifecycle script.
      const syntax = spawnSync(process.execPath, ['--check', join(output, 'postinstall.cjs')], { encoding: 'utf8' });
      assert.equal(syntax.status, 0, 'marker script must parse');
    }
    const pack = spawnSync('npm', ['pack', output, '--dry-run', '--ignore-scripts', '--json'], {
      encoding: 'utf8', timeout: 60_000,
    });
    assert.equal(pack.status, 0, 'static npm pack must succeed');
    const packages = JSON.parse(pack.stdout);
    assert.equal(packages.length, 1);
    assert.equal(packages[0].name, name);
    assert.equal(packages[0].version, version);
    assert.deepEqual(packages[0].files.map((file) => file.path).sort(),
      ['README.md', 'package.json', 'variant.json', ...(malicious ? ['postinstall.cjs'] : [])].sort());
    assert.equal(existsSync(join(output, 'drill-marker.txt')), false, 'pack must never execute postinstall');
    assert.throws(() => prepare(version, output), { code: 'EEXIST' });
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
console.log('Static drill fixture validation passed (5 versions; no install scripts executed).');
