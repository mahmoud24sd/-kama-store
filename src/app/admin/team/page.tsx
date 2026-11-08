import type { Metadata } from 'next';
import { demoteAdmin, promoteToAdmin, savePermissions } from '@/app/actions/team';
import UserActions from '@/components/admin/UserActions';
import { requireOwner } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/permissions';
import type { Profile } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الفريق والصلاحيات' };

export default async function AdminTeam({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase } = await requireOwner();
  const sp = await searchParams;
  const { data } = await supabase.from('profiles').select('*').eq('role', 'admin').order('created_at', { ascending: true });
  const admins = (data ?? []) as Profile[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">الفريق والصلاحيات</h1>
      {sp.saved && <p className={ui.alertOk}>تم الحفظ.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-1 font-bold">اجعله أدمن</h2>
        <p className="mb-3 text-sm text-gray-600">اكتب بريد مستخدم سجّل حسابًا في المتجر، ثم امنحه الصلاحيات المطلوبة من القائمة تحت.</p>
        <form action={promoteToAdmin} className="flex flex-wrap gap-2">
          <input name="email" type="email" required dir="ltr" placeholder="user@example.com" className={`${ui.input} max-w-sm`} aria-label="بريد المستخدم" />
          <button className={ui.btnDark}>اجعله أدمن</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold">الأدمن الحاليون ({admins.length})</h2>
        {admins.length === 0 && <p className="text-gray-500">لا يوجد أدمن بعد.</p>}
        {admins.map((a) => (
          <div key={a.id} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{a.full_name || '—'}</p>
                <p className="text-sm text-gray-600" dir="ltr">{a.email}</p>
                <p className="text-xs text-gray-500">منذ {formatDate(a.created_at)}</p>
              </div>
              <form action={demoteAdmin}>
                <input type="hidden" name="id" value={a.id} />
                <button className={ui.btnOutline}>إلغاء الأدمن</button>
              </form>
            </div>

            <form action={savePermissions} className="space-y-3">
              <input type="hidden" name="id" value={a.id} />
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-gray-700">الصلاحيات</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="permissions" value={p.key} defaultChecked={(a.permissions ?? []).includes(p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-gray-500">كل أدمن يدير الطلبات والمنتجات والمخزون والعروض والتقييمات افتراضيًا. الصلاحيات أعلاه إضافية.</p>
              <button className={ui.btnDark}>حفظ الصلاحيات</button>
            </form>

            <div className="mt-3 border-t border-gray-100 pt-3">
              <UserActions id={a.id} canTemp canDelete />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
