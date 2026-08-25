'use client';

import { useCallback, useRef, useState } from 'react';
import type { MediaAssetDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { uploadMedia } from './media-api';
import { MediaPicker } from './media-picker';

/**
 * Місце під картинку прямо у формі блока.
 *
 * Приймає файл трьома способами, і всі три — та сама дія з погляду людини:
 * перетягнути з робочого столу сюди, вибрати з медіатеки, або відкрити
 * провідник. Перетягування працює просто в поле, без відкривання медіатеки:
 * саме так це роблять у більшості випадків, і змушувати відкрити вікно,
 * щоб покласти файл, — зайвий крок на порожньому місці.
 *
 * Завантажений файл одразу реєструється в медіатеці, тож наступного разу
 * його можна взяти звідти, а не заливати вдруге.
 */
export function ImageDropTarget({
  url, alt, onPick, onClear, compact = false,
}: {
  url: string;
  alt: string;
  onPick: (asset: MediaAssetDto) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const depth = useRef(0);

  const upload = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      onPick(await uploadMedia(file));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не вдалося завантажити');
    } finally {
      setBusy(false);
    }
  }, [onPick]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) void upload(file);
  };

  return (
    <>
      <div
        onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragLeave={(e) => {
          e.preventDefault();
          depth.current -= 1;
          if (depth.current <= 0) { depth.current = 0; setOver(false); }
        }}
        onDrop={onDrop}
        className={[
          'flex items-center gap-3 rounded-card border-2 border-dashed p-3 transition',
          over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-sunken',
          busy ? 'opacity-60' : '',
        ].join(' ')}
      >
        {url !== '' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url} alt={alt}
            className={`${compact ? 'h-14 w-14' : 'h-20 w-20'} shrink-0 rounded-card bg-surface object-contain`}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`${compact ? 'h-14 w-14' : 'h-20 w-20'} shrink-0 rounded-card border border-line bg-surface`}
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            {busy ? 'Завантажую…' : over ? 'Відпустіть' : url !== '' ? 'Картинка на місці' : 'Перетягніть фото сюди'}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            <button
              type="button" onClick={() => setPicking(true)} disabled={busy}
              className="font-medium text-ink underline underline-offset-2"
            >
              Вибрати з медіатеки
            </button>
            {url !== '' && (
              <button type="button" onClick={onClear} className="text-danger">Прибрати</button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
        </div>
      </div>

      {picking && (
        <MediaPicker
          onPick={(asset) => { onPick(asset); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
