import Image from 'next/image';
import { canOptimizeImage } from '@/lib/image-source';

/**
 * Якість зменшеної копії — та сама, що в картках каталогу (`print-thumb.tsx`):
 * `q` входить у ключ кешу оптимізатора, тож кожне інше значення подвоювало б
 * кількість платних трансформацій.
 */
export const IMAGE_QUALITY = 72;

/**
 * Картинка, що заповнює свою обгортку (обгортка має бути `relative` і мати
 * розмір). Наш Blob — через `next/image` із `sizes`: телефон отримує копію
 * під слот (іконка породи 56 px → ≈112 px при DPR 2 замість 900×900), і Blob
 * бачить лише перше звернення, далі віддає CDN сайту. Чужа адреса —
 * звичайним `<img>`, бо оптимізатор її не прийме (див. `image-source.ts`).
 */
export function BlobImage({
  src, alt, sizes, className = '', priority = false,
}: {
  src: string;
  alt: string;
  /** CSS-ширина слота на кожному брейкпоінті, як атрибут `sizes` у `<img>`. */
  sizes: string;
  className?: string;
  /** LCP-кадр: без lazy, з preload і `fetchpriority=high`. */
  priority?: boolean;
}) {
  if (canOptimizeImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={IMAGE_QUALITY}
        priority={priority}
        className={className}
        draggable={false}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className}`}
      draggable={false}
    />
  );
}
