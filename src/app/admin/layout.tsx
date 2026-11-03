import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Boxes, Layers, Package, Percent, ShoppingBag, Star, Tag, Users } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: { default: 'لوحة التحكم', template: '%s | إدارة Kama Store' } };

const LINKS = [
  { href: '/admin', label: 'الإحصائيات', icon: BarChart3 },
  { href: '/admin/orders', label: 'الطلبات', icon: ShoppingBag },
  { href: '/admin/products', label: 'المنتجات', icon: Package },
  { href: '/admin/categories', label: 'الأقسام', icon: Layers },
  { href: '/admin/inventory', label: 'المخزون', icon: Boxes },
  { href: '/admin/offers', label: 'العروض', icon: Percent },
  { href: '/admin/coupons', label: 'الكوبونات', icon: Tag },
  { href: '/admin/customers', label: 'العملاء', icon: Users },
  { href: '/admin/reviews', label: 'التقييمات', icon: Star },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // حماية على السيرفر: غير المدير يُعاد توجيهه (إضافة إلى middleware و RLS)
  await requireAdmin();
  return (
    <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
      <nav aria-label="لوحة التحكم" className="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow-sm md:flex-col md:self-start">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700">
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-6">{children}</div>
    </div>
  );
}
