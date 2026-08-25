#!/usr/bin/env node
/**
 * Перевіряє, що кожен пакет, який імпортує код API, справді резолвиться
 * з apps/api.
 *
 * Навіщо окрема перевірка. У pnpm сувора розкладка node_modules: пакет,
 * якого немає в package.json, не резолвиться, навіть якщо він лежить у
 * дереві як чужа залежність. При цьому `@types/foo` у devDependencies
 * робить TypeScript цілком щасливим — і `tsc` мовчить, а функція падає на
 * старті вже у проді, з `FUNCTION_INVOCATION_FAILED` і без жодного натяку.
 *
 * Саме так express опинився в імпорті, але не в залежностях.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(apiRoot, 'package.json'));

const BUILTIN = /^(node:|assert|buffer|child_process|crypto|dns|events|fs|http|https|net|os|path|querystring|stream|string_decoder|timers|tls|url|util|zlib)/;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?(?:[\w*{}\n\r\t, ]+\s+from\s+)?['"]([^'"]+)['"]/g;
const missing = new Map();

for (const file of walk(join(apiRoot, 'src'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (spec.startsWith('.') || BUILTIN.test(spec)) continue;
    // Ім'я пакета: @scope/name або name
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    try {
      require.resolve(spec);
    } catch {
      try {
        require.resolve(`${pkg}/package.json`);
      } catch {
        const where = missing.get(pkg) ?? new Set();
        where.add(file.slice(apiRoot.length + 1));
        missing.set(pkg, where);
      }
    }
  }
}

if (missing.size === 0) {
  console.log('Імпорти: усі пакети резолвяться з apps/api');
  process.exit(0);
}

console.error('Ці пакети імпортуються, але не резолвяться з apps/api:\n');
for (const [pkg, files] of missing) {
  console.error(`  ${pkg}`);
  for (const file of files) console.error(`      ${file}`);
}
console.error('\nДодайте їх у dependencies apps/api:');
console.error(`  pnpm --filter @dt/api add ${[...missing.keys()].join(' ')}`);
process.exit(1);
