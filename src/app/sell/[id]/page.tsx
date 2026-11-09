import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SellerProductForm from '@/components/sell/SellerProductForm';
import { requireUser } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { getPublishSettings } from '@/lib/settings';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import type { Product } from '@/lib/types';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'تعديل المنتج' };

export default async function EditSellerProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/sell/${id}`);
  if (!hasServiceRole || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;

  const db = createAdminClient();
  const { data } = await db.from('products').select('*, product_images(*)').eq('id', id).eq('seller_id', user.id).maybeSingle();
  if (!data) notFound();
  const product = { ...data, product_variants: [], categories: null } as unknown as Product;
  const [categories, { fee }] = await Promise.all([getCategories(), getPublishSettings()]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <h1 className="text-2xl font-extrabold">تعديل المنتج</h1>
      {sp.saved && <p className={ui.alertOk}>تم حفظ التغييرات.</p>}
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      {product.status === 'pending' ? (
        <p className={ui.alertError}>هذا المنتج بانتظار تأكيد الدفع ولا يمكن تعديله الآن.</p>
      ) : (
        <SellerProductForm product={product} categories={categories} fee={fee} />
      )}
    </div>
  );
}
