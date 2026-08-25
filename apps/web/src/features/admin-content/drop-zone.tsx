'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Область, у яку можна перетягнути файли.
 *
 * Три речі, які роблять перетягування або зручним, або дратівливим.
 *
 * Лічильник входів. Браузер шле `dragleave` щоразу, коли курсор перетинає
 * межу будь-якого дочірнього елемента — а їх усередині повно. Без лічильника
 * підсвітка блимає, поки ведеш файл над зоною, і виглядає це як несправність.
 *
 * `preventDefault` на `dragover` обовʼязковий. Без нього браузер вважає, що
 * тут нічого не приймають: курсор показує заборону, а на відпускання
 * сторінка просто відкриє картинку замість того, щоб її завантажити.
 *
 * Вставка з буфера. Знімок екрана рідко існує файлом — його копіюють. Тому
 * Ctrl+V ловиться теж, поки область на екрані.
 */
export function DropZone({
  onFiles, busy, hint, children,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  hint?: string;
  children?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);

  const accept = useCallback((list: FileList | null) => {
    if (!list) return;
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) onFiles(files);
  }, [onFiles]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length > 0) { e.preventDefault(); onFiles(files); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFiles]);

  return (
    <div
      ref={zone}
      onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setOver(true); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) { depth.current = 0; setOver(false); }
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        accept(e.dataTransfer.files);
      }}
      className={[
        'rounded-card border-2 border-dashed p-6 text-center transition',
        over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-sunken',
        busy ? 'opacity-60' : '',
      ].join(' ')}
    >
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => { accept(e.target.files); e.target.value = ''; }}
      />

      <p className="text-sm font-medium text-ink">
        {over ? 'Відпустіть — завантажимо' : 'Перетягніть фото сюди'}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        або{' '}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="font-medium text-ink underline underline-offset-2"
        >
          виберіть на компʼютері
        </button>
        {' '}· можна вставити з буфера через Ctrl+V
      </p>
      {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
      {children}
    </div>
  );
}
