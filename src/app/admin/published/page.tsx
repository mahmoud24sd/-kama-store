import type { Metadata } from 'next';
import { bulkDraft, bulkTrash } from '@/app/actions/productFiles';
import Pagination, { pageNum } from '@/components/admin/Pagination';
import FolderTree from '@/components/admin/FolderTree';
import { loadFolders } from '@/lib/folders';
import { getAllCategories } from '@/lib/queries';
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
  const { folders } = await loadFolders(supabase, 'public', 1, 300, 12);
  const cats = await getAllCategories();
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
          <FolderTree folders={folders} back="/admin/published" cats={cats} canEdit={canEdit} canPublish={false} canDraft={canDraft} canTrash={canTrash} noticeFolder={sp.folder} notice={sp.msg} />
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
