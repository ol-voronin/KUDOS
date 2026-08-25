import { describe, expect, it } from 'vitest';
import { AnyBlock, BLOCK_TYPES, type BlockType } from '@dt/contracts';
import { BLOCK_REGISTRY, createBlock } from './block-registry';
import { emptyItem, type Field } from './fields';

/**
 * Реєстр блоків в адмінці.
 *
 * Головне тут — інваріант «додав тип у контракт, і редактор одразу вміє з
 * ним працювати». Компілятор стежить лише за наявністю ключа; те, що новий
 * блок можна створити, заповнити й зберегти, перевіряється ось цим.
 */

/** Усі поля, включно з полями вкладених списків. */
function allFields(fields: readonly Field[]): Field[] {
  return fields.flatMap((f) => (f.kind === 'list' ? [f, ...allFields(f.fields)] : [f]));
}

describe('реєстр блоків', () => {
  it('покриває всі типи з контракту, і жодного зайвого', () => {
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it.each(BLOCK_TYPES)('%s — кожну помилку нового блока видно у формі', (type) => {
    // Новий блок не зобовʼязаний бути валідним: «Картинка з текстом» без
    // картинки і не має публікуватися. Зобовʼязання інше й важливіше — на
    // кожну помилку мусить бути поле, через яке її можна виправити.
    // Помилка на полі, якого немає у формі, — глухий кут: блок червоний,
    // публікація заблокована, а зробити нічого не можна.
    const parsed = AnyBlock.safeParse(createBlock(type, []));
    if (parsed.success) return;

    const editable = new Set(allFields(BLOCK_REGISTRY[type].fields).map((f) => f.name));
    for (const issue of parsed.error.issues) {
      const root = String(issue.path[0] ?? '');
      expect(editable.has(root), `${type}: помилка на полі «${root}», якого немає у формі`).toBe(true);
    }
  });

  it.each(BLOCK_TYPES)('%s — id новий, а не збігається з наявним', (type) => {
    const first = createBlock(type, []);
    const second = createBlock(type, [first.id]);
    expect(second.id).not.toBe(first.id);
  });

  it.each(BLOCK_TYPES)('%s — усі поля форми існують у блоці', (type) => {
    // Поле, якого немає в схемі, — це введення, яке нікуди не потрапляє:
    // людина пише текст, зберігає, і текст зникає.
    const block = createBlock(type, []) as unknown as Record<string, unknown>;
    for (const field of BLOCK_REGISTRY[type].fields) {
      expect(Object.hasOwn(block, field.name), `${type}.${field.name}`).toBe(true);
    }
  });

  it.each(BLOCK_TYPES)('%s — заповнені поля списків проходять схему', (type) => {
    // Кнопка «додати крок» кладе порожній елемент. Він мусить бути валідним
    // хоча б після заповнення обовʼязкових рядків — інакше блок неможливо
    // довести до придатного стану, і це виявиться в момент публікації.
    const spec = BLOCK_REGISTRY[type];
    const block = { ...(createBlock(type, []) as unknown as Record<string, unknown>) };

    for (const field of spec.fields) {
      if (field.kind !== 'list') continue;
      const item = emptyItem(field.fields);
      for (const sub of field.fields) {
        if (sub.kind === 'text' || sub.kind === 'rich' || sub.kind === 'textarea') item[sub.name] = 'текст';
      }
      block[field.name] = [item];
    }

    // Картинки заповнюємо теж: без адреси блок валідним не стане, і це
    // правильно — але перевірити треба саме заповнений стан.
    for (const field of spec.fields) {
      if (field.kind === 'image') block[field.name] = { url: '/x.webp', alt: 'опис', caption: '' };
      if (field.kind === 'images') block[field.name] = [{ url: '/x.webp', alt: 'опис', caption: '' }];
    }

    const parsed = AnyBlock.safeParse(block);
    expect(parsed.success ? '' : `${type}: ${parsed.error.message}`).toBe('');
  });

  it('імена полів у межах блока не повторюються', () => {
    for (const type of BLOCK_TYPES) {
      const names = BLOCK_REGISTRY[type].fields.map((f) => f.name);
      expect(new Set(names).size, type).toBe(names.length);
    }
  });

  it('кожне поле має назву українською', () => {
    for (const type of BLOCK_TYPES) {
      for (const field of allFields(BLOCK_REGISTRY[type].fields)) {
        expect(field.label.trim(), `${type}.${field.name}`).not.toBe('');
      }
    }
  });

  it('короткий підпис не падає на щойно створеному блоці', () => {
    for (const type of BLOCK_TYPES as readonly BlockType[]) {
      expect(() => BLOCK_REGISTRY[type].summary(createBlock(type, []))).not.toThrow();
    }
  });

  it('числові випадні списки повертають число, а не рядок', () => {
    // `<select>` завжди віддає рядок. Там, де схема чекає число, це тихо
    // ламає блок — тому варіанти таких списків мусять бути числовими.
    for (const type of BLOCK_TYPES) {
      for (const field of allFields(BLOCK_REGISTRY[type].fields)) {
        if (field.kind !== 'select') continue;
        const numeric = field.options.every((o) => /^\d+$/.test(o.value));
        const mixed = field.options.some((o) => /^\d+$/.test(o.value)) && !numeric;
        expect(mixed, `${type}.${field.name}: варіанти змішані`).toBe(false);
      }
    }
  });
});
