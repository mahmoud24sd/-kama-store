import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import FilterSidebar from '@/components/product/FilterSidebar';
import ProductGrid from '@/components/product/ProductGrid';
import { getActiveBrands, getCategories, getFavoriteIds, searchProducts } from '@/lib/queries';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المنتجات' };

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const num = (v: string | string[] | undefined) => {
  const s = first(v);
  if (s === undefined || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const SORTS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'best', label: 'الأكثر مبيعًا' },
  { value: 'price_asc', label: 'السعر: من الأقل للأعلى' },
  { value: 'price_desc', label: 'السعر: من الأعلى للأقل' },
  { value: 'rating', label: 'الأعلى تقييمًا' },
];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Raw> }) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() || undefined;
  const category = first(sp.category) || undefined;
  const brands = list(sp.brand).filter(Boolean);
  const min = num(sp.min);
  const max = num(sp.max);
  const rating = num(sp.rating);
  const sort = SORTS.some((x) => x.value === first(sp.sort)) ? (first(sp.sort) as string) : 'newest';
  const deals = first(sp.deals) === '1';
  const page = Math.max(1, Math.floor(num(sp.page) ?? 1));

  const [result, categories, allBrands, favorites] = await Promise.all([
    searchProducts({ q, category, brands, min, max, rating, sort, deals, page }),
    getCategories(),
    getActiveBrands(),
    getFavoriteIds(),
  ]);

  // يبني رابطًا يحافظ على الفلاتر الحالية
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q, category, min: min?.toString(), max: max?.toString(), rating: rating?.toString(), sort, deals: deals ? '1' : undefined,
    };
    Object.entries({ ...base, ...overrides }).forEach(([k, v]) => v && params.set(k, v));
    brands.forEach((b) => params.append('brand', b));
    return `/products?${params.toString()}`;
  };

  const activeCategory = categories.find((c) => c.slug === category);
  const title = q ? `نتائج البحث عن "${q}"` : activeCategory ? activeCategory.name : deals ? 'عروض اليوم' : 'كل المنتجات';

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <FilterSidebar categories={categories} brands={allBrands} current={{ q, category, brands, min, max, rating, sort, deals }} />

      <section className="min-w-0">
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div>
            <h1 className="text-lg font-extrabold">{title}</h1>
          </div>
          <div className="-mx-1 flex w-full min-w-0 items-center sm:w-auto gap-1.5 overflow-x-auto px-1 pb-1 text-sm [scrollbar-width:none]">
            <span className="shrink-0 text-gray-500">ترتيب:</span>
            {SORTS.map((s) => (
              <Link
                key={s.value}
                href={buildHref({ sort: s.value, page: undefined })}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 transition-colors ${sort === s.value ? 'border-brand-700 bg-brand-800 text-white' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {result.products.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <SearchX className="mx-auto h-12 w-12 text-gray-300" />
            <h2 className="mt-3 text-lg font-bold">لا توجد نتائج مطابقة</h2>
            <p className="mt-1 text-sm text-gray-600">جرّب كلمات بحث مختلفة أو قلّل الفلاتر المطبقة.</p>
            <Link href="/products" className={`${ui.btnDark} mt-4`}>عرض كل المنتجات</Link>
          </div>
        ) : (
          <ProductGrid products={result.products} favorites={favorites} />
        )}

        {result.pages > 1 && (
          <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="الصفحات">
            {(() => {
              const start = Math.floor((result.page - 1) / 10) * 10 + 1;
              const end = Math.min(start + 9, result.pages);
              const box = 'flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm border-gray-300 bg-white hover:bg-gray-50';
              return (
                <>
                  {start > 1 && <Link href={buildHref({ page: String(start - 1) })} className={box} aria-label="الصفحات السابقة">«</Link>}
                  {Array.from({ length: end - start + 1 }, (_, i) => start + i).map((n) => (
                    <Link
                      key={n}
                      href={buildHref({ page: n === 1 ? undefined : String(n) })}
                      aria-current={n === result.page ? 'page' : undefined}
                      className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm ${n === result.page ? 'border-brand-700 bg-brand-800 text-white' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
                    >
                      {n}
                    </Link>
                  ))}
                  {end < result.pages && <Link href={buildHref({ page: String(end + 1) })} className={box} aria-label="الصفحات التالية">»</Link>}
                </>
              );
            })()}
          </nav>
        )}
      </section>
    </div>
  );
}
