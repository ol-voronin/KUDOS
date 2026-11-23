import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNTIME_MIGRATIONS_FOR_TEST } from './runtime-migrations';

describe('runtime-міграції', () => {
  for (const m of RUNTIME_MIGRATIONS_FOR_TEST) {
    it(`${m.name}: checksum збігається з migration.sql`, () => {
      const file = readFileSync(resolve(__dirname, '../../prisma/migrations', m.name, 'migration.sql'));
      expect(createHash('sha256').update(file).digest('hex')).toBe(m.checksum);
    });
    it(`${m.name}: SQL адитивний й ідемпотентний`, () => {
      expect(m.sql).toMatch(/IF NOT EXISTS/);
      expect(m.sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
      const file = readFileSync(resolve(__dirname, '../../prisma/migrations', m.name, 'migration.sql'), 'utf8');
      expect(file).toContain(m.sql);
    });
  }
});
