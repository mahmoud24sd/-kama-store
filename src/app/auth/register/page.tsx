import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/AuthForms';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  if (await getUser()) redirect(next);

  return (
    <AuthShell title="إنشاء حساب جديد" subtitle="سجّل لتتابع طلباتك وتحفظ مفضلتك">
      <RegisterForm next={next} />
    </AuthShell>
  );
}
