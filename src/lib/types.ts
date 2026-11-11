// أنواع البيانات المطابقة لجداول supabase/schema.sql

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
};

export type ProductImage = { id: string; url: string; sort_order: number };

export type Variant = {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  price_override: number | null;
  stock: number;
  sku: string | null;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  details?: string | null;
  brand: string | null;
  shop_name?: string | null;
  affiliate_url?: string | null;
  seller_id?: string | null;
  status?: 'draft' | 'pending' | 'published' | 'rejected';
  price: number;
  compare_at_price: number | null;
  stock: number;
  sold_count: number;
  is_active: boolean;
  is_deal: boolean;
  deal_ends_at: string | null;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  product_images: ProductImage[];
  product_variants: Variant[];
  categories: { name: string; slug: string } | null;
};

export type ProductPrivate = {
  product_id: string;
  cost_price: number | null;
  supplier: string | null;
  notes: string | null;
};

export type Review = {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string | null;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'customer' | 'admin' | 'owner';
  permissions?: string[] | null;
  created_at: string;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  line1: string;
  city: string;
  governorate: string;
  notes: string | null;
  is_default: boolean;
  created_at: string;
};

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  variant_label: string | null;
  image_url: string | null;
  unit_price: number;
  quantity: number;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_method: 'cod' | 'card';
  payment_status: PaymentStatus;
  shipping_method: 'standard' | 'express';
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon_code: string | null;
  ship_name: string;
  ship_phone: string;
  ship_line1: string;
  ship_city: string;
  ship_governorate: string;
  notes: string | null;
  created_at: string;
  order_items?: OrderItem[];
};

export type Coupon = {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

/** عنصر السلة المحفوظ في المتصفح — بدون أسعار (الأسعار تُجلب وتُحسب من السيرفر) */
export type CartLineInput = {
  productId: string;
  variantId: string | null;
  qty: number;
};

/** عنصر السلة بعد جلب السعر والمخزون الحقيقيين من قاعدة البيانات */
export type CartLineDetail = {
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  stock: number;
  variantLabel: string | null;
  available: boolean;
};
