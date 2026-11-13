import type { Metadata } from 'next';
import ProductForm from '@/components/admin/ProductForm';
import { requirePermission } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'منتج جديد' };

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePermission('products');
  const [categories, sp] = await Promise.all([getCategories(), searchParams]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">منتج جديد</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      <ProductForm categories={categories} />
    </div>
  );
}
