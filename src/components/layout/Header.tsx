import Link from 'next/link';
import { Heart, Menu, Search, User } from 'lucide-react';
import Logo from './Logo';
import CartLink from '@/components/cart/CartLink';
import { getProfile, getUser } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { signOut } from '@/app/actions/auth';
import { t } from '@/lib/i18n';

export default async function Header() {
  const [user, profile, categories] = await Promise.all([getUser(), getProfile(), getCategories()]);
  const topLevel = categories.filter((c) => !c.parent_id);
  const firstName = (profile?.full_name ?? '').split(' ')[0];

  return (
    <header className="sticky top-0 z-40 shadow-md">
      <div className="bg-brand-950 px-3 py-1.5 text-center text-xs text-white/90">{t('announce')}</div>

      <div className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <Logo />

          {/* البحث: صف مستقل في الموبايل، وسط الشريط في الشاشات الكبيرة */}
          <form action="/products" method="get" className="order-last flex w-full overflow-hidden rounded-lg bg-white md:order-none md:w-auto md:flex-1" role="search">
            <select
              name="category"
              aria-label="القسم"
              className="hidden max-w-[10rem] border-e border-gray-200 bg-gray-100 px-2 text-xs text-gray-700 focus:outline-none sm:block"
              defaultValue=""
            >
              <option value="">{t('all_categories')}</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              name="q"
              placeholder={t('search_placeholder')}
              aria-label={t('search')}
              className="min-w-0 flex-1 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <button type="submit" className="bg-accent-400 px-4 text-gray-900 hover:bg-accent-500" aria-label={t('search')}>
              <Search className="h-5 w-5" />
            </button>
          </form>

          <div className="ms-auto flex items-center gap-1 md:ms-0">
            {/* الحساب */}
            <details className="relative">
              <summary className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/10">
                <User className="h-6 w-6" />
                <span className="hidden text-sm font-semibold lg:inline">{user ? `أهلًا ${firstName || ''}` : t('account')}</span>
              </summary>
              <div className="absolute end-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 text-sm text-gray-800 shadow-xl">
                {user ? (
                  <>
                    <Link href="/account" className="block px-4 py-2 hover:bg-gray-50">
                      {t('account')}
                    </Link>
                    <Link href="/account/orders" className="block px-4 py-2 hover:bg-gray-50">
                      {t('orders')}
                    </Link>
                    <Link href="/account/addresses" className="block px-4 py-2 hover:bg-gray-50">
                      عناويني
                    </Link>
                    <Link href="/account/favorites" className="block px-4 py-2 hover:bg-gray-50">
                      {t('favorites')}
                    </Link>
                    <Link href="/sell" className="block px-4 py-2 hover:bg-gray-50">انشر منتجك</Link>
                    {(profile?.role === 'admin' || profile?.role === 'owner') && (
                      <Link href="/admin" className="block px-4 py-2 font-semibold text-brand-700 hover:bg-gray-50">
                        لوحة التحكم
                      </Link>
                    )}
                    <form action={signOut} className="mt-1 border-t border-gray-100 pt-1">
                      <button type="submit" className="block w-full px-4 py-2 text-start text-red-600 hover:bg-gray-50">
                        {t('logout')}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link href="/auth/login" className="block px-4 py-2 font-semibold hover:bg-gray-50">
                      {t('login')}
                    </Link>
                    <Link href="/auth/register" className="block px-4 py-2 hover:bg-gray-50">
                      {t('register')}
                    </Link>
                  </>
                )}
              </div>
            </details>

            <Link href="/account/favorites" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/10" aria-label={t('favorites')}>
              <Heart className="h-6 w-6" />
              <span className="hidden text-sm font-semibold lg:inline">{t('favorites')}</span>
            </Link>

            <CartLink />
          </div>
        </div>
      </div>

      {/* شريط الأقسام */}
      <nav className="bg-brand-800 text-sm text-white" aria-label="الأقسام">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 no-scrollbar">
          <Link href="/products" className="flex shrink-0 items-center gap-1.5 rounded px-3 py-2 font-semibold hover:bg-white/10">
            <Menu className="h-4 w-4" />
            {t('all_categories')}
          </Link>
          <Link href="/products?deals=1" className="shrink-0 rounded px-3 py-2 text-accent-300 hover:bg-white/10">
            {t('todays_deals')}
          </Link>
          {topLevel.map((c) => (
            <Link key={c.id} href={`/products?category=${encodeURIComponent(c.slug)}`} className="shrink-0 rounded px-3 py-2 hover:bg-white/10">
              {c.name}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
