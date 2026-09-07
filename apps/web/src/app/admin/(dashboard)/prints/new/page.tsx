import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintForm } from '@/features/admin-prints/print-form';

export const metadata: Metadata = { title: 'Новий принт' };

/**
 * `collectionId` у адресі — місток із розділу «Колекції»: кнопка «Новий
 * принт у цю колекцію» приводить сюди, і колекція вже вибрана у формі.
 * Людина не мусить памʼятати, звідки прийшла, і шукати її в списку вдруге.
 */
export default function NewPrintPage({ searchParams }: { searchParams: { collectionId?: string } }) {
  const collectionId = searchParams.collectionId;
  return (
    <div>
      <Link href="/admin/prints" className="text-sm text-ink-muted hover:underline">← Принти</Link>
      <h1 className="mt-2 text-2xl text-ink">Новий принт</h1>
      <div className="mt-6">
        <PrintForm {...(collectionId ? { presetCollectionIds: [collectionId] } : {})} />
      </div>
    </div>
  );
}
