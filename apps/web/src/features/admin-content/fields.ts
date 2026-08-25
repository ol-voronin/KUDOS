/**
 * Опис полів блока.
 *
 * Це не «конфіг форми заради конфігу». Типів блоків пʼятнадцять, і кожен
 * має від двох до шести полів; написані руками, ці форми — приблизно
 * пʼятсот рядків майже однакової розмітки, у якій кожен наступний блок
 * трохи відрізняється від попереднього просто тому, що його писали пізніше.
 * Через півроку додати поле в один блок означає згадати, як влаштований
 * саме він.
 *
 * З описом усе навпаки: новий тип блока — це рядок у реєстрі, а вигляд,
 * поведінка й доступність приходять готовими й однаковими.
 */

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface Base {
  /** Імʼя поля в обʼєкті блока. */
  readonly name: string;
  readonly label: string;
  /** Підказка під полем. Пояснює правило, а не повторює назву. */
  readonly help?: string;
}

export type Field =
  /** Однорядковий текст. */
  | (Base & { readonly kind: 'text'; readonly placeholder?: string })
  /** Багаторядковий текст без розмітки. */
  | (Base & { readonly kind: 'textarea'; readonly rows?: number })
  /** Текст із дозволеною розміткою: посилання, виділення, підстановки. */
  | (Base & { readonly kind: 'rich'; readonly rows?: number })
  | (Base & { readonly kind: 'number'; readonly min: number; readonly max: number })
  | (Base & { readonly kind: 'select'; readonly options: readonly SelectOption[] })
  | (Base & { readonly kind: 'toggle' })
  /** Картинка: адреса, alt і підпис одним обʼєктом. */
  | (Base & { readonly kind: 'image' })
  /** Кнопки блока. */
  | (Base & { readonly kind: 'links'; readonly max: number })
  /** Список простих рядків — абзаци, пункти списку. */
  | (Base & { readonly kind: 'strings'; readonly itemLabel: string; readonly max: number; readonly rich?: boolean })
  /** Список однакових обʼєктів — кроки, картки, питання. */
  | (Base & { readonly kind: 'list'; readonly itemLabel: string; readonly max: number; readonly fields: readonly Field[] })
  /** Список картинок. */
  | (Base & { readonly kind: 'images'; readonly max: number });

/** Порожнє значення поля — щоб додавання елемента давало валідний обʼєкт. */
export function emptyValue(field: Field): unknown {
  switch (field.kind) {
    case 'text': case 'textarea': case 'rich': return '';
    case 'number': return field.min;
    case 'select': return field.options[0]?.value ?? '';
    case 'toggle': return false;
    case 'image': return { url: '', alt: '', caption: '' };
    case 'images': case 'links': case 'strings': return [];
    case 'list': return [];
    default: {
      const exhaustive: never = field;
      void exhaustive;
      return '';
    }
  }
}

/** Порожній елемент списку: обʼєкт із порожніми значеннями всіх полів. */
export function emptyItem(fields: readonly Field[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.name, emptyValue(f)]));
}

/** Підказка про дозволену розмітку. Однакова скрізь, тому лежить тут. */
export const RICH_HELP = 'Можна: [текст](/адреса) — посилання, **жирний**, {{email}} — підстановка.';
