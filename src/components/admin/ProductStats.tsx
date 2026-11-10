import Link from 'next/link';
import { Flame, UserCheck } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

type Trending = { id: string; name: string; category: string | null; sold_total: number; units_30d: number; revenue_30d: number };
type PublisherRow = { admin_id: string | null; admin_name: string | null; category: string; products: number };
export type ProductStatsData = { trending?: Trending[]; publishers?: PublisherRow[] };

/** قسمان في لوحة الإحصائيات: المنتجات الأكثر انتشارًا، ومن نشر كم منتج في أي قسم */
export default function ProductStats({ data, failed }: { data: ProductStatsData | null; failed: boolean }) {
  if (failed || !data) {
    return (
      <p className={ui.alertError}>
        تعذّر تحميل إحصائيات المنتجات. شغّل ملف <code dir="ltr">supabase/migrations/008_product_stats.sql</code> مرة واحدة في Supabase.
      </p>
    );
  }

  const trending = data.trending ?? [];
  const byAdmin = new Map<string, { name: string; total: number; cats: { category: string; products: number }[] }>();
  for (const r of data.publishers ?? []) {
    const key = r.admin_id ?? 'unknown';
    const entry = byAdmin.get(key) ?? { name: r.admin_id ? r.admin_name || 'أدمن' : 'غير محدد (منتجات قبل بدء التتبع)', total: 0, cats: [] };
    entry.total += Number(r.products);
    entry.cats.push({ category: r.category, products: Number(r.products) });
    byAdmin.set(key, entry);
  }
  const admins = [...byAdmin.values()].sort((a, b) => b.total - a.total);

  return (
    <>
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold"><Flame className="h-5 w-5 text-orange-500" /> المنتجات الأكثر انتشارًا</h2>
        {trending.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد مبيعات بعد. ستظهر هنا المنتجات الأكثر طلبًا فور تسجيل أول طلبات.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={ui.th}>#</th><th className={ui.th}>المنتج</th><th className={ui.th}>القسم</th>
                  <th className={ui.th}>مبيعات آخر 30 يومًا</th><th className={ui.th}>إيراد 30 يومًا</th><th className={ui.th}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {trending.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className={ui.td}>{i + 1}</td>
                    <td className={ui.td}><Link href={`/admin/products/${p.id}`} className="font-semibold text-brand-600 hover:underline">{p.name}</Link></td>
                    <td className={ui.td}>{p.category || '—'}</td>
                    <td className={ui.td}>{Number(p.units_30d)} قطعة</td>
                    <td className={ui.td}>{formatPrice(Number(p.revenue_30d))}</td>
                    <td className={ui.td}>{Number(p.sold_total)} قطعة</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 font-bold"><UserCheck className="h-5 w-5 text-brand-600" /> من نشر كم منتج (حسب القسم)</h2>
        <p className="mb-3 text-xs text-gray-500">يُحسب عدد المنتجات المنشورة حاليًا في المتجر لكل أدمن. المنتجات المنشورة قبل تفعيل هذه الميزة تظهر تحت «غير محدد».</p>
        {admins.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد منتجات منشورة بعد.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {admins.map((a) => (
              <div key={a.name} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold">{a.name}</p>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">{a.total} منتج</span>
                </div>
                <ul className="space-y-1 text-sm text-gray-700">
                  {a.cats.map((c) => (
                    <li key={c.category} className="flex justify-between border-t border-gray-100 pt-1">
                      <span>{c.category}</span><span className="font-semibold">{c.products}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
