import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';
import { formatDate, formatPrice, safeDecode } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'تم استلام طلبك' };

export default async function SuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber: raw } = await params;
  const orderNumber = safeDecode(raw);
  await requireUser(`/checkout/success/${raw}`);

  // RLS تضمن أن المستخدم لا يرى إلا طلباته
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*, order_items(*)').eq('order_number', orderNumber).maybeSingle();
  if (!data) notFound();
  const order = data as unknown as Order;

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 text-center shadow-sm sm:p-10">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
      <h1 className="mt-4 text-2xl font-extrabold">تم استلام طلبك بنجاح</h1>
      <p className="mt-1 text-gray-600">سنتواصل معك على رقم الهاتف لتأكيد الشحن.</p>

      <div className="mx-auto mt-6 inline-block rounded-xl bg-gray-50 px-6 py-3">
        <p className="text-xs text-gray-500">رقم الطلب</p>
        <p className="text-xl font-extrabold tracking-wider" dir="ltr">{order.order_number}</p>
      </div>

      <dl className="mt-6 space-y-2 text-start text-sm">
        <div className="flex justify-between"><dt className="text-gray-500">التاريخ</dt><dd>{formatDate(order.created_at)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-500">طريقة الدفع</dt><dd>{order.payment_method === 'cod' ? 'الدفع عند الاستلام' : 'بطاقة بنكية'}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-500">عنوان الشحن</dt><dd className="max-w-[60%] text-end">{order.ship_line1}، {order.ship_city}، {order.ship_governorate}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-500">الشحن</dt><dd>{order.shipping === 0 ? 'مجاني' : formatPrice(order.shipping)}</dd></div>
        {order.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">الخصم</dt><dd>- {formatPrice(order.discount)}</dd></div>}
        <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-extrabold"><dt>الإجمالي</dt><dd>{formatPrice(order.total)}</dd></div>
      </dl>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account/orders" className={ui.btnDark}>عرض طلباتي</Link>
        <Link href="/products" className={ui.btnOutline}>متابعة التسوق</Link>
      </div>
    </div>
  );
}
