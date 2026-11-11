import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateOrderStatus } from '@/app/actions/admin';
import { requireAdmin } from '@/lib/auth';
import OrderTimeline from '@/components/orders/OrderTimeline';
import type { Order, OrderEvent } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, ui } from '@/lib/ui';
import { getSiteUrl } from '@/lib/site';
import { buildOrderMessage, waLink } from '@/lib/whatsapp';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [{ id }, sp, { supabase }] = await Promise.all([params, searchParams, requireAdmin()]);
  if (!UUID.test(id)) notFound();

  const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const order = data as unknown as Order;
  const { data: eventRows } = await supabase.from('order_events').select('*').eq('order_id', id).order('created_at', { ascending: true });
  const events = (eventRows ?? []) as OrderEvent[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold" dir="ltr">{order.order_number}</h1>
        <Link href="/admin/orders" className="text-sm text-brand-600 hover:underline">← كل الطلبات</Link>
      </div>
      {sp.saved && <p className={ui.alertOk}>تم تحديث الطلب.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 p-4 text-sm">
          <h2 className="mb-2 font-bold">بيانات العميل والشحن</h2>
          <p>{order.ship_name}</p>
          <p dir="ltr" className="text-end">{order.ship_phone}</p>
          <p className="mt-1 text-gray-700">{order.ship_line1}، {order.ship_city}، {order.ship_governorate}</p>
          {order.notes && <p className="mt-2 rounded bg-gray-50 p-2 text-gray-600">ملاحظات: {order.notes}</p>}
          <p className="mt-2 text-xs text-gray-500">{formatDate(order.created_at)} · شحن {order.shipping_method === 'express' ? 'سريع' : 'عادي'}</p>
        </section>

        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 font-bold">تحديث الحالة</h2>
          <form action={updateOrderStatus} className="space-y-3">
            <input type="hidden" name="id" value={order.id} />
            <div>
              <label className={ui.label} htmlFor="status">حالة الطلب</label>
              <select id="status" name="status" defaultValue={order.status} className={ui.input}>
                {Object.entries(ORDER_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={ui.label} htmlFor="payment_status">حالة الدفع ({order.payment_method === 'cod' ? 'عند الاستلام' : 'بطاقة'})</label>
              <select id="payment_status" name="payment_status" defaultValue={order.payment_status} className={ui.input}>
                {Object.entries(PAYMENT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={ui.label} htmlFor="note">ملاحظة التسليم (اسم المندوب / تفاصيل) — تظهر للعميل</label>
              <input id="note" name="note" maxLength={300} placeholder="مثال: سلّمه المندوب أحمد للعميل" className={ui.input} />
            </div>
            <p className="text-xs text-gray-500">عند اختيار «ملغي» يُعاد المخزون تلقائيًا. عند ضغط المندوب على «تم التسليم» اختر الحالة «تم التسليم» واحفظ.</p>
            <button className={ui.btnDark}>حفظ</button>
          </form>
          <a
            href={waLink(order.ship_phone, buildOrderMessage(order.ship_name, order.order_number, ORDER_STATUS_LABEL[order.status] ?? order.status, getSiteUrl(), events[events.length - 1]?.note))}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ui.btnOutline} mt-3 inline-block`}
          >
            أبلغ العميل بالحالة على واتساب
          </a>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 font-bold">مراحل الطلب (كما يراها العميل)</h2>
        <OrderTimeline createdAt={order.created_at} events={events} />
      </section>

      <section>
        <h2 className="mb-2 font-bold">المنتجات</h2>
        <table className="w-full">
          <thead><tr className="border-b border-gray-200"><th className={ui.th}>المنتج</th><th className={ui.th}>السعر</th><th className={ui.th}>الكمية</th><th className={ui.th}>الإجمالي</th></tr></thead>
          <tbody>
            {(order.order_items ?? []).map((it) => (
              <tr key={it.id} className="border-b border-gray-100">
                <td className={ui.td}>{it.name}{it.variant_label && <span className="block text-xs text-gray-500">{it.variant_label}</span>}</td>
                <td className={ui.td}>{formatPrice(it.unit_price)}</td>
                <td className={ui.td}>{it.quantity}</td>
                <td className={ui.td}>{formatPrice(it.unit_price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ms-auto mt-3 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>المجموع الفرعي</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between"><dt>الخصم {order.coupon_code && `(${order.coupon_code})`}</dt><dd>- {formatPrice(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt>الشحن</dt><dd>{formatPrice(order.shipping)}</dd></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-extrabold"><dt>الإجمالي</dt><dd>{formatPrice(order.total)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
