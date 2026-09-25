'use client';

import type { GarmentDto, MeasurementKey, SizeDto } from '@dt/contracts';

/**
 * Розмірна сітка виробу.
 *
 * Найдорожча відсутня деталь на сторінці товару. Розмір — єдине рішення в
 * покупці, яке людина не може перевірити після оплати й не може виправити
 * без повернення; без сітки вона або йде порівнювати з чужою футболкою, або
 * не купує. Сітка тут ЗАВЖДИ повна: не «розмір M», а всі розміри поряд, бо
 * обирають порівнянням, а не читанням одного рядка.
 *
 * ── Чому це панель, а не розгортання на місці ─────────────────────────
 *
 * Таблиця розсовувала картку товару вдвічі, і кнопка купівлі їхала за екран
 * рівно тоді, коли розмір нарешті обрано. Панель показує сітку поверх
 * сторінки й повертає людину точно туди, звідки вона її відкрила.
 *
 * ── Два заміри, не три ────────────────────────────────────────────────
 *
 * Рукав прибрано (вересень 2026). Він стояв у сітці як рівний ширині й
 * довжині, але міряється інакше на різних виробах — у футболці від
 * плечового шва, у світшоті від горловини, — і самі числа це видавали:
 * 24 см поруч із 68 у сусідньому рядку. Замір, який половина людей знімає
 * не так, як ми, не допомагає обрати розмір, зате дає привід сперечатися
 * про нього при поверненні.
 *
 * Колонки все одно будуються з того, що реально є в рядках: у базі можуть
 * лишитися старі заміри, і порожня колонка гірша за її відсутність.
 *
 * ── Рядки, а не колонки ───────────────────────────────────────────────
 *
 * Розміри йдуть згори вниз, заміри — впоперек. Так у всіх магазинів одягу
 * і так у нашому паспорті виробу: людина шукає СВІЙ рядок, а не свою
 * колонку. Попередня орієнтація (розміри в шапці) на телефоні давала
 * горизонтальну прокрутку в таблиці з семи колонок.
 */

const LABELS: Record<MeasurementKey, string> = {
  WIDTH: 'Ширина (А), см',
  LENGTH: 'Довжина (Б), см',
  SLEEVE: 'Рукав, см',
  WAIST: 'Талія, см',
  HIP: 'Стегна, см',
};

/** Ширина попереду: на малюнку стрілка А стоїть вище за Б. */
const ORDER: readonly MeasurementKey[] = ['WIDTH', 'LENGTH', 'SLEEVE', 'WAIST', 'HIP'];

export function SizeChart({ garment, highlight }: { garment: GarmentDto; highlight?: string | null }) {
  const sizes = garment.sizes;
  const present = new Set<MeasurementKey>();
  for (const s of sizes) for (const m of s.measurements) present.add(m.key);
  const keys = ORDER.filter((k) => present.has(k));

  if (sizes.length === 0 || keys.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      <HowToMeasure garment={garment} />
      <Table sizes={sizes} keys={keys} highlight={highlight ?? null} />
      <p className="text-xs text-ink-subtle">
        <a href="/vyroby" className="underline underline-offset-4 hover:text-ink">
          Сітки всіх виробів
        </a>
      </p>
    </div>
  );
}

function Table({
  sizes, keys, highlight,
}: { sizes: readonly SizeDto[]; keys: readonly MeasurementKey[]; highlight: string | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse border border-ink text-sm tabular-nums">
        <thead>
          <tr className="bg-ink text-surface">
            <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-label">
              Розмір
            </th>
            {keys.map((k) => (
              <th key={k} scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-label">
                {LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => {
            const picked = s.id === highlight;
            return (
              <tr
                key={s.id}
                aria-current={picked ? 'true' : undefined}
                className={picked ? 'bg-accent-soft' : undefined}
              >
                <th
                  scope="row"
                  className={[
                    'border border-ink px-4 py-3 text-center text-sm font-semibold',
                    picked ? 'text-accent-ink' : 'text-ink',
                  ].join(' ')}
                >
                  {s.label}
                </th>
                {keys.map((k) => (
                  <td
                    key={k}
                    className={[
                      'border border-ink px-4 py-3 text-center',
                      picked ? 'font-semibold text-accent-ink' : 'text-ink',
                    ].join(' ')}
                  >
                    {s.measurements.find((m) => m.key === k)?.value ?? '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Як обрати розмір.
 *
 * Три кроки, а не абзац: інструкція «візьми свою річ і заміряй» працює
 * тільки тоді, коли її видно як послідовність дій. І головне — вона знімає
 * найчастішу помилку: люди міряють СЕБЕ, а в таблиці стоять заміри РЕЧІ.
 */
function HowToMeasure({ garment }: { garment: GarmentDto }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">Як обрати необхідний розмір?</h3>
      <ol className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-muted">
        <li><b className="font-semibold text-ink">Крок 1</b> Візьми власну аналогічну річ і розклади на рівній поверхні</li>
        <li><b className="font-semibold text-ink">Крок 2</b> Заміряй ширину (А) та довжину (Б), як вказано на малюнку</li>
        <li><b className="font-semibold text-ink">Крок 3</b> Порівняй свої цифри із вказаними у таблиці та обери розмір</li>
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        У таблиці вказані заміри виробу, а не тіла.
        <br />
        Можливе відхилення у допустимих межах 1–3 см.
      </p>
      <GarmentDiagram garment={garment} />
    </div>
  );
}

/**
 * Малюнок замірів — свій на кожен крій.
 *
 * Раніше тут стояла одна футболка на всі сім виробів, і на сторінці худі
 * вона працювала проти нас: стрілка «довжина» на футболці йде від плеча,
 * а на худі людина бачить капюшон і не знає, рахувати його чи ні. Малюнок
 * існує рівно для того, щоб зняти це питання, — отже, він має показувати
 * ту річ, яку зараз обирають.
 *
 * Знімки з макета, а не мальований контур. Схема, накреслена в коді,
 * відповідала на питання «звідки й куди міряти», але виглядала як
 * креслення з інструкції до пилососа поруч зі справжніми фотографіями
 * виробу — і тим підказувала, що сторінку складали нашвидкуруч.
 *
 * Чотири файли, а не сім: гібрид-світшот міряється як футболка, а три
 * футболки різняться кроєм, але не тим, звідки й куди тягнути стрічку.
 */
type Shape = 'tee' | 'hoodie-short' | 'crew' | 'hoodie';

function shapeOf(garment: GarmentDto): Shape {
  if (garment.type === 'HOODIE') return garment.fit === 'HYBRID' ? 'hoodie-short' : 'hoodie';
  if (garment.type === 'SWEATSHIRT' && garment.fit !== 'HYBRID') return 'crew';
  return 'tee';
}

function GarmentDiagram({ garment }: { garment: GarmentDto }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/size-guide/${shapeOf(garment)}.webp`}
      alt={`${garment.name}: А — ширина впоперек під пахвами, Б — довжина від плеча до низу`}
      loading="lazy"
      className="mt-5 h-44 w-auto max-w-full"
    />
  );
}
