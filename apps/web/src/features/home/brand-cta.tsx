import { ButtonLink } from '@/components/ui';

/**
 * Заголовок, у якому останнє слово стоїть на жовтій хвилі — головний прийом
 * героя й «Про нас», тепер і в каталозі. Одне слово, а не фраза: хвиля під
 * цілим рядком перестає бути наголосом.
 */
export function WaveLastWord({ text }: { text: string }) {
  const at = text.trimEnd().lastIndexOf(' ');
  if (at === -1) return <span className="wave-underline">{text}</span>;
  return <>{text.slice(0, at + 1)}<span className="wave-underline">{text.slice(at + 1)}</span></>;
}

/**
 * Та сама хвиля, але під першим словом.
 *
 * «Благодійна Бабака»: наголос має бути на «Благодійна», а не на бренді —
 * у решти колекцій хвиля стоїть під останнім словом, і саме це робить
 * «Бабаку» впізнаваною. Тут навпаки: слово «Бабака» вже в назві сайту,
 * а що колекція благодійна — ні.
 */
export function WaveFirstWord({ text }: { text: string }) {
  const at = text.trimStart().indexOf(' ');
  if (at === -1) return <span className="wave-underline">{text}</span>;
  return <><span className="wave-underline">{text.slice(0, at)}</span>{text.slice(at)}</>;
}

/**
 * Заклик під сіткою каталогу: «немає твоєї породи — намалюємо».
 *
 * Прийоми бренду з «Про нас» (аудит 17.10, U1): жовта підкладка, наліпка
 * навскіс і пес-дудл із лого. Жовтої хвилі тут немає навмисно — на жовтому
 * тлі її не видно. Текст — правило №3 з «Про нас», а не новий: обіцянка та сама.
 */
export function DrawYourDogCta() {
  return (
    <section className="tone-yellow relative mt-16 overflow-hidden rounded-3xl border border-ink p-6 sm:p-10">
      <p className="sticker">Портрет саме твого пса з фото</p>
      <h2 className="mt-5 max-w-xl text-section font-bold text-ink">
        Немає твоєї породи? <span className="ghost-word">Намалюємо.</span>
      </h2>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/svoya-ideya" size="lg">Замовити свій принт</ButtonLink>
        <ButtonLink href="/breeds" variant="outline" size="lg">Усі породи</ButtonLink>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-dog.svg"
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none mt-8 h-16 w-auto sm:absolute sm:bottom-8 sm:right-8 sm:mt-0 sm:h-28"
      />
    </section>
  );
}
