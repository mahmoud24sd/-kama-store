'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleFavorite } from '@/app/actions/account';

export default function FavoriteButton({
  productId,
  initial,
  className = '',
}: {
  productId: string;
  initial: boolean;
  className?: string;
}) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={fav}
      aria-label={fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
      onClick={() =>
        start(async () => {
          const res = await toggleFavorite(productId);
          if ('needsLogin' in res) {
            router.push(`/auth/login?next=${encodeURIComponent(pathname)}`);
            return;
          }
          setFav(res.favorite);
        })
      }
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white disabled:opacity-60 ${className}`}
    >
      <Heart className={`h-5 w-5 ${fav ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
    </button>
  );
}
