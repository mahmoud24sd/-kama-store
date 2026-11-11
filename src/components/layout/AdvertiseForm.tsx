'use client';

import { useActionState } from 'react';
import { AD_TYPES, submitAdRequest, type AdState } from '@/app/actions/ads';
import { ui } from '@/lib/ui';

export default function AdvertiseForm() {
  const [state, action, pending] = useActionState(submitAdRequest, {} as AdState);
  if (state.ok) {
    return <p className={ui.alertOk}>وصلنا طلبك، وسنتواصل معك قريبًا لتأكيد التفاصيل. شكرًا لك.</p>;
  }
  return (
    <form action={action} className="space-y-4">
      {/* حقل مخفي ضد الروبوتات: الإنسان لا يراه ولا يملؤه */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div>
        <label htmlFor="name" className={ui.label}>الاسم</label>
        <input id="name" name="name" required minLength={2} maxLength={100} className={ui.input} />
      </div>
      <div>
        <label htmlFor="phone" className={ui.label}>رقم الهاتف / واتساب</label>
        <input id="phone" name="phone" type="tel" required maxLength={30} dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="email" className={ui.label}>البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required maxLength={200} dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="ad_type" className={ui.label}>نوع الإعلان</label>
        <select id="ad_type" name="ad_type" required defaultValue="" className={ui.input}>
          <option value="" disabled>اختر نوع الإعلان</option>
          {AD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ad_price" className={ui.label}>سعر الإعلان الذي تقترحه (ج.م)</label>
        <input id="ad_price" name="ad_price" type="number" required min={0} step="1" inputMode="numeric" dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="message" className={ui.label}>تفاصيل إضافية (اختياري)</label>
        <textarea id="message" name="message" rows={3} maxLength={2000} className={ui.input} />
      </div>
      {state.error && <p className={ui.alertError}>{state.error}</p>}
      <button disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>{pending ? 'جارٍ الإرسال...' : 'أرسل طلب الإعلان'}</button>
    </form>
  );
}
