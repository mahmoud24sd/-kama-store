import Link from 'next/link';
import { requireUser } from '@/lib/auth';

const LINKS = [
  { href: '/account', label: 'بياناتي' },
  { href: '/account/orders', label: 'طلباتي' },
  { href: '/account/addresses', label: 'عناوين الشحن' },
  { href: '/account/favorites', label: 'المفضلة' },
  { href: '/sell', label: 'انشر منتجك' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account');
  return (
    <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
      <nav aria-label="حسابي" className="flex gap-2 overflow-x-auto rounded-xl bg-white p-2 shadow-sm md:flex-col md:self-start">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">{children}</div>
    </div>
  );
}
