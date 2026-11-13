import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import OrderTimeline from '@/components/orders/OrderTimeline';
import type { Order, OrderEvent } from '@/lib/types';
import { formatDate, formatPrice, safeImageUrl } from '@/lib/utils';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'طلباتي' };

export default async function OrdersPage() {
  const user = await requireUser('/account/orders');
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  const orders = (data ?? []) as unknown as Order[];

  // مراحل كل طلب (تُجلب بشكل منفصل حتى لا تتعطل الصفحة لو الجدول غير جاهز)
  const eventsByOrder = new Map<string, OrderEvent[]>();
  if (orders.length > 0) {
    const { data: ev } = await supabase
      .from('order_events')
      .select('*')
      .in('order_id', orders.map((o) => o.id))
      .order('created_at', { ascending: true });
    ((ev ?? []) as OrderEvent[]).forEach((e) => eventsByOrder.set(e.order_id, [...(eventsByOrder.get(e.order_id) ?? []), e]));
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">طلباتي</h1>
      {orders.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-600">لم تقم بأي طلب بعد.</p>
          <Link href="/products" className={`${ui.btnPrimary} mt-4`}>ابدأ التسوق</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-3 text-sm">
                <div>
                  <p className="font-bold" dir="ltr">{o.order_number}</p>
                  <p className="text-xs text-gray-500">{formatDate(o.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${ORDER_STATUS_COLOR[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                  <span className="text-xs text-gray-500">{PAYMENT_STATUS_LABEL[o.payment_status]}</span>
                </div>
                <p className="font-extrabold">{formatPrice(o.total)}</p>
              </div>
              <ul className="divide-y divide-gray-100 px-4">
                {(o.order_items ?? []).map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                      {safeImageUrl(it.image_url) ? <Image src={safeImageUrl(it.image_url) as string} alt="" fill sizes="48px" className="object-contain p-1" /> : <span className="flex h-full items-center justify-center text-gray-300"><ImageOff className="h-5 w-5" /></span>}
                    </span>
                    <span className="flex-1">
                      {it.name}
                      {it.variant_label && <span className="block text-xs text-gray-500">{it.variant_label}</span>}
                    </span>
                    <span className="text-gray-500">× {it.quantity}</span>
                    <span className="font-semibold">{formatPrice(it.unit_price * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              {o.status === 'delivered' && (
                <p className="border-t border-green-100 bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
                  ✓ تم تسليم هذا الطلب{(() => {
                    const done = (eventsByOrder.get(o.id) ?? []).filter((e) => e.status === 'delivered').slice(-1)[0];
                    return done ? ` بتاريخ ${formatDate(done.created_at)}` : '';
                  })()}
                </p>
              )}
              <details className="border-t border-gray-100 px-4 py-2 text-sm">
                <summary className="cursor-pointer font-semibold text-brand-700">تتبع الطلب</summary>
                <div className="mt-3">
                  <OrderTimeline createdAt={o.created_at} events={eventsByOrder.get(o.id) ?? []} />
                </div>
              </details>
              <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                الشحن إلى: {o.ship_name}، {o.ship_line1}، {o.ship_city}، {o.ship_governorate}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
