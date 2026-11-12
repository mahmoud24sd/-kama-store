import type { Metadata } from 'next';
import { bulkPublish, bulkTrash } from '@/app/actions/productFiles';
import FileBar from '@/components/admin/FileBar';
import ProductPick from '@/components/admin/ProductPick';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { loadList } from '@/lib/productLists';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المسودات' };

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, profile } = await requirePermission('drafts');
  const sp = await searchParams;
  const { files, rows, missing, fileNames } = await loadList(supabase, false);
  const canPublish = (['products', 'bot_publish', 'published'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'drafts'] as const).some((k) => hasPermission(profile, k));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">📝 المسودات</h1>
      <p className="text-sm text-gray-600">منتجات وملفات لسه ما اتنشرتش (مخفية عن العملاء).</p>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {missing && <p className={ui.alertError}>شغّل ملف supabase/migrations/020_product_files.sql في Supabase.</p>}
      {files.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">ملفات ({files.length})</h2>
          <div className="grid gap-3 lg:grid-cols-2">{files.map((f) => <FileBar key={f.id} f={f} back="/admin/drafts" canTrash={canTrash} />)}</div>
        </section>
      )}
      <h2 className="font-bold">المنتجات ({rows.length})</h2>
      <ProductPick rows={rows} back="/admin/drafts" fileNames={fileNames}>
        {canPublish && <button formAction={bulkPublish} className={ui.btnPrimary}>نشر للعلن</button>}
        {canTrash && <button formAction={bulkTrash} className={ui.btnDanger}>حذف (للمهملات)</button>}
      </ProductPick>
    </div>
  );
}
