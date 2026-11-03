import type { Metadata } from 'next';
import { saveOffer } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { discountPercent, formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'العروض' };

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminOffers({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const { data } = await supabase
    .from('products')
    .select('id,name,price,compare_at_price,is_deal,deal_ends_at')
    .order('is_deal', { ascending: false })
    .order('name')
    .limit(300);
  const products = (data ?? []) as Pick<Product, 'id' | 'name' | 'price' | 'compare_at_price' | 'is_deal' | 'deal_ends_at'>[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">العروض</h1>
      <p className="text-sm text-gray-600">فعّل «عروض اليوم» لأي منتج بإدخال سعر قبل الخصم أكبر من السعر الحالي. السعر الحالي يُعدَّل من صفحة المنتج.</p>
      {sp.saved && <p className={ui.alertOk}>تم حفظ العرض.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      {products.length === 0 ? (
        <p className="py-8 text-center text-gray-500">لا توجد منتجات.</p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-200 p-3">
              <form action={saveOffer} className="grid items-end gap-3 md:grid-cols-[1fr_9rem_13rem_auto_auto]">
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    السعر الحالي {formatPrice(p.price)}
                    {p.compare_at_price && p.compare_at_price > p.price && ` · خصم ${discountPercent(p.price, p.compare_at_price)}%`}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500" htmlFor={`c-${p.id}`}>السعر قبل الخصم</label>
                  <input id={`c-${p.id}`} name="compare_at_price" type="number" step="0.01" min="0" defaultValue={p.compare_at_price ?? ''} className={ui.input} />
                </div>
                <div>
                  <label className="text-xs text-gray-500" htmlFor={`e-${p.id}`}>ينتهي العرض</label>
                  <input id={`e-${p.id}`} name="deal_ends_at" type="datetime-local" defaultValue={toLocalInput(p.deal_ends_at)} className={ui.input} />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="is_deal" defaultChecked={p.is_deal} /> عرض اليوم</label>
                <button className={ui.btnDark}>حفظ</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
