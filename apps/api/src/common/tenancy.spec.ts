import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLOBAL_MODELS, TENANT_MODELS } from './tenancy';

/**
 * Перевірки ізоляції, які не потребують бази.
 *
 * Найважливіша з них — перша. Розширення падає на моделі, якої немає в
 * жодному зі списків, але падає воно в рантаймі, при першому запиті. Цей
 * тест переносить ту саму помилку на етап збірки: додав таблицю в схему —
 * скажи, чия вона, ще до того, як щось запустиш.
 */

const schema = readFileSync(
  join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);

describe('розподіл таблиць', () => {
  it('у схемі є моделі — інакше решта тестів нічого не перевіряє', () => {
    expect(models.length).toBeGreaterThan(20);
  });

  it('кожна таблиця віднесена до орендних або спільних', () => {
    const unassigned = models.filter((m) => !TENANT_MODELS.has(m) && !GLOBAL_MODELS.has(m));
    expect(
      unassigned,
      `Нові таблиці без рішення: ${unassigned.join(', ')}. `
      + 'Додайте у TENANT_MODELS (дані належать сайту) або GLOBAL_MODELS (спільні).',
    ).toEqual([]);
  });

  it('жодна таблиця не в обох списках одразу', () => {
    const both = models.filter((m) => TENANT_MODELS.has(m) && GLOBAL_MODELS.has(m));
    expect(both).toEqual([]);
  });

  it('у списках немає таблиць, яких уже немає в схемі', () => {
    // Видалили таблицю, а рядок лишився — потім хтось прочитає його як опис
    // реальності. Дешевше не давати спискам гнити.
    const known = new Set(models);
    const ghosts = [...TENANT_MODELS, ...GLOBAL_MODELS].filter((m) => !known.has(m));
    expect(ghosts).toEqual([]);
  });

  it('кожна орендна таблиця справді має колонку siteId', () => {
    // Розширення додає `siteId` у запит. Якщо колонки немає, воно зламає
    // кожен запит до цієї таблиці — і зламає в проді, а не тут.
    for (const model of TENANT_MODELS) {
      const block = new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(schema);
      expect(block, `моделі ${model} немає в схемі`).not.toBeNull();
      expect(/^\s*siteId\s+String/m.test(block?.[1] ?? ''), `${model} без siteId`).toBe(true);
    }
  });

  it('siteId в орендних таблицях обовʼязковий і без значення за замовчуванням', () => {
    // Це те, що ловить вкладене створення без сайту на етапі компіляції:
    // необовʼязкове поле або поле з дефолтом компілятор пропустить мовчки.
    for (const model of TENANT_MODELS) {
      const block = new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(schema);
      const line = /^\s*siteId\s+String.*$/m.exec(block?.[1] ?? '')?.[0] ?? '';
      expect(line, `${model}: siteId має бути String, не String?`).not.toMatch(/String\?/);
      expect(line, `${model}: siteId не має мати @default`).not.toMatch(/@default/);
    }
  });

  it('унікальні обмеження орендних таблиць починаються з siteId', () => {
    // Адреса, унікальна глобально, означає, що другий клієнт не зможе
    // створити свою «Доставку». Це виявляється не в тестах, а в підтримці.
    for (const model of TENANT_MODELS) {
      const block = new RegExp(`^model\\s+${model}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(schema)?.[1] ?? '';
      for (const attr of block.matchAll(/@@unique\(\[([^\]]+)\]/g)) {
        const fields = (attr[1] ?? '').split(',').map((f) => f.trim());
        // Виняток лише для ключів, що й так прив'язані до батька в межах сайту.
        if (fields.includes('pageId')) continue;
        expect(fields[0], `${model}: @@unique([${fields.join(', ')}]) без siteId попереду`).toBe('siteId');
      }
    }
  });
});
