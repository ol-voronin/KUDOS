'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaAssetDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { DropZone } from './drop-zone';
import { deleteMedia, listMedia, updateMedia, uploadMedia } from './media-api';

const KEY = ['admin-media'];

/**
 * Медіатека: вибір картинки або завантаження нової.
 *
 * Файли завантажуються послідовно, а не всі разом. Три знімки з телефона
 * паралельно — це три стиснення canvas одночасно й три запити по 2,5 МБ;
 * на звичайному ноутбуці вкладка на кілька секунд перестає відповідати, і
 * виглядає це як зависання.
 */
export function MediaPicker({
  onPick, onClose,
}: { onPick: (asset: MediaAssetDto) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: listMedia });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      setFailed(null);
      setProgress({ done: 0, total: files.length });
      const uploaded: MediaAssetDto[] = [];
      for (const [i, file] of files.entries()) {
        uploaded.push(await uploadMedia(file));
        setProgress({ done: i + 1, total: files.length });
      }
      return uploaded;
    },
    onSuccess: async (uploaded) => {
      setProgress(null);
      await qc.invalidateQueries({ queryKey: KEY });
      // Одну картинку одразу ставимо в поле: у 90% випадків завантажують
      // саме для того, щоб її вставити, і зайвий клік тут — це зайвий клік.
      const first = uploaded[0];
      if (uploaded.length === 1 && first) onPick(first);
    },
    onError: (e) => {
      setProgress(null);
      setFailed(e instanceof ApiError ? e.message : 'Не вдалося завантажити');
    },
  });

  const remove = useMutation({
    mutationFn: deleteMedia,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const rename = useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) => updateMedia(id, { alt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-card border border-line bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Медіатека</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
            Закрити
          </button>
        </div>

        <DropZone
          onFiles={(files) => upload.mutate(files)}
          busy={upload.isPending}
          hint="Фото стискається в браузері: довга сторона до 2000 px, WebP. Оригінал на компʼютері не змінюється."
        >
          {progress && (
            <p className="mt-3 text-sm font-medium text-ink" role="status">
              Завантажую {progress.done + 1} з {progress.total}…
            </p>
          )}
          {failed && <p className="mt-3 text-sm text-danger" role="alert">{failed}</p>}
        </DropZone>

        <div className="mt-5">
          {isLoading ? (
            <p className="text-ink-muted">Завантаження…</p>
          ) : (data?.items.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-ink-subtle">
              Поки що порожньо. Перетягніть перше фото у поле вище.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {data?.items.map((asset) => (
                <li key={asset.id} className="rounded-card border border-line p-2">
                  <button
                    type="button"
                    onClick={() => onPick(asset)}
                    className="block w-full overflow-hidden rounded-card focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url} alt={asset.alt || asset.filename}
                      className="aspect-square w-full bg-surface-sunken object-contain"
                    />
                  </button>
                  <input
                    type="text"
                    defaultValue={asset.alt}
                    placeholder="Опис картинки"
                    onBlur={(e) => {
                      if (e.target.value !== asset.alt) rename.mutate({ id: asset.id, alt: e.target.value });
                    }}
                    className="mt-2 w-full rounded-card border border-line px-2 py-1 text-xs text-ink focus:border-ink focus:outline-none"
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-subtle">
                    <span>{Math.round(asset.bytes / 1024)} КБ</span>
                    <button
                      type="button"
                      onClick={() => remove.mutate(asset.id)}
                      disabled={remove.isPending}
                      className="text-danger"
                    >
                      Видалити
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 text-xs text-ink-subtle">
          Опис картинки заповнюється тут один раз і підставляється всюди, де її вставили.
          Його читають екранні читалки й показує Google, коли фото не завантажилось.
        </p>
      </div>
    </div>
  );
}
