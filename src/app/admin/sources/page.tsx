import type { Metadata } from 'next';
import { addSource, deleteSource, runSourceNow, toggleSource } from '@/app/actions/sources';
import { requireOwner } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'ربط المتاجر' };
export const dynamic = 'force-dynamic';

type Src = {
  id: string; name: string; kind: string; base_url: string; markup_percent: number; rate: number; per_run: number;
  is_active: boolean; imported_total: number; last_run_at: string | null; last_status: string | null; cursor_page: number;
};

export default async function AdminSources({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { supabase } = await requireOwner();
  const sp = await searchParams;
  const [{ data, error }, { data: cats }] = await Promise.all([
    supabase.from('product_sources').select('*').order('created_at', { ascending: false }),
    supabase.from('categories').select('id,name').order('name'),
  ]);
  const sources = (data ?? []) as Src[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ربط المتاجر (سحب منتجات تلقائي)</h1>
      {sp.saved && <p className={ui.alertOk}>تم.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {error && <p className={ui.alertError}>الجدول غير جاهز. شغّل ملفي 010 و 011 في Supabase (SQL Editor).</p>}
      <p className="text-sm text-gray-600">
        أضف متجر (Shopify أو WooCommerce) تملكه أو عندك إذن من صاحبه، واختار القسم. الموقع يسحب منه منتجات جديدة كل ساعة (بدون حذف أي شيء)، بسعر البيع = سعره × سعر الصرف × (1 + نسبة الربح). سعره الأصلي يُحفظ كسعر تكلفة خاص بك.
      </p>

      <section className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-3 font-bold">إضافة متجر</h2>
        <form action={addSource} className="grid gap-3 sm:grid-cols-2">
          <div><label className={ui.label} htmlFor="name">اسم للمتجر</label><input id="name" name="name" required className={ui.input} /></div>
          <div>
            <label className={ui.label} htmlFor="kind">نوع المتجر</label>
            <select id="kind" name="kind" className={ui.input}><option value="auto">اكتشاف تلقائي (الأفضل)</option><option value="shopify">Shopify</option><option value="woocommerce">WooCommerce (ووردبريس)</option></select>
          </div>
          <div className="sm:col-span-2"><label className={ui.label} htmlFor="base_url">رابط المتجر</label><input id="base_url" name="base_url" type="url" required dir="ltr" placeholder="https://store.example.com" className={ui.input} /></div>
          <div>
            <label className={ui.label} htmlFor="category_id">القسم عندك</label>
            <select id="category_id" name="category_id" className={ui.input}><option value="">بدون قسم</option>{(cats ?? []).map((c) => <option key={c.id as string} value={c.id as string}>{c.name as string}</option>)}</select>
          </div>
          <div><label className={ui.label} htmlFor="per_run">عدد المنتجات كل ساعة</label><input id="per_run" name="per_run" type="number" min={1} max={200} defaultValue={50} className={ui.input} /></div>
          <div><label className={ui.label} htmlFor="markup_percent">نسبة الربح %</label><input id="markup_percent" name="markup_percent" type="number" step="0.1" defaultValue={20} className={ui.input} /></div>
          <div><label className={ui.label} htmlFor="rate">سعر صرف عملة المتجر للجنيه (1 لو بالجنيه)</label><input id="rate" name="rate" type="number" step="0.0001" min="0.0001" defaultValue={1} className={ui.input} /></div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="consent" className="mt-1" /> أؤكد أن المتجر ملكي أو عندي إذن من صاحبه (مورّد/شراكة) لاستخدام منتجاته وصوره.</label>
          <button className={`${ui.btnDark} sm:col-span-2`}>إضافة</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">المتاجر المربوطة ({sources.length})</h2>
        {sources.length === 0 && <p className="text-gray-500">لا توجد متاجر بعد.</p>}
        {sources.map((s) => (
          <div key={s.id} className="rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-bold">{s.name} <span className="text-xs font-normal text-gray-500">({s.kind})</span> {!s.is_active && <span className="text-red-600">— متوقف</span>}</p>
                <p dir="ltr" className="text-gray-600">{s.base_url}</p>
                <p className="text-xs text-gray-500">تم سحب {s.imported_total} منتج · {s.per_run}/ساعة · ربح {s.markup_percent}% · صرف {s.rate} · الصفحة {s.cursor_page}</p>
                <p className="text-xs text-gray-500">آخر تشغيل: {s.last_run_at ? formatDate(s.last_run_at) : 'لم يعمل بعد'} {s.last_status ? `· ${s.last_status}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={runSourceNow}><input type="hidden" name="id" value={s.id} /><button className={ui.btnPrimary}>شغّل الآن</button></form>
                <form action={toggleSource}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={s.is_active ? '0' : '1'} /><button className={ui.btnOutline}>{s.is_active ? 'إيقاف' : 'تشغيل'}</button></form>
                <form action={deleteSource}><input type="hidden" name="id" value={s.id} /><button className={ui.btnOutline}>إزالة الربط</button></form>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
