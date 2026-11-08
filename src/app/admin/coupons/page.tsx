import type { Metadata } from 'next';
import { deleteCoupon, saveCoupon, toggleCoupon } from '@/app/actions/admin';
import { requirePermission } from '@/lib/auth';
import type { Coupon } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الكوبونات' };

export default async function AdminCoupons({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase } = await requirePermission('coupons');
  const sp = await searchParams;
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  const coupons = (data ?? []) as Coupon[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">الكوبونات</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 font-bold">كوبون جديد</h2>
        <form action={saveCoupon} className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={ui.label} htmlFor="code">الكود</label>
            <input id="code" name="code" required dir="ltr" placeholder="SAVE10" className={`${ui.input} uppercase`} />
          </div>
          <div>
            <label className={ui.label} htmlFor="discount_type">النوع</label>
            <select id="discount_type" name="discount_type" className={ui.input}>
              <option value="percent">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت (ج.م)</option>
            </select>
          </div>
          <div>
            <label className={ui.label} htmlFor="value">القيمة</label>
            <input id="value" name="value" type="number" step="0.01" min="0.01" required className={ui.input} />
          </div>
          <div>
            <label className={ui.label} htmlFor="min_order">الحد الأدنى للطلب</label>
            <input id="min_order" name="min_order" type="number" step="0.01" min="0" defaultValue={0} className={ui.input} />
          </div>
          <div>
            <label className={ui.label} htmlFor="max_uses">أقصى عدد استخدامات (اختياري)</label>
            <input id="max_uses" name="max_uses" type="number" min="1" className={ui.input} />
          </div>
          <div>
            <label className={ui.label} htmlFor="expires_at">ينتهي في (اختياري)</label>
            <input id="expires_at" name="expires_at" type="datetime-local" className={ui.input} />
          </div>
          <div className="sm:col-span-3"><button className={ui.btnPrimary}>إضافة الكوبون</button></div>
        </form>
      </section>

      {coupons.length === 0 ? (
        <p className="py-6 text-center text-gray-500">لا توجد كوبونات.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className={ui.th}>الكود</th><th className={ui.th}>الخصم</th><th className={ui.th}>الحد الأدنى</th>
                <th className={ui.th}>الاستخدام</th><th className={ui.th}>ينتهي</th><th className={ui.th}>الحالة</th><th className={ui.th}></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className={`${ui.td} font-bold`} dir="ltr">{c.code}</td>
                  <td className={ui.td}>{c.discount_type === 'percent' ? `${c.value}%` : formatPrice(c.value)}</td>
                  <td className={ui.td}>{formatPrice(c.min_order)}</td>
                  <td className={ui.td}>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                  <td className={ui.td}>{c.expires_at ? formatDate(c.expires_at) : '—'}</td>
                  <td className={ui.td}>{c.is_active ? <span className="text-green-700">مفعّل</span> : <span className="text-gray-400">متوقف</span>}</td>
                  <td className={ui.td}>
                    <div className="flex gap-2">
                      <form action={toggleCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="is_active" value={String(!c.is_active)} />
                        <button className={ui.btnOutline}>{c.is_active ? 'إيقاف' : 'تفعيل'}</button>
                      </form>
                      <form action={deleteCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className={ui.btnDanger}>حذف</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
