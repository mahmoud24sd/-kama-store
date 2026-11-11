import type { Metadata } from 'next';
import { updateStock } from '@/app/actions/admin';
import { requirePermission } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المخزون' };

function StockForm({ kind, id, stock }: { kind: 'product' | 'variant'; id: string; stock: number }) {
  return (
    <form action={updateStock} className="flex items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input name="stock" type="number" min={0} step={1} defaultValue={stock} aria-label="المخزون" className={`${ui.input} !w-24 ${stock <= 5 ? 'border-red-300 bg-red-50' : ''}`} />
      <button className={ui.btnOutline}>حفظ</button>
    </form>
  );
}

export default async function AdminInventory({ searchParams }: { searchParams: Promise<{ saved?: string; low?: string }> }) {
  const { supabase } = await requirePermission('inventory');
  const sp = await searchParams;
  const { data } = await supabase
    .from('products')
    .select('id,name,stock,is_active,product_variants(id,product_id,color,size,price_override,stock,sku)')
    .order('name')
    .limit(500);
  let products = (data ?? []) as unknown as Pick<Product, 'id' | 'name' | 'stock' | 'is_active' | 'product_variants'>[];
  if (sp.low) {
    products = products.filter((p) => (p.product_variants.length ? p.product_variants.some((v) => v.stock <= 5) : p.stock <= 5));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">المخزون</h1>
        <a href={sp.low ? '/admin/inventory' : '/admin/inventory?low=1'} className={ui.btnOutline}>
          {sp.low ? 'عرض الكل' : 'المخزون المنخفض فقط (≤ 5)'}
        </a>
      </div>
      {sp.saved && <p className={ui.alertOk}>تم تحديث المخزون.</p>}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-gray-200"><th className={ui.th}>المنتج</th><th className={ui.th}>الخيار</th><th className={ui.th}>المخزون</th></tr></thead>
          <tbody>
            {products.flatMap((p) =>
              p.product_variants.length === 0
                ? [
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className={ui.td}>{p.name}{!p.is_active && <span className="ms-2 text-xs text-gray-400">(مخفي)</span>}</td>
                      <td className={ui.td}>—</td>
                      <td className={ui.td}><StockForm kind="product" id={p.id} stock={p.stock} /></td>
                    </tr>,
                  ]
                : p.product_variants.map((v) => (
                    <tr key={v.id} className="border-b border-gray-100">
                      <td className={ui.td}>{p.name}</td>
                      <td className={ui.td}>{[v.color, v.size].filter(Boolean).join(' / ')}</td>
                      <td className={ui.td}><StockForm kind="variant" id={v.id} stock={v.stock} /></td>
                    </tr>
                  )),
            )}
          </tbody>
        </table>
        {products.length === 0 && <p className="py-8 text-center text-gray-500">لا توجد منتجات.</p>}
      </div>
    </div>
  );
}
