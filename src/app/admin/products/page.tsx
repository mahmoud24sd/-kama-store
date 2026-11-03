import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { deleteProduct } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { formatPrice, totalStock } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المنتجات' };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  let query = supabase
    .from('products')
    .select('*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku)')
    .order('created_at', { ascending: false })
    .limit(200);
  const term = sp.q?.replace(/[,()%_\\*]/g, ' ').trim();
  if (term) query = query.ilike('name', `%${term}%`);
  const { data } = await query;
  const products = (data ?? []) as unknown as Product[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">المنتجات ({products.length})</h1>
        <Link href="/admin/products/new" className={ui.btnPrimary}><Plus className="h-4 w-4" /> منتج جديد</Link>
      </div>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="ابحث بالاسم..." className={ui.input} />
        <button className={ui.btnOutline}>بحث</button>
      </form>

      {products.length === 0 ? (
        <p className="py-8 text-center text-gray-500">لا توجد منتجات.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={ui.th}>المنتج</th><th className={ui.th}>القسم</th><th className={ui.th}>السعر</th>
                <th className={ui.th}>المخزون</th><th className={ui.th}>الحالة</th><th className={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const stock = totalStock(p);
                return (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className={ui.td}><Link href={`/admin/products/${p.id}`} className="font-semibold text-brand-600 hover:underline">{p.name}</Link></td>
                    <td className={ui.td}>{p.categories?.name ?? '—'}</td>
                    <td className={ui.td}>{formatPrice(p.price)}</td>
                    <td className={`${ui.td} ${stock <= 5 ? 'font-bold text-red-600' : ''}`}>{stock}</td>
                    <td className={ui.td}>{p.is_active ? <span className="text-green-700">ظاهر</span> : <span className="text-gray-400">مخفي</span>}</td>
                    <td className={ui.td}>
                      <div className="flex gap-2">
                        <Link href={`/admin/products/${p.id}`} className={ui.btnOutline}>تعديل</Link>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className={ui.btnDanger}>حذف</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
