import Image from 'next/image';
import { saveProduct } from '@/app/actions/admin';
import type { Category, Product } from '@/lib/types';
import { sortedImages } from '@/lib/utils';
import { ui } from '@/lib/ui';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const images = product ? sortedImages(product) : [];
  const variantsText = (product?.product_variants ?? [])
    .map((v) => [v.color ?? '', v.size ?? '', v.stock, v.price_override ?? '', v.sku ?? ''].join(' | ').replace(/( \| )+$/, ''))
    .join('\n');

  return (
    <form action={saveProduct} className="space-y-5">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="name">اسم المنتج *</label>
          <input id="name" name="name" required minLength={2} defaultValue={product?.name} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="slug">الرابط المختصر (slug)</label>
          <input id="slug" name="slug" defaultValue={product?.slug} dir="ltr" placeholder="يُولَّد تلقائيًا إن تُرك فارغًا" className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="brand">العلامة التجارية</label>
          <input id="brand" name="brand" defaultValue={product?.brand ?? ''} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="shop_name">اسم المحل</label>
          <input id="shop_name" name="shop_name" defaultValue={product?.shop_name ?? ''} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="category_id">القسم</label>
          <select id="category_id" name="category_id" defaultValue={product?.category_id ?? ''} className={ui.input}>
            <option value="">— بدون قسم —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={ui.label} htmlFor="stock">المخزون (للمنتج بدون خيارات)</label>
          <input id="stock" name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="price">السعر (ج.م) *</label>
          <input id="price" name="price" type="number" min={0} step="0.01" required defaultValue={product?.price} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="compare_at_price">السعر قبل الخصم (اختياري)</label>
          <input id="compare_at_price" name="compare_at_price" type="number" min={0} step="0.01" defaultValue={product?.compare_at_price ?? ''} className={ui.input} />
        </div>
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="description">الوصف</label>
          <textarea id="description" name="description" rows={5} defaultValue={product?.description ?? ''} className={ui.input} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-lg bg-gray-50 p-3 text-sm">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${product?.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
          {product?.is_active ? 'منشور في المتجر' : 'مسودة (غير ظاهر للعملاء)'}
        </span>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_deal" defaultChecked={product?.is_deal ?? false} /> ضمن عروض اليوم</label>
        <label className="flex items-center gap-2">ينتهي العرض في
          <input type="datetime-local" name="deal_ends_at" defaultValue={toLocalInput(product?.deal_ends_at ?? null)} className={`${ui.input} !w-auto`} />
        </label>
      </div>

      <div>
        <label className={ui.label} htmlFor="variants">الخيارات: ألوان / مقاسات (اختياري)</label>
        <textarea
          id="variants"
          name="variants"
          rows={4}
          dir="ltr"
          defaultValue={variantsText}
          placeholder={'أسود | M | 10 | 250 | SKU-1\nأبيض | L | 5'}
          className={`${ui.input} font-mono`}
        />
        <p className="mt-1 text-xs text-gray-500">
          سطر لكل خيار بالشكل: <b>اللون | المقاس | المخزون | السعر (اختياري) | SKU (اختياري)</b>. اترك اللون أو المقاس فارغًا إن لم يلزم. عند وجود خيارات يُحسب المخزون منها.
        </p>
      </div>

      <div>
        <span className={ui.label}>صور المنتج</span>
        {images.length > 0 && (
          <ul className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {images.map((img) => (
              <li key={img.id} className="rounded-lg border border-gray-200 p-2 text-center text-xs">
                <span className="relative mx-auto mb-1 block h-20 w-20"><Image src={img.url} alt="" fill sizes="80px" className="object-contain" /></span>
                <label className="flex items-center justify-center gap-1 text-red-600"><input type="checkbox" name="delete_images" value={img.id} /> حذف</label>
              </li>
            ))}
          </ul>
        )}
        <input type="file" name="images" accept="image/*" multiple className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-white" />
        <p className="mt-1 text-xs text-gray-500">حتى 5 ميجابايت للصورة. الصورة الأولى هي الرئيسية.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" className={`${ui.btnOutline} px-6 py-2.5`}>حفظ التغييرات</button>
        <button type="submit" name="intent" value="publish" className={`${ui.btnPrimary} px-8 py-2.5`}>{product?.is_active ? 'حفظ ونشر' : 'نشر المنتج'}</button>
        {product?.is_active && <button type="submit" name="intent" value="unpublish" className={`${ui.btnDanger} px-6 py-2.5`}>إخفاء من المتجر</button>}
      </div>
    </form>
  );
}
