'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from './CartProvider';

export default function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/10" aria-label="السلة">
      <span className="relative">
        <ShoppingCart className="h-6 w-6" />
        {ready && count > 0 && (
          <span className="absolute -top-2 -end-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-bold text-gray-900">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="hidden text-sm font-semibold lg:inline">السلة</span>
    </Link>
  );
}
