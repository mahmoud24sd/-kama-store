import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import AutoSubmitForm from '@/components/product/AutoSubmitForm';
import { categoryTree } from '@/lib/categoryTree';
import type { Category } from '@/lib/types';
import { ui } from '@/lib/ui';

type Props = {
  categories: Category[];
  brands: string[];
  current: { q?: string; category?: string; brands: string[]; min?: number; max?: number; rating?: number; sort?: string; deals?: boolean };
};

/** نموذج GET عادي: يعمل بدون JavaScript، وفي الموبايل يُفتح داخل <details> */
export default function FilterSidebar({ categories, brands, current }: Props) {
  const tree = categoryTree(categories);

  const body = (
    <AutoSubmitForm className="space-y-4 text-sm">
      {current.q && <input type="hidden" name="q" value={current.q} />}
      {current.sort && <input type="hidden" name="sort" value={current.sort} />}

      <div>
        <h3 className="mb-1.5 border-b border-gray-100 pb-1 font-extrabold text-brand-800">القسم</h3>
        <ul className="space-y-0.5">
          <li>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 has-[:checked]:bg-brand-100 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-300">
              <input type="radio" name="category" value="" defaultChecked={!current.category} /> الكل
            </label>
          </li>
          {tree.map(({ c, children }) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 has-[:checked]:bg-brand-100 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-300">
                <input type="radio" name="category" value={c.slug} data-was={current.category === c.slug ? 'true' : undefined} defaultChecked={current.category === c.slug} /> {c.name}
              </label>
              {children.length > 0 && (current.category === c.slug || children.some((k) => k.slug === current.category)) && (
                <ul className="mr-5 space-y-0.5 border-r border-gray-200 pr-2">
                  {children.map((k) => (
                    <li key={k.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-0.5 text-[13px] transition-colors hover:bg-gray-50 has-[:checked]:bg-brand-100 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-300">
                        <input type="radio" name="category" value={k.slug} data-was={current.category === k.slug ? 'true' : undefined} defaultChecked={current.category === k.slug} /> {k.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1.5 border-b border-gray-100 pb-1 font-extrabold text-brand-800">السعر (ج.م)</h3>
        <div className="flex items-center gap-2">
          <input type="number" name="min" min={0} placeholder="من" defaultValue={current.min} className={ui.input} aria-label="السعر من" />
          <span>–</span>
          <input type="number" name="max" min={0} placeholder="إلى" defaultValue={current.max} className={ui.input} aria-label="السعر إلى" />
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 border-b border-gray-100 pb-1 font-extrabold text-brand-800">التقييم</h3>
        <ul className="space-y-0.5">
          {[0, 4, 3, 2].map((r) => (
            <li key={r}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 has-[:checked]:bg-brand-100 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-300">
                <input type="radio" name="rating" value={r === 0 ? '' : r} defaultChecked={(current.rating ?? 0) === r} />
                {r === 0 ? 'الكل' : `${r} نجوم فأكثر`}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {brands.length > 0 && (
        <div>
          <h3 className="mb-1.5 border-b border-gray-100 pb-1 font-extrabold text-brand-800">العلامة التجارية</h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {brands.map((b) => (
              <li key={b}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 has-[:checked]:bg-brand-100 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-300" dir="auto">
                  <input type="checkbox" name="brand" value={b} defaultChecked={current.brands.includes(b)} /> {b}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50 has-[:checked]:bg-brand-100 has-[:checked]:font-bold has-[:checked]:text-brand-800 has-[:checked]:ring-1 has-[:checked]:ring-brand-300 font-semibold">
        <input type="checkbox" name="deals" value="1" defaultChecked={current.deals} /> العروض فقط
      </label>

      <div className="flex gap-2">
        <noscript><button type="submit" className={`${ui.btnDark} flex-1`}>تطبيق</button></noscript>
        <Link href="/products" className={`${ui.btnOutline} flex-1 text-center`}>مسح الفلاتر</Link>
      </div>
    </AutoSubmitForm>
  );

  return (
    <aside>
      <details className="rounded-xl bg-white p-4 shadow-sm md:hidden">
        <summary className="flex cursor-pointer items-center gap-2 font-bold">
          <SlidersHorizontal className="h-5 w-5" /> الفلاتر
        </summary>
        <div className="mt-4">{body}</div>
      </details>
      <div className="hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-brand-100 bg-white p-3 shadow-sm md:sticky md:top-24 md:block">{body}</div>
    </aside>
  );
}
