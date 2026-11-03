import ProductCard from './ProductCard';
import type { Product } from '@/lib/types';

export default function ProductGrid({ products, favorites }: { products: Product[]; favorites?: Set<string> }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} isFavorite={favorites?.has(p.id) ?? false} />
      ))}
    </div>
  );
}
