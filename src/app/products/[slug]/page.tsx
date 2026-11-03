import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductGallery from '@/components/product/ProductGallery';
import PurchasePanel from '@/components/product/PurchasePanel';
import ProductGrid from '@/components/product/ProductGrid';
import ReviewForm from '@/components/product/ReviewForm';
import Stars from '@/components/product/Stars';
import { getUser } from '@/lib/auth';
import { getFavoriteIds, getProductBySlug, hasPurchased } from '@/lib/queries';
import { discountPercent, formatDate, formatPrice, safeDecode, sortedImages } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProductBySlug(safeDecode(slug));
  if (!result) return { title: 'المنتج غير موجود' };
  return {
    title: result.product.name,
    description: result.product.description?.slice(0, 160) ?? undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = safeDecode(rawSlug);
  const result = await getProductBySlug(slug);
  if (!result) notFound();

  const { product, related, reviews } = result;
  const [favorites, user] = await Promise.all([getFavoriteIds(), getUser()]);
  const canReview = user ? await hasPurchased(product.id) : false;
  const alreadyReviewed = user ? reviews.some((r) => r.user_id === user.id) : false;

  const images = sortedImages(product).map((i) => i.url);
  const discount = discountPercent(product.price, product.compare_at_price);
  const baseStock = product.stock;

  return (
    <div className="space-y-5">
      <nav className="text-sm text-gray-500" aria-label="مسار التصفح">
        <Link href="/" className="hover:underline">الرئيسية</Link>
        <span className="mx-1">/</span>
        {product.categories && (
          <>
            <Link href={`/products?category=${encodeURIComponent(product.categories.slug)}`} className="hover:underline">{product.categories.name}</Link>
            <span className="mx-1">/</span>
          </>
        )}
        <span className="text-gray-800">{product.name}</span>
      </nav>

      <div className="grid gap-6 rounded-xl bg-white p-4 shadow-sm lg:grid-cols-2 lg:p-6">
        <ProductGallery images={images} name={product.name} />

        <div className="space-y-4">
          {product.brand && (
            <Link href={`/products?brand=${encodeURIComponent(product.brand)}`} className="text-sm font-semibold text-brand-600 hover:underline" dir="auto">
              {product.brand}
            </Link>
          )}
          <h1 className="text-2xl font-extrabold leading-snug">{product.name}</h1>
          <div className="flex items-center gap-3">
            <Stars rating={Number(product.rating_avg)} count={product.rating_count} size="md" />
            {product.sold_count > 0 && <span className="text-sm text-gray-500">تم بيع {product.sold_count}+</span>}
          </div>

          {product.compare_at_price && product.compare_at_price > product.price && (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-md bg-red-600 px-2 py-0.5 font-bold text-white">-{discount}%</span>
              <span className="text-gray-500">السعر قبل الخصم: <span className="line-through">{formatPrice(product.compare_at_price)}</span></span>
            </div>
          )}

          <PurchasePanel
            productId={product.id}
            basePrice={product.price}
            baseStock={baseStock}
            variants={product.product_variants ?? []}
            isFavorite={favorites.has(product.id)}
          />

          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            شحن مجاني للطلبات فوق 1000 ج.م · الدفع عند الاستلام متاح
          </p>
        </div>
      </div>

      {product.description && (
        <section className="rounded-xl bg-white p-4 shadow-sm lg:p-6">
          <h2 className="mb-3 text-xl font-extrabold">وصف المنتج</h2>
          <p className="whitespace-pre-line leading-8 text-gray-700">{product.description}</p>
        </section>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm lg:p-6">
        <h2 className="mb-4 text-xl font-extrabold">التقييمات ({product.rating_count})</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد تقييمات بعد.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reviews.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{r.author_name || 'عميل'}</span>
                  <Stars rating={r.rating} />
                  <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-gray-100 pt-5">
          {!user ? (
            <p className="text-sm text-gray-600">
              <Link href={`/auth/login?next=${encodeURIComponent(`/products/${product.slug}`)}`} className="font-semibold text-brand-600 hover:underline">سجّل الدخول</Link> لتقييم المنتج.
            </p>
          ) : alreadyReviewed ? (
            <p className="text-sm text-gray-600">شكرًا، لقد قمت بتقييم هذا المنتج.</p>
          ) : canReview ? (
            <ReviewForm productId={product.id} slug={product.slug} />
          ) : (
            <p className="text-sm text-gray-600">يمكنك تقييم المنتج بعد شرائه.</p>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xl font-extrabold">منتجات مشابهة</h2>
          <ProductGrid products={related} favorites={favorites} />
        </section>
      )}
    </div>
  );
}
