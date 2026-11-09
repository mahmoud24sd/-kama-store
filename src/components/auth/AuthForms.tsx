'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from '@/app/actions/auth';
import { ui } from '@/lib/ui';
import { GOVERNORATES } from '@/lib/governorates';
import PasswordInput from './PasswordInput';
import { COUNTRIES } from '@/lib/countries';

const initial: FormState = {};

function Feedback({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <p className={ui.alertError} role="alert">{state.error}</p>}
      {state.message && <p className={ui.alertOk} role="status">{state.message}</p>}
    </>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <div className="space-y-4">
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className={ui.label}>البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="password" className={ui.label}>كلمة المرور</label>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>
        {pending ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
      </button>
      <div className="flex justify-between text-sm">
        <Link href="/auth/forgot" className="text-brand-600 hover:underline">نسيت كلمة المرور؟</Link>
        <Link href={`/auth/register?next=${encodeURIComponent(next)}`} className="text-brand-600 hover:underline">إنشاء حساب جديد</Link>
      </div>
    </form>
    </div>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  return (
    <div className="space-y-4">
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="full_name" className={ui.label}>الاسم الكامل</label>
        <input id="full_name" name="full_name" required minLength={2} autoComplete="name" className={ui.input} />
      </div>
      <div>
        <label htmlFor="email" className={ui.label}>البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="phone" className={ui.label}>رقم الموبايل</label>
        <div className="flex gap-2" dir="ltr">
          <select name="phone_country" aria-label="الدولة" defaultValue="20" className={`${ui.input} !w-40 shrink-0`}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.dial}>{c.name} (+{c.dial})</option>
            ))}
          </select>
          <input id="phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel-national" placeholder="1012345678" className={ui.input} />
        </div>
      </div>
      <div>
        <label htmlFor="governorate" className={ui.label}>المحافظة</label>
        <select id="governorate" name="governorate" required defaultValue="" className={ui.input}>
          <option value="" disabled>اختر المحافظة</option>
          {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="password" className={ui.label}>كلمة المرور (8 أحرف على الأقل)</label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
      </div>
      <div>
        <label htmlFor="confirm" className={ui.label}>تأكيد كلمة المرور</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>
        {pending ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
      </button>
      <p className="text-center text-sm">
        لديك حساب؟ <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="text-brand-600 hover:underline">سجّل الدخول</Link>
      </p>
    </form>
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className={ui.label}>البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={ui.input} />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>
        {pending ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
      </button>
      <p className="text-center text-sm">
        <Link href="/auth/login" className="text-brand-600 hover:underline">العودة لتسجيل الدخول</Link>
      </p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className={ui.label}>كلمة المرور الجديدة</label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
      </div>
      <div>
        <label htmlFor="confirm" className={ui.label}>تأكيد كلمة المرور</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>
        {pending ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
      </button>
    </form>
  );
}
