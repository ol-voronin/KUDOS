#!/usr/bin/env node
/**
 * Прибирає `.next/types` перед перевіркою типів.
 *
 * Next генерує в цю теку по файлу на кожен маршрут і додає її в `include`
 * свого tsconfig. Файли лишаються після видалення сторінки — і тоді `tsc`
 * падає на згенерованому коді, який посилається на вже неіснуючий модуль:
 *
 *   .next/types/app/svoya-ideya/page.ts(2,24):
 *   error TS2307: Cannot find module '../../../../src/app/svoya-ideya/page.js'
 *
 * Помилка виглядає як зламаний код, хоча код у порядку — застаріла лише
 * тека збірки. Кожне перенесення сторінки в CMS видаляє маршрут, тож
 * натрапляти на це доведеться ще не раз. Теку відновлює наступний
 * `next build` чи `next dev`, тому видаляти її безпечно.
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = join(fileURLToPath(new URL('..', import.meta.url)), '.next', 'types');
rmSync(target, { recursive: true, force: true });
