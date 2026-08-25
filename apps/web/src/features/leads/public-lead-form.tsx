'use client';

import Link from 'next/link';
import { useState } from 'react';
import { site } from '@/config/site';
import { ApiError } from '@/lib/api-client';
import { Consent, Field, SubmitButton, SuccessPanel, TextArea } from '@/features/forms/fields';
import { createLead } from './public-api';

/**
 * Заявка. Найкоротший шлях від «цікаво» до розмови в Telegram.
 *
 * Обовʼязкових полів рівно два — імʼя й телефон. Кожне додаткове обовʼязкове
 * поле коштує заявок, а все інше ви й так спитаєте в переписці, бо кожне
 * замовлення підтверджується руками.
 *
 * `source` каже, з якої сторінки прийшла заявка: те саме повідомлення в
 * Telegram, але видно контекст.
 */
export function PublicLeadForm({ source, compact = false }: { source: string; compact?: boolean }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  if (sent !== null) {
    return (
      <SuccessPanel title={`Заявка №${sent} прийнята`}>
        <p>Напишемо або зателефонуємо найближчим часом — зазвичай того ж дня.</p>
        <p>
          Якщо зручніше одразу —{' '}
          <a href={site.telegramUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline">
            напишіть нам у Telegram
          </a>.
        </p>
      </SuccessPanel>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next['name'] = 'Вкажіть, як до вас звертатися';
    if (phone.trim().length === 0) next['phone'] = 'Без телефону ми не зможемо відповісти';
    if (!consent) next['consent'] = 'Потрібна згода на обробку даних';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      const result = await createLead({
        name: name.trim(),
        phone: phone.trim(),
        ...(message.trim() ? { message: message.trim() } : {}),
        source,
        marketingConsent: marketing,
      });
      setSent(result.number);
    } catch (err) {
      // Помилку валідації з сервера показуємо на полі телефону: це єдине поле,
      // яке сервер може відхилити після того, як форма його пропустила.
      const text = err instanceof ApiError ? err.message : 'Не вдалося надіслати. Спробуйте ще раз або напишіть у Telegram.';
      setErrors({ phone: text });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <Field
        id="lead-name" label="Як до вас звертатися" required
        value={name} onChange={setName} error={errors['name']} autoComplete="name"
      />
      <Field
        id="lead-phone" label="Телефон" type="tel" required
        value={phone} onChange={setPhone} error={errors['phone']}
        placeholder="+380 67 123 45 67" autoComplete="tel"
        hint="Можна як завгодно — з плюсом, з нулем чи без. Ми зрозуміємо."
      />
      {!compact && (
        <TextArea
          id="lead-message" label="Що вас цікавить" rows={3}
          value={message} onChange={setMessage}
          placeholder="Худі з коргі, розмір M…"
          hint="Не обовʼязково — можна просто лишити телефон."
        />
      )}

      <Consent id="lead-consent" checked={consent} onChange={setConsent} error={errors['consent']}>
        Погоджуюсь на обробку імені й телефону, щоб ви відповіли на цю заявку —
        згідно з <Link href="/pryvatnist" className="underline">політикою конфіденційності</Link>.
        Дані приходять нам у Telegram.
      </Consent>
      <Consent id="lead-marketing" checked={marketing} onChange={setMarketing}>
        Можна писати мені про нові принти й акції. Не обовʼязково.
      </Consent>

      <SubmitButton pending={pending}>Надіслати заявку</SubmitButton>

      <div className="flex flex-wrap gap-3 pt-1">
        <a
          href={site.telegramUrl} target="_blank" rel="noreferrer"
          className="flex min-h-12 flex-1 items-center justify-center rounded-card border border-line px-4 text-sm font-medium text-ink transition hover:border-ink"
        >
          Написати в Telegram
        </a>
        {site.phone && (
          <a
            href={`tel:${site.phone}`}
            className="flex min-h-12 flex-1 items-center justify-center rounded-card border border-line px-4 text-sm font-medium text-ink transition hover:border-ink"
          >
            Подзвонити
          </a>
        )}
      </div>
    </form>
  );
}
