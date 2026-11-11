import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import Stars from './Stars';
import FavoriteButton from './FavoriteButton';
import QuickAdd from './QuickAdd';
import { affiliateHref } from '@/lib/affiliate';
import type { Product } from '@/lib/types';
import { discountPercent, firstImage, formatPrice, totalStock } from '@/lib/utils';
import { ui } from '@/lib/ui';

export default function ProductCard({ product, isFavorite = false }: { product: Product; isFavorite?: boolean }) {
  const img = firstImage(product);
  const stock = totalStock(product);
  const discount = discountPercent(product.price, product.compare_at_price);
  const hasVariants = (product.product_variants ?? []).length > 0;
  const href = `/products/${encodeURIComponent(product.slug)}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-square bg-gray-50">
        <Link href={href} className="block h-full w-full" aria-label={product.name}>
          {img ? (
            <Image
              src={img}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-3 transition group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-gray-300">
              <ImageOff className="h-10 w-10" />
            </span>
          )}
        </Link>
        {discount > 0 && (
          <span className="absolute start-2 top-2 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">-{discount}%</span>
        )}
        <FavoriteButton productId={product.id} initial={isFavorite} className="absolute end-2 top-2" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {product.brand && <span className="text-xs text-gray-500">{product.brand}</span>}
        <Link href={href} className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-gray-900 hover:text-brand-600">
          {product.name}
        </Link>
        <Stars rating={Number(product.rating_avg)} count={product.rating_count} />

        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-1">
          <span className="text-lg font-extrabold text-gray-900">{formatPrice(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(product.compare_at_price)}</span>
          )}
        </div>

        {stock > 0 && stock <= 5 && <span className="text-xs font-semibold text-red-600">متبقي {stock} فقط</span>}

        <div className="pt-1">
          {product.affiliate_url ? (
            <a href={affiliateHref(product.affiliate_url)} target="_blank" rel="sponsored nofollow noopener noreferrer" className={`${ui.btnPrimary} w-full`}>
              اشترِ من أمازون
            </a>
          ) : hasVariants && stock > 0 ? (
            <Link href={href} className={`${ui.btnOutline} w-full`}>
              اختر الخيارات
            </Link>
          ) : (
            <QuickAdd productId={product.id} stock={stock} />
          )}
        </div>
      </div>
    </article>
  );
}
