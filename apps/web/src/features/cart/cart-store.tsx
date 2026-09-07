'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import type { CartItemDto } from '@dt/contracts';

/**
 * Кошик живе в браузері.
 *
 * ── Що саме тут зберігається ──────────────────────────────────────────
 *
 * Тільки «який варіант і скільки». Ні цін, ні сум, ні знижок — усе це
 * рахує сервер на `/cart/quote` і перераховує ще раз на касі. Тобто вміст
 * `localStorage` не є цінністю, яку варто підробляти: підмінивши його,
 * людина змінить лише те, що вона хоче купити, а не скільки це коштує.
 *
 * Саме тому кошику не потрібні ні таблиця в базі, ні cookie, ні згода на
 * неї. Мінус чесний і його варто памʼятати: кошик не переїжджає з телефона
 * на ноут, і покинутих кошиків ми не бачимо. Обидві речі додаються пізніше
 * без зміни контракту — сервер уже вміє приймати кошик цілком.
 *
 * ── Чому стан читається у `useEffect`, а не одразу ────────────────────
 *
 * На сервері `localStorage` не існує. Якщо прочитати його під час першого
 * рендеру, розмітка сервера й браузера розійдуться, і React перемалює
 * сторінку з попередженням про гідрацію. Тому початковий стан — порожній
 * кошик, а справжній приїжджає першим ефектом. `ready` існує рівно для
 * того, щоб лічильник у шапці не блимнув нулем перед справжнім числом.
 */

const KEY = 'dt.cart.v1';
const MAX_LINES = 20;
const MAX_QTY = 5;

export interface CartLine extends CartItemDto {
  /** Знімок для показу, поки не приїхав перерахунок із сервера. */
  readonly title: string;
  readonly previewUrl: string;
}

interface CartApi {
  readonly lines: readonly CartLine[];
  readonly count: number;
  readonly ready: boolean;
  add: (line: CartLine) => void;
  setQuantity: (variantId: string, printSlug: string | null, quantity: number) => void;
  remove: (variantId: string, printSlug: string | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

/**
 * Один рядок — це пара «принт + варіант». Метод друку на це не впливає.
 * `printSlug: null` — базовий одяг: порожня футболка і та сама футболка з
 * принтом — два різні рядки.
 */
function sameLine(
  a: { variantId: string; printSlug: string | null },
  b: { variantId: string; printSlug: string | null },
): boolean {
  return a.variantId === b.variantId && a.printSlug === b.printSlug;
}

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Чужий або застарілий вміст не має ламати сторінку: беремо тільки те,
    // що схоже на рядок кошика, решту тихо відкидаємо.
    return parsed
      .filter((v): v is CartLine => (
        typeof v === 'object' && v !== null
        && typeof (v as CartLine).variantId === 'string'
        && (typeof (v as CartLine).printSlug === 'string' || (v as CartLine).printSlug === null)
      ))
      .slice(0, MAX_LINES)
      .map((v) => ({
        variantId: v.variantId,
        printSlug: v.printSlug,
        // Без принта метод друку не існує; з принтом — DTF за замовчуванням.
        printMethod: v.printSlug === null ? null : (v.printMethod === 'DTG' ? 'DTG' : 'DTF'),
        quantity: Math.min(MAX_QTY, Math.max(1, Math.trunc(Number(v.quantity) || 1))),
        title: typeof v.title === 'string' ? v.title : '',
        previewUrl: typeof v.previewUrl === 'string' ? v.previewUrl : '',
      }));
  } catch {
    // Приватне вікно, вимкнене сховище, зіпсований JSON — кошик просто
    // порожній. Сторінка мусить працювати в усіх трьох випадках.
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<readonly CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(read());
    setReady(true);
  }, []);

  // Запис у сховище — окремим ефектом, і тільки після першого читання:
  // інакше порожній початковий стан затер би справжній кошик ще до того,
  // як його встигли прочитати.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch { /* сховище недоступне — кошик житиме до перезавантаження */ }
  }, [lines, ready]);

  /*
   * Кошик синхронізується між вкладками.
   *
   * Дві відкриті вкладки того самого магазину — звичайна річ: в одній
   * дивляться каталог, у другій кошик. Без цього рядка друга вкладка
   * показувала б стан на момент її відкриття й затирала б ним першу.
   */
  useEffect(() => {
    function onStorage(e: StorageEvent): void {
      if (e.key === KEY) setLines(read());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const found = prev.find((l) => sameLine(l, line));
      if (found !== undefined) {
        return prev.map((l) => (sameLine(l, line)
          ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) }
          : l));
      }
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, { ...line, quantity: Math.min(MAX_QTY, Math.max(1, line.quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, printSlug: string | null, quantity: number) => {
    setLines((prev) => (quantity <= 0
      ? prev.filter((l) => !sameLine(l, { variantId, printSlug }))
      : prev.map((l) => (sameLine(l, { variantId, printSlug })
        ? { ...l, quantity: Math.min(MAX_QTY, quantity) }
        : l))));
  }, []);

  const remove = useCallback((variantId: string, printSlug: string | null) => {
    setLines((prev) => prev.filter((l) => !sameLine(l, { variantId, printSlug })));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartApi>(() => ({
    lines,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    ready,
    add,
    setQuantity,
    remove,
    clear,
  }), [lines, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (ctx === null) throw new Error('useCart поза <CartProvider>');
  return ctx;
}

/** Те, що їде на сервер: без назв і картинок — сервер їх знає краще. */
export function toCartItems(lines: readonly CartLine[]): CartItemDto[] {
  return lines.map((l) => ({
    printSlug: l.printSlug,
    variantId: l.variantId,
    printMethod: l.printMethod,
    quantity: l.quantity,
  }));
}
