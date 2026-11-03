import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import type { Order } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الطلبات' };

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; error?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) query = query.eq('status', sp.status);
  const term = sp.q?.replace(/[,()%_\\*]/g, ' ').trim();
  if (term) query = query.or(`order_number.ilike.%${term}%,ship_name.ilike.%${term}%,ship_phone.ilike.%${term}%`);
  const { data } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">الطلبات</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/orders" className={`rounded-full border px-3 py-1 text-sm ${!sp.status ? 'border-brand-700 bg-brand-800 text-white' : 'border-gray-300'}`}>الكل</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className={`rounded-full border px-3 py-1 text-sm ${sp.status === s ? 'border-brand-700 bg-brand-800 text-white' : 'border-gray-300'}`}>
            {ORDER_STATUS_LABEL[s]}
          </Link>
        ))}
        <form className="ms-auto flex gap-2" role="search">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q} placeholder="رقم الطلب / الاسم / الهاتف" className={ui.input} />
          <button className={ui.btnOutline}>بحث</button>
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="py-8 text-center text-gray-500">لا توجد طلبات.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={ui.th}>رقم الطلب</th><th className={ui.th}>العميل</th><th className={ui.th}>التاريخ</th>
                <th className={ui.th}>الحالة</th><th className={ui.th}>الدفع</th><th className={ui.th}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-100">
                  <td className={ui.td}><Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand-600 hover:underline" dir="ltr">{o.order_number}</Link></td>
                  <td className={ui.td}>{o.ship_name}<span className="block text-xs text-gray-500" dir="ltr">{o.ship_phone}</span></td>
                  <td className={ui.td}>{formatDate(o.created_at)}</td>
                  <td className={ui.td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ORDER_STATUS_COLOR[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                  <td className={ui.td}>{o.payment_method === 'cod' ? 'عند الاستلام' : 'بطاقة'} · {PAYMENT_STATUS_LABEL[o.payment_status]}</td>
                  <td className={ui.td}>{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
