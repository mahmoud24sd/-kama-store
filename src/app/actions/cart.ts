'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { CartLineDetail, CartLineInput } from '@/lib/types';

const linesSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid().nullable(),
      qty: z.number().int().min(1).max(99),
    }),
  )
  .max(50);

type Row = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  is_active: boolean;
  product_images: { url: string; sort_order: number }[];
  product_variants: { id: string; color: string | null; size: string | null; price_override: number | null; stock: number }[];
};

/** يرجع الأسعار والمخزون الحقيقيين من قاعدة البيانات لعناصر السلة المحفوظة في المتصفح */
export async function getCartLines(input: CartLineInput[]): Promise<CartLineDetail[]> {
  const parsed = linesSchema.safeParse(input);
  if (!parsed.success || parsed.data.length === 0) return [];

  const supabase = await createClient();
  const ids = Array.from(new Set(parsed.data.map((l) => l.productId)));
  const { data } = await supabase
    .from('products')
    .select('id,name,slug,price,stock,is_active,product_images(url,sort_order),product_variants(id,color,size,price_override,stock)')
    .in('id', ids);

  const byId = new Map((data as unknown as Row[] | null ?? []).map((p) => [p.id, p]));

  return parsed.data.map((line): CartLineDetail => {
    const p = byId.get(line.productId);
    if (!p || !p.is_active) {
      return {
        productId: line.productId,
        variantId: line.variantId,
        name: 'منتج غير متاح',
        slug: '',
        image: null,
        unitPrice: 0,
        stock: 0,
        variantLabel: null,
        available: false,
      };
    }
    const image = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
    const hasVariants = p.product_variants.length > 0;
    const variant = line.variantId ? p.product_variants.find((v) => v.id === line.variantId) : undefined;

    // منتج له variants لا يُباع بدون اختيار variant صالح
    if (hasVariants && !variant) {
      return { productId: p.id, variantId: line.variantId, name: p.name, slug: p.slug, image, unitPrice: p.price, stock: 0, variantLabel: null, available: false };
    }
    return {
      productId: p.id,
      variantId: variant ? variant.id : null,
      name: p.name,
      slug: p.slug,
      image,
      unitPrice: variant?.price_override ?? p.price,
      stock: variant ? variant.stock : p.stock,
      variantLabel: variant ? [variant.color, variant.size].filter(Boolean).join(' / ') || null : null,
      available: (variant ? variant.stock : p.stock) > 0,
    };
  });
}

export type CouponQuote = { valid: boolean; discount: number; message: string };

export async function quoteCoupon(code: string, subtotal: number): Promise<CouponQuote> {
  const parsed = z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().min(0).max(10_000_000) }).safeParse({ code, subtotal });
  if (!parsed.success) return { valid: false, discount: 0, message: 'أدخل كود الكوبون' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('validate_coupon', { p_code: parsed.data.code, p_subtotal: parsed.data.subtotal });
  if (error || !data) return { valid: false, discount: 0, message: 'تعذر التحقق من الكوبون' };
  return data as CouponQuote;
}
