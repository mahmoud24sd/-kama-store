import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import { ResetCodeForm } from '@/components/auth/AuthForms';

export const metadata: Metadata = { title: 'لدي رمز استعادة' };

export default function ResetCodePage() {
  return (
    <AuthShell title="تعيين كلمة مرور جديدة" subtitle="أدخل الرمز الذي أرسله لك الدعم على واتساب (صالح 3 أيام)">
      <ResetCodeForm />
    </AuthShell>
  );
}
