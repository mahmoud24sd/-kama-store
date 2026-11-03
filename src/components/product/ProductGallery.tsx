'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-gray-50 text-gray-300">
        <ImageOff className="h-16 w-16" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      <div className="relative aspect-square flex-1 overflow-hidden rounded-xl bg-white">
        <Image src={images[active]} alt={name} fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-contain p-4" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sm:flex-col sm:overflow-visible">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`صورة ${i + 1}`}
              aria-current={i === active}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${i === active ? 'border-accent-500' : 'border-gray-200'}`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
