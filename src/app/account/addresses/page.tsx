import type { Metadata } from 'next';
import { AddressForm } from '@/components/account/AccountForms';
import { deleteAddress, setDefaultAddress } from '@/app/actions/account';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Address } from '@/lib/types';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'عناوين الشحن' };

export default async function AddressesPage() {
  const user = await requireUser('/account/addresses');
  const supabase = await createClient();
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  const addresses = (data ?? []) as Address[];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-extrabold">عناوين الشحن</h1>
        {addresses.length === 0 ? (
          <p className="text-sm text-gray-600">لا توجد عناوين محفوظة.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-xl border border-gray-200 p-4 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <b>{a.full_name}</b>
                  {a.is_default && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">الافتراضي</span>}
                </div>
                <p dir="ltr" className="text-end text-gray-600">{a.phone}</p>
                <p className="mt-1 text-gray-700">{a.line1}، {a.city}، {a.governorate}</p>
                {a.notes && <p className="mt-1 text-xs text-gray-500">{a.notes}</p>}
                <div className="mt-3 flex gap-2">
                  {!a.is_default && (
                    <form action={setDefaultAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className={ui.btnOutline}>اجعله افتراضيًا</button>
                    </form>
                  )}
                  <form action={deleteAddress}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className={ui.btnGhost + ' !text-red-600'}>حذف</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-extrabold">إضافة عنوان جديد</h2>
        <AddressForm />
      </section>
    </div>
  );
}
