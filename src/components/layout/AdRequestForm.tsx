'use client';

import { useActionState } from 'react';
import { submitAdRequest, type AdState } from '@/app/actions/ads';

const field =
  'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:border-accent-400 focus:outline-none';

export default function AdRequestForm() {
  const [state, action, pending] = useActionState(submitAdRequest, {} as AdState);
  if (state.ok) {
    return <p className="rounded-lg bg-green-600/20 p-3 text-green-200">وصلنا طلبك، وسنتواصل معك قريبًا. شكرًا لك.</p>;
  }
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {/* حقل مخفي ضد الروبوتات: الإنسان لا يراه ولا يملؤه */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <input name="name" required minLength={2} maxLength={100} placeholder="الاسم" aria-label="الاسم" className={field} />
      <input name="phone" required type="tel" maxLength={30} dir="ltr" placeholder="رقم الهاتف / واتساب" aria-label="رقم الهاتف" className={field} />
      <input name="email" type="email" maxLength={200} dir="ltr" placeholder="البريد الإلكتروني (اختياري)" aria-label="البريد الإلكتروني" className={`${field} sm:col-span-2`} />
      <textarea name="message" rows={3} maxLength={2000} placeholder="عن ماذا تريد أن تعلن؟ (اختياري)" aria-label="تفاصيل الإعلان" className={`${field} sm:col-span-2`} />
      {state.error && <p className="rounded-lg bg-red-600/20 p-2 text-red-200 sm:col-span-2">{state.error}</p>}
      <button disabled={pending} className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-bold text-gray-900 hover:bg-accent-500 disabled:opacity-50 sm:col-span-2">
        {pending ? 'جارٍ الإرسال...' : 'أرسل طلب الإعلان'}
      </button>
    </form>
  );
}
