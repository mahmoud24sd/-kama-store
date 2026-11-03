import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { Category } from '@/lib/types';
import { ui } from '@/lib/ui';

type Props = {
  categories: Category[];
  brands: string[];
  current: { q?: string; category?: string; brands: string[]; min?: number; max?: number; rating?: number; sort?: string; deals?: boolean };
};

/** نموذج GET عادي: يعمل بدون JavaScript، وفي الموبايل يُفتح داخل <details> */
export default function FilterSidebar({ categories, brands, current }: Props) {
  const topLevel = categories.filter((c) => !c.parent_id);

  const body = (
    <form action="/products" method="get" className="space-y-5 text-sm">
      {current.q && <input type="hidden" name="q" value={current.q} />}
      {current.sort && <input type="hidden" name="sort" value={current.sort} />}

      <div>
        <h3 className="mb-2 font-bold">القسم</h3>
        <ul className="space-y-1">
          <li>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="category" value="" defaultChecked={!current.category} /> الكل
            </label>
          </li>
          {topLevel.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="category" value={c.slug} defaultChecked={current.category === c.slug} /> {c.name}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-bold">السعر (ج.م)</h3>
        <div className="flex items-center gap-2">
          <input type="number" name="min" min={0} placeholder="من" defaultValue={current.min} className={ui.input} aria-label="السعر من" />
          <span>–</span>
          <input type="number" name="max" min={0} placeholder="إلى" defaultValue={current.max} className={ui.input} aria-label="السعر إلى" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-bold">التقييم</h3>
        <ul className="space-y-1">
          {[0, 4, 3, 2].map((r) => (
            <li key={r}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="rating" value={r === 0 ? '' : r} defaultChecked={(current.rating ?? 0) === r} />
                {r === 0 ? 'الكل' : `${r} نجوم فأكثر`}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {brands.length > 0 && (
        <div>
          <h3 className="mb-2 font-bold">العلامة التجارية</h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {brands.map((b) => (
              <li key={b}>
                <label className="flex cursor-pointer items-center gap-2" dir="auto">
                  <input type="checkbox" name="brand" value={b} defaultChecked={current.brands.includes(b)} /> {b}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 font-semibold">
        <input type="checkbox" name="deals" value="1" defaultChecked={current.deals} /> العروض فقط
      </label>

      <div className="flex gap-2">
        <button type="submit" className={`${ui.btnDark} flex-1`}>تطبيق</button>
        <Link href="/products" className={ui.btnOutline}>مسح</Link>
      </div>
    </form>
  );

  return (
    <aside>
      <details className="rounded-xl bg-white p-4 shadow-sm lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 font-bold">
          <SlidersHorizontal className="h-5 w-5" /> الفلاتر
        </summary>
        <div className="mt-4">{body}</div>
      </details>
      <div className="hidden rounded-xl bg-white p-4 shadow-sm lg:block">{body}</div>
    </aside>
  );
}
