'use client';

import { useRef, useState } from 'react';
import type { AdminPrintDto, PrintImageDto } from '@dt/contracts';
import {
  MAX_PRINT_IMAGE_BYTES, MAX_PRINT_IMAGES, PRINT_IMAGE_CONTENT_TYPES,
} from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { compressImage } from './compress-image';
import {
  addPrintImage, deletePrintPhotoBlob, removePrintImage, reorderPrintImages, uploadPrintPhoto,
} from './api';

/**
 * Фото принта: завантаження, порядок, видалення.
 *
 * Шлях файлу: стиснення в браузері (2000 px, WebP) → маршрут вебзастосунку,
 * який заливає його у сховище → API, який реєструє адресу.
 *
 * Дві попередні спроби пояснюють, чому саме так. Завантаження напряму з
 * браузера у сховище не працює: у Blob API немає CORS, preflight не проходить.
 * Завантаження через API не працює теж: Vercel видав токен сховища тільки
 * проєкту `kudos-web`, а `kudos-api` підключений через OIDC і токена не має.
 * Тому файли обробляє той, у кого є ключ, а дані лишаються за API.
 *
 * Порядок важливий: перше фото — обкладинка в каталозі. Тому тут не «галерея»,
 * а список зі стрілками: перетягування мишею на телефоні не працює, а
 * обкладинку міняють саме з телефона, стоячи біля столу з виробами.
 */
export function PrintImageUploader({
  print, onChange,
}: { print: AdminPrintDto; onChange: (updated: AdminPrintDto) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const images = print.images;
  const slotsLeft = MAX_PRINT_IMAGES - images.length;

  async function handleFiles(fileList: FileList | null): Promise<void> {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList);
    if (files.length > slotsLeft) {
      setError(
        slotsLeft === 0
          ? `Уже ${MAX_PRINT_IMAGES} фото — більше не можна. Видаліть зайве.`
          : `Лишилось місце на ${slotsLeft} фото, а обрано ${files.length}.`,
      );
      return;
    }

    const tooBig = files.find((f) => f.size > MAX_PRINT_IMAGE_BYTES);
    if (tooBig) {
      setError(`«${tooBig.name}» важить ${mb(tooBig.size)} МБ. Максимум — ${mb(MAX_PRINT_IMAGE_BYTES)} МБ.`);
      return;
    }
    const wrongType = files.find((f) => !PRINT_IMAGE_CONTENT_TYPES.includes(f.type as never));
    if (wrongType) {
      setError(`«${wrongType.name}» — не той формат. Приймаємо JPEG, PNG, WebP і AVIF.`);
      return;
    }


    setBusy(true);
    setProgress({ done: 0, total: files.length });
    try {
      let latest = print;
      // Послідовно, а не паралельно: ліміт «пʼять» перевіряє сервер, і три
      // одночасні запити могли б проскочити повз нього вдвох.
      for (const [index, file] of files.entries()) {
        const { blob, filename } = await compressImage(file);
        const stored = await withTimeout(
          uploadPrintPhoto(print.slug, blob, filename),
          UPLOAD_TIMEOUT_MS,
          `«${file.name}» не завантажився за ${UPLOAD_TIMEOUT_MS / 1000} секунд.`,
        );
        latest = await addPrintImage(print.id, stored);
        setProgress({ done: index + 1, total: files.length });
      }
      onChange(latest);
    } catch (err) {
      // У консоль — повний об'єкт: повідомлення в інтерфейсі коротке, а
      // причина зависання зазвичай у полях, яких у ньому немає.
      console.error('Не вдалося завантажити фото', err);
      setError(messageOf(err));
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function move(index: number, direction: -1 | 1): Promise<void> {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const ids = images.map((img) => img.id);
    const moved = ids[index]!;
    ids[index] = ids[target]!;
    ids[target] = moved;

    setBusy(true);
    setError(null);
    try {
      onChange(await reorderPrintImages(print.id, ids));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(image: PrintImageDto): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      // Спершу рядок у базі, потім файл. Зворотний порядок дав би покупцеві
      // картку з битим зображенням; так найгірше — осиротілий файл у сховищі.
      onChange(await removePrintImage(print.id, image.id));
      await deletePrintPhotoBlob(image.pathname);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display font-bold text-ink">Фото</h2>
        <p className="text-sm text-ink-subtle">{images.length} з {MAX_PRINT_IMAGES}</p>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Перше фото — обкладинка: саме воно показується в каталозі, на породних
        сторінках і в пошуку. Порядок міняється стрілками.
      </p>

      {images.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="rounded-card border border-line p-2">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.alt || `${print.title} — фото ${index + 1}`}
                  className="aspect-square w-full rounded-card object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-card bg-accent px-2 py-1 text-xs font-semibold text-white">
                    Обкладинка
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  <IconButton
                    label="Раніше" disabled={busy || index === 0}
                    onClick={() => void move(index, -1)}
                  >
                    ←
                  </IconButton>
                  <IconButton
                    label="Пізніше" disabled={busy || index === images.length - 1}
                    onClick={() => void move(index, 1)}
                  >
                    →
                  </IconButton>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(image)}
                  disabled={busy}
                  className="min-h-9 rounded-card px-2 text-sm font-medium text-danger transition hover:bg-danger-soft disabled:opacity-50"
                >
                  Видалити
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={PRINT_IMAGE_CONTENT_TYPES.join(',')}
          disabled={busy || slotsLeft === 0}
          onChange={(e) => void handleFiles(e.target.files)}
          className="block w-full text-sm text-ink-muted file:mr-4 file:min-h-11 file:cursor-pointer
                     file:rounded-card file:border-0 file:bg-ink file:px-4 file:text-sm file:font-semibold
                     file:text-surface hover:file:bg-ink/90 disabled:opacity-50"
        />
        <p className="mt-2 text-sm text-ink-subtle">
          {slotsLeft === 0
            ? `Досягнуто межі в ${MAX_PRINT_IMAGES} фото.`
            : `Можна додати ще ${slotsLeft}. JPEG, PNG, WebP або AVIF, до ${mb(MAX_PRINT_IMAGE_BYTES)} МБ кожне.`}
        </p>
      </div>

      {progress && (
        <p className="mt-3 text-sm font-medium text-ink" role="status">
          Завантажуємо {progress.done + 1} з {progress.total}…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function IconButton({
  children, label, disabled, onClick,
}: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-card border border-line text-ink transition hover:border-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Скільки чекати на одне фото, перш ніж визнати, що воно не долетить.
 *
 * Завантаження, яке зависло, гірше за помилку: людина дивиться на «Завантажуємо
 * 1 з 1…» і не знає, чекати їй чи перезавантажити сторінку. Півтори хвилини —
 * із запасом навіть для повільного мобільного інтернету.
 */
const UPLOAD_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
    );
  });
}

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace('.0', '');
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Не вдалося. Спробуйте ще раз.';
}
