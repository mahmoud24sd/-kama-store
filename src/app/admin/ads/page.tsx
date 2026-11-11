import type { Metadata } from 'next';
import { deleteAdRequest, toggleAdHandled } from '@/app/actions/ads';
import { requirePermission } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'طلبات الإعلانات' };

type AdRequest = { ad_type?: string | null; ad_price?: number | null; id: string; name: string; phone: string; email: string | null; message: string | null; is_handled: boolean; created_at: string };

export default async function AdminAds() {
  const { supabase } = await requirePermission('ads');
  const { data, error } = await supabase.from('ad_requests').select('*').order('created_at', { ascending: false }).limit(200);
  const items = (data ?? []) as AdRequest[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">طلبات الإعلانات ({items.length})</h1>
      <p className="text-sm text-gray-600">من يريد الإعلان في موقعك يرسل بياناته من أسفل الموقع، وتظهر هنا.</p>
      {error && <p className={ui.alertError}>تعذّر تحميل الطلبات. شغّل ملف supabase/migrations/007_ads_visits.sql في Supabase.</p>}
      {items.length === 0 && !error && <p className="py-8 text-center text-gray-500">لا توجد طلبات بعد.</p>}
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className={`rounded-xl border p-4 ${a.is_handled ? 'border-gray-200 bg-gray-50' : 'border-amber-300 bg-amber-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 text-sm">
                <p className="font-bold">{a.name} {a.is_handled && <span className="text-xs font-normal text-green-700">✓ تم التواصل</span>}</p>
                <p><a href={`tel:${a.phone}`} dir="ltr" className="font-semibold text-brand-600">{a.phone}</a></p>
                {a.email && <p><a href={`mailto:${a.email}`} dir="ltr" className="text-brand-600">{a.email}</a></p>}
                {a.ad_type && <p className="font-semibold">النوع: {a.ad_type}</p>}
                {a.ad_price != null && <p className="font-semibold text-green-700">السعر المعروض: {a.ad_price} ج.م</p>}
                {a.message && <p className="whitespace-pre-line text-gray-700">{a.message}</p>}
                <p className="text-xs text-gray-500">{formatDate(a.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <form action={toggleAdHandled}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="handled" value={a.is_handled ? '0' : '1'} />
                  <button className={ui.btnOutline}>{a.is_handled ? 'إعادة فتح' : 'تم التواصل'}</button>
                </form>
                <form action={deleteAdRequest}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className={ui.btnDanger}>حذف</button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
