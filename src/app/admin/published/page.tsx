import type { Metadata } from 'next';
import { bulkDraft, bulkTrash } from '@/app/actions/productFiles';
import Pagination, { pageNum } from '@/components/admin/Pagination';
import FolderCard from '@/components/admin/FolderCard';
import { loadFolders } from '@/lib/folders';
import { getCategories } from '@/lib/queries';
import ProductPick from '@/components/admin/ProductPick';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { loadList } from '@/lib/productLists';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المنشور للعلن' };

export default async function PublishedPage({ searchParams }: { searchParams: Promise<{ msg?: string; folder?: string; fp?: string; pp?: string }> }) {
  const { supabase, profile } = await requirePermission('published');
  const sp = await searchParams;
  const { rows, total, missing, fileNames } = await loadList(supabase, true, pageNum(sp.pp));
  const { folders, total: folderTotal } = await loadFolders(supabase, 'public', pageNum(sp.fp));
  const cats = await getCategories();
  const canEdit = (['drafts_edit', 'products'] as const).some((k) => hasPermission(profile, k));
  const canDraft = (['products', 'bot_publish', 'drafts'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'published'] as const).some((k) => hasPermission(profile, k));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">✅ المنشور للعلن</h1>
      <p className="text-sm text-gray-600">المنتجات والملفات الظاهرة للعملاء دلوقتي.</p>
      {sp.msg && !sp.folder && <p className={ui.alertOk}>{sp.msg}</p>}
      {missing && <p className={ui.alertError}>شغّل ملف supabase/migrations/020_product_files.sql في Supabase.</p>}
      {folders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">📁 فولدرات ({folders.length})</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {folders.map((f) => <FolderCard key={f.id} notice={sp.folder === f.id ? sp.msg : undefined} f={f} back="/admin/published" cats={cats} canEdit={canEdit} canPublish={false} canDraft={canDraft} canTrash={canTrash} />)}
          </div>
          <Pagination total={folderTotal} page={pageNum(sp.fp)} param="fp" sp={sp} base="/admin/published" />
        </section>
      )}
      <h2 className="font-bold">المنتجات ({total})</h2>
      <ProductPick rows={rows} back="/admin/published" fileNames={fileNames}>
        {canDraft && <button formAction={bulkDraft} className={ui.btnOutline}>حفظ كمسودة</button>}
        {canTrash && <button formAction={bulkTrash} className={ui.btnDanger}>حذف (للمهملات)</button>}
      </ProductPick>
      <Pagination total={total} page={pageNum(sp.pp)} param="pp" sp={sp} base="/admin/published" />
    </div>
  );
}
