import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Boxes, Layers, MessageCircle, Package, Percent, Settings, ShieldCheck, ShoppingBag, Star, Tag, Upload, UserCog, Users, Wallet } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import ChatAlert from '@/components/chat/ChatAlert';
import { hasPermission, type Permission } from '@/lib/permissions';

export const metadata: Metadata = { title: { default: 'لوحة التحكم', template: '%s | إدارة Kama Store' } };

type NavLink = { href: string; label: string; icon: typeof Users; perm?: Permission; owner?: boolean };

const LINKS: NavLink[] = [
  { href: '/admin', label: 'الإحصائيات', icon: BarChart3, perm: 'dashboard' },
  { href: '/admin/orders', label: 'الطلبات', icon: ShoppingBag },
  { href: '/admin/products', label: 'المنتجات', icon: Package },
  { href: '/admin/categories', label: 'الأقسام', icon: Layers, perm: 'categories' },
  { href: '/admin/inventory', label: 'المخزون', icon: Boxes },
  { href: '/admin/offers', label: 'العروض', icon: Percent },
  { href: '/admin/coupons', label: 'الكوبونات', icon: Tag, perm: 'coupons' },
  { href: '/admin/customers', label: 'العملاء', icon: Users, perm: 'users' },
  { href: '/admin/publishing', label: 'طلبات النشر', icon: Upload, perm: 'publishing' },
  { href: '/admin/chat', label: 'الدردشة', icon: MessageCircle, perm: 'chat' },
  { href: '/admin/reviews', label: 'التقييمات', icon: Star },
  { href: '/admin/earnings', label: 'الأرباح والسحب', icon: Wallet, perm: 'withdraw' },
  { href: '/admin/users', label: 'المستخدمون', icon: UserCog, owner: true },
  { href: '/admin/team', label: 'الفريق والصلاحيات', icon: ShieldCheck, owner: true },
  { href: '/admin/settings', label: 'إعدادات التواصل', icon: Settings, owner: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // حماية على السيرفر: غير الموظف يُعاد توجيهه (إضافة إلى middleware و RLS)
  const { profile } = await requireAdmin();
  const links = LINKS.filter((l) => (l.owner ? profile.role === 'owner' : l.perm ? hasPermission(profile, l.perm) : true));
  return (
    <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
      <nav aria-label="لوحة التحكم" className="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow-sm md:flex-col md:self-start">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700">
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-6">
        {hasPermission(profile, 'chat') && <ChatAlert />}
        {children}
      </div>
    </div>
  );
}
