import type { Metadata } from 'next';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { getProfile, requireUser } from '@/lib/auth';
import { cardPaymentsEnabled } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';
import type { Address } from '@/lib/types';

export const metadata: Metadata = { title: 'إتمام الطلب' };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ coupon?: string }> }) {
  const user = await requireUser('/checkout');
  const [profile, sp] = await Promise.all([getProfile(), searchParams]);

  const supabase = await createClient();
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">إتمام الطلب</h1>
      <CheckoutForm
        addresses={(data ?? []) as Address[]}
        defaultName={profile?.full_name ?? ''}
        defaultPhone={profile?.phone ?? ''}
        cardEnabled={cardPaymentsEnabled()}
        initialCoupon={sp.coupon}
      />
    </div>
  );
}
