import type { Metadata } from 'next';
import Link from 'next/link';
import { PrintForm } from '@/features/admin-prints/print-form';

export const metadata: Metadata = { title: 'Новий принт' };

export default function NewPrintPage() {
  return (
    <div>
      <Link href="/admin/prints" className="text-sm text-ink-muted hover:underline">← Принти</Link>
      <h1 className="mt-2 text-2xl text-ink">Новий принт</h1>
      <div className="mt-6">
        <PrintForm />
      </div>
    </div>
  );
}
