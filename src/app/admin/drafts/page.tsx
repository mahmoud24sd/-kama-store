import type { Metadata } from 'next';
import { bulkEditDrafts, bulkPublish, bulkTrash } from '@/app/actions/productFiles';
import { getCategories } from '@/lib/queries';
import FolderCard from '@/components/admin/FolderCard';
import { loadFolders } from '@/lib/folders';
import ProductPick from '@/components/admin/ProductPick';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { loadList } from '@/lib/productLists';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المسودات' };

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { supabase, profile } = await requirePermission('drafts');
  const sp = await searchParams;
  const { rows, missing, fileNames } = await loadList(supabase, false);
  const { folders } = await loadFolders(supabase, 'draft');
  const cats = await getCategories();
  const canEdit = (['drafts_edit', 'products'] as const).some((k) => hasPermission(profile, k));
  const canPublish = (['products', 'bot_publish', 'published'] as const).some((k) => hasPermission(profile, k));
  const canTrash = (['products', 'drafts'] as const).some((k) => hasPermission(profile, k));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">📝 المسودات</h1>
      <p className="text-sm text-gray-600">منتجات وملفات لسه ما اتنشرتش (مخفية عن العملاء).</p>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      {missing && <p className={ui.alertError}>شغّل ملف supabase/migrations/020_product_files.sql في Supabase.</p>}
      {folders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">📁 فولدرات ({folders.length})</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {folders.map((f) => <FolderCard key={f.id} f={f} back="/admin/drafts" cats={cats} canEdit={canEdit} canPublish={canPublish} canDraft={false} canTrash={canTrash} />)}
          </div>
        </section>
      )}
      <h2 className="font-bold">المنتجات ({rows.length})</h2>
      <ProductPick
        rows={rows}
        back="/admin/drafts"
        fileNames={fileNames}
        editable={hasPermission(profile, 'products')}
        panel={canEdit ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="mb-2 text-sm font-bold">تعديل المحدّد مرة واحدة (الخانة الفاضية ما بتتغيّرش)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className={ui.label} htmlFor="be-cat">القسم</label>
                <select id="be-cat" name="category_id" defaultValue="" className={ui.input}>
                  <option value="">— من غير تغيير —</option>
                  <option value="__none">بدون قسم</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className={ui.label} htmlFor="be-brand">العلامة التجارية</label><input id="be-brand" name="brand" className={ui.input} /></div>
              <div><label className={ui.label} htmlFor="be-shop">اسم المحل</label><input id="be-shop" name="shop_name" className={ui.input} /></div>
              <div><label className={ui.label} htmlFor="be-price">سعر ثابت جديد (جنيه)</label><input id="be-price" name="price" type="number" min={1} step="any" className={ui.input} /></div>
              <div><label className={ui.label} htmlFor="be-add">زيادة / نقصان على السعر (جنيه)</label><input id="be-add" name="price_add" type="number" step="any" placeholder="مثلًا 20 أو -10" className={ui.input} /></div>
              <div><label className={ui.label} htmlFor="be-stock">المخزون</label><input id="be-stock" name="stock" type="number" min={0} step="1" className={ui.input} /></div>
            </div>
            <button formAction={bulkEditDrafts} className={`${ui.btnPrimary} mt-3`}>تطبيق التعديل على المحدّد</button>
          </div>
        ) : null}
      >
        {canPublish && <button formAction={bulkPublish} className={ui.btnPrimary}>نشر للعلن</button>}
        {canTrash && <button formAction={bulkTrash} className={ui.btnDanger}>حذف (للمهملات)</button>}
      </ProductPick>
    </div>
  );
}
