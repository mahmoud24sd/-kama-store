import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/AuthForms';
import { getUser } from '@/lib/auth';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  if (await getUser()) redirect(next);

  return (
    <AuthShell title="تسجيل الدخول" subtitle="أهلًا بعودتك إلى Kama Store">
      {sp.error === 'link' && <p className={`${ui.alertError} mb-4`}>الرابط غير صالح أو منتهي. اطلب رابطًا جديدًا.</p>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
