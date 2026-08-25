'use client';

import type { FabricDto } from '@dt/contracts';
import { garmentPhoto } from '../garment-photos';

/**
 * Виріб у вибраному кольорі.
 *
 * Свідомо стоїть окремо від галереї принта й ніколи з нею не змішується.
 * Галерея показує МАКЕТ — те, що людина купує; цей кадр показує НОСІЙ — те,
 * на чому макет буде. Складеного фото «цей принт на цьому худі в цьому
 * кольорі» у нас немає й не буде на кожну з чотирьохсот комбінацій, тож
 * єдине чесне рішення — показати два джерела окремо й підписати їх. Якщо
 * зсипати їх в одну карусель, покупець прочитає ряд кадрів як «ось так це
 * виглядатиме», і це буде обіцянка, якої ми не давали.
 */
export function GarmentPreview({
  garmentSlug, garmentName, colourCode, colourName, colourHex, fabric,
}: {
  garmentSlug: string;
  garmentName: string;
  colourCode: string;
  colourName: string | null;
  colourHex: string | null;
  fabric: FabricDto | undefined;
}) {
  const src = garmentPhoto(garmentSlug, colourCode);
  const colour = colourName ?? `колір ${colourCode}`;

  return (
    <figure className="mt-6 flex items-center gap-4 rounded-card border border-line bg-surface-sunken p-4">
      <div className="shrink-0">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${garmentName}, ${colour}`}
            width={96}
            height={96}
            className="h-24 w-24 object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="block h-24 w-24 rounded-card border border-line"
            style={colourHex ? { backgroundColor: colourHex } : undefined}
          />
        )}
      </div>
      <figcaption className="min-w-0 text-sm">
        <span className="block font-medium text-ink">{garmentName}</span>
        <span className="block text-ink-muted">{colour}</span>
        {fabric && (
          <span className="mt-1 block text-xs text-ink-subtle">
            {fabric.composition} · {fabric.weightGsm} г/м²
          </span>
        )}
        <span className="mt-1 block text-xs text-ink-subtle">Фото виробу без принта</span>
      </figcaption>
    </figure>
  );
}
