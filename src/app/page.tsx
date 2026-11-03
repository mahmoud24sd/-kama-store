import Link from 'next/link';
import { CreditCard, ShieldCheck, Truck } from 'lucide-react';
import Section from '@/components/home/Section';
import { getCategories, getFavoriteIds, getHomeData } from '@/lib/queries';
import { t } from '@/lib/i18n';
import { ui } from '@/lib/ui';

export default async function HomePage() {
  const [data, categories, favorites] = await Promise.all([getHomeData(), getCategories(), getFavoriteIds()]);
  const isEmpty = data.best.length === 0 && data.fresh.length === 0;
  const topLevel = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-5">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-brand-950 via-brand-800 to-brand-600 text-white">
        <div className="absolute -start-10 -top-10 h-56 w-56 rounded-full bg-accent-400/20 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-16 end-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative grid gap-6 px-6 py-10 md:grid-cols-2 md:px-12 md:py-16">
          <div>
            <span className="inline-block rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-gray-900">عروض Kama Store</span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">تسوّق بذكاء، <br /> ووفّر أكثر</h1>
            <p className="mt-3 max-w-md text-white/80">اكتشف عروض اليوم وأحدث المنتجات في كل الأقسام، مع شحن مجاني للطلبات فوق 1000 ج.م.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products?deals=1" className={`${ui.btnPrimary} px-6 py-3 text-base`}>تسوّق العروض</Link>
              <Link href="/products" className="inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3 text-base font-semibold hover:bg-white/10">
                تصفّح كل المنتجات
              </Link>
            </div>
          </div>
          <ul className="grid content-center gap-3 text-sm">
            {[
              { icon: Truck, text: 'شحن مجاني للطلبات فوق 1000 ج.م' },
              { icon: CreditCard, text: 'الدفع عند الاستلام متاح' },
              { icon: ShieldCheck, text: 'تقييمات من مشترين حقيقيين فقط' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
                <Icon className="h-6 w-6 text-accent-300" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* الأقسام */}
      {topLevel.length > 0 && (
        <section className="rounded-xl bg-white p-4">
          <h2 className="mb-3 text-xl font-extrabold">تسوق حسب القسم</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {topLevel.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${encodeURIComponent(c.slug)}`}
                className="flex h-20 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-2 text-center text-sm font-bold text-brand-800 transition hover:border-accent-400 hover:bg-accent-300/20"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {isEmpty && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <h2 className="text-lg font-bold">لا توجد منتجات بعد</h2>
          <p className="mt-1 text-sm text-gray-600">سجّل الدخول بحساب الإدارة وأضف أول منتج من لوحة التحكم، وستظهر الأقسام هنا تلقائيًا.</p>
          <Link href="/admin/products/new" className={`${ui.btnDark} mt-4`}>إضافة منتج</Link>
        </div>
      )}

      <Section title={t('best_sellers')} href="/products?sort=best" products={data.best} favorites={favorites} />
      <Section title={t('todays_deals')} href="/products?deals=1" products={data.deals} favorites={favorites} accent />
      <Section title={t('recommended')} href="/products?sort=rating" products={data.recommended} favorites={favorites} />
      <Section title={t('new_arrivals')} href="/products?sort=newest" products={data.fresh} favorites={favorites} />

      {data.brands.length > 0 && (
        <section className="rounded-xl bg-white p-4">
          <h2 className="mb-3 text-xl font-extrabold">{t('brands')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data.brands.map((b) => (
              <Link
                key={b}
                href={`/products?brand=${encodeURIComponent(b)}`}
                className="flex h-16 items-center justify-center rounded-xl border border-gray-200 px-2 text-center font-bold text-gray-700 transition hover:border-brand-400 hover:text-brand-700"
                dir="auto"
              >
                {b}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
