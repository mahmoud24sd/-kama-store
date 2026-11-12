import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { bulkPublish, bulkDraft, bulkTrash } from '@/app/actions/productFiles';
import FileBar, { type FileRow } from '@/components/admin/FileBar';
import SelectAll from '@/components/admin/SelectAll';
import { requireAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import ProductGrid from '@/components/product/ProductGrid';
import type { Product } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'ملف منتجات' };

export default async function FilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const canProducts = hasPermission(profile, 'products');
  if (!(['products', 'bot_publish', 'drafts', 'published', 'files'] as const).some((k) => hasPermission(profile, k))) redirect('/admin/no-access');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: f } = await supabase.from('product_files').select('id,name,source,markup,is_public,created_at,deleted_at').eq('id', id).maybeSingle();
  if (!f || f.deleted_at) notFound();
  const { data } = await supabase
    .from('products')
    .select('id,name,price,base_price,is_active,published_at,product_images(url,sort_order)')
    .eq('file_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1000);
  type P = { id: string; name: string; price: number; base_price: number | null; is_active: boolean; published_at: string | null; product_images: { url: string; sort_order: number }[] };
  const products = (data ?? []) as unknown as P[];
  const { data: full } = await supabase
    .from('products')
    .select('*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku)')
    .eq('file_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(48);
  const preview = (full ?? []) as unknown as Product[];
  const row: FileRow = { ...(f as Omit<FileRow, 'count'>), markup: Number(f.markup), count: products.length };
  const back = `/admin/products/files/${id}`;

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="text-sm text-brand-600 hover:underline">← المنتجات</Link>
      {sp.msg && <p className={ui.alertOk}>{sp.msg}</p>}
      <FileBar f={row} back={back} canTrash={canProducts} detail />
      {f.is_public && <p className="text-sm">رابط الملف للعلن: <Link href={`/files/${id}`} className="font-bold text-brand-600 underline" dir="ltr">/files/{id.slice(0, 8)}…</Link></p>}

      {!f.is_public && preview.length > 0 && (
        <section className="space-y-2 rounded-xl border-2 border-dashed border-amber-300 p-3">
          <h2 className="font-extrabold">👁 معاينة: كده هتظهر المنتجات للعملاء بعد النشر</h2>
          <ProductGrid products={preview} />
        </section>
      )}

      <form className="space-y-2">
        <input type="hidden" name="back" value={back} />
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 text-sm">
          <span className="font-bold">المحدّد:</span>
          <button formAction={bulkPublish} className={ui.btnPrimary}>نشر للعلن</button>
          <button formAction={bulkDraft} className={ui.btnOutline}>حفظ كمسودة</button>
          {canProducts && <button formAction={bulkTrash} className={ui.btnDanger}>حذف (للمهملات)</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={ui.th}><SelectAll /></th><th className={ui.th}>الصورة</th><th className={ui.th}>المنتج</th>
                <th className={ui.th}>السعر الأصلي</th><th className={ui.th}>السعر بعد الزيادة</th><th className={ui.th}>الحالة</th><th className={ui.th}>وقت النشر</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const img = [...(p.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url;
                return (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className={ui.td}><input type="checkbox" name="ids" value={p.id} aria-label="تحديد" /></td>
                    <td className={ui.td}>{img ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="h-12 w-12 rounded object-cover" /> : <span className="text-xs text-red-600">بدون صورة</span>}</td>
                    <td className={ui.td}>{canProducts ? <Link href={`/admin/products/${p.id}`} className="font-semibold text-brand-600 hover:underline">{p.name}</Link> : p.name}</td>
                    <td className={ui.td}>{p.base_price != null ? formatPrice(p.base_price) : '—'}</td>
                    <td className={ui.td}>{formatPrice(p.price)}</td>
                    <td className={ui.td}>{p.is_active ? <span className="text-green-700">ظاهر</span> : <span className="text-gray-400">مسودة</span>}</td>
                    <td className={`${ui.td} text-xs text-gray-600`}>{p.published_at ? new Date(p.published_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
