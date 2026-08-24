import type { Metadata } from 'next';
import { PublicShell } from '@/components/public-shell';
import { PublicLeadForm } from '@/features/leads/public-lead-form';
import { site } from '@/config/site';

export const metadata: Metadata = {
  title: `Залишити заявку — ${site.brand}`,
  description: 'Напишіть, що вас цікавить. Відповідаємо того ж дня.',
};

export default function LeadPage() {
  return (
    <PublicShell>
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <div>
          <h1 className="font-display text-hero text-ink">Напишіть нам</h1>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted">
            Не треба формулювати ідеально. Лишіть телефон — і ми напишемо самі,
            розберемось разом.
          </p>

          <dl className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink">Відповідаємо того ж дня</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                Нас двоє, і кожне замовлення ми ведемо самі — тому без черг і без ботів.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink">Спілкуємось у Telegram</dt>
              <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                Там зручно надсилати фото й показувати макети. Заявка потрібна лише
                щоб ми знали, кому написати.
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-card border border-line bg-surface-raised p-6 sm:p-8">
          <PublicLeadForm source="/zayavka" />
        </div>
      </div>
    </PublicShell>
  );
}
