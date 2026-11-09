import { unstable_cache } from 'next/cache';
import { createClient as createPublicClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import type { Category, Product, Review } from '@/lib/types';

const PRODUCT_SELECT =
  '*, product_images(id,url,sort_order), categories(name,slug), product_variants(id,product_id,color,size,price_override,stock,sku)';

export const PAGE_SIZE = 12;

// الأقسام عامة وتُطلب في كل صفحة (الهيدر): نخزنها 60 ثانية بدل استعلام في كل نقرة
const fetchCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = createPublicClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await supabase.from('categories').select('*').order('sort_order').order('name');
    return (data ?? []) as Category[];
  },
  ['categories-v1'],
  { revalidate: 60 },
);

export async function getCategories(): Promise<Category[]> {
  return fetchCategories();
}

export async function getHomeData() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const base = () => supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true);

  const [best, deals, fresh, recommended, brandRows] = await Promise.all([
    base().order('sold_count', { ascending: false }).limit(8),
    base()
      .eq('is_deal', true)
      .or(`deal_ends_at.is.null,deal_ends_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(8),
    base().order('created_at', { ascending: false }).limit(8),
    base()
      .order('rating_avg', { ascending: false })
      .order('rating_count', { ascending: false })
      .limit(8),
    supabase.from('products').select('brand').eq('is_active', true).not('brand', 'is', null),
  ]);

  const brands = Array.from(
    new Set((brandRows.data ?? []).map((r) => (r as { brand: string }).brand).filter(Boolean)),
  ).slice(0, 12);

  return {
    best: (best.data ?? []) as unknown as Product[],
    deals: (deals.data ?? []) as unknown as Product[],
    fresh: (fresh.data ?? []) as unknown as Product[],
    recommended: (recommended.data ?? []) as unknown as Product[],
    brands,
  };
}

export type SearchParams = {
  q?: string;
  category?: string;
  brands?: string[];
  min?: number;
  max?: number;
  rating?: number;
  sort?: string;
  deals?: boolean;
  page?: number;
};

export async function searchProducts(p: SearchParams) {
  const supabase = await createClient();
  const page = Math.max(1, p.page ?? 1);
  const empty = { products: [] as Product[], total: 0, page, pages: 0 };

  let query = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('is_active', true);

  if (p.q) {
    const s = p.q.replace(/[,()%_\\*]/g, ' ').trim();
    if (s) query = query.or(`name.ilike.%${s}%,brand.ilike.%${s}%,description.ilike.%${s}%`);
  }

  if (p.category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', p.category).maybeSingle();
    if (!cat) return empty;
    const { data: kids } = await supabase.from('categories').select('id').eq('parent_id', cat.id);
    const ids = [cat.id, ...(kids ?? []).map((k) => k.id)];
    query = query.in('category_id', ids);
  }

  if (p.brands && p.brands.length > 0) query = query.in('brand', p.brands);
  if (p.min !== undefined) query = query.gte('price', p.min);
  if (p.max !== undefined) query = query.lte('price', p.max);
  if (p.rating !== undefined) query = query.gte('rating_avg', p.rating);
  if (p.deals) query = query.eq('is_deal', true);

  switch (p.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'best':
      query = query.order('sold_count', { ascending: false });
      break;
    case 'rating':
      query = query.order('rating_avg', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  return {
    products: (data ?? []) as unknown as Product[],
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getActiveBrands(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('brand').eq('is_active', true).not('brand', 'is', null);
  return Array.from(new Set((data ?? []).map((r) => (r as { brand: string }).brand).filter(Boolean))).sort();
}

export async function getProductBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  const product = data as unknown as Product;

  const [related, reviews] = await Promise.all([
    product.category_id
      ? supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .eq('is_active', true)
          .eq('category_id', product.category_id)
          .neq('id', product.id)
          .order('sold_count', { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from('reviews')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  return {
    product,
    related: (related.data ?? []) as unknown as Product[],
    reviews: (reviews.data ?? []) as Review[],
  };
}

export async function getFavoriteIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from('favorites').select('product_id').eq('user_id', user.id);
  return new Set((data ?? []).map((r) => (r as { product_id: string }).product_id));
}

/** هل اشترى المستخدم هذا المنتج (للسماح بالتقييم)؟ */
export async function hasPurchased(productId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('order_items')
    .select('id, orders!inner(user_id,status)')
    .eq('product_id', productId)
    .eq('orders.user_id', user.id)
    .neq('orders.status', 'cancelled')
    .limit(1);
  return (data ?? []).length > 0;
}
