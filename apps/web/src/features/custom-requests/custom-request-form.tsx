'use client';

import { useState } from 'react';
import { site } from '@/config/site';
import { ApiError } from '@/lib/api-client';
import { Consent, Field, Select, SubmitButton, SuccessPanel, TextArea } from '@/features/forms/fields';
import { createCustomRequest } from './api';
import { PhotoPlaceholder } from './photo-placeholder';

/**
 * Бриф «своя ідея» — потік із найбільшим чеком і найдовшим циклом.
 *
 * Порядок полів не випадковий: спершу собака, потім ідея, і тільки наприкінці
 * контакти. Людина заповнює найцікавіше для неї першим і доходить до телефону
 * вже вклавшись — це той самий прийом, що й у брифах агенцій.
 *
 * Обовʼязкових полів пʼять. Кожне з них справді змінює роботу дизайнера;
 * решта — опційні, і додавати нових обовʼязкових не варто без перевірки.
 */

const GARMENTS = [
  { value: 'TSHIRT', label: 'Футболка' },
  { value: 'HOODIE', label: 'Худі' },
  { value: 'SWEATSHIRT', label: 'Світшот' },
  { value: 'LONGSLEEVE', label: 'Лонгслів' },
] as const;

export function CustomRequestForm() {
  const [dogName, setDogName] = useState('');
  const [dogBreed, setDogBreed] = useState('');
  const [mood, setMood] = useState('');
  const [notes, setNotes] = useState('');
  const [garmentType, setGarmentType] = useState<string>('HOODIE');
  const [sizeLabel, setSizeLabel] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ownArtwork, setOwnArtwork] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  if (sent !== null) {
    return (
      <SuccessPanel title={`Бриф №${sent} прийнято`}>
        <p>
          Ми подивимось і напишемо вам у Telegram — там же попросимо фото
          {dogName ? ` ${dogName}` : ' собаки'} і назвемо ціну.
        </p>
        <p>
          Ціну не називаємо наперед навмисно: робота з нуля буває дуже різною,
          і чесніше порахувати після того, як побачили ідею.
        </p>
        <p>
          <a href={site.telegramUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline">
            Написати першими
          </a>{' '}— теж можна, так буде швидше.
        </p>
      </SuccessPanel>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (dogName.trim().length < 1) next['dogName'] = 'Як звати собаку?';
    if (dogBreed.trim().length < 1) next['dogBreed'] = 'Порода або «метис» — теж відповідь';
    if (mood.trim().length < 1) next['mood'] = 'Опишіть ідею хоча б одним реченням';
    if (name.trim().length < 2) next['name'] = 'Вкажіть, як до вас звертатися';
    if (phone.trim().length === 0) next['phone'] = 'Без телефону ми не зможемо відповісти';
    if (!consent) next['consent'] = 'Потрібна згода на обробку даних';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      const result = await createCustomRequest({
        contact: { name: name.trim(), phone: phone.trim() },
        // photoKeys поки завжди порожній — завантаження ще немає, фото
        // приходять у Telegram. Див. PhotoPlaceholder.
        dog: { name: dogName.trim(), breed: dogBreed.trim(), photoKeys: [] },
        brief: {
          mood: mood.trim(),
          referenceUrls: [],
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        product: {
          garmentType: garmentType as 'TSHIRT',
          ...(sizeLabel.trim() ? { sizeLabel: sizeLabel.trim() } : {}),
        },
        customerSuppliedArtwork: ownArtwork,
        consent: true,
      });
      setSent(result.number);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Не вдалося надіслати. Спробуйте ще раз або напишіть у Telegram.';
      setErrors({ phone: text });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-bold text-ink">Про собаку</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="dog-name" label="Кличка" required value={dogName} onChange={setDogName} error={errors['dogName']} />
          <Field
            id="dog-breed" label="Порода" required value={dogBreed} onChange={setDogBreed}
            error={errors['dogBreed']} placeholder="Коргі, метис…"
          />
        </div>
        <PhotoPlaceholder />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-bold text-ink">Ідея</legend>
        <TextArea
          id="brief-mood" label="Що ви хочете бачити на одязі" required rows={4}
          value={mood} onChange={setMood} error={errors['mood']}
          placeholder="Портрет у стилі ренесанс. Або: Барні на обкладинці Vogue."
          hint="Одне речення достатньо. Деталі обговоримо в Telegram."
        />
        <TextArea
          id="brief-notes" label="Що ще важливо знати" rows={3}
          value={notes} onChange={setNotes}
          placeholder="Улюблена іграшка, шрам на вусі, характер…"
          hint="Не обовʼязково — але саме такі дрібниці роблять принт упізнаваним."
        />
        <Consent id="own-artwork" checked={ownArtwork} onChange={setOwnArtwork}>
          У мене вже є готовий макет. <span className="text-ink">Знижка 150 ₴</span> — не малюємо з нуля.
        </Consent>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-bold text-ink">Виріб</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            id="garment-type" label="Що шиємо" required
            value={garmentType} onChange={setGarmentType} options={GARMENTS}
          />
          <Field
            id="size-label" label="Розмір" value={sizeLabel} onChange={setSizeLabel}
            placeholder="M" hint="Якщо не знаєте — підберемо разом."
          />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-bold text-ink">Контакти</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="brief-name" label="Як до вас звертатися" required value={name} onChange={setName} error={errors['name']} autoComplete="name" />
          <Field
            id="brief-phone" label="Телефон" type="tel" required value={phone} onChange={setPhone}
            error={errors['phone']} placeholder="+380 67 123 45 67" autoComplete="tel"
          />
        </div>
        <Consent id="brief-consent" checked={consent} onChange={setConsent} error={errors['consent']}>
          Погоджуюсь на обробку імені й телефону, щоб ви відповіли на цей бриф.
          Дані йдуть у ваш Telegram і зберігаються у вас.
        </Consent>
      </fieldset>

      <SubmitButton pending={pending}>Надіслати бриф</SubmitButton>
      <p className="text-center text-sm text-ink-muted">
        Ціну назвемо після того, як подивимось — робота з нуля буває дуже різною.
      </p>
    </form>
  );
}
