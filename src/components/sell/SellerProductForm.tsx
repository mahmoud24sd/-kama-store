import Image from 'next/image';
import { saveSellerProduct } from '@/app/actions/sell';
import type { Category, Product } from '@/lib/types';
import { sortedImages } from '@/lib/utils';
import { ui } from '@/lib/ui';

export default function SellerProductForm({ product, categories, fee }: { product?: Product; categories: Category[]; fee: number }) {
  const images = product ? sortedImages(product) : [];
  return (
    <form action={saveSellerProduct} className="space-y-5">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="name">اسم المنتج *</label>
          <input id="name" name="name" required minLength={2} defaultValue={product?.name} className={ui.input} />
        </div>
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="shop_name">اسم المحل *</label>
          <input id="shop_name" name="shop_name" required minLength={2} defaultValue={product?.shop_name ?? ''} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="category_id">القسم</label>
          <select id="category_id" name="category_id" defaultValue={product?.category_id ?? ''} className={ui.input}>
            <option value="">— بدون قسم —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={ui.label} htmlFor="stock">الكمية المتاحة</label>
          <input id="stock" name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 1} className={ui.input} />
        </div>
        <div>
          <label className={ui.label} htmlFor="price">السعر (ج.م) *</label>
          <input id="price" name="price" type="number" min={1} step="0.01" required defaultValue={product?.price} className={ui.input} />
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

      <div>
        <span className={ui.label}>صور المنتج (حتى 6)</span>
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

      <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
        «حفظ التغييرات» يحفظ المنتج كمسودة لا تظهر للعملاء. «نشر المنتج» ينقلك لدفع رسم النشر <b>{fee} جنيه</b> عبر InstaPay أو محفظة، ويظهر المنتج في المتجر بعد تأكيد الدفع.
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="save" className={`${ui.btnOutline} px-6 py-2.5`}>حفظ التغييرات</button>
        <button type="submit" name="intent" value="publish" className={`${ui.btnPrimary} px-8 py-2.5`}>نشر المنتج</button>
      </div>
    </form>
  );
}
