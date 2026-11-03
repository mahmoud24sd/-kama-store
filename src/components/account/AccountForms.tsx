'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addAddress, updateProfile } from '@/app/actions/account';
import type { FormState } from '@/app/actions/auth';
import { ui } from '@/lib/ui';

const initial: FormState = {};

function Feedback({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <p className={ui.alertError} role="alert">{state.error}</p>}
      {state.message && <p className={ui.alertOk} role="status">{state.message}</p>}
    </>
  );
}

export function ProfileForm({ fullName, phone, email }: { fullName: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  return (
    <form action={action} className="max-w-md space-y-4">
      <div>
        <label className={ui.label} htmlFor="email">البريد الإلكتروني</label>
        <input id="email" value={email} readOnly dir="ltr" className={`${ui.input} bg-gray-50 text-gray-500`} />
      </div>
      <div>
        <label className={ui.label} htmlFor="full_name">الاسم الكامل</label>
        <input id="full_name" name="full_name" defaultValue={fullName} required minLength={2} className={ui.input} />
      </div>
      <div>
        <label className={ui.label} htmlFor="phone">رقم الهاتف</label>
        <input id="phone" name="phone" defaultValue={phone} dir="ltr" inputMode="tel" className={ui.input} />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={ui.btnDark}>{pending ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>
    </form>
  );
}

export function AddressForm() {
  const [state, action, pending] = useActionState(addAddress, initial);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={ui.label} htmlFor="a_name">الاسم الكامل</label>
        <input id="a_name" name="full_name" required className={ui.input} />
      </div>
      <div>
        <label className={ui.label} htmlFor="a_phone">رقم الهاتف</label>
        <input id="a_phone" name="phone" required dir="ltr" inputMode="tel" className={ui.input} />
      </div>
      <div className="sm:col-span-2">
        <label className={ui.label} htmlFor="a_line">العنوان بالتفصيل</label>
        <input id="a_line" name="line1" required minLength={5} className={ui.input} />
      </div>
      <div>
        <label className={ui.label} htmlFor="a_city">المدينة / المنطقة</label>
        <input id="a_city" name="city" required className={ui.input} />
      </div>
      <div>
        <label className={ui.label} htmlFor="a_gov">المحافظة</label>
        <input id="a_gov" name="governorate" required className={ui.input} />
      </div>
      <div className="sm:col-span-2">
        <label className={ui.label} htmlFor="a_notes">ملاحظات (اختياري)</label>
        <input id="a_notes" name="notes" maxLength={300} className={ui.input} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Feedback state={state} />
        <button type="submit" disabled={pending} className={ui.btnDark}>{pending ? 'جارٍ الحفظ...' : 'إضافة العنوان'}</button>
      </div>
    </form>
  );
}
