import type { Metadata } from 'next';
import SellerProductForm from '@/components/sell/SellerProductForm';
import { requireUser } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { getPublishSettings } from '@/lib/settings';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'إضافة منتج' };

export default async function NewSellerProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser('/sell/new');
  const sp = await searchParams;
  const [categories, { fee }] = await Promise.all([getCategories(), getPublishSettings()]);
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <h1 className="text-2xl font-extrabold">إضافة منتج</h1>
      {sp.error && <p className={ui.alertError}>{sp.error}</p>}
      <SellerProductForm categories={categories} fee={fee} />
    </div>
  );
}
