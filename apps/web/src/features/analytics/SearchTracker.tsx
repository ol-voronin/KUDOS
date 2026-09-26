'use client';

import { useEffect, useRef } from 'react';
import { ga4Search } from './ga4';

/**
 * Пошуковий запит у звіт.
 *
 * Найдешевше джерело правди про попит: люди самі пишуть, яких порід і
 * колекцій їм бракує. Запит, за яким нічого не знайшлося, — це готове
 * технічне завдання Даші на наступний принт, а не помилка сайту.
 *
 * Надсилається зі сторінки результатів, а не з кожного натискання клавіші:
 * подія на кожну літеру перетворила б «коргі» на пʼять запитів, з яких
 * чотири — сміття.
 */
export function SearchTracker({ term }: { term: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (term.trim() === '' || sent.current === term) return;
    sent.current = term;
    ga4Search(term);
  }, [term]);
  return null;
}
