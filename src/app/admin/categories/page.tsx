import type { Metadata } from 'next';
import { deleteCategory, saveCategory } from '@/app/actions/admin';
import { getCategories } from '@/lib/queries';
import { requireAdmin } from '@/lib/auth';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'الأقسام' };

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const [categories, sp] = await Promise.all([getCategories(), searchParams]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">الأقسام</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 font-bold">قسم جديد</h2>
        <form action={saveCategory} className="grid gap-3 sm:grid-cols-5">
          <input name="name" required placeholder="اسم القسم" className={`${ui.input} sm:col-span-2`} aria-label="اسم القسم" />
          <input name="slug" placeholder="slug (اختياري)" dir="ltr" className={ui.input} aria-label="الرابط المختصر" />
          <select name="parent_id" className={ui.input} aria-label="القسم الأب" defaultValue="">
            <option value="">قسم رئيسي</option>
            {categories.filter((c) => !c.parent_id).map((c) => <option key={c.id} value={c.id}>تابع لـ {c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input name="sort_order" type="number" min={0} defaultValue={0} className={ui.input} aria-label="الترتيب" />
            <button className={ui.btnPrimary}>إضافة</button>
          </div>
        </form>
      </section>

      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="rounded-xl border border-gray-200 p-3">
            <form action={saveCategory} className="grid items-center gap-2 sm:grid-cols-6">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} required className={`${ui.input} sm:col-span-2`} aria-label="الاسم" />
              <input name="slug" defaultValue={c.slug} dir="ltr" className={ui.input} aria-label="slug" />
              <select name="parent_id" defaultValue={c.parent_id ?? ''} className={ui.input} aria-label="القسم الأب">
                <option value="">رئيسي</option>
                {categories.filter((p) => !p.parent_id && p.id !== c.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input name="sort_order" type="number" min={0} defaultValue={c.sort_order} className={ui.input} aria-label="الترتيب" />
              <div className="flex gap-2">
                <button className={ui.btnDark}>حفظ</button>
                <button formAction={deleteCategory} className={ui.btnDanger}>حذف</button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">حذف القسم لا يحذف منتجاته؛ تصبح بدون قسم.</p>
    </div>
  );
}
