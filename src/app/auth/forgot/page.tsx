import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import { ForgotForm } from '@/components/auth/AuthForms';

export const metadata: Metadata = { title: 'استعادة كلمة المرور' };

export default function ForgotPage() {
  return (
    <AuthShell title="استعادة كلمة المرور" subtitle="أدخل بريدك وسنرسل لك رابطًا لتعيين كلمة مرور جديدة">
      <ForgotForm />
    </AuthShell>
  );
}
