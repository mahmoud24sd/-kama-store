import type { Metadata } from 'next';
import AuthShell from '@/components/auth/AuthShell';
import AdvertiseForm from '@/components/layout/AdvertiseForm';

export const metadata: Metadata = { title: 'أعلن معنا' };

export default function AdvertisePage() {
  return (
    <AuthShell title="أعلن معنا" subtitle="اترك بياناتك ونوع الإعلان والسعر الذي تقترحه، وسنتواصل معك لتأكيد التفاصيل.">
      <AdvertiseForm />
    </AuthShell>
  );
}
