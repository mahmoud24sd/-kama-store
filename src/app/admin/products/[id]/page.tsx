import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';
import { requirePermission } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import type { Product, ProductPrivate } from '@/lib/types';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'تعديل منتج' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ id }, sp, { supabase }, categories] = await Promise.all([params, searchParams, requirePermission('products'), getCategories()]);
  if (!UUID.test(id)) notFound();

  const { data } = await supabase
    .from('products')
    .select('*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku)')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();
  const { data: priv } = await supabase.from('product_private').select('*').eq('product_id', id).maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">تعديل المنتج</h1>
      {sp.saved && <p className={ui.alertOk}>{sp.saved === 'published' ? 'تم نشر المنتج في المتجر.' : sp.saved === 'hidden' ? 'تم إخفاء المنتج من المتجر.' : 'تم حفظ التغييرات.'}</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      <ProductForm product={data as unknown as Product} categories={categories} privateInfo={(priv as ProductPrivate | null) ?? null} />
    </div>
  );
}
