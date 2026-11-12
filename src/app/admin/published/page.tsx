import type { Metadata } from 'next';
import { bulkDraft, bulkTrash } from '@/app/actions/productFiles';
import FolderCard from '@/components/admin/FolderCard';
import { loadFolders } from '@/lib/folders';
import { getCategories } from '@/lib/queries';
import ProductPick from '@/components/admin/ProductPick';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { loadList } from '@/lib/productLists';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المنشور للعلن' };

export default async function PublishedPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, profile } = await requirePermission('published');
  const sp = await searchParams;
  const { rows, missing, fileNames } = await loadList(supabase, true);
  const { folders } = await loadFolders(supabase, 'public');
  const cats = await getCategories();
  const canEdit = (['drafts_edit', 'products'] as const).some((k) => hasPermission(profile, k));
  const canDraft = (['products', 'bot_publish', 'drafts'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'published'] as const).some((k) => hasPermission(profile, k));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">✅ المنشور للعلن</h1>
      <p className="text-sm text-gray-600">المنتجات والملفات الظاهرة للعملاء دلوقتي.</p>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {missing && <p className={ui.alertError}>شغّل ملف supabase/migrations/020_product_files.sql في Supabase.</p>}
      {folders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">📁 فولدرات ({folders.length})</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {folders.map((f) => <FolderCard key={f.id} f={f} back="/admin/published" cats={cats} canEdit={canEdit} canPublish={false} canDraft={canDraft} canTrash={canTrash} />)}
          </div>
        </section>
      )}
      <h2 className="font-bold">المنتجات ({rows.length})</h2>
      <ProductPick rows={rows} back="/admin/published" fileNames={fileNames}>
        {canDraft && <button formAction={bulkDraft} className={ui.btnOutline}>حفظ كمسودة</button>}
        {canTrash && <button formAction={bulkTrash} className={ui.btnDanger}>حذف (للمهملات)</button>}
      </ProductPick>
    </div>
  );
}
