import type { Metadata } from 'next';
import Link from 'next/link';
import ProductGrid from '@/components/product/ProductGrid';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import { ui } from '@/lib/ui';

export const metadata: Metadata = { title: 'المفضلة' };

export default async function FavoritesPage() {
  const user = await requireUser('/account/favorites');
  const supabase = await createClient();
  const { data } = await supabase
    .from('favorites')
    .select(
      'created_at, products!inner(*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku))',
    )
    .eq('user_id', user.id)
    .eq('products.is_active', true)
    .order('created_at', { ascending: false });

  const products = ((data ?? []) as unknown as { products: Product }[]).map((r) => r.products);

  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">المفضلة</h1>
      {products.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-gray-600">لم تضف أي منتج إلى المفضلة بعد.</p>
          <Link href="/products" className={`${ui.btnPrimary} mt-4`}>تصفّح المنتجات</Link>
        </div>
      ) : (
        <ProductGrid products={products} favorites={new Set(products.map((p) => p.id))} />
      )}
    </div>
  );
}
