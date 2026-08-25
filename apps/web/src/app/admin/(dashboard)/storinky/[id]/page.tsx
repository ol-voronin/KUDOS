import type { Metadata } from 'next';
import { PageEditor } from '@/features/admin-content/page-editor';

export const metadata: Metadata = { title: 'Редагування сторінки · адмін' };

export default function EditPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-4xl">
      <PageEditor id={params.id} />
    </div>
  );
}
