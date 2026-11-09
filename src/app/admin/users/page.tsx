import type { Metadata } from 'next';
import Link from 'next/link';
import { makeAdminWithPermissions } from '@/app/actions/team';
import { requireOwner } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import type { Profile } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المستخدمون' };


export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; saved?: string }>;
}) {
  const { supabase } = await requireOwner();
  const sp = await searchParams;

  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(300);
  const term = sp.q?.replace(/[,()%_\\*]/g, ' ').trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await query;
  const profiles = (data ?? []) as Profile[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">المستخدمون ({profiles.length})</h1>
      <p className="text-sm text-gray-600">اضغط «اجعله أدمن» بجانب أي عميل، وحدد هل يشوف المستخدمين والسحب أم لا.</p>
      {sp.saved && <p className={ui.alertOk}>تمت ترقية المستخدم إلى أدمن.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="الاسم / البريد / الهاتف" className={ui.input} />
        <button className={ui.btnOutline}>بحث</button>
      </form>

      <ul className="space-y-3">
        {profiles.map((p) => (
          <li key={p.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">
                  {p.full_name || '—'}{' '}
                  {p.role === 'owner' && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">المالك</span>}
                  {p.role === 'admin' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">أدمن</span>}
                </p>
                <p className="text-sm text-gray-600" dir="ltr">{p.email}</p>
                <p className="text-xs text-gray-500">{p.phone ? <span dir="ltr">{p.phone} · </span> : null}منذ {formatDate(p.created_at)}</p>
              </div>

              {p.role === 'admin' && (
                <Link href="/admin/team" className="text-sm text-brand-600 hover:underline">تعديل صلاحياته ←</Link>
              )}

              {p.role === 'customer' && (
                <form action={makeAdminWithPermissions} className="space-y-2 rounded-lg bg-gray-50 p-3">
                  <input type="hidden" name="id" value={p.id} />
                  <p className="text-xs font-semibold text-gray-600">اختر الصلاحيات التي تريد منحها:</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PERMISSIONS.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="permissions" value={perm.key} />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                  <button className={ui.btnDark}>اجعله أدمن</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
      {profiles.length === 0 && <p className="py-8 text-center text-gray-500">لا يوجد مستخدمون.</p>}
    </div>
  );
}
