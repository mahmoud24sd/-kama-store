import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Boxes, KeyRound, Link2, Layers, Megaphone, MessageCircle, Package, Percent, Settings, ShieldCheck, ShoppingBag, Star, Tag, Upload, UserCog, Users, Wallet } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import ChatAlert from '@/components/chat/ChatAlert';
import AutoRefresh from '@/components/chat/AutoRefresh';
import { hasPermission, type Permission } from '@/lib/permissions';

export const metadata: Metadata = { title: { default: 'لوحة التحكم', template: '%s | إدارة Kama Store' } };

type NavLink = { href: string; label: string; icon: typeof Users; perm?: Permission; owner?: boolean };

const LINKS: NavLink[] = [
  { href: '/admin', label: 'الإحصائيات', icon: BarChart3, perm: 'dashboard' },
  { href: '/admin/orders', label: 'الطلبات', icon: ShoppingBag, perm: 'orders' },
  { href: '/admin/products', label: 'المنتجات', icon: Package, perm: 'products' },
  { href: '/admin/categories', label: 'الأقسام', icon: Layers, perm: 'categories' },
  { href: '/admin/inventory', label: 'المخزون', icon: Boxes, perm: 'inventory' },
  { href: '/admin/offers', label: 'العروض', icon: Percent, perm: 'offers' },
  { href: '/admin/coupons', label: 'الكوبونات', icon: Tag, perm: 'coupons' },
  { href: '/admin/customers', label: 'العملاء', icon: Users, perm: 'users' },
  { href: '/admin/publishing', label: 'طلبات النشر', icon: Upload, perm: 'publishing' },
  { href: '/admin/chat', label: 'الدردشة', icon: MessageCircle, perm: 'chat' },
  { href: '/admin/password-requests', label: 'طلبات كلمة المرور', icon: KeyRound, perm: 'temp_password' },
  { href: '/admin/reviews', label: 'التقييمات', icon: Star, perm: 'reviews' },
  { href: '/admin/earnings', label: 'الأرباح والسحب', icon: Wallet, perm: 'withdraw' },
  { href: '/admin/users', label: 'المستخدمون', icon: UserCog, owner: true },
  { href: '/admin/team', label: 'الفريق والصلاحيات', icon: ShieldCheck, owner: true },
  { href: '/admin/telegram', label: 'بوت تليجرام', icon: Link2, perm: 'telegram_bot' },
  { href: '/admin/telegram-import', label: 'استيراد تليجرام', icon: Link2, perm: 'telegram_import' },
  { href: '/admin/sources', label: 'ربط المتاجر', icon: Link2, perm: 'sources' },
  { href: '/admin/ads', label: 'طلبات الإعلانات', icon: Megaphone, perm: 'ads' },
  { href: '/admin/settings', label: 'إعدادات التواصل', icon: Settings, perm: 'settings' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // حماية على السيرفر: غير الموظف يُعاد توجيهه (إضافة إلى middleware و RLS)
  const { profile, supabase } = await requireAdmin();
  let pendingResets = 0;
  if (hasPermission(profile, 'temp_password')) {
    try {
      const { count } = await supabase.from('password_reset_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      pendingResets = count ?? 0;
    } catch {
      pendingResets = 0;
    }
  }
  const links = LINKS.filter((l) => (l.owner ? profile.role === 'owner' : l.perm ? hasPermission(profile, l.perm) : true));
  return (
    <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
      <nav aria-label="لوحة التحكم" className="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow-sm md:flex-col md:self-start">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700">
            <Icon className="h-4 w-4" />
            {label}
            {href === '/admin/password-requests' && pendingResets > 0 && (
              <span className="min-w-5 rounded-full bg-red-600 px-1.5 text-center text-xs font-bold text-white">{pendingResets}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 rounded-xl bg-white p-4 shadow-sm sm:p-6">
        {hasPermission(profile, 'temp_password') && <AutoRefresh seconds={30} />}
        {hasPermission(profile, 'chat') && <ChatAlert />}
        {pendingResets > 0 && (
          <Link href="/admin/password-requests" className="mb-4 block rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 hover:bg-amber-100">
            🔔 عندك {pendingResets} طلب «نسيت كلمة المرور» ينتظر الرد، اضغط هنا لإرسال الرمز
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
