import type { Metadata } from 'next';
import { ProfileForm } from '@/components/account/AccountForms';
import { getProfile, getUser } from '@/lib/auth';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'حسابي' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const [user, profile, sp] = await Promise.all([getUser(), getProfile(), searchParams]);
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">بياناتي</h1>
      {sp.updated && <p className={`${ui.alertOk} mb-4`}>تم تحديث كلمة المرور بنجاح.</p>}
      <ProfileForm fullName={profile?.full_name ?? ''} phone={profile?.phone ?? ''} email={user?.email ?? ''} />
    </div>
  );
}
