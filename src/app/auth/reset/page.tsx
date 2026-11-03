import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { ResetForm } from '@/components/auth/AuthForms';
import { getUser } from '@/lib/auth';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'كلمة مرور جديدة' };

export default async function ResetPage() {
  // الجلسة تُنشأ من رابط البريد عبر /auth/callback
  const user = await getUser();
  return (
    <AuthShell title="كلمة مرور جديدة">
      {user ? (
        <ResetForm />
      ) : (
        <div className="space-y-3">
          <p className={ui.alertError}>انتهت صلاحية الرابط أو غير صالح.</p>
          <Link href="/auth/forgot" className={`${ui.btnDark} w-full`}>اطلب رابطًا جديدًا</Link>
        </div>
      )}
    </AuthShell>
  );
}
