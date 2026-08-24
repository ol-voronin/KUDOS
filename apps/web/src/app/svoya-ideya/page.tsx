import type { Metadata } from 'next';
import { PublicShell } from '@/components/public-shell';
import { CustomRequestForm } from '@/features/custom-requests/custom-request-form';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: `Своя ідея — ${site.brand}`,
  description: 'Намалюємо вашу собаку з нуля: портрет, обкладинка, будь-яка ідея. Заповніть бриф.',
};

const STEPS = [
  { n: 1, title: 'Ви розповідаєте ідею', text: 'Одного речення достатньо. Далі допитаємо самі — це наша робота, не ваша.' },
  { n: 2, title: 'Ми називаємо ціну', text: 'Після того, як побачили ідею. Не раніше: робота з нуля буває і на дві години, і на два дні.' },
  { n: 3, title: 'Малюємо й показуємо', text: 'Правки включені. Друкуємо тільки після того, як ви сказали «так».' },
];

export default function CustomRequestPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">Принт з нуля</p>
          <h1 className="mt-3 font-display text-hero text-ink">Вашої собаки ще немає в каталозі</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            Це не проблема, а окрема послуга. Намалюємо саме вашого пса — з його
            вухами, шрамом і виразом морди, який знаєте тільки ви.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-card border border-line bg-surface-raised p-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-card bg-ink text-sm font-bold text-surface">
                {s.n}
              </span>
              <p className="mt-3 font-medium text-ink">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,34rem)_1fr]">
          <div className="rounded-card border border-line bg-surface-raised p-6 sm:p-8">
            <CustomRequestForm />
          </div>
          <aside className="lg:pt-2">
            <h2 className="font-display text-lg font-bold text-ink">Чому не видно ціни</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Портрет у складному стилі й простий силует — це різна кількість годин.
              Назвати одну цифру наперед означало б або обдурити вас, або продати
              собі в збиток. Тому спершу дивимось, потім рахуємо.
            </p>
            <h2 className="mt-8 font-display text-lg font-bold text-ink">Якщо макет уже є</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Поставте галочку в брифі — це знімає 150 ₴ і кілька днів очікування.
              Друкуємо ваш файл, малювати нічого не треба.
            </p>
            <h2 className="mt-8 font-display text-lg font-bold text-ink">Скільки чекати</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Точний строк назвемо разом із ціною — він залежить від складності
              й від того, скільки замовлень зараз у роботі.
            </p>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
