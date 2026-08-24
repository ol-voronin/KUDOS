'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PrintForm } from '@/features/admin-prints/print-form';
import { getPrint } from '@/features/admin-prints/api';

export default function EditPrintPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-print', id],
    queryFn: () => getPrint(id),
    enabled: id.length > 0,
  });

  return (
    <div>
      <Link href="/admin/prints" className="text-sm text-ink-muted hover:underline">← Принти</Link>
      {isLoading && <p className="mt-6 text-ink-muted">Завантаження…</p>}
      {isError && <p className="mt-6 text-danger">Принт не знайдено.</p>}
      {data && (
        <>
          <h1 className="mt-2 text-2xl text-ink">{data.title}</h1>
          <p className="mt-1 text-sm text-ink-subtle">/prints/{data.slug}</p>
          <div className="mt-6">
            <PrintForm initial={data} />
          </div>
        </>
      )}
    </div>
  );
}
