/**
 * Схема тут описана структурно, а не як `ZodSchema<T>`, і це не дрібниця.
 *
 * `ZodSchema<T>` вимагає, щоб тип на вході й на виході збігався. Щойно в
 * схемі зʼявляється `.default()`, вони перестають збігатися: на вході поле
 * необовʼязкове, на виході — обовʼязкове. TypeScript тоді підбирає T за
 * входом, і виклик повертає тип, у якому половина полів `| undefined` —
 * тобто рівно те, від чого `.default()` мав захистити.
 *
 * `parse(data: unknown): T` описує лише те, що нам справді потрібно, і T
 * завжди виявляється вихідним типом.
 */
interface Parser<T> {
  parse(data: unknown): T;
}
import { SERVER_API_URL } from './api-origin';

/**
 * Читання каталогу на сервері.
 *
 * Окремо від `apiFetch` навмисно: той носить cookie й живе в браузері, а тут
 * усе публічне, без сесії, і головне — результат має потрапити в HTML.
 * Поки дані тягне react-query в useEffect, пошуковик отримує порожню
 * оболонку: сторінки, чий сенс — приводити людей із пошуку, тоді не працюють.
 *
 * `revalidate` — ISR: сторінка віддається статикою й перебудовується у фоні.
 * Каталог змінюється разів на тиждень, тож хвилина свіжості тут із запасом.
 */
export async function serverFetch<T>(
  path: string,
  schema: Parser<T>,
  revalidate = 60,
): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    headers: { 'content-type': 'application/json' },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return schema.parse(await res.json());
}

/** Те саме, але «немає» — це нормальний результат, а не аварія (404 сторінки). */
export async function serverFetchOrNull<T>(
  path: string,
  schema: Parser<T>,
  revalidate = 60,
): Promise<T | null> {
  try {
    return await serverFetch(path, schema, revalidate);
  } catch {
    return null;
  }
}
