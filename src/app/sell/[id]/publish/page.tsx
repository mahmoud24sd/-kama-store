import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { submitPublishRequest } from '@/app/actions/sell';
import { requireUser } from '@/lib/auth';
import { getContactSettings, getPublishSettings, whatsappLink } from '@/lib/settings';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'دفع رسم النشر' };

export default async function PublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/sell/${id}/publish`);
  if (!hasServiceRole || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;

  const db = createAdminClient();
  const { data: product } = await db.from('products').select('id,name,status').eq('id', id).eq('seller_id', user.id).maybeSingle();
  if (!product) notFound();
  if (product.status === 'published' || product.status === 'pending') redirect('/sell');

  const [{ instapay, fee }, contact] = await Promise.all([getPublishSettings(), getContactSettings()]);
  const wa = contact.whatsapp ? whatsappLink(contact.whatsapp) : '';

  return (
    <div className="mx-auto max-w-lg space-y-4 py-4">
      <h1 className="text-2xl font-extrabold">دفع رسم نشر المنتج</h1>
      <p className="text-sm text-gray-600">المنتج: <b>{product.name}</b></p>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <div className={`${ui.card} space-y-3 p-4`}>
        <ol className="list-decimal space-y-2 pe-5 text-sm leading-7">
          <li>افتح تطبيق <b>InstaPay</b> وحوّل مبلغ <b>{fee} جنيه</b> إلى:
            <div className="my-1 rounded-lg bg-gray-50 p-2 text-center text-base font-extrabold" dir="ltr">{instapay || 'لم يحدد المالك الحساب بعد'}</div>
          </li>
          <li>انسخ <b>رقم العملية</b> (Reference Number) الذي يظهر بعد التحويل.</li>
          <li>اكتبه أدناه وأرسل الطلب. بعد أن نتأكد من وصول التحويل ينشر المنتج.</li>
        </ol>
        {!instapay && <p className={ui.alertError}>حساب InstaPay غير مضبوط بعد. تواصل معنا قبل التحويل{wa ? ' عبر واتساب' : ''}.</p>}
      </div>

      <form action={submitPublishRequest} className="space-y-3">
        <input type="hidden" name="product_id" value={product.id} />
        <div>
          <label className={ui.label} htmlFor="payment_ref">رقم العملية *</label>
          <input id="payment_ref" name="payment_ref" required minLength={4} dir="ltr" className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="sender_phone">رقم الهاتف الذي حوّلت منه (اختياري)</label>
          <input id="sender_phone" name="sender_phone" type="tel" dir="ltr" className={ui.input} />
        </div>
        <div className="flex gap-3">
          <button type="submit" className={`${ui.btnPrimary} px-8 py-2.5`}>إرسال طلب النشر</button>
          <Link href={`/sell/${product.id}`} className={ui.btnOutline}>رجوع</Link>
        </div>
      </form>
      <p className="text-xs text-gray-500">الدفع يُراجع يدويًا. أي رقم عملية غير صحيح أو مكرر يُرفض ويُعاد المنتج كمسودة.</p>
    </div>
  );
}
