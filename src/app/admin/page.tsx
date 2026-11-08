import Link from 'next/link';
import { AlertTriangle, DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import type { Order } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, ui } from '@/lib/ui';

type Stats = {
  total_sales: number;
  orders_count: number;
  pending_orders: number;
  customers_count: number;
  products_count: number;
  low_stock: number;
  sales_by_day: { day: string; total: number; orders: number }[];
};

export default async function AdminDashboard() {
  const { supabase } = await requirePermission('dashboard');
  const [{ data: stats, error }, { data: recent }] = await Promise.all([
    supabase.rpc('admin_stats'),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(8),
  ]);

  if (error || !stats) {
    return <p className={ui.alertError}>تعذر تحميل الإحصائيات. تأكد من تشغيل supabase/schema.sql بالكامل.</p>;
  }

  const s = stats as Stats;
  const orders = (recent ?? []) as Order[];
  const maxDay = Math.max(1, ...s.sales_by_day.map((d) => Number(d.total)));

  const cards = [
    { label: 'إجمالي المبيعات', value: formatPrice(Number(s.total_sales)), icon: DollarSign, color: 'bg-green-100 text-green-700' },
    { label: 'إجمالي الطلبات', value: String(s.orders_count), sub: `${s.pending_orders} قيد المراجعة`, icon: ShoppingBag, color: 'bg-blue-100 text-blue-700' },
    { label: 'العملاء', value: String(s.customers_count), icon: Users, color: 'bg-purple-100 text-purple-700' },
    { label: 'المنتجات', value: String(s.products_count), sub: s.low_stock > 0 ? `${s.low_stock} مخزون منخفض` : undefined, icon: Package, color: 'bg-amber-100 text-amber-700' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">الإحصائيات</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 p-4">
            <span className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color}`}><c.icon className="h-5 w-5" /></span>
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-xl font-extrabold">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-500">{c.sub}</p>}
          </div>
        ))}
      </div>

      {s.low_stock > 0 && (
        <Link href="/admin/inventory" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <AlertTriangle className="h-5 w-5" /> {s.low_stock} منتج مخزونه 5 قطع أو أقل — راجع المخزون
        </Link>
      )}

      <section>
        <h2 className="mb-3 font-bold">المبيعات آخر 14 يومًا</h2>
        {s.sales_by_day.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد مبيعات في هذه الفترة.</p>
        ) : (
          <div className="flex h-40 items-end gap-2 rounded-xl border border-gray-200 p-3" role="img" aria-label="رسم بياني للمبيعات اليومية">
            {s.sales_by_day.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${formatPrice(Number(d.total))} (${d.orders} طلب)`}>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.max(4, (Number(d.total) / maxDay) * 100)}%` }} />
                <span className="text-[10px] text-gray-500" dir="ltr">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">أحدث الطلبات</h2>
          <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">عرض الكل</Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد طلبات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-gray-200"><th className={ui.th}>رقم الطلب</th><th className={ui.th}>العميل</th><th className={ui.th}>التاريخ</th><th className={ui.th}>الحالة</th><th className={ui.th}>الإجمالي</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-100">
                    <td className={ui.td}><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-600 hover:underline" dir="ltr">{o.order_number}</Link></td>
                    <td className={ui.td}>{o.ship_name}</td>
                    <td className={ui.td}>{formatDate(o.created_at)}</td>
                    <td className={ui.td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ORDER_STATUS_COLOR[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                    <td className={ui.td}>{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
