import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { bulkPublish, bulkDraft, bulkTrash } from '@/app/actions/productFiles';
import SelectAll from '@/components/admin/SelectAll';
import { hasPermission } from '@/lib/permissions';
import { requireAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Product } from '@/lib/types';
import { formatPrice, totalStock } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المنتجات' };

type Row = Product & { file_id?: string | null; published_at?: string | null; deleted_at?: string | null };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; msg?: string }> }) {
  const { supabase, profile } = await requireAdmin();
  const canProducts = hasPermission(profile, 'products');
  const canBot = hasPermission(profile, 'bot_publish');
  if (!canProducts && !canBot) redirect('/admin/no-access');
  const sp = await searchParams;

  const term = sp.q?.replace(/[,()%_\\*]/g, ' ').trim();
  const build = (withDeleted: boolean) => {
    let q = supabase
      .from('products')
      .select('*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (withDeleted) q = q.is('deleted_at', null);
    if (term) q = q.ilike('name', `%${term}%`);
    return q;
  };
  let res = await build(true);
  if (res.error) res = await build(false); // قبل تشغيل ملف 020
  const products = (res.data ?? []) as unknown as Row[];

  const fileName = new Map<string, string>();

  const { data: pubs } = await supabase.from('profiles').select('id,full_name,email').in('id', [...new Set(products.map((p) => (p as unknown as { published_by?: string }).published_by).filter(Boolean) as string[])].slice(0, 200));
  const pubName = new Map((pubs ?? []).map((u) => [u.id as string, (u.full_name as string) || (u.email as string) || '']));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">المنتجات ({products.length})</h1>
        <div className="flex flex-wrap gap-2">
          {hasPermission(profile, 'trash') && <Link href="/admin/trash" className={ui.btnOutline}>🗑 المهملات</Link>}
          {canProducts && <Link href="/admin/products/import" className={ui.btnOutline}>رفع ملف (إكسل / CSV / JSON)</Link>}
          {canProducts && <Link href="/admin/products/new" className={ui.btnPrimary}><Plus className="h-4 w-4" /> منتج جديد</Link>}
        </div>
      </div>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}

      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="ابحث بالاسم..." className={ui.input} />
        <button className={ui.btnOutline}>بحث</button>
      </form>

      {products.length === 0 ? (
        <p className="py-8 text-center text-gray-500">لا توجد منتجات.</p>
      ) : (
        <form className="space-y-2">
          <input type="hidden" name="back" value="/admin/products" />
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 text-sm">
            <span className="font-bold">المحدّد:</span>
            <button formAction={bulkPublish} className={ui.btnPrimary}>نشر للعلن</button>
            <button formAction={bulkDraft} className={ui.btnOutline}>حفظ كمسودة</button>
            {canProducts && <button formAction={bulkTrash} className={ui.btnDanger}>حذف (للمهملات)</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={ui.th}><SelectAll /></th>
                  <th className={ui.th}>المنتج</th><th className={ui.th}>القسم</th><th className={ui.th}>السعر</th>
                  <th className={ui.th}>المخزون</th><th className={ui.th}>الحالة</th><th className={ui.th}>وقت النشر</th><th className={ui.th}></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stock = totalStock(p);
                  const by = (p as unknown as { published_by?: string }).published_by;
                  return (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className={ui.td}><input type="checkbox" name="ids" value={p.id} aria-label="تحديد" /></td>
                      <td className={ui.td}>
                        <Link href={`/admin/products/${p.id}`} className="font-semibold text-brand-600 hover:underline">{p.name}</Link>
                        {p.file_id && fileName.get(p.file_id) && <div className="text-xs text-gray-500">📄 <Link href={`/admin/products/files/${p.file_id}`} className="hover:underline">{fileName.get(p.file_id)}</Link></div>}
                      </td>
                      <td className={ui.td}>{p.categories?.name ?? '—'}</td>
                      <td className={ui.td}>{formatPrice(p.price)}</td>
                      <td className={`${ui.td} ${stock <= 5 ? 'font-bold text-red-600' : ''}`}>{stock}</td>
                      <td className={ui.td}>{p.is_active ? <span className="text-green-700">ظاهر</span> : <span className="text-gray-400">مسودة</span>}</td>
                      <td className={`${ui.td} text-xs text-gray-600`}>
                        {p.published_at ? (
                          <>
                            {new Date(p.published_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                            {by && pubName.get(by) ? <div>{pubName.get(by)}</div> : null}
                          </>
                        ) : '—'}
                      </td>
                      <td className={ui.td}><Link href={`/admin/products/${p.id}`} className={ui.btnOutline}>تعديل</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </div>
  );
}
