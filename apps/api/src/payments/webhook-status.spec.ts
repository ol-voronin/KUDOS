import { describe, expect, it } from 'vitest';
import type { PaymentStatus } from '@dt/contracts';
import { statusesBelow } from './payments-webhook.service';

/**
 * Ці тести описують рівно два сценарії, через які до виправлення в Telegram
 * могло прилетіти два повідомлення про одну оплату:
 *   1) два одночасні `success` (гонка між читанням і записом);
 *   2) спізнілий `processing`, що відкочував уже успішний платіж назад.
 * Умова `status: { in: statusesBelow(next) }` закриває обидва однією
 * атомарною операцією, тож перевіряємо саме її таблицю переходів.
 */
describe('statusesBelow', () => {
  const canMove = (from: PaymentStatus, to: PaymentStatus) => statusesBelow(to).includes(from);

  it('дозволяє нормальний рух уперед', () => {
    expect(canMove('CREATED', 'PROCESSING')).toBe(true);
    expect(canMove('PROCESSING', 'HOLD')).toBe(true);
    expect(canMove('HOLD', 'SUCCESS')).toBe(true);
    expect(canMove('CREATED', 'SUCCESS')).toBe(true);
  });

  it('не дає відкотити успішний платіж назад', () => {
    expect(canMove('SUCCESS', 'PROCESSING')).toBe(false);
    expect(canMove('SUCCESS', 'CREATED')).toBe(false);
    expect(canMove('SUCCESS', 'HOLD')).toBe(false);
  });

  it('другий success не проходить — це і є ідемпотентність', () => {
    expect(canMove('SUCCESS', 'SUCCESS')).toBe(false);
  });

  it('повернення коштів законно йде після успіху', () => {
    expect(canMove('SUCCESS', 'REVERSED')).toBe(true);
  });

  it('термінальні стани не переходять один в одного', () => {
    expect(canMove('FAILURE', 'SUCCESS')).toBe(false);
    expect(canMove('EXPIRED', 'SUCCESS')).toBe(false);
    expect(canMove('SUCCESS', 'FAILURE')).toBe(false);
  });

  it('з CREATED можна потрапити в будь-який інший стан', () => {
    const all: PaymentStatus[] = ['PROCESSING', 'HOLD', 'SUCCESS', 'FAILURE', 'EXPIRED', 'REVERSED'];
    for (const to of all) expect(canMove('CREATED', to)).toBe(true);
  });
});
