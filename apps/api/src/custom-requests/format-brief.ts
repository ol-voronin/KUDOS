import { escapeHtml } from '../common/telegram';

export interface BriefNotification {
  readonly number: number;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly dogName: string;
  readonly dogBreed: string;
  readonly garmentType: string;
  readonly mood: string;
  readonly photoCount: number;
  readonly customerSuppliedArtwork: boolean;
  readonly notes?: string;
  readonly sizeLabel?: string;
  readonly deadline?: Date;
}

const GARMENT_LABELS: Record<string, string> = {
  TSHIRT: 'футболка',
  HOODIE: 'худі',
  SWEATSHIRT: 'світшот',
  LONGSLEEVE: 'лонгслів',
  JOGGERS: 'джогери',
  TOTE: 'шопер',
};

/**
 * Бриф «принт з 0» у Telegram.
 *
 * Досі бриф лише лягав у базу — тобто заявка на 3000₴+ приходила й ніхто про
 * неї не дізнавався, поки хтось не відкриє адмінку. Формат навмисно
 * відрізняється від заявки: тут одразу видно, скільки роботи в замовленні.
 */
export function formatBrief(brief: BriefNotification): string {
  const rows = [
    `🎨 <b>Бриф «своя ідея» №${brief.number}</b>`,
    '',
    `👤 ${escapeHtml(brief.customerName)}`,
    `📞 <a href="tel:${escapeHtml(brief.customerPhone)}">${escapeHtml(brief.customerPhone)}</a>`,
    '',
    `🐕 ${escapeHtml(brief.dogName)} — ${escapeHtml(brief.dogBreed)}`,
    `👕 ${escapeHtml(GARMENT_LABELS[brief.garmentType] ?? brief.garmentType)}${brief.sizeLabel ? `, ${escapeHtml(brief.sizeLabel)}` : ''}`,
    '',
    `<b>Ідея:</b> ${escapeHtml(brief.mood)}`,
  ];

  if (brief.notes) rows.push('', `<b>Деталі:</b> ${escapeHtml(brief.notes)}`);
  if (brief.deadline) {
    rows.push('', `⏳ Дедлайн: ${brief.deadline.toLocaleDateString('uk-UA')}`);
  }

  rows.push('');
  rows.push(
    brief.customerSuppliedArtwork
      ? '📎 Клієнт має свій макет — знижка 150 ₴'
      : '✏️ Макет з нуля',
  );

  // Поки завантаження немає, це завжди 0 — і саме тому рядок потрібен:
  // він каже, що фото треба попросити, а не що клієнт їх не додав.
  rows.push(
    brief.photoCount > 0
      ? `📷 Фото: ${brief.photoCount}`
      : '📷 Фото немає — попросіть у відповідь тут, у Telegram',
  );

  return rows.join('\n');
}
