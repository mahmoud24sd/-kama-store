import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import ProductGrid from '@/components/product/ProductGrid';
import type { Product } from '@/lib/types';
import { t } from '@/lib/i18n';

export default function Section({
  title,
  href,
  products,
  favorites,
  accent = false,
}: {
  title: string;
  href?: string;
  products: Product[];
  favorites: Set<string>;
  accent?: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section className={`rounded-xl p-4 ${accent ? 'bg-gradient-to-l from-red-50 to-white ring-1 ring-red-100' : 'bg-white'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            {t('view_all')}
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
      </div>
      <ProductGrid products={products} favorites={favorites} />
    </section>
  );
}
