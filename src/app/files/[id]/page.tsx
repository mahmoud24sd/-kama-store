import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductGrid from '@/components/product/ProductGrid';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';

export const metadata: Metadata = { title: 'مجموعة منتجات' };

export default async function PublicFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: f } = await supabase.from('product_files').select('id,name,is_public,deleted_at').eq('id', id).eq('is_public', true).is('deleted_at', null).maybeSingle();
  if (!f) notFound();
  const { data } = await supabase
    .from('products')
    .select('*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku)')
    .eq('file_id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500);
  const products = (data ?? []) as unknown as Product[];
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-2xl font-extrabold">{f.name as string}</h1>
      {products.length === 0 ? <p className="py-8 text-center text-gray-500">لا توجد منتجات.</p> : <ProductGrid products={products} />}
    </div>
  );
}
