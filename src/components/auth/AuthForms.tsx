'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from '@/app/actions/auth';
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

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className={ui.label}>البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="password" className={ui.label}>كلمة المرور</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" className={ui.input} />
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
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  return (
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
        <label htmlFor="password" className={ui.label}>كلمة المرور (8 أحرف على الأقل)</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="confirm" className={ui.label}>تأكيد كلمة المرور</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={ui.input} />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>
        {pending ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
      </button>
      <p className="text-center text-sm">
        لديك حساب؟ <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="text-brand-600 hover:underline">سجّل الدخول</Link>
      </p>
    </form>
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
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={ui.input} />
      </div>
      <div>
        <label htmlFor="confirm" className={ui.label}>تأكيد كلمة المرور</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" dir="ltr" className={ui.input} />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${ui.btnPrimary} w-full py-2.5`}>
        {pending ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور'}
      </button>
    </form>
  );
}
